// TechieMan — progression persistence (M4).
// Design: ONE pure function owns all the logic — applyFight(snapshot, input,
// nowMs) — and the SQLite shell is a thin load/persist wrapper around it.
// That makes the whole loop (XP → streak → quests → rematch) testable
// headlessly; the DB can never disagree with the in-memory store because
// both run the same function. rematchWins is NOT a DB column: it is derived
// from the fights table (wins for the node minus the first clear), so the
// fights log stays the single source of truth for history.

import { openDb } from './bank';
import { ALL_QUESTIONS } from '../data/allQuestions';
import { xpForFight } from '../engine/fightMath';
import {
  applyFightToProgress,
  applyFightToQuests,
  generateDailyQuests,
  levelForXp,
  maybeEarnFreeze,
  pickRematch,
  updateStreak,
  type ProgressRow,
  type Quest,
} from '../engine/progression';

export type SqlCommand = { sql: string; params: (string | number | null)[] };

export interface ProgressionSnapshot {
  userId: string;
  xp: number;
  level: number;
  gems: number;
  streak: number;
  streakFreeze: number;
  lastPlayedDay: string | null; // YYYY-MM-DD (local) of the last fight day
  progress: Record<string, ProgressRow>;
  quests: Quest[];
  questDay: string; // YYYY-MM-DD the quests belong to
  winsByNode: Record<string, number>;
}

export function emptySnapshot(userId: string): ProgressionSnapshot {
  return {
    userId,
    xp: 0,
    level: 1,
    gems: 0,
    streak: 0,
    streakFreeze: 0,
    lastPlayedDay: null,
    progress: {},
    quests: [],
    questDay: '',
    winsByNode: {},
  };
}

