// TechieMan — Arcade Mode engine (pure TypeScript, zero React Native imports).
// Endless wave survival: language-creatures attack in waves, one beat each;
// correct answer kills the creature, wrong/timeout costs a life and the
// creature survives with a fresh question. Score + combo + XP rules are the
// contract in ARCADE_MODE_SPEC.md — the numbers here and the tests assert
// them; do not tune them by feel in the UI.
//
// Reuses fightMath.comboMultiplier (same combo ladder as the campaign) and
// enemies.ts (the full 40-design roster). Question sampling is seeded and
// deterministic: same seed + same answer sequence → identical waves.
// A beat is beatKind 'question' | 'live'; this build generates question
// beats only — the live-beat driver is ARCADE-SEAM-2 (live-levels lane):
// a live beat resolves to { correct, secondsUsed } the same way a question
// does, and answerArcadeBeat is beat-kind-agnostic.

import { comboMultiplier } from './fightMath';
import { ALL_ENEMIES, BOSS_ENEMIES, NODE_ENEMIES, type EnemyDesign } from '../data/enemies';
import type { Question } from '../data/questions';

// ---------------------------------------------------------------------------
// Constants — the arcade contract (ARCADE_MODE_SPEC.md §2–§3)
// ---------------------------------------------------------------------------

/** Lives per run. */
export const ARCADE_MAX_LIVES = 3;
/** Question timer on wave 1 (seconds). */
export const ARCADE_BASE_TIMER_SECONDS = 15;
/** Timer floor — reached at wave 8, never below. */
export const ARCADE_MIN_TIMER_SECONDS = 8;
/** Base score per correct hit, before speed bonus and combo. */
export const ARCADE_BASE_HIT_SCORE = 100;
/** Max speed bonus (answering instantly). */
export const ARCADE_SPEED_BONUS_MAX = 100;
/** XP cap per run (new-best-only). */
export const ARCADE_XP_CAP_PER_RUN = 25;
/** Clearing every Nth wave restores 1 life (capped at ARCADE_MAX_LIVES). */
export const ARCADE_LIFE_BACK_EVERY_WAVES = 5;
/** Every Nth wave is a boss wave; its last creature is a boss. */
export const ARCADE_BOSS_WAVE_EVERY = 5;
/** Run history cap in MMKV. */
export const ARCADE_RUN_HISTORY_CAP = 10;

// ---------------------------------------------------------------------------
// Wave curves
// ---------------------------------------------------------------------------

/** Question timer for a wave: 15, 14, …, 8, 8, 8… */
export function timerSecondsForWave(wave: number): number {
  return Math.max(ARCADE_BASE_TIMER_SECONDS - (Math.max(1, wave) - 1), ARCADE_MIN_TIMER_SECONDS);
}

/** Creatures per wave: 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8… (cap 8). */
export function waveSizeForWave(wave: number): number {
  return Math.min(3 + Math.floor((Math.max(1, wave) - 1) / 2), 8);
}

/** Difficulty band for a wave's questions. */
export function difficultyRangeForWave(wave: number): { min: number; max: number } {
  const w = Math.max(1, wave);
  return {
    min: w >= 5 ? 2 : 1,
    max: Math.min(2 + Math.floor((w - 1) / 2), 5),
  };
}

/** True on waves 5, 10, 15… — the wave's last creature is a boss. */
export function isBossWave(wave: number): boolean {
  return wave % ARCADE_BOSS_WAVE_EVERY === 0;
}

// ---------------------------------------------------------------------------
// Score + XP
// ---------------------------------------------------------------------------

/**
 * Score for one correct hit. Base 100 + speed bonus (up to +100 for an
 * instant answer, linear to 0 at the timer deadline), times the combo
 * multiplier for the combo BEFORE this answer. Boss kills pay double.
 */
