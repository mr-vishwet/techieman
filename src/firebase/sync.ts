// TechieMan — Firestore sync core (M5).
// Offline-first, local-is-source-of-truth: SQLite/MMKV always wins the
// fight path; Firestore is a backup + the leagues feed. Sync is
// fire-and-forget and must NEVER throw into a fight — callers catch.
//
// Collections (see FIREBASE_SETUP.md for the security rules):
//   users/{uid}                     profile: xp, level, gems, streak, ...
//   users/{uid}/progress/{nodeId}   one doc per node
//   users/{uid}/fights/{fightId}   append-only log, capped at last 100
//   leagues/{weekId}/groups/{id}/members/{uid}   weekly XP (see leagues.ts)
//
// Conflict rule (spec): last-write-wins per node, local winning ties.
// "Write" time for a node is its lastPlayedAt. A lost fight still counts
// as a write (wrong tags are progress). Merge rule for the profile: keep
// the HIGHER xp / gems / streak (never wipe), level is derived from xp.
//
// All Firestore access goes through the FirestorePort interface so tests
// inject a fake in-memory port. The real port lazy-requires
// @react-native-firebase/firestore inside each method.

import { openDb } from '../storage/bank';
import { levelForXp, type ProgressRow } from '../engine/progression';
import type { ProgressionSnapshot } from '../storage/progress';
import { weekIdFor, weeklyXpForFights, type LeagueTier } from './leagues';

export const MAX_FIGHTS_SYNCED = 100;

export interface RemoteUserDoc {
  xp: number;
  level: number;
  gems: number;
  streak: number;
  streakFreeze: number;
  lastPlayedDay: string | null;
  winsByNode: Record<string, number>;
  updatedAt: number;
  /** XP earned in the current week (derived from the fights log at sync time). */
  weeklyXp?: number;
  weeklyXpWeekId?: string;
  /** League the Cloud Function placed this player in ({weekId, leagueId}). */
  currentLeague?: { weekId: string; leagueId: string } | null;
}

export interface RemoteProgressRow {
  state: ProgressRow['state'];
  bestCombo: number;
  lastPlayedAt: number | null;
  nextRematchAt: number | null;
  wrongTags: string[];
}

export interface RemoteFight {
  nodeId: string;
  result: 'win' | 'lose';
  correctCount: number;
  wrongCount: number;
  bestCombo: number;
  xpEarned: number;
  startedAt: number;
  endedAt: number;
}

export interface RemoteSnapshot {
  user: RemoteUserDoc;
  progress: Record<string, RemoteProgressRow>;
}

/** What a merge decided, for logging + the UI ("synced — kept your 320 XP"). */
export interface MergeReport {
  source: 'local-only' | 'merged';
  xpKept: 'local' | 'remote' | 'equal';
  gemsKept: 'local' | 'remote' | 'equal';
  streakKept: 'local' | 'remote' | 'equal';
  nodesMerged: number;
  nodesLocalWon: number;
  nodesRemoteWon: number;
  nodesTiedLocal: number;
}

// ---------------------------------------------------------------------------
// Pure core
// ---------------------------------------------------------------------------

const STATE_RANK: Record<ProgressRow['state'], number> = { locked: 0, open: 1, cleared: 2, mastered: 3 };

function pickHigher(a: number, b: number): 'local' | 'remote' | 'equal' {
  if (a > b) return 'local';
  if (b > a) return 'remote';
  return 'equal';
}

/**
 * Per-node conflict resolution: last-write-wins, local winning ties.
 * Higher state rank wins first (mastered > cleared > open); then the later
 * lastPlayedAt; then the higher bestCombo; an exact tie goes local.
 */
