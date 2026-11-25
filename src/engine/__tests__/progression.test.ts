// Tests for the M4 progression engine (pure — no clock, no native code).
import {
  XP_PER_LEVEL,
  applyFightToProgress,
  applyFightToQuests,
  dayDiff,
  generateDailyQuests,
  levelForXp,
  maybeEarnFreeze,
  nextRematchAtMs,
  pickRematch,
  updateStreak,
  xpToNextLevel,
  type ProgressRow,
} from '../progression';

const DAY = 86_400_000;

function row(partial: Partial<ProgressRow> = {}): ProgressRow {
  return {
    nodeId: '1.1-js-basics',
    state: 'open',
    bestCombo: 0,
    lastPlayedAt: null,
    nextRematchAt: null,
    wrongTags: [],
    rematchWins: 0,
    ...partial,
  };
}

describe('levels', () => {
  it('level 1 at 0 XP, level 2 at 100 XP', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(250)).toBe(3);
  });
  it('xpToNextLevel counts down to the next boundary', () => {
    expect(xpToNextLevel(0)).toBe(XP_PER_LEVEL);
    expect(xpToNextLevel(90)).toBe(10);
    expect(xpToNextLevel(100)).toBe(XP_PER_LEVEL);
  });
});

describe('dayDiff', () => {
  it('counts whole days between YYYY-MM-DD strings', () => {
    expect(dayDiff('2026-11-25', '2026-11-25')).toBe(0);
    expect(dayDiff('2026-11-25', '2026-11-26')).toBe(1);
    expect(dayDiff('2026-11-25', '2026-11-28')).toBe(3);
  });
});

describe('updateStreak', () => {
  it('first ever fight starts a streak of 1', () => {
    expect(updateStreak({ lastPlayedDay: null, streak: 0, freezes: 0 }, '2026-11-25')).toEqual(
      { streak: 1, freezes: 0, freezeUsed: false, broke: false },
    );
  });
  it('same-day fight leaves the streak alone', () => {
    expect(updateStreak({ lastPlayedDay: '2026-11-25', streak: 4, freezes: 0 }, '2026-11-25').streak).toBe(4);
  });
  it('next-day fight increments', () => {
    expect(updateStreak({ lastPlayedDay: '2026-11-25', streak: 4, freezes: 0 }, '2026-11-26').streak).toBe(5);
  });
  it('one missed day with a freeze spends the freeze and keeps the streak', () => {
    const r = updateStreak({ lastPlayedDay: '2026-11-25', streak: 4, freezes: 1 }, '2026-11-27');
    expect(r).toEqual({ streak: 5, freezes: 0, freezeUsed: true, broke: false });
  });
  it('one missed day without a freeze breaks the streak', () => {
    const r = updateStreak({ lastPlayedDay: '2026-11-25', streak: 4, freezes: 0 }, '2026-11-27');
    expect(r.streak).toBe(1);
    expect(r.broke).toBe(true);
  });
});

describe('rematch intervals', () => {
  it('spaced repetition is 1d then 3d then 7d', () => {
    expect(nextRematchAtMs(0, 0)).toBe(1 * DAY);
    expect(nextRematchAtMs(0, 1)).toBe(3 * DAY);
    expect(nextRematchAtMs(0, 2)).toBe(7 * DAY);
    expect(nextRematchAtMs(0, 9)).toBe(7 * DAY); // capped
  });
});

describe('daily quests', () => {
  it('generates exactly the 3 quests, deterministic per day', () => {
    const a = generateDailyQuests('2026-11-25');
    const b = generateDailyQuests('2026-11-25');
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(a.map(q => q.type)).toEqual(['win-fights', 'clear-rematch', 'fast-answers']);
    expect(a.every(q => q.expiresAt === '2026-11-25' && !q.done)).toBe(true);
  });
});

describe('pickRematch', () => {
  it('returns null when nothing is due', () => {
    expect(pickRematch([row()], Date.now())).toBeNull();
    expect(
      pickRematch([row({ wrongTags: ['keys'], nextRematchAt: Date.now() + DAY })], Date.now()),
    ).toBeNull();
  });
  it('picks the due node with the most wrong tags, earliest first on ties', () => {
    const now = 10 * DAY;
    const a = row({ nodeId: 'a', wrongTags: ['x'], nextRematchAt: 5 * DAY });
    const b = row({ nodeId: 'b', wrongTags: ['x', 'y'], nextRematchAt: 6 * DAY });
    const c = row({ nodeId: 'c', wrongTags: ['x', 'y'], nextRematchAt: 4 * DAY });
    expect(pickRematch([a, b, c], now)?.nodeId).toBe('c');
  });
});

