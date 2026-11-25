// Tests for the M4 progression loop, headless: applyFight() is the pure
// core, so a whole week of play is simulated by feeding it snapshots and
// advancing the clock — no native modules, no clock mocking.
// Scenario: earn XP → streak kept → wrong tags surface a rematch.
import {
  applyArcadeXp,
  applyFight,
  dayString,
  emptySnapshot,
  snapshotRematch,
  type FightInput,
  type ProgressionSnapshot,
} from '../progress';

const DAY = 86_400_000;
// Noon UTC — safely inside one local day on either side of the dateline.
const DAY1 = Date.UTC(2026, 10, 25, 12, 0, 0);

function fightInput(partial: Partial<FightInput> = {}): FightInput {
  return {
    nodeId: '1.1-js-basics',
    won: true,
    correctCount: 10,
    wrongCount: 0,
    bestCombo: 4,
    totalQuestions: 10,
    flawless: true,
    isBoss: false,
    wrongTags: [],
    fastAnswers: 5,
    durationMs: 60_000,
    startedAt: DAY1,
    ...partial,
  };
}

describe('applyFight: day 1 first clear', () => {
  it('banks full XP, starts a streak, clears the node, schedules a 1d rematch', () => {
    const snap = emptySnapshot('guest-test');
    const { snapshot, summary, commands } = applyFight(snap, fightInput(), DAY1);
    expect(summary.won).toBe(true);
    expect(summary.xpEarned).toBe(10 * 10 + 25); // 10 correct + flawless
    expect(summary.isFirstClear).toBe(true);
    expect(snapshot.xp).toBe(125);
    expect(snapshot.level).toBe(2);
    expect(snapshot.streak).toBe(1);
    expect(snapshot.progress['1.1-js-basics'].state).toBe('cleared');
    expect(snapshot.progress['1.1-js-basics'].nextRematchAt).toBe(DAY1 + DAY);
    // Quests: win-fights 1/2, fast-answers 5/5 → done, +10 gems.
    const fast = snapshot.quests.find(q => q.type === 'fast-answers');
    expect(fast?.done).toBe(true);
    expect(snapshot.gems).toBe(10);
    // Persistence commands cover fights + progress + users + 3 quests.
    const sqls = commands.map(c => c.sql);
    expect(sqls.some(s => s.includes('INSERT INTO fights'))).toBe(true);
    expect(sqls.some(s => s.includes('INSERT OR REPLACE INTO progress'))).toBe(true);
    expect(sqls.some(s => s.includes('UPDATE users SET xp'))).toBe(true);
    expect(sqls.filter(s => s.includes('INSERT OR REPLACE INTO quests'))).toHaveLength(3);
  });
});

describe('applyFight: rematch → mastery, streak kept', () => {
  it('a rematch win 24h+ after clearing masters the node and keeps the streak', () => {
    const day1 = applyFight(emptySnapshot('guest-test'), fightInput(), DAY1).snapshot;
    const day2 = DAY1 + DAY + 3_600_000; // next day, 13:00
    const { snapshot, summary } = applyFight(
      day1,
      fightInput({ startedAt: day2, fastAnswers: 2 }),
      day2,
    );
    expect(summary.isRematch).toBe(true);
    expect(summary.mastered).toBe(true);
    expect(snapshot.progress['1.1-js-basics'].state).toBe('mastered');
    expect(snapshot.progress['1.1-js-basics'].wrongTags).toEqual([]);
    expect(snapshot.progress['1.1-js-basics'].nextRematchAt).toBeNull();
    expect(snapshot.streak).toBe(2);
    // Day-2 quests are a fresh set: the rematch win completes clear-rematch
    // (+15) and puts win-fights at 1/2. Total gems: 10 (day 1 fast) + 15.
    expect(snapshot.quests.find(q => q.type === 'clear-rematch')?.done).toBe(true);
    expect(snapshot.quests.find(q => q.type === 'win-fights')?.progress).toBe(1);
    expect(snapshot.gems).toBe(25);
  });

  it('a same-day replay win pays 10% XP and does NOT master yet', () => {
    const day1 = applyFight(emptySnapshot('guest-test'), fightInput(), DAY1).snapshot;
    const { snapshot, summary } = applyFight(
      day1,
      fightInput({ startedAt: DAY1 + 3_600_000, flawless: false, correctCount: 8, fastAnswers: 0 }),
      DAY1 + 3_600_000,
    );
    expect(summary.mastered).toBe(false);
    expect(snapshot.progress['1.1-js-basics'].state).toBe('cleared');
    expect(summary.xpEarned).toBe(Math.round(8 * 10 * 0.1));
    expect(snapshot.streak).toBe(1); // same day: streak untouched
  });
});

