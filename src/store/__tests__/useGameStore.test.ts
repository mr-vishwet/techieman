// Tests for the M4 store: hydrate (in-memory fallback when the native
// module is unavailable, as under Jest) and finishFight state transitions.
// Persistence failures must never break the fight — the store catches them.
import { useGameStore } from '../useGameStore';
import type { FightInput } from '../../storage/progress';

function resetStore() {
  useGameStore.setState({
    userId: null,
    hydrated: false,
    xp: 0,
    level: 1,
    gems: 0,
    streak: 0,
    streakFreeze: 0,
    lastPlayedDay: null,
    clearedNodeIds: [],
    masteredNodeIds: [],
    quests: [],
    questDay: '',
    rematchNodeId: null,
    rematchTag: null,
    snapshot: null,
    currentNodeId: null,
  });
}

function winInput(partial: Partial<FightInput> = {}): Omit<FightInput, 'nodeId'> {
  return {
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
    startedAt: Date.now() - 60_000,
    ...partial,
  };
}

describe('useGameStore hydrate', () => {
  beforeEach(resetStore);

  it('hydrates in-memory when SQLite is unavailable and deals today quests', async () => {
    await useGameStore.getState().hydrate();
    const s = useGameStore.getState();
    expect(s.hydrated).toBe(true);
    expect(s.userId).toMatch(/^guest-/);
    expect(s.quests).toHaveLength(3);
    expect(s.xp).toBe(0);
    expect(s.level).toBe(1);
  });
});

describe('useGameStore finishFight', () => {
  beforeEach(resetStore);

  it('a first-clear win banks XP, clears the node, starts a streak', async () => {
    await useGameStore.getState().hydrate();
    const summary = useGameStore.getState().finishFight('1.1-js-basics', winInput());
    expect(summary.won).toBe(true);
    expect(summary.xpEarned).toBe(125);
    const s = useGameStore.getState();
    expect(s.xp).toBe(125);
    expect(s.level).toBe(2);
    expect(s.clearedNodeIds).toContain('1.1-js-basics');
    expect(s.streak).toBe(1);
    expect(s.gems).toBe(10); // fast-answers quest completed
    expect(s.rematchNodeId).toBeNull(); // rematch is tomorrow, not due yet
  });

  it('a loss records wrong tags but never un-clears, and never throws', async () => {
    await useGameStore.getState().hydrate();
    useGameStore.getState().finishFight('1.1-js-basics', winInput());
    const summary = useGameStore.getState().finishFight(
      '1.2-css-basics',
      winInput({ won: false, correctCount: 3, wrongCount: 5, flawless: false, fastAnswers: 0, wrongTags: ['1.2-q03'] }),
    );
    expect(summary.won).toBe(false);
    expect(summary.xpEarned).toBe(0); // plan §2.2: a lost fight pays no XP
    const s = useGameStore.getState();
    expect(s.clearedNodeIds).toContain('1.1-js-basics');
    expect(s.clearedNodeIds).not.toContain('1.2-css-basics');
    expect(s.streak).toBe(1); // same-day activity keeps the streak
  });
});