describe('applyFightToQuests', () => {
  it('a win advances win-fights, a rematch win advances clear-rematch, fast answers count', () => {
    const quests = generateDailyQuests('2026-11-25');
    const { quests: q1, gemsEarned: g1 } = applyFightToQuests(quests, {
      won: true,
      isRematch: false,
      fastAnswers: 5,
    });
    expect(q1.find(q => q.type === 'win-fights')?.progress).toBe(1);
    expect(q1.find(q => q.type === 'clear-rematch')?.progress).toBe(0);
    expect(q1.find(q => q.type === 'fast-answers')?.done).toBe(true);
    expect(g1).toBe(10); // fast-answers reward only
    const { quests: q2, gemsEarned: g2 } = applyFightToQuests(q1, {
      won: true,
      isRematch: true,
      fastAnswers: 0,
    });
    expect(q2.find(q => q.type === 'win-fights')?.done).toBe(true);
    expect(q2.find(q => q.type === 'clear-rematch')?.done).toBe(true);
    expect(g2).toBe(10 + 15); // win-fights + clear-rematch rewards
  });
  it('a loss advances nothing', () => {
    const quests = generateDailyQuests('2026-11-25');
    const { quests: q1, gemsEarned } = applyFightToQuests(quests, {
      won: false,
      isRematch: false,
      fastAnswers: 0,
    });
    expect(q1.every(q => q.progress === 0)).toBe(true);
    expect(gemsEarned).toBe(0);
  });
  it('a completed quest never pays twice', () => {
    const quests = generateDailyQuests('2026-11-25');
    const once = applyFightToQuests(quests, { won: true, isRematch: false, fastAnswers: 5 });
    const twice = applyFightToQuests(once.quests, { won: true, isRematch: false, fastAnswers: 5 });
    expect(twice.gemsEarned).toBe(10); // only the win-fights completion, fast already paid
  });
});

describe('maybeEarnFreeze', () => {
  it('banks a freeze on day 7, never holds more than 1', () => {
    expect(maybeEarnFreeze(6, 7, 0)).toBe(1);
    expect(maybeEarnFreeze(6, 7, 1)).toBe(1);
    expect(maybeEarnFreeze(13, 14, 0)).toBe(1);
    expect(maybeEarnFreeze(5, 6, 0)).toBe(0);
  });
});

describe('applyFightToProgress', () => {
  it('a win clears an open node and schedules a 1d rematch', () => {
    const r = applyFightToProgress(row(), true, 3, [], 1000, false);
    expect(r.state).toBe('cleared');
    expect(r.bestCombo).toBe(3);
    expect(r.nextRematchAt).toBe(1000 + DAY);
  });
  it('a loss never un-clears, but adds tags and schedules a rematch', () => {
    const cleared = row({ state: 'cleared', lastPlayedAt: 0 });
    const r = applyFightToProgress(cleared, false, 2, ['keys'], 5000, false);
    expect(r.state).toBe('cleared');
    expect(r.wrongTags).toEqual(['keys']);
    expect(r.nextRematchAt).toBe(5000 + DAY);
  });
  it('a rematch win 24h+ after clearing masters the node and clears tags', () => {
    const cleared = row({ state: 'cleared', lastPlayedAt: 0, wrongTags: ['keys'], nextRematchAt: DAY });
    const r = applyFightToProgress(cleared, true, 4, [], 2 * DAY, true);
    expect(r.state).toBe('mastered');
    expect(r.wrongTags).toEqual([]);
    expect(r.nextRematchAt).toBeNull();
  });
  it('a same-day rematch win does NOT master yet', () => {
    const cleared = row({ state: 'cleared', lastPlayedAt: 0, wrongTags: ['keys'] });
    const r = applyFightToProgress(cleared, true, 4, [], 1000, true);
    expect(r.state).toBe('cleared');
  });
});
