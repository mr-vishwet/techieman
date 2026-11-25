// Tests for Arcade Mode persistence — best score + run history (MMKV,
// in-memory fallback under Jest). The anti-farm contract lives here too:
// XP is new-best-only, so a run that does not beat the best banks 0 XP.
import {
  __resetArcadeForTests,
  loadArcadeBest,
  loadArcadeRuns,
  loadArcadeSummary,
  recordArcadeRun,
  type ArcadeRunInput,
} from '../arcade';

function runInput(partial: Partial<ArcadeRunInput> = {}): ArcadeRunInput {
  return {
    score: 1240,
    wave: 7,
    kills: 21,
    bestCombo: 5,
    correct: 21,
    wrong: 2,
    durationMs: 180_000,
    endedAt: 1_700_000_000_000,
    ...partial,
  };
}

beforeEach(() => {
  __resetArcadeForTests();
});

describe('recordArcadeRun: first run', () => {
  it('sets the best, flags newBest, banks floor(score/100) XP capped at 25', () => {
    const record = recordArcadeRun(runInput());
    expect(record.newBest).toBe(true);
    expect(record.xpEarned).toBe(12); // floor(1240/100)
    expect(loadArcadeBest()).toEqual({ score: 1240, wave: 7, at: 1_700_000_000_000 });
    expect(loadArcadeRuns()).toHaveLength(1);
    expect(loadArcadeSummary().totalRuns).toBe(1);
  });

  it('caps XP at 25 on a huge first score', () => {
    const record = recordArcadeRun(runInput({ score: 99999 }));
    expect(record.newBest).toBe(true);
    expect(record.xpEarned).toBe(25);
  });
});

describe('recordArcadeRun: later runs', () => {
  it('a worse run does not move the best and banks 0 XP', () => {
    recordArcadeRun(runInput());
    const worse = recordArcadeRun(runInput({ score: 900, wave: 5, endedAt: 1_700_000_001_000 }));
    expect(worse.newBest).toBe(false);
    expect(worse.xpEarned).toBe(0);
    expect(loadArcadeBest()?.score).toBe(1240);
    expect(loadArcadeRuns()).toHaveLength(2);
    expect(loadArcadeRuns()[0].score).toBe(900); // newest first
  });

  it('an equal score is not a new best', () => {
    recordArcadeRun(runInput());
    const equal = recordArcadeRun(runInput({ endedAt: 1_700_000_001_000 }));
    expect(equal.newBest).toBe(false);
    expect(equal.xpEarned).toBe(0);
  });

  it('a better run replaces the best and banks XP on the new score', () => {
    recordArcadeRun(runInput());
    const better = recordArcadeRun(runInput({ score: 1500, wave: 8, endedAt: 1_700_000_001_000 }));
    expect(better.newBest).toBe(true);
    expect(better.xpEarned).toBe(15);
    expect(loadArcadeBest()).toEqual({ score: 1500, wave: 8, at: 1_700_000_001_000 });
  });

  it('run history caps at 10, newest first', () => {
    for (let i = 0; i < 12; i++) {
      recordArcadeRun(runInput({ score: 100 + i, endedAt: 1_700_000_000_000 + i * 1000 }));
    }
    const runs = loadArcadeRuns();
    expect(runs).toHaveLength(10);
    expect(runs[0].score).toBe(111); // the last recorded run
    expect(runs[9].score).toBe(102); // the 10th-newest; the two oldest dropped
  });
});

describe('loadArcadeSummary with no runs', () => {
  it('returns null best and an empty history', () => {
    expect(loadArcadeSummary()).toEqual({ best: null, runs: [], totalRuns: 0 });
  });
});
