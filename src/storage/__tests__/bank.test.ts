// Tests for the M3 bank layer's pure helpers (no native module loaded).
import {
  buildSeedCommands,
  INSERT_QUESTION_SQL,
  questionToParams,
  questionsForNodeLocal,
  rowToQuestion,
} from '../bank';
import { ALL_QUESTIONS } from '../../data/allQuestions';
import { CHAPTER_1_SEED_QUESTIONS, type Question } from '../../data/questions';
import { CHAPTERS, NODES } from '../../data/roadmap';

const SAMPLE: Question = CHAPTER_1_SEED_QUESTIONS[0];

describe('questionToParams / rowToQuestion', () => {
  it('round-trips a question through DB params and back', () => {
    const params = questionToParams(SAMPLE);
    expect(params).toHaveLength(12);
    const row: Record<string, unknown> = {
      id: params[0],
      node_id: params[1],
      type: params[2],
      stem: params[3],
      options_json: params[4],
      correct_index: params[5],
      explanation: params[6],
      source_url: params[7],
      source_quote: params[8],
      sdk_version: params[9],
      status: params[10],
    };
    const back = rowToQuestion(row);
    expect(back.id).toBe(SAMPLE.id);
    expect(back.options).toEqual(SAMPLE.options);
    expect(back.correctIndex).toBe(SAMPLE.correctIndex);
    expect(back.sourceQuote).toBe(SAMPLE.sourceQuote);
  });
  it('options serialise as JSON, not as a joined string', () => {
    expect(typeof questionToParams(SAMPLE)[4]).toBe('string');
    expect(JSON.parse(questionToParams(SAMPLE)[4] as string)).toEqual(SAMPLE.options);
  });
});

describe('buildSeedCommands', () => {
  it('seeds schema + roadmap + every chapter + every node + every question', () => {
    const cmds = buildSeedCommands(CHAPTER_1_SEED_QUESTIONS);
    const sqls = cmds.map(c => c.sql);
    expect(sqls.some(s => s.includes('CREATE TABLE IF NOT EXISTS questions'))).toBe(true);
    expect(sqls.some(s => s.includes('INSERT OR REPLACE INTO roadmaps'))).toBe(true);
    expect(sqls.filter(s => s.includes('INSERT OR REPLACE INTO chapters')).length).toBe(CHAPTERS.length);
    expect(sqls.filter(s => s.includes('INSERT OR REPLACE INTO nodes')).length).toBe(NODES.length);
    expect(sqls.filter(s => s === INSERT_QUESTION_SQL).length).toBe(CHAPTER_1_SEED_QUESTIONS.length);
  });
  it('is idempotent by construction (INSERT OR REPLACE everywhere)', () => {
    const cmds = buildSeedCommands(CHAPTER_1_SEED_QUESTIONS);
    const inserts = cmds.filter(c => c.sql.includes('INSERT'));
    expect(inserts.length).toBeGreaterThan(0);
    expect(inserts.every(c => c.sql.includes('INSERT OR REPLACE'))).toBe(true);
  });
});

describe('buildSeedCommands with the full bank (M3 Ch1 + M6 Ch2–8)', () => {
  it('seeds all 320 questions, 10 per node across all 32 nodes', () => {
    const cmds = buildSeedCommands(ALL_QUESTIONS);
    expect(cmds.filter(c => c.sql === INSERT_QUESTION_SQL)).toHaveLength(320);
    const seeded = cmds
      .filter(c => c.sql === INSERT_QUESTION_SQL)
      .map(c => String(c.params?.[1]));
    for (const node of NODES) {
      expect(seeded.filter(n => n === node.id)).toHaveLength(10);
    }
  });
  it('seeding twice produces identical commands (idempotent re-seed)', () => {
    expect(buildSeedCommands(ALL_QUESTIONS)).toEqual(buildSeedCommands(ALL_QUESTIONS));
  });
});

describe('questionsForNodeLocal (TS-array fallback)', () => {
  it('returns 10 approved questions per node, in id order', () => {
    for (const node of NODES) {
      const qs = questionsForNodeLocal(node.id, ALL_QUESTIONS);
      expect(qs).toHaveLength(10);
      const ids = qs.map(q => q.id);
      expect(ids).toEqual([...ids].sort());
    }
  });
  it('returns [] for nodes with no authored bank', () => {
    expect(questionsForNodeLocal('2.1-state-management', ALL_QUESTIONS)).toEqual([]);
  });
  it('excludes non-approved questions from fights', () => {
    const q = { ...ALL_QUESTIONS[0], status: 'quarantined' as const };
    const qs = questionsForNodeLocal(q.nodeId, [q]);
    expect(qs).toHaveLength(0);
  });
});
