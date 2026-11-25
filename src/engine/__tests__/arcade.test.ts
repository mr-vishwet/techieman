// Tests for the Arcade Mode engine — the numbers in ARCADE_MODE_SPEC.md
// are the contract; these tests assert them exactly. Pure + deterministic:
// every run here uses a fixed seed, so the same answers always give the
// same waves, questions, and scores.
import {
  ARCADE_MAX_LIVES,
  answerArcadeBeat,
  arcadeRosterSize,
  arcadeXpForRun,
  createArcadeRun,
  creaturesDownInWave,
  currentCreature,
  difficultyRangeForWave,
  generateWave,
  isBossWave,
  sampleQuestions,
  scoreForHit,
  timerSecondsForWave,
  waveClearBonus,
  waveSizeForWave,
  type ArcadeRunState,
} from '../arcade';
import { ALL_QUESTIONS } from '../../data/allQuestions';
import type { Question } from '../../data/questions';

function answerCorrectNTimes(state: ArcadeRunState, n: number): ArcadeRunState {
  let s = state;
  for (let i = 0; i < n && s.status === 'running'; i++) {
    s = answerArcadeBeat(s, true, 5, ALL_QUESTIONS).state;
  }
  return s;
}

describe('wave curves', () => {
  it('timer shrinks 15 → 8 and floors at 8', () => {
    expect(timerSecondsForWave(1)).toBe(15);
    expect(timerSecondsForWave(2)).toBe(14);
    expect(timerSecondsForWave(7)).toBe(9);
    expect(timerSecondsForWave(8)).toBe(8);
    expect(timerSecondsForWave(20)).toBe(8);
  });

  it('wave size grows 3 → 8 and caps at 8', () => {
    expect(waveSizeForWave(1)).toBe(3);
    expect(waveSizeForWave(2)).toBe(3);
    expect(waveSizeForWave(3)).toBe(4);
    expect(waveSizeForWave(9)).toBe(7);
    expect(waveSizeForWave(11)).toBe(8);
    expect(waveSizeForWave(50)).toBe(8);
  });

  it('difficulty band widens with the wave', () => {
    expect(difficultyRangeForWave(1)).toEqual({ min: 1, max: 2 });
    expect(difficultyRangeForWave(3)).toEqual({ min: 1, max: 3 });
    expect(difficultyRangeForWave(5)).toEqual({ min: 2, max: 4 });
    expect(difficultyRangeForWave(7)).toEqual({ min: 2, max: 5 });
    expect(difficultyRangeForWave(8)).toEqual({ min: 2, max: 5 });
    expect(difficultyRangeForWave(10)).toEqual({ min: 2, max: 5 });
    expect(difficultyRangeForWave(99)).toEqual({ min: 2, max: 5 });
  });

  it('every 5th wave is a boss wave', () => {
    expect(isBossWave(4)).toBe(false);
    expect(isBossWave(5)).toBe(true);
    expect(isBossWave(10)).toBe(true);
    expect(isBossWave(11)).toBe(false);
  });

  it('wave-clear bonus is 50 × wave', () => {
    expect(waveClearBonus(1)).toBe(50);
    expect(waveClearBonus(5)).toBe(250);
  });
});

describe('scoreForHit', () => {
  it('instant answer at combo 0 is 200 (100 base + 100 speed)', () => {
    expect(scoreForHit(0, 15, 0)).toBe(200);
  });

  it('answering on the deadline earns no speed bonus', () => {
    expect(scoreForHit(15, 15, 0)).toBe(100);
    expect(scoreForHit(8, 8, 0)).toBe(100);
  });

  it('half the timer earns half the speed bonus', () => {
    expect(scoreForHit(7.5, 15, 0)).toBe(150);
  });

  it('combo multiplier follows the campaign ladder', () => {
    expect(scoreForHit(0, 15, 1)).toBe(200); // ×1.0
    expect(scoreForHit(0, 15, 2)).toBe(250); // ×1.25
    expect(scoreForHit(0, 15, 3)).toBe(300); // ×1.5
    expect(scoreForHit(0, 15, 4)).toBe(400); // ×2.0
    expect(scoreForHit(0, 15, 9)).toBe(400); // capped at ×2.0
  });

  it('boss kills pay double', () => {
    expect(scoreForHit(0, 15, 0, true)).toBe(400);
    expect(scoreForHit(15, 15, 2, true)).toBe(250);
  });
});

describe('arcadeXpForRun', () => {
  it('pays floor(score/100) only on a new best, capped at 25', () => {
    expect(arcadeXpForRun(1240, 1000)).toBe(12);
    expect(arcadeXpForRun(99999, 0)).toBe(25);
    expect(arcadeXpForRun(100, null)).toBe(1);
    expect(arcadeXpForRun(0, null)).toBe(0);
  });

  it('pays 0 XP when the best is not beaten (no farming)', () => {
    expect(arcadeXpForRun(900, 1000)).toBe(0);
    expect(arcadeXpForRun(1000, 1000)).toBe(0);
  });
});