export function resolveNodeConflict(
  local: ProgressRow,
  remote: RemoteProgressRow | null,
): { row: ProgressRow; winner: 'local' | 'remote' | 'tie-local' } {
  if (!remote) return { row: local, winner: 'local' };
  const remoteRow: ProgressRow = {
    nodeId: local.nodeId,
    state: remote.state,
    bestCombo: remote.bestCombo,
    lastPlayedAt: remote.lastPlayedAt,
    nextRematchAt: remote.nextRematchAt,
    wrongTags: remote.wrongTags,
    rematchWins: 0, // derived on load, not synced
  };
  const rankDiff = STATE_RANK[local.state] - STATE_RANK[remoteRow.state];
  if (rankDiff !== 0) {
    const winner = rankDiff > 0 ? 'local' : 'remote';
    return { row: winner === 'local' ? local : remoteRow, winner };
  }
  const localPlayed = local.lastPlayedAt ?? 0;
  const remotePlayed = remoteRow.lastPlayedAt ?? 0;
  if (localPlayed !== remotePlayed) {
    const winner = localPlayed > remotePlayed ? 'local' : 'remote';
    return { row: winner === 'local' ? local : remoteRow, winner };
  }
  if (local.bestCombo !== remoteRow.bestCombo) {
    const winner = local.bestCombo > remoteRow.bestCombo ? 'local' : 'remote';
    return { row: winner === 'local' ? local : remoteRow, winner };
  }
  // Exact tie: local wins. Wrong tags are unioned either way — a missed
  // question is a fact on both sides, never dropped by a merge.
  return {
    row: { ...local, wrongTags: Array.from(new Set([...local.wrongTags, ...remoteRow.wrongTags])) },
    winner: 'tie-local',
  };
}