/** Local YYYY-MM-DD for a timestamp (matches progression.ts day strings). */
export function dayString(nowMs: number): string {
  const d = new Date(nowMs);
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function defaultRow(nodeId: string): ProgressRow {
  return {
    nodeId,
    state: 'open',
    bestCombo: 0,
    lastPlayedAt: null,
    nextRematchAt: null,
    wrongTags: [],
    rematchWins: 0,
  };
}

export interface FightInput {
  nodeId: string;
  /** The fight outcome — owned by FightScreen's HP state, never guessed from counts (a lost fight can still have correct answers). */
  won: boolean;
  correctCount: number;
  wrongCount: number;
  bestCombo: number;
  totalQuestions: number;
  flawless: boolean;
  isBoss: boolean;
  /** question ids answered wrong — the wrong-tag set for the rematch card */
  wrongTags: string[];
  /** correct answers given in under 8s (fast-answers quest) */
  fastAnswers: number;
  durationMs: number;
  startedAt: number;
}

export interface FightSummary {
  won: boolean;
  xpEarned: number;
  newState: ProgressRow['state'];
  streak: number;
  streakBroke: boolean;
  freezeUsed: boolean;
  gemsEarned: number;
  nextRematchAt: number | null;
  mastered: boolean;
  isFirstClear: boolean;
  isRematch: boolean;
}

export interface ApplyFightResult {
  snapshot: ProgressionSnapshot;
  commands: SqlCommand[];
  summary: FightSummary;
}

/**
 * Pure core of M4: apply one finished fight to a snapshot.
 * Returns the new snapshot + the SQL commands that persist it (the caller
 * executes them; under Jest the commands are asserted, never run).
 */
export function applyFight(
  snapshot: ProgressionSnapshot,
  input: FightInput,
  nowMs: number,
): ApplyFightResult {
  const today = dayString(nowMs);
  const isWin = input.won;

  const priorRow = snapshot.progress[input.nodeId] ?? defaultRow(input.nodeId);
  const isFirstClear = priorRow.state !== 'cleared' && priorRow.state !== 'mastered';
  const isRematch = priorRow.state === 'cleared' || priorRow.state === 'mastered';

  // Plan §2.2: XP only from first-clears, boss wins, and weak-area
  // rematches. A lost fight banks wrong tags and streak activity, never XP.
  const xpEarned = isWin
    ? xpForFight(
        input.correctCount,
        input.totalQuestions,
        input.flawless,
        isFirstClear,
        input.isBoss,
      )
    : 0;

  // Streak (any finished fight counts as activity for the day).
  const streakBefore = snapshot.streak;
  const streakRes = updateStreak(
    { lastPlayedDay: snapshot.lastPlayedDay, streak: snapshot.streak, freezes: snapshot.streakFreeze },
    today,
  );
  const streakFreeze = maybeEarnFreeze(streakBefore, streakRes.streak, streakRes.freezes);

  // Progress row for the node.
  const newRow = applyFightToProgress(
    { ...priorRow, rematchWins: snapshot.winsByNode[input.nodeId] ? snapshot.winsByNode[input.nodeId] - 1 : 0 },
    isWin,
    input.bestCombo,
    input.wrongTags,
    nowMs,
    isRematch,
  );

  // Daily quests: roll over to a fresh set when the day changed.
  const quests =
    snapshot.questDay === today && snapshot.quests.length === 3
      ? snapshot.quests
      : generateDailyQuests(today);
  const questRes = applyFightToQuests(quests, {
    won: isWin,
    isRematch,
    fastAnswers: input.fastAnswers,
  });

  const newXp = snapshot.xp + xpEarned;
  const next: ProgressionSnapshot = {
    ...snapshot,
    xp: newXp,
    level: levelForXp(newXp),
    gems: snapshot.gems + questRes.gemsEarned,
    streak: streakRes.streak,
    streakFreeze,
    lastPlayedDay: today,
    progress: { ...snapshot.progress, [input.nodeId]: newRow },
    quests: questRes.quests,
    questDay: today,
    winsByNode: {
      ...snapshot.winsByNode,
      [input.nodeId]: (snapshot.winsByNode[input.nodeId] ?? 0) + (isWin ? 1 : 0),
    },
  };

  const fightId = `${snapshot.userId}:${input.nodeId}:${input.startedAt}`;
  const commands: SqlCommand[] = [
    {
      sql: `INSERT OR IGNORE INTO users (id, display_name, avatar_skin, xp, level, gems, streak, streak_freeze, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [snapshot.userId, null, 'crimson', 0, 1, 0, 0, 0, nowMs],
    },
    {
      sql: `INSERT INTO fights (id, user_id, node_id, boss_id, started_at, ended_at, result, correct_count, wrong_count, best_combo, xp_earned, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        fightId,
        snapshot.userId,
        input.nodeId,
        null,
        input.startedAt,
        nowMs,
        isWin ? 'win' : 'lose',
        input.correctCount,
        input.wrongCount,
        input.bestCombo,
        xpEarned,
        input.durationMs,
      ],
    },
    {
      sql: `INSERT OR REPLACE INTO progress (user_id, node_id, state, best_combo, last_played_at, next_rematch_at, wrong_tags_json) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        snapshot.userId,
        input.nodeId,
        newRow.state,
        newRow.bestCombo,
        newRow.lastPlayedAt,
        newRow.nextRematchAt,
        JSON.stringify(newRow.wrongTags),
      ],
    },
    {
      sql: `UPDATE users SET xp = ?, level = ?, gems = ?, streak = ?, streak_freeze = ? WHERE id = ?`,
      params: [next.xp, next.level, next.gems, next.streak, next.streakFreeze, snapshot.userId],
    },
    ...questRes.quests.map((q): SqlCommand => {
      const expiresAtMs = Date.parse(`${q.expiresAt}T00:00:00Z`) + 86_400_000;
      return {
        sql: `INSERT OR REPLACE INTO quests (id, user_id, type, target, progress, reward_gems, expires_at, done) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [q.id, snapshot.userId, q.type, q.target, q.progress, q.rewardGems, expiresAtMs, q.done ? 1 : 0],
      };
    }),
  ];

  return {
    snapshot: next,
    commands,
    summary: {
      won: isWin,
      xpEarned,
      newState: newRow.state,
      streak: streakRes.streak,
      streakBroke: streakRes.broke,
      freezeUsed: streakRes.freezeUsed,
      gemsEarned: questRes.gemsEarned,
      nextRematchAt: newRow.nextRematchAt,
      mastered: newRow.state === 'mastered',
      isFirstClear,
      isRematch,
    },
  };
}

/** Highest-value due rematch in a snapshot (null when nothing is due). */
export function snapshotRematch(snapshot: ProgressionSnapshot, nowMs: number): ProgressRow | null {
  return pickRematch(Object.values(snapshot.progress), nowMs);
}

// ---------------------------------------------------------------------------
// SQLite shell (thin wrappers — all logic lives in applyFight above)
// ---------------------------------------------------------------------------