describe('sampleQuestions', () => {
  it('draws unique questions inside the difficulty band', () => {
    const { questions, usedIds } = sampleQuestions(
      8,
      new Set<string>(),
      ALL_QUESTIONS,
      { min: 1, max: 2 },
      1234,
    );
    expect(questions).toHaveLength(8);
    expect(new Set(questions.map(q => q.id)).size).toBe(8);
    expect(questions.every(q => q.difficulty >= 1 && q.difficulty <= 2)).toBe(true);
    expect(usedIds.size).toBe(8);
  });

  it('never repeats a question id already used in the run', () => {
    const first = sampleQuestions(5, new Set<string>(), ALL_QUESTIONS, { min: 1, max: 5 }, 99);
    const second = sampleQuestions(5, first.usedIds, ALL_QUESTIONS, { min: 1, max: 5 }, first.rngState);
    const overlap = second.questions.filter(q => first.usedIds.has(q.id));
    expect(overlap).toHaveLength(0);
  });

  it('widens the band instead of failing when the band is too thin', () => {
    // Difficulty-5 questions are rare; asking for 8 of them must widen.
    const { questions } = sampleQuestions(8, new Set<string>(), ALL_QUESTIONS, { min: 5, max: 5 }, 7);
    expect(questions).toHaveLength(8);
  });

  it('cycles a tiny bank with replacement instead of recursing forever', () => {
    const tiny: Question[] = ALL_QUESTIONS.slice(0, 3);
    const { questions } = sampleQuestions(8, new Set<string>(), tiny, { min: 1, max: 5 }, 3);
    expect(questions).toHaveLength(8);
  });
});

describe('generateWave determinism', () => {
  it('same seed builds the same wave, twice', () => {
    const a = generateWave(42, 3, new Set<string>(), ALL_QUESTIONS, 42);
    const b = generateWave(42, 3, new Set<string>(), ALL_QUESTIONS, 42);
    expect(a.creatures.map(c => c.question.id)).toEqual(b.creatures.map(c => c.question.id));
    expect(a.creatures.map(c => c.enemy.id)).toEqual(b.creatures.map(c => c.enemy.id));
  });

  it('different seeds build different waves', () => {
    const a = generateWave(42, 3, new Set<string>(), ALL_QUESTIONS, 42);
    const b = generateWave(43, 3, new Set<string>(), ALL_QUESTIONS, 43);
    expect(a.creatures.map(c => c.question.id)).not.toEqual(b.creatures.map(c => c.question.id));
  });

  it('wave 5 ends with boss-1 and a chapter-1 question', () => {
    const { creatures } = generateWave(5, 5, new Set<string>(), ALL_QUESTIONS, 5);
    expect(creatures).toHaveLength(5);
    const boss = creatures[4];
    expect(boss.isBoss).toBe(true);
    expect(boss.enemy.id).toBe('boss-1');
    expect(boss.question.nodeId.startsWith('1.')).toBe(true);
  });

  it('the roster is the full 40-enemy set', () => {
    expect(arcadeRosterSize()).toBe(40);
  });
});

describe('createArcadeRun', () => {
  it('starts on wave 1 with 3 creatures, 3 lives, 0 score', () => {
    const run = createArcadeRun(7, ALL_QUESTIONS, 1000);
    expect(run.wave).toBe(1);
    expect(run.creatures).toHaveLength(3);
    expect(run.lives).toBe(ARCADE_MAX_LIVES);
    expect(run.score).toBe(0);
    expect(run.combo).toBe(0);
    expect(run.status).toBe('running');
    expect(currentCreature(run)?.question.id).toBe(run.creatures[0].question.id);
  });
});