function dayString(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

/** Merge a remote snapshot into the local one. Never lowers xp/gems/streak. */
export function mergeSnapshots(
  local: ProgressionSnapshot,
  remote: RemoteSnapshot | null,
  nowMs: number,
): { snapshot: ProgressionSnapshot; report: MergeReport } {
  if (!remote) {
    return {
      snapshot: local,
      report: {
        source: 'local-only',
        xpKept: 'local',
        gemsKept: 'local',
        streakKept: 'local',
        nodesMerged: 0,
        nodesLocalWon: 0,
        nodesRemoteWon: 0,
        nodesTiedLocal: 0,
      },
    };
  }

  const xpKept = pickHigher(local.xp, remote.user.xp);
  const gemsKept = pickHigher(local.gems, remote.user.gems);
  const streakKept = pickHigher(local.streak, remote.user.streak);
  const xp = Math.max(local.xp, remote.user.xp);
  const gems = Math.max(local.gems, remote.user.gems);
  const streak = Math.max(local.streak, remote.user.streak);
  const streakFreeze = Math.max(local.streakFreeze, remote.user.streakFreeze);
  const lastPlayedDay =
    (local.lastPlayedDay ?? '') >= (remote.user.lastPlayedDay ?? '')
      ? local.lastPlayedDay
      : remote.user.lastPlayedDay;

  const nodeIds = new Set([...Object.keys(local.progress), ...Object.keys(remote.progress)]);
  const progress: Record<string, ProgressRow> = {};
  let nodesLocalWon = 0;
  let nodesRemoteWon = 0;
  let nodesTiedLocal = 0;
  for (const nodeId of nodeIds) {
    const localRow = local.progress[nodeId];
    const remoteRow = remote.progress[nodeId] ?? null;
    if (!localRow) {
      progress[nodeId] = {
        nodeId,
        state: remoteRow!.state,
        bestCombo: remoteRow!.bestCombo,
        lastPlayedAt: remoteRow!.lastPlayedAt,
        nextRematchAt: remoteRow!.nextRematchAt,
        wrongTags: remoteRow!.wrongTags,
        rematchWins: 0,
      };
      nodesRemoteWon += 1;
      continue;
    }
    const { row, winner } = resolveNodeConflict(localRow, remoteRow);
    progress[nodeId] = row;
    if (winner === 'local') nodesLocalWon += 1;
    else if (winner === 'remote') nodesRemoteWon += 1;
    else nodesTiedLocal += 1;
  }

  const winsByNode: Record<string, number> = {};
  for (const nodeId of new Set([...Object.keys(local.winsByNode), ...Object.keys(remote.user.winsByNode)])) {
    winsByNode[nodeId] = Math.max(local.winsByNode[nodeId] ?? 0, remote.user.winsByNode[nodeId] ?? 0);
  }

  // Quests belong to a local day: keep today's set from whichever side has it.
  const today = dayString(nowMs);
  const quests =
    local.questDay === today && local.quests.length === 3 ? local.quests : local.quests;
  const questDay = local.questDay === today ? local.questDay : today;

  return {
    snapshot: {
      ...local,
      xp,
      level: levelForXp(xp),
      gems,
      streak,
      streakFreeze,
      lastPlayedDay,
      progress,
      quests,
      questDay,
      winsByNode,
    },
    report: {
      source: 'merged',
      xpKept,
      gemsKept,
      streakKept,
      nodesMerged: nodeIds.size,
      nodesLocalWon,
      nodesRemoteWon,
      nodesTiedLocal,
    },
  };
}

/** The user-doc shape written to users/{uid}. */
export function buildUserDoc(
  snapshot: ProgressionSnapshot,
  nowMs: number,
  weekly?: { xp: number; weekId: string },
): RemoteUserDoc {
  return {
    xp: snapshot.xp,
    level: snapshot.level,
    gems: snapshot.gems,
    streak: snapshot.streak,
    streakFreeze: snapshot.streakFreeze,
    lastPlayedDay: snapshot.lastPlayedDay,
    winsByNode: snapshot.winsByNode,
    updatedAt: nowMs,
    ...(weekly ? { weeklyXp: weekly.xp, weeklyXpWeekId: weekly.weekId } : {}),
  };
}

/** The progress-doc shape written to users/{uid}/progress/{nodeId}. */
export function buildProgressDocs(snapshot: ProgressionSnapshot): Record<string, RemoteProgressRow> {
  const docs: Record<string, RemoteProgressRow> = {};
  for (const row of Object.values(snapshot.progress)) {
    docs[row.nodeId] = {
      state: row.state,
      bestCombo: row.bestCombo,
      lastPlayedAt: row.lastPlayedAt,
      nextRematchAt: row.nextRematchAt,
      wrongTags: row.wrongTags,
    };
  }
  return docs;
}

/** Keep only the most recent fights (by endedAt) — the synced log is capped. */
export function pruneFights(fights: RemoteFight[], limit: number = MAX_FIGHTS_SYNCED): RemoteFight[] {
  return [...fights].sort((a, b) => b.endedAt - a.endedAt).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Firestore port (injected in tests, real implementation lazy-requires)
// ---------------------------------------------------------------------------

export interface FirestorePort {
  getUserDoc(uid: string): Promise<RemoteUserDoc | null>;
  setUserDoc(uid: string, doc: RemoteUserDoc): Promise<void>;
  getProgress(uid: string): Promise<Record<string, RemoteProgressRow>>;
  setProgress(uid: string, docs: Record<string, RemoteProgressRow>): Promise<void>;
  addFights(uid: string, fights: RemoteFight[]): Promise<void>;
  /** Delete the user doc + progress + fights (account deletion). */
  deleteUserData(uid: string): Promise<void>;
  /** Remove one league membership doc (account deletion / league leave). */
  deleteLeagueMember(weekId: string, leagueId: string, uid: string): Promise<void>;
  /** Write this week's XP into a league member doc (see leagues.ts). */
  setLeagueMember(
    weekId: string,
    leagueId: string,
    uid: string,
    member: { weeklyXp: number; displayName: string | null },
  ): Promise<void>;
  getLeagueMembers(
    weekId: string,
    leagueId: string,
  ): Promise<{ uid: string; weeklyXp: number; displayName: string | null }[]>;
  /** The league group doc itself (tier + member count). Null when unplaced. */
  getLeagueGroup(
    weekId: string,
    leagueId: string,
  ): Promise<{ tier: LeagueTier } | null>;
}

type FirestoreInstance = {
  collection: (path: string) => {
    doc: (id: string) => {
      get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
      set: (data: Record<string, unknown>, opts?: { merge?: boolean }) => Promise<void>;
      delete: () => Promise<void>;
      collection: (sub: string) => {
        doc: (id: string) => {
          get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
          set: (data: Record<string, unknown>, opts?: { merge?: boolean }) => Promise<void>;
          delete: () => Promise<void>;
        };
        get: () => Promise<{ docs: { id: string; data: () => Record<string, unknown> }[] }>;
      };
    };
  };
  batch: () => {
    set: (ref: unknown, data: Record<string, unknown>, opts?: { merge?: boolean }) => void;
    delete: (ref: unknown) => void;
    commit: () => Promise<void>;
  };
};

function loadFirestore(): FirestoreInstance {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-firebase/firestore') as { default: () => FirestoreInstance };
  return mod.default();
}

function docRef(fs: FirestoreInstance, path: string, id: string) {
  return fs.collection(path).doc(id);
}

function toRemoteUserDoc(data: Record<string, unknown>): RemoteUserDoc {
  const currentLeague = data.currentLeague as { weekId: string; leagueId: string } | undefined;
  return {
    xp: Number(data.xp ?? 0),
    level: Number(data.level ?? 1),
    gems: Number(data.gems ?? 0),
    streak: Number(data.streak ?? 0),
    streakFreeze: Number(data.streakFreeze ?? 0),
    lastPlayedDay: (data.lastPlayedDay as string | null) ?? null,
    winsByNode: (data.winsByNode as Record<string, number>) ?? {},
    updatedAt: Number(data.updatedAt ?? 0),
    weeklyXp: data.weeklyXp === undefined ? undefined : Number(data.weeklyXp),
    weeklyXpWeekId: (data.weeklyXpWeekId as string | undefined) ?? undefined,
    currentLeague: currentLeague ?? null,
  };
}

function toRemoteProgressRow(data: Record<string, unknown>): RemoteProgressRow {
  return {
    state: (data.state as RemoteProgressRow['state']) ?? 'open',
    bestCombo: Number(data.bestCombo ?? 0),
    lastPlayedAt: (data.lastPlayedAt as number | null) ?? null,
    nextRematchAt: (data.nextRematchAt as number | null) ?? null,
    wrongTags: (data.wrongTags as string[]) ?? [],
  };
}

export const FirebaseFirestorePort: FirestorePort = {
  async getUserDoc(uid) {
    const fs = loadFirestore();
    const snap = await docRef(fs, 'users', uid).get();
    if (!snap.exists) return null;
    const data = snap.data();
    return data ? toRemoteUserDoc(data) : null;
  },

  async setUserDoc(uid, doc) {
    const fs = loadFirestore();
    await docRef(fs, 'users', uid).set({ ...doc }, { merge: true });
  },

  async getProgress(uid) {
    const fs = loadFirestore();
    const snap = await docRef(fs, 'users', uid).collection('progress').get();
    const out: Record<string, RemoteProgressRow> = {};
    for (const d of snap.docs) out[d.id] = toRemoteProgressRow(d.data());
    return out;
  },

  async setProgress(uid, docs) {
    const fs = loadFirestore();
    const batch = fs.batch();
    const coll = docRef(fs, 'users', uid).collection('progress');
    for (const [nodeId, row] of Object.entries(docs)) {
      batch.set(coll.doc(nodeId), { ...row }, { merge: true });
    }
    await batch.commit();
  },

  async addFights(uid, fights) {
    if (fights.length === 0) return;
    const fs = loadFirestore();
    const batch = fs.batch();
    const coll = docRef(fs, 'users', uid).collection('fights');
    for (const f of fights) {
      const fightId = `${uid}:${f.nodeId}:${f.startedAt}`;
      batch.set(coll.doc(fightId), { ...f }, { merge: true });
    }
    await batch.commit();
  },

  async deleteUserData(uid) {
    const fs = loadFirestore();
    const userRef = docRef(fs, 'users', uid);
    for (const sub of ['progress', 'fights']) {
      const snap = await userRef.collection(sub).get();
      const batch = fs.batch();
      for (const d of snap.docs) batch.delete(userRef.collection(sub).doc(d.id));
      await batch.commit();
    }
    await userRef.delete();
  },

  async deleteLeagueMember(weekId, leagueId, uid) {
    const fs = loadFirestore();
    await fs
      .collection(`leagues/${weekId}/groups`)
      .doc(leagueId)
      .collection('members')
      .doc(uid)
      .delete();
  },

  async setLeagueMember(weekId, leagueId, uid, member) {
    const fs = loadFirestore();
    await fs
      .collection(`leagues/${weekId}/groups`)
      .doc(leagueId)
      .collection('members')
      .doc(uid)
      .set({ ...member, updatedAt: Date.now() }, { merge: true });
  },

  async getLeagueMembers(weekId, leagueId) {
    const fs = loadFirestore();
    const snap = await fs
      .collection(`leagues/${weekId}/groups`)
      .doc(leagueId)
      .collection('members')
      .get();
    return snap.docs.map(d => {
      const data = d.data();
      return {
        uid: d.id,
        weeklyXp: Number(data.weeklyXp ?? 0),
        displayName: (data.displayName as string | null) ?? null,
      };
    });
  },

  async getLeagueGroup(weekId, leagueId) {
    const fs = loadFirestore();
    const snap = await fs.collection(`leagues/${weekId}/groups`).doc(leagueId).get();
    if (!snap.exists) return null;
    const data = snap.data();
    const tier = data?.tier as string | undefined;
    const valid: LeagueTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    return { tier: (valid.includes(tier as LeagueTier) ? tier : 'Bronze') as LeagueTier };
  },
};

// ---------------------------------------------------------------------------
// Sync orchestration (port-injected; callers catch — never throws into a fight)
// ---------------------------------------------------------------------------

export interface SyncResult {
  snapshot: ProgressionSnapshot;
  report: MergeReport;
  pushed: boolean;
}

/** Load the local fights log (most recent first) for the capped sync upload. */
export async function loadLocalFights(userId: string, limit: number = MAX_FIGHTS_SYNCED): Promise<RemoteFight[]> {
  const db = openDb();
  const rows = (await db.executeAsync(
    `SELECT node_id, result, correct_count, wrong_count, best_combo, xp_earned, started_at, ended_at FROM fights WHERE user_id = ? ORDER BY ended_at DESC LIMIT ?`,
    [userId, limit],
  )).rows as unknown as Record<string, unknown>[];
  return rows.map(r => ({
    nodeId: String(r.node_id),
    result: (r.result === 'win' ? 'win' : 'lose') as 'win' | 'lose',
    correctCount: Number(r.correct_count ?? 0),
    wrongCount: Number(r.wrong_count ?? 0),
    bestCombo: Number(r.best_combo ?? 0),
    xpEarned: Number(r.xp_earned ?? 0),
    startedAt: Number(r.started_at ?? 0),
    endedAt: Number(r.ended_at ?? 0),
  }));
}

/**
 * Full sync: pull remote → merge (local never loses) → push merged state +
 * last-100 fights. Returns the merged snapshot the store should adopt.
 * Throws on network/native failure — callers MUST catch and stay local.
 */
export async function syncNow(
  port: FirestorePort,
  uid: string,
  local: ProgressionSnapshot,
  nowMs: number = Date.now(),
): Promise<SyncResult> {
  const [remoteUser, remoteProgress] = await Promise.all([
    port.getUserDoc(uid),
    port.getProgress(uid),
  ]);
  const remote: RemoteSnapshot | null = remoteUser
    ? { user: remoteUser, progress: remoteProgress }
    : null;
  const { snapshot, report } = mergeSnapshots(local, remote, nowMs);
  // The fights log is a capped nicety, not the sync's purpose: a DB read
  // failure (native module unavailable under Jest / cold start) must never
  // fail the user-doc + progress sync.
  let fights: RemoteFight[] = [];
  try {
    fights = pruneFights(await loadLocalFights(local.userId), MAX_FIGHTS_SYNCED);
  } catch {
    fights = [];
  }
  const weekly = weeklyXpForFights(fights, nowMs);
  await port.setUserDoc(uid, buildUserDoc(snapshot, nowMs, { xp: weekly, weekId: weekIdFor(nowMs) }));
  await port.setProgress(uid, buildProgressDocs(snapshot));
  await port.addFights(uid, fights);
  return { snapshot, report, pushed: true };
}

/** Upload-only (no pull): used right after first anonymous sign-in. */
export async function pushSnapshot(
  port: FirestorePort,
  uid: string,
  snapshot: ProgressionSnapshot,
  nowMs: number = Date.now(),
): Promise<void> {
  let fights: RemoteFight[] = [];
  try {
    fights = pruneFights(await loadLocalFights(snapshot.userId), MAX_FIGHTS_SYNCED);
  } catch {
    fights = [];
  }
  const weekly = weeklyXpForFights(fights, nowMs);
  await port.setUserDoc(uid, buildUserDoc(snapshot, nowMs, { xp: weekly, weekId: weekIdFor(nowMs) }));
  await port.setProgress(uid, buildProgressDocs(snapshot));
  await port.addFights(uid, fights);
}
