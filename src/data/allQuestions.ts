// TechieMan — the full question bank in one place (M3).
// Single source of truth: the TS arrays. SQLite is seeded FROM these
// (storage/bank.ts) and FightScreen falls back to them when the DB has
// not seeded yet, so the bundle and the DB can never diverge.

import { CHAPTER_1_SEED_QUESTIONS, type Question } from './questions';
import { QUESTIONS_CH1A } from './questions-ch1a';
import { QUESTIONS_CH1B } from './questions-ch1b';
import { QUESTIONS_CH2 } from './questions-ch2';
import { QUESTIONS_CH3 } from './questions-ch3';
import { QUESTIONS_CH4 } from './questions-ch4';
import { QUESTIONS_CH5 } from './questions-ch5';
import { QUESTIONS_CH6 } from './questions-ch6';
import { QUESTIONS_CH7 } from './questions-ch7';
import { QUESTIONS_CH8 } from './questions-ch8';

export const ALL_QUESTIONS: Question[] = [
  ...CHAPTER_1_SEED_QUESTIONS,
  ...QUESTIONS_CH1A,
  ...QUESTIONS_CH1B,
  ...QUESTIONS_CH2,
  ...QUESTIONS_CH3,
  ...QUESTIONS_CH4,
  ...QUESTIONS_CH5,
  ...QUESTIONS_CH6,
  ...QUESTIONS_CH7,
  ...QUESTIONS_CH8,
];

/** Approved questions for one node, in id order (the TS-array fallback path). */
export function questionsForNode(nodeId: string): Question[] {
  return ALL_QUESTIONS.filter(q => q.nodeId === nodeId && q.status === 'approved').sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}