describe('answerArcadeBeat: correct answers', () => {
  it('kills the creature, banks score, grows the combo', () => {
    const run = createArcadeRun(7, ALL_QUESTIONS, 1000);
    // Wave-1 timer is 15 s; instant answer at combo 0 = 200.
    const res = answerArcadeBeat(run, true, 0, ALL_QUESTIONS);
    expect(res.creatureDown).toBe(true);
    expect(res.scoreGained).toBe(200);
    expect(res.state.score).toBe(200);
    expect(res.state.combo).toBe(1);
    expect(res.state.kills).toBe(1);
    expect(res.state.correct).toBe(1);
    expect(creaturesDownInWave(res.state)).toBe(1);
  });

  it('clearing wave 1 pays the wave bonus and advances to wave 2', () => {
    let run = createArcadeRun(7, ALL_QUESTIONS, 1000);
    let res = answerArcadeBeat(run, true, 0, ALL_QUESTIONS);
    run = res.state;
    res = answerArcadeBeat(run, true, 0, ALL_QUESTIONS);
    run = res.state;
    res = answerArcadeBeat(run, true, 0, ALL_QUESTIONS);
    // 3rd kill: combo 0→1→2, so hit scores are 200 + 200 + 250 = 650, +50 bonus.
    expect(res.waveCleared).toBe(true);
    expect(res.state.wave).toBe(2);
    expect(res.state.creatures).toHaveLength(3);
    expect(res.state.score).toBe(650 + 50);
    expect(res.scoreGained).toBe(250 + 50);
  });

  it('clearing wave 5 with a lost life restores it (cap 3)', () => {
    let run = createArcadeRun(21, ALL_QUESTIONS, 1000);
    // Lose one life first (wrong answer on the first creature).
    run = answerArcadeBeat(run, false, 5, ALL_QUESTIONS).state;
    expect(run.lives).toBe(2);
    // Waves 1–4 = 3+3+4+4 = 14 correct, then wave 5 = 5 correct.
    run = answerCorrectNTimes(run, 14);
    expect(run.wave).toBe(5);
    expect(run.lives).toBe(2);
    let res = answerArcadeBeat(run, true, 5, ALL_QUESTIONS);
    run = res.state;
    res = answerArcadeBeat(run, true, 5, ALL_QUESTIONS);
    run = res.state;
    res = answerArcadeBeat(run, true, 5, ALL_QUESTIONS);
    run = res.state;
    res = answerArcadeBeat(run, true, 5, ALL_QUESTIONS);
    run = res.state;
    res = answerArcadeBeat(run, true, 5, ALL_QUESTIONS);
    expect(res.waveCleared).toBe(true);
    expect(res.lifeRestored).toBe(true);
    expect(res.state.lives).toBe(3);
    expect(res.state.wave).toBe(6);
  });

  it('clearing wave 5 at full lives does not exceed 3', () => {
    let run = createArcadeRun(21, ALL_QUESTIONS, 1000);
    run = answerCorrectNTimes(run, 19); // waves 1–5
    expect(run.wave).toBe(6);
    expect(run.lives).toBe(3);
  });
});

describe('answerArcadeBeat: wrong answers', () => {
  it('costs a life, resets the combo, and the creature survives with a fresh question', () => {
    const run = createArcadeRun(11, ALL_QUESTIONS, 1000);
    const before = currentCreature(run);
    const res = answerArcadeBeat(run, false, 5, ALL_QUESTIONS);
    expect(res.lifeLost).toBe(true);
    expect(res.creatureDown).toBe(false);
    expect(res.state.lives).toBe(2);
    expect(res.state.combo).toBe(0);
    expect(res.state.wrong).toBe(1);
    const after = currentCreature(res.state);
    expect(after?.enemy.id).toBe(before?.enemy.id); // same creature
    expect(after?.question.id).not.toBe(before?.question.id); // fresh question
  });

  it('three wrong answers end the run, and further answers change nothing', () => {
    let run = createArcadeRun(11, ALL_QUESTIONS, 1000);
    let res = answerArcadeBeat(run, false, 5, ALL_QUESTIONS);
    run = res.state;
    res = answerArcadeBeat(run, false, 5, ALL_QUESTIONS);
    run = res.state;
    expect(run.lives).toBe(1);
    res = answerArcadeBeat(run, false, 5, ALL_QUESTIONS);
    expect(res.runOver).toBe(true);
    expect(res.state.status).toBe('gameover');
    expect(currentCreature(res.state)).toBeUndefined();
    const frozen = answerArcadeBeat(res.state, true, 0, ALL_QUESTIONS);
    expect(frozen.state).toBe(res.state);
    expect(frozen.scoreGained).toBe(0);
  });
});

describe('run determinism', () => {
  it('same seed + same answers → identical run state', () => {
    const play = (seed: number): ArcadeRunState => {
      let s = createArcadeRun(seed, ALL_QUESTIONS, 1000);
      s = answerArcadeBeat(s, true, 3, ALL_QUESTIONS).state;
      s = answerArcadeBeat(s, false, 5, ALL_QUESTIONS).state;
      s = answerArcadeBeat(s, true, 2, ALL_QUESTIONS).state;
      s = answerArcadeBeat(s, true, 9, ALL_QUESTIONS).state;
      return s;
    };
    const a = play(77);
    const b = play(77);
    expect(a.score).toBe(b.score);
    expect(a.combo).toBe(b.combo);
    expect(a.lives).toBe(b.lives);
    expect(a.creatures.map(c => c.question.id)).toEqual(b.creatures.map(c => c.question.id));
  });
});
