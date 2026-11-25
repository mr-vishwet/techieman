// TechieMan local-first storage schema (plan §7.1, v1.1).
// Relational data: react-native-nitro-sqlite (NitroSQLite 10.x — the maintained
// successor to the deprecated react-native-quick-sqlite; swapped 25 Nov 2026
// before any code used the old driver). Session/prefs: react-native-mmkv.
// This file holds the DDL + MMKV keys only — the DB is opened by the app layer.

export const SCHEMA_VERSION = 1;

export const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    avatar_skin TEXT NOT NULL DEFAULT 'crimson',
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    gems INTEGER NOT NULL DEFAULT 0,
    streak INTEGER NOT NULL DEFAULT 0,
    streak_freeze INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS roadmaps (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    source_url TEXT NOT NULL,
    version TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    roadmap_id TEXT NOT NULL REFERENCES roadmaps(id),
    ord INTEGER NOT NULL,
    title TEXT NOT NULL,
    boss_name TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL REFERENCES chapters(id),
    ord INTEGER NOT NULL,
    title TEXT NOT NULL,
    source_url TEXT NOT NULL,
    difficulty INTEGER NOT NULL,
    is_side_quest INTEGER NOT NULL DEFAULT 0,
    prereq_ids TEXT NOT NULL DEFAULT '[]'
  )`,
  `CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL REFERENCES nodes(id),
    type TEXT NOT NULL,
    stem TEXT NOT NULL,
    options_json TEXT NOT NULL,
    correct_index INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_quote TEXT NOT NULL DEFAULT '',
    sdk_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    flags INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS fights (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    node_id TEXT,
    boss_id TEXT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    result TEXT,
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    best_combo INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS progress (
    user_id TEXT NOT NULL REFERENCES users(id),
    node_id TEXT NOT NULL REFERENCES nodes(id),
    state TEXT NOT NULL DEFAULT 'locked',
    best_combo INTEGER NOT NULL DEFAULT 0,
    last_played_at INTEGER,
    next_rematch_at INTEGER,
    wrong_tags_json TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (user_id, node_id)
  )`,
  `CREATE TABLE IF NOT EXISTS quests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    target INTEGER NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    reward_gems INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nodes_chapter ON nodes(chapter_id)`,
  `CREATE INDEX IF NOT EXISTS idx_questions_node ON questions(node_id)`,
  `CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id)`,
];

/** MMKV keys (fast session/prefs storage — NOT relational data). */
export const MMKV_KEYS = {
  guestId: 'techieman.guestId',
  authToken: 'techieman.authToken',
  soundEnabled: 'techieman.soundEnabled',
  hapticsEnabled: 'techieman.hapticsEnabled',
  lastNodeId: 'techieman.lastNodeId',
  // M5 — Firebase Auth + sync (see src/firebase/*).
  /** Firebase uid linked to the local guest id (anonymous → email/Google keeps the same uid). */
  firebaseUid: 'techieman.firebaseUid',
  /** Set when the user explicitly signs out — stops auto anonymous sign-in. */
  authSignedOut: 'techieman.authSignedOut',
  /** Offline sync outbox (JSON array of OutboxEntry). */
  syncOutbox: 'techieman.syncOutbox.v1',
  /** Last merge report (JSON) — shown in the Account card after a sync. */
  lastMerge: 'techieman.lastMerge',
} as const;