export function scoreForHit(
  secondsUsed: number,
  timerSeconds: number,
  comboBefore: number,
  isBoss = false,
): number {
  const clamped = Math.max(0, Math.min(timerSeconds, secondsUsed));
  const speedBonus = Math.round(
    ARCADE_SPEED_BONUS_MAX * (1 - clamped / Math.max(1, timerSeconds)),
  );
  const raw = (ARCADE_BASE_HIT_SCORE + speedBonus) * comboMultiplier(comboBefore);
  const hit = Math.max(ARCADE_BASE_HIT_SCORE, Math.round(raw));
  return isBoss ? hit * 2 : hit;
}

/** Wave-clear bonus: +50 × wave. */
export function waveClearBonus(wave: number): number {
  return 50 * Math.max(1, wave);
}

/**
 * XP for a finished arcade run. New-best-only (anti-farm): a run that does
 * not beat the stored best banks 0 XP. Capped at 25 XP per run.
 * previousBestScore null = no best stored yet.
 */
export function arcadeXpForRun(score: number, previousBestScore: number | null): number {
  const prev = previousBestScore ?? -1;
  if (score <= prev) return 0;
  return Math.min(ARCADE_XP_CAP_PER_RUN, Math.floor(Math.max(0, score) / 100));
}

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32, stateful form so the run state stays pure)
// ---------------------------------------------------------------------------

export function nextRandom(rngState: number): { value: number; nextState: number } {
  let t = (rngState + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, nextState: t };
}