describe('applyFight: losses, wrong tags, rematch surfacing', () => {
  it('a loss banks wrong tags and the rematch card surfaces once due', () => {
    const snap = emptySnapshot('guest-test');
    const lost = fightInput({
      nodeId: '1.2-css-basics',
      won: false,
      correctCount: 3,
      wrongCount: 5,
      bestCombo: 1,
      flawless: false,
      wrongTags: ['1.2-q03', '1.2-q07'],
      fastAnswers: 0,
      startedAt: DAY1,
    });
    const afterLoss = applyFight(snap, lost, DAY1).snapshot;
    const row = afterLoss.progress['1.2-css-basics'];
    expect(row.state).toBe('open');
    expect(row.wrongTags).toEqual(['1.2-q03', '1.2-q07']);
    // Not due yet (rematch is tomorrow).
    expect(snapshotRematch(afterLoss, DAY1)).toBeNull();
    // A day later it surfaces as the weak-area rematch.
    const due = snapshotRematch(afterLoss, DAY1 + DAY + 1);
    expect(due?.nodeId).toBe('1.2-css-basics');
  });
});

describe('applyFight: streak breaks and freezes', () => {
  it('a 3-day gap without a freeze resets the streak to 1', () => {
    let snap = applyFight(emptySnapshot('guest-test'), fightInput(), DAY1).snapshot;
    const threeDaysLater = applyFight(
      snap,
      fightInput({ startedAt: DAY1 + 3 * DAY }),
      DAY1 + 3 * DAY,
    );
    expect(threeDaysLater.summary.streakBroke).toBe(true);
    expect(threeDaysLater.snapshot.streak).toBe(1);
    snap = threeDaysLater.snapshot;
    expect(snap.lastPlayedDay).toBe(dayString(DAY1 + 3 * DAY));
  });

  it('7 straight days earns a freeze, and the freeze saves the streak', () => {
    let snap: ProgressionSnapshot = emptySnapshot('guest-test');
    for (let d = 0; d < 7; d++) {
      const now = DAY1 + d * DAY;
      snap = applyFight(
        snap,
        fightInput({ nodeId: '1.1-js-basics', startedAt: now, flawless: d === 0 }),
        now,
      ).snapshot;
    }
    expect(snap.streak).toBe(7);
    expect(snap.streakFreeze).toBe(1); // earned at day 7
    // Miss one day (day 9 = 2-day gap): freeze is spent, streak kept.
    const day9 = DAY1 + 8 * DAY;
    const res = applyFight(snap, fightInput({ startedAt: day9 }), day9);
    expect(res.summary.freezeUsed).toBe(true);
    expect(res.snapshot.streak).toBe(8);
    expect(res.snapshot.streakFreeze).toBe(0);
  });
});

describe('applyFight: daily quest rollover', () => {
  it('quests reset to a fresh set on a new day', () => {
    const day1 = applyFight(emptySnapshot('guest-test'), fightInput(), DAY1).snapshot;
    expect(day1.quests.find(q => q.type === 'fast-answers')?.done).toBe(true);
    const day2 = applyFight(
      day1,
      fightInput({ startedAt: DAY1 + DAY, fastAnswers: 0, flawless: false, correctCount: 6 }),
      DAY1 + DAY,
    ).snapshot;
    const fast = day2.quests.find(q => q.type === 'fast-answers');
    expect(fast?.progress).toBe(0);
    expect(fast?.done).toBe(false);
    expect(day2.questDay).toBe(dayString(DAY1 + DAY));
  });
});

describe('applyArcadeXp: arcade runs bank XP without touching quests or nodes', () => {
  it('banks the XP, bumps the level, starts the streak, and leaves quests/nodes alone', () => {
    const snap = emptySnapshot('guest-test');
    const { snapshot, commands } = applyArcadeXp(snap, 12, DAY1);
    expect(snapshot.xp).toBe(12);
    expect(snapshot.level).toBe(1); // 12 XP is still level 1
    expect(snapshot.streak).toBe(1);
    expect(snapshot.lastPlayedDay).toBe(dayString(DAY1));
    expect(snapshot.quests).toEqual([]);
    expect(snapshot.progress).toEqual({});
    const sqls = commands.map(c => c.sql);
    expect(sqls.some(s => s.includes('INSERT OR IGNORE INTO users'))).toBe(true);
    expect(sqls.some(s => s.includes('UPDATE users SET xp'))).toBe(true);
    expect(sqls.some(s => s.includes('INSERT INTO fights'))).toBe(false);
    expect(sqls.some(s => s.includes('quests'))).toBe(false);
  });

  it('levels up at 100 XP and never pays negative XP', () => {
    const snap = emptySnapshot('guest-test');
    snap.xp = 95;
    const { snapshot } = applyArcadeXp(snap, 25, DAY1);
    expect(snapshot.xp).toBe(120);
    expect(snapshot.level).toBe(2);
    const zero = applyArcadeXp(emptySnapshot('guest-test'), -5, DAY1).snapshot;
    expect(zero.xp).toBe(0);
  });

  it('a same-day arcade run keeps the streak; a next-day run grows it', () => {
    const day1 = applyArcadeXp(emptySnapshot('guest-test'), 5, DAY1).snapshot;
    expect(day1.streak).toBe(1);
    const sameDay = applyArcadeXp(day1, 5, DAY1 + 60_000).snapshot;
    expect(sameDay.streak).toBe(1);
    const nextDay = applyArcadeXp(day1, 5, DAY1 + DAY).snapshot;
    expect(nextDay.streak).toBe(2);
  });
});
