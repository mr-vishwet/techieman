// TechieMan — question-bank + persistence layer (M3/M4, M6: Ch2–8 wired).
// Single source of truth: the TS question arrays (data/questions.ts,
// data/questions-ch1a.ts, data/questions-ch1b.ts, data/questions-ch2.ts
// … data/questions-ch8.ts). SQLite is a CACHE +
// the home of progress/fights — it is seeded FROM the arrays at app start,
// so the bundle and the DB can never diverge. All SQL-building helpers are
// pure (testable without the native module); only openDb/initDb touch Nitro.

import { DDL } from './schema';
import { CHAPTERS, NODES, ROADMAP } from '../data/roadmap';
import type { Question } from '../data/questions';

// NOTE: NitroSQLite is required lazily inside openDb() — never at module top.
// The native module cannot load under Jest, and the pure helpers in this file
// (buildSeedCommands, questionToParams, rowToQuestion) must stay testable.
type NitroOpen = (options: { name: string }) => {
  executeAsync: (sql: string, params?: (string | number | null)[]) => Promise<{ rows: unknown[] }>;
  executeBatchAsync: (commands: { sql: string; params: (string | number | null)[] }[]) => Promise<unknown>;
};

export const DB_NAME = 'techieman.db';
export const GUEST_ID_PREFIX = 'guest-';

type DbConnection = ReturnType<NitroOpen>;
let db: DbConnection | null = null;

export function openDb(): DbConnection {
  if (!db) {
    // Lazy require: keeps this module importable under Jest (no native code).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NitroSQLite } = require('react-native-nitro-sqlite') as {
      NitroSQLite: { open: NitroOpen };
    };
    db = NitroSQLite.open({ name: DB_NAME });
  }
  return db;
}

/** One row of the `questions` table, as bound params (order matches DDL). */
export function questionToParams(q: Question): (string | number)[] {
  return [
    q.id,
    q.nodeId,
    q.type,
    q.stem,
    JSON.stringify(q.options),
    q.correctIndex,
    q.explanation,
    q.sourceUrl,
    q.sourceQuote,
    q.sdkVersion,
    q.status,
    0, // flags
  ];
}

export const INSERT_QUESTION_SQL =
  `INSERT OR REPLACE INTO questions
   (id, node_id, type, stem, options_json, correct_index, explanation,
    source_url, source_quote, sdk_version, status, flags)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/** Pure: every statement needed to (re)seed the static content. Tested without native code. */
export function buildSeedCommands(questions: Question[]) {
  const commands: { sql: string; params?: (string | number)[] }[] = [];
  for (const sql of DDL) commands.push({ sql });
  commands.push({
    sql: `INSERT OR REPLACE INTO roadmaps (id, slug, title, accent_color, source_url, version)
          VALUES (?, ?, ?, ?, ?, ?)`,
    params: [ROADMAP.id, ROADMAP.slug, ROADMAP.title, ROADMAP.accentColor, ROADMAP.sourceUrl, ROADMAP.version],
  });
  for (const c of CHAPTERS) {
    commands.push({
      sql: `INSERT OR REPLACE INTO chapters (id, roadmap_id, ord, title, boss_name) VALUES (?, ?, ?, ?, ?)`,
      params: [c.id, ROADMAP.id, c.order, c.title, c.bossName],
    });
  }
  for (const n of NODES) {
    commands.push({
      sql: `INSERT OR REPLACE INTO nodes (id, chapter_id, ord, title, source_url, difficulty, is_side_quest, prereq_ids)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [n.id, n.chapterId, n.order, n.title, `https://roadmap.sh/react-native`, n.difficulty, n.isSideQuest ? 1 : 0, '[]'],
    });
  }
  for (const q of questions) {
    commands.push({ sql: INSERT_QUESTION_SQL, params: questionToParams(q) });
  }
  return commands;
}

/** Create schema + seed static content. Safe to call on every launch (idempotent). */
export async function initDb(questions: Question[]): Promise<void> {
  const connection = openDb();
  await connection.executeBatchAsync(
    buildSeedCommands(questions).map(c => ({ sql: c.sql, params: c.params ?? [] })),
  );
}

/** Map a DB row back to a Question. */
export function rowToQuestion(row: Record<string, unknown>): Question {
  const options = JSON.parse(String(row.options_json)) as [string, string, string, string];
  return {
    id: String(row.id),
    nodeId: String(row.node_id),
    type: row.type as Question['type'],
    stem: String(row.stem),
    options,
    correctIndex: Number(row.correct_index) as Question['correctIndex'],
    explanation: String(row.explanation),
    sourceUrl: String(row.source_url),
    sourceQuote: String(row.source_quote ?? ''),
    difficulty: Number(row.difficulty ?? 1) as Question['difficulty'],
    sdkVersion: String(row.sdk_version),
    verified: true, // seeded only from the verified TS arrays
    status: (row.status as Question['status']) ?? 'approved',
  };
}

/** Load the approved questions for one node from SQLite, in id order. */
export async function loadQuestionsForNode(nodeId: string): Promise<Question[]> {
  const connection = openDb();
  const result = await connection.executeAsync(
    `SELECT * FROM questions WHERE node_id = ? AND status = 'approved' ORDER BY id ASC`,
    [nodeId],
  );
  return (result.rows as unknown as Record<string, unknown>[]).map(rowToQuestion);
}

/**
 * Pure TS-array fallback for loadQuestionsForNode: same filter + order,
 * no native code. FightScreen uses this when the DB is not seeded yet
 * (or the native module is unavailable) so a fight never blocks on SQLite.
 */
export function questionsForNodeLocal(nodeId: string, questions: Question[]): Question[] {
  return questions
    .filter(q => q.nodeId === nodeId && q.status === 'approved')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Count approved questions per node (used by the Roadmap map for lock state). */
export async function countQuestionsByNode(): Promise<Record<string, number>> {
  const connection = openDb();
  const result = await connection.executeAsync(
    `SELECT node_id, COUNT(*) AS n FROM questions WHERE status = 'approved' GROUP BY node_id`,
  );
  const out: Record<string, number> = {};
  for (const row of result.rows as unknown as Record<string, unknown>[]) {
    out[String(row.node_id)] = Number(row.n);
  }
  return out;
}