/** Seeded Fisher–Yates over a copy. Returns the shuffled copy + next rng state. */
export function seededShuffle<T>(items: readonly T[], rngState: number): { items: T[]; rngState: number } {
  const out = [...items];
  let state = rngState;
  for (let i = out.length - 1; i > 0; i--) {
    const r = nextRandom(state);
    state = r.nextState;
    const j = Math.floor(r.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { items: out, rngState: state };
}

// ---------------------------------------------------------------------------
// Wave generation
// ---------------------------------------------------------------------------

export type ArcadeBeatKind = 'question' | 'live';

export interface ArcadeCreature {
  enemy: EnemyDesign;
  /** The question this beat asks (question beats). Live beats carry none yet. */
  question: Question;
  isBoss: boolean;
  beatKind: ArcadeBeatKind;
}

function chapterOfNode(nodeId: string): number {
  const n = parseInt(nodeId.split('.')[0] ?? '1', 10);
  return Number.isFinite(n) ? n : 1;
}

/**
 * Draw `count` fresh questions inside `range`, excluding `usedIds`.
 * Widens the band (min → 1, then max → 5) when the band is too thin, and
 * resets the used set when the whole bank is exhausted. Deterministic.
 */
export function sampleQuestions(
  count: number,
  usedIds: ReadonlySet<string>,
  bank: readonly Question[],
  range: { min: number; max: number },
  rngState: number,
): { questions: Question[]; usedIds: Set<string>; rngState: number } {
  const approved = bank.filter(q => q.status === 'approved');
  const bands: Array<{ min: number; max: number }> = [
    range,
    { min: 1, max: range.max },
    { min: 1, max: 5 },
  ];
  let state = rngState;
  for (const band of bands) {
    const fresh = approved.filter(
      q => q.difficulty >= band.min && q.difficulty <= band.max && !usedIds.has(q.id),
    );
    if (fresh.length >= count) {
      const shuffled = seededShuffle(fresh, state);
      state = shuffled.rngState;
      const picked = shuffled.items.slice(0, count);
      const nextUsed = new Set(usedIds);
      picked.forEach(q => nextUsed.add(q.id));
      return { questions: picked, usedIds: nextUsed, rngState: state };
    }
  }
  // Bank exhausted inside every band: start the used set over (a run that
  // long has answered ~320 questions — repeats are honest at that point).
  // Tiny bank (tests): cycle through it with replacement instead of
  // recursing forever when the bank holds fewer than `count` questions.
  const totalApproved = approved.length;
  if (totalApproved === 0) {
    return { questions: [], usedIds: new Set(usedIds), rngState: state };
  }
  if (totalApproved < count) {
    const shuffled = seededShuffle(approved, state);
    const picked: Question[] = [];
    for (let i = 0; i < count; i++) picked.push(shuffled.items[i % shuffled.items.length]);
    const nextUsed = new Set(usedIds);
    picked.forEach(q => nextUsed.add(q.id));
    return { questions: picked, usedIds: nextUsed, rngState: shuffled.rngState };
  }
  const reset = sampleQuestions(count, new Set<string>(), bank, range, state);
  return reset;
}

/**
 * Generate one wave. Creatures are a seeded shuffle of the full roster;
 * on a boss wave the last creature is the chapter boss, with a question
 * drawn from that chapter's nodes. Returns the wave + updated used ids +
 * updated rng state — pure, so the same seed always builds the same wave.
 */
export function generateWave(
  seed: number,
  wave: number,
  usedIds: ReadonlySet<string>,
  bank: readonly Question[],
  rngState: number,
): { creatures: ArcadeCreature[]; usedIds: Set<string>; rngState: number } {
  const size = waveSizeForWave(wave);
  const range = difficultyRangeForWave(wave);
  const bossWave = isBossWave(wave);
  const normalCount = bossWave ? size - 1 : size;

  const sampled = sampleQuestions(normalCount, usedIds, bank, range, rngState);
  let state = sampled.rngState;
  let used = sampled.usedIds;

  const enemyPool = seededShuffle(NODE_ENEMIES, state);
  state = enemyPool.rngState;
  const creatures: ArcadeCreature[] = sampled.questions.map((q, i) => ({
    enemy: enemyPool.items[i % enemyPool.items.length],
    question: q,
    isBoss: false,
    beatKind: 'question' as const,
  }));

  if (bossWave) {
    const bossIndex = (wave / ARCADE_BOSS_WAVE_EVERY - 1) % BOSS_ENEMIES.length;
    const boss = BOSS_ENEMIES[bossIndex];
    // Boss question: from the boss's chapter, inside the wave band if possible.
    const chapterQs = bank.filter(
      q => q.status === 'approved' && chapterOfNode(q.nodeId) === boss.chapter && !used.has(q.id),
    );
    const bossPick =
      chapterQs.length > 0
        ? sampleQuestions(1, used, chapterQs, { min: 1, max: 5 }, state)
        : sampleQuestions(1, used, bank, range, state);
    state = bossPick.rngState;
    used = bossPick.usedIds;
    if (bossPick.questions[0]) {
      creatures.push({
        enemy: boss,
        question: bossPick.questions[0],
        isBoss: true,
        beatKind: 'question',
      });
    }
  }

  return { creatures, usedIds: used, rngState: state };
}

// ---------------------------------------------------------------------------
// Run state machine
// ---------------------------------------------------------------------------

export interface ArcadeRunState {
  seed: number;
  rngState: number;
  wave: number;
  creatureIndex: number;
  creatures: ArcadeCreature[];
  usedQuestionIds: Set<string>;
  lives: number;
  score: number;
  combo: number;
  bestCombo: number;
  kills: number;
  correct: number;
  wrong: number;
  status: 'running' | 'gameover';
  startedAt: number;
}

export function createArcadeRun(seed: number, bank: readonly Question[], startedAt: number): ArcadeRunState {
  const rngState = seed | 0;
  const wave = generateWave(seed, 1, new Set<string>(), bank, rngState);
  return {
    seed,
    rngState: wave.rngState,
    wave: 1,
    creatureIndex: 0,
    creatures: wave.creatures,
    usedQuestionIds: wave.usedIds,
    lives: ARCADE_MAX_LIVES,
    score: 0,
    combo: 0,
    bestCombo: 0,
    kills: 0,
    correct: 0,
    wrong: 0,
    status: 'running',
    startedAt,
  };
}

/** The creature the player is fighting right now (undefined when the run is over). */
export function currentCreature(state: ArcadeRunState): ArcadeCreature | undefined {
  return state.status === 'running' ? state.creatures[state.creatureIndex] : undefined;
}

/** Creatures already down in the current wave. */
export function creaturesDownInWave(state: ArcadeRunState): number {
  return state.creatureIndex;
}

export interface ArcadeAnswerResult {
  state: ArcadeRunState;
  /** Score gained by this beat (0 on a wrong answer). */
  scoreGained: number;
  lifeLost: boolean;
  creatureDown: boolean;
  waveCleared: boolean;
  /** True when clearing this wave restored a life (waves 5, 10, …). */
  lifeRestored: boolean;
  runOver: boolean;
}

/**
 * Resolve one beat. Correct → the creature dies, score lands, combo grows;
 * clearing the last creature of a wave pays the wave bonus and advances to
 * the next wave (with a life back every 5th wave). Wrong/timeout → −1 life,
 * combo resets, the creature SURVIVES with a fresh question drawn for it.
 * Pure: the same state + the same answer always gives the same result.
 */
export function answerArcadeBeat(
  state: ArcadeRunState,
  correct: boolean,
  secondsUsed: number,
  bank: readonly Question[],
): ArcadeAnswerResult {
  if (state.status !== 'running') {
    return {
      state,
      scoreGained: 0,
      lifeLost: false,
      creatureDown: false,
      waveCleared: false,
      lifeRestored: false,
      runOver: true,
    };
  }
  const creature = state.creatures[state.creatureIndex];
  const timerSeconds = timerSecondsForWave(state.wave);

  if (correct) {
    const gained = scoreForHit(secondsUsed, timerSeconds, state.combo, creature.isBoss);
    const combo = state.combo + 1;
    const next: ArcadeRunState = {
      ...state,
      score: state.score + gained,
      combo,
      bestCombo: Math.max(state.bestCombo, combo),
      kills: state.kills + 1,
      correct: state.correct + 1,
      creatureIndex: state.creatureIndex + 1,
    };
    if (next.creatureIndex < next.creatures.length) {
      return {
        state: next,
        scoreGained: gained,
        lifeLost: false,
        creatureDown: true,
        waveCleared: false,
        lifeRestored: false,
        runOver: false,
      };
    }
    // Wave cleared: bonus + next wave (+1 life every 5th wave).
    const bonus = waveClearBonus(state.wave);
    const clearedWave = state.wave;
    const lifeRestored = clearedWave % ARCADE_LIFE_BACK_EVERY_WAVES === 0 && next.lives < ARCADE_MAX_LIVES;
    const wave = generateWave(state.seed, clearedWave + 1, next.usedQuestionIds, bank, next.rngState);
    return {
      state: {
        ...next,
        score: next.score + bonus,
        lives: lifeRestored ? next.lives + 1 : next.lives,
        wave: clearedWave + 1,
        creatureIndex: 0,
        creatures: wave.creatures,
        usedQuestionIds: wave.usedIds,
        rngState: wave.rngState,
      },
      scoreGained: gained + bonus,
      lifeLost: false,
      creatureDown: true,
      waveCleared: true,
      lifeRestored,
      runOver: false,
    };
  }

  // Wrong / timeout: −1 life, combo dies, the creature survives — but with
  // a FRESH question, so the player can always kill it next beat.
  const lives = state.lives - 1;
  const range = difficultyRangeForWave(state.wave);
  const fresh = sampleQuestions(1, state.usedQuestionIds, bank, range, state.rngState);
  const creatures = state.creatures.map((c, i) =>
    i === state.creatureIndex ? { ...c, question: fresh.questions[0] } : c,
  );
  return {
    state: {
      ...state,
      lives,
      combo: 0,
      wrong: state.wrong + 1,
      creatures,
      usedQuestionIds: fresh.usedIds,
      rngState: fresh.rngState,
      status: lives <= 0 ? 'gameover' : 'running',
    },
    scoreGained: 0,
    lifeLost: true,
    creatureDown: false,
    waveCleared: false,
    lifeRestored: false,
    runOver: lives <= 0,
  };
}

/** Every enemy design the arcade can field (roster size, for tests/UI). */
export function arcadeRosterSize(): number {
  return ALL_ENEMIES.length;
}
