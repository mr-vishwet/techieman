// TechieMan — fight engine math (pure TypeScript, no React Native imports).
// Tested headlessly with Jest. Same rules as plan §2.1.

export type FightOutcome = 'win' | 'lose' | 'ongoing';

export interface FighterState {
  hp: number;
  maxHp: number;
}

export interface FightState {
  player: FighterState;
  enemy: FighterState;
  combo: number;
  correctCount: number;
  wrongCount: number;
  bestCombo: number;
}

export const PLAYER_MAX_HP = 100;

export function enemyMaxHp(difficulty: 1 | 2 | 3 | 4 | 5, isBoss: boolean): number {
  if (isBoss) return 300;
  return [60, 80, 100, 125, 150][difficulty - 1];
}

export function newFight(difficulty: 1 | 2 | 3 | 4 | 5, isBoss = false): FightState {
  const enemyHp = enemyMaxHp(difficulty, isBoss);
  return {
    player: { hp: PLAYER_MAX_HP, maxHp: PLAYER_MAX_HP },
    enemy: { hp: enemyHp, maxHp: enemyHp },
    combo: 0,
    correctCount: 0,
    wrongCount: 0,
    bestCombo: 0,
  };
}

/** Combo multiplier: x1.0 / x1.25 / x1.5 / x2.0 at 0-1 / 2 / 3 / 4+ consecutive correct. */
export function comboMultiplier(combo: number): number {
  if (combo >= 4) return 2.0;
  if (combo === 3) return 1.5;
  if (combo === 2) return 1.25;
  return 1.0;
}

/**
 * Damage dealt by a correct answer.
 * base 20 + speed bonus (up to +15 for answering in <5s, linear to 0 at 15s)
 * multiplied by the combo multiplier. Always an integer, min 20.
 */
export function damageForCorrectAnswer(answerSeconds: number, comboBefore: number): number {
  const clamped = Math.max(0, Math.min(15, answerSeconds));
  const speedBonus = Math.round(15 * (1 - clamped / 15));
  const raw = (20 + speedBonus) * comboMultiplier(comboBefore);
  return Math.max(20, Math.round(raw));
}

/** HP lost on a wrong answer (bosses hit harder). */
export function damageForWrongAnswer(isBoss: boolean): number {
  return isBoss ? 30 : 20;
}

export interface AnswerResult {
  state: FightState;
  damageDealt: number;
  damageTaken: number;
  outcome: FightOutcome;
  flawless: boolean;
}

export function applyAnswer(
  state: FightState,
  correct: boolean,
  answerSeconds: number,
  isBoss = false,
): AnswerResult {
  const next: FightState = {
    player: { ...state.player },
    enemy: { ...state.enemy },
    combo: state.combo,
    correctCount: state.correctCount,
    wrongCount: state.wrongCount,
    bestCombo: state.bestCombo,
  };
  let damageDealt = 0;
  let damageTaken = 0;

  if (correct) {
    damageDealt = damageForCorrectAnswer(answerSeconds, next.combo);
    next.enemy.hp = Math.max(0, next.enemy.hp - damageDealt);
    next.combo += 1;
    next.correctCount += 1;
    next.bestCombo = Math.max(next.bestCombo, next.combo);
  } else {
    damageTaken = damageForWrongAnswer(isBoss);
    next.player.hp = Math.max(0, next.player.hp - damageTaken);
    next.combo = 0;
    next.wrongCount += 1;
  }

  const outcome: FightOutcome =
    next.enemy.hp <= 0 ? 'win' : next.player.hp <= 0 ? 'lose' : 'ongoing';
  return {
    state: next,
    damageDealt,
    damageTaken,
    outcome,
    flawless: outcome === 'win' && next.wrongCount === 0,
  };
}

/**
 * XP for a finished fight. First-clears and weak-area rematches pay full XP;
 * replays of a cleared node pay 10% (no farming — plan §2.2).
 */
export function xpForFight(
  correctCount: number,
  totalQuestions: number,
  flawless: boolean,
  isFirstClear: boolean,
  isBoss: boolean,
): number {
  const base = correctCount * 10 + (isBoss ? 50 : 0) + (flawless ? 25 : 0);
  const scaled = isFirstClear ? base : Math.round(base * 0.1);
  return Math.max(0, scaled);
}

/** Next rematch date for spaced repetition: 1d → 3d → 7d (plan §2.2). */
export function nextRematchAt(lastPlayedAt: number, rematchCount: number): number {
  const day = 24 * 60 * 60 * 1000;
  const interval = [1, 3, 7][Math.min(rematchCount, 2)] * day;
  return lastPlayedAt + interval;
}