function rowToProgressRow(row: Record<string, unknown>): ProgressRow {
  return {
    nodeId: String(row.node_id),
    state: (row.state as ProgressRow['state']) ?? 'open',
    bestCombo: Number(row.best_combo ?? 0),
    lastPlayedAt: row.last_played_at === null ? null : Number(row.last_played_at),
    nextRematchAt: row.next_rematch_at === null ? null : Number(row.next_rematch_at),
    wrongTags: JSON.parse(String(row.wrong_tags_json ?? '[]')) as string[],
    rematchWins: 0, // filled in by loadSnapshot from the fights table
  };
}

function rowToQuest(row: Record<string, unknown>): Quest {
  const expiresAtMs = Number(row.expires_at);
  return {
    id: String(row.id),
    type: row.type as Quest['type'],
    title: questTitle(row.type as Quest['type']),
    target: Number(row.target),
    progress: Number(row.progress),
    rewardGems: Number(row.reward_gems),
    expiresAt: dayString(expiresAtMs - 1),
    done: Number(row.done) === 1,
  };
}

function questTitle(type: Quest['type']): string {
  if (type === 'win-fights') return 'Win 2 fights';
  if (type === 'clear-rematch') return 'Clear 1 weak-area rematch';
  return 'Answer 5 questions in under 8s';
}

/** Load the full progression snapshot for a user (creates the user row if needed). */
export async function loadSnapshot(userId: string, nowMs: number = Date.now()): Promise<ProgressionSnapshot> {
  const db = openDb();
  const today = dayString(nowMs);
  const snap = emptySnapshot(userId);

  const userRows = (await db.executeAsync(`SELECT xp, level, gems, streak, streak_freeze FROM users WHERE id = ?`, [userId])).rows as unknown as Record<string, unknown>[];
  if (userRows.length > 0) {
    const u = userRows[0];
    snap.xp = Number(u.xp);
    snap.level = Number(u.level);
    snap.gems = Number(u.gems);
    snap.streak = Number(u.streak);
    snap.streakFreeze = Number(u.streak_freeze);
  }

  const lastFight = (await db.executeAsync(
    `SELECT MAX(ended_at) AS last_end FROM fights WHERE user_id = ?`,
    [userId],
  )).rows as unknown as Record<string, unknown>[];
  const lastEnd = lastFight[0]?.last_end;
  snap.lastPlayedDay = lastEnd === null || lastEnd === undefined ? null : dayString(Number(lastEnd));

  const progressRows = (await db.executeAsync(
    `SELECT * FROM progress WHERE user_id = ?`,
    [userId],
  )).rows as unknown as Record<string, unknown>[];
  for (const r of progressRows) {
    const pr = rowToProgressRow(r);
    snap.progress[pr.nodeId] = pr;
  }

  const wins = (await db.executeAsync(
    `SELECT node_id, COUNT(*) AS n FROM fights WHERE user_id = ? AND result = 'win' GROUP BY node_id`,
    [userId],
  )).rows as unknown as Record<string, unknown>[];
  for (const w of wins) {
    const nodeId = String(w.node_id);
    snap.winsByNode[nodeId] = Number(w.n);
    if (snap.progress[nodeId]) snap.progress[nodeId].rematchWins = Math.max(0, Number(w.n) - 1);
  }

  const dayStartMs = Date.parse(`${today}T00:00:00Z`);
  const questRows = (await db.executeAsync(
    `SELECT * FROM quests WHERE user_id = ? AND expires_at > ? AND expires_at <= ?`,
    [userId, dayStartMs, dayStartMs + 86_400_000],
  )).rows as unknown as Record<string, unknown>[];
  if (questRows.length === 3) {
    snap.quests = questRows.map(rowToQuest);
    snap.questDay = today;
  } else {
    snap.quests = generateDailyQuests(today);
    snap.questDay = today;
  }
  return snap;
}

/** Execute persistence commands (INSERT/UPDATE batch). */
export async function persistCommands(commands: SqlCommand[]): Promise<void> {
  const db = openDb();
  await db.executeBatchAsync(commands.map(c => ({ sql: c.sql, params: c.params ?? [] })));
}

/** Load → apply → persist, in one call. Returns the new snapshot + summary. */
export async function recordFight(
  userId: string,
  input: FightInput,
  nowMs: number = Date.now(),
): Promise<{ snapshot: ProgressionSnapshot; summary: FightSummary }> {
  const snap = await loadSnapshot(userId, nowMs);
  const result = applyFight(snap, input, nowMs);
  await persistCommands(result.commands);
  return { snapshot: result.snapshot, summary: result.summary };
}

/** Re-exported so the store can seed the DB from the same arrays. */
export { ALL_QUESTIONS };
