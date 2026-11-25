// TechieMan — auth + sync orchestration (M5).
// The store calls these; they never throw into the UI. Every failure
// degrades to local-guest mode and (for sync) queues the payload.
//
//   initAuthAndSync()  — hydrate-time: anonymous sign-in (unless the user
//                        explicitly signed out), link uid ↔ guest id, full
//                        sync (pull → merge → push), flush the outbox.
//   afterFightSync()   — after finishFight: attempt a sync, else enqueue.
//   flushOutboxNow()   — retry queued payloads (called on hydrate + after
//                        a successful sync).
//   signOutFlow()      — drops the Firebase session ONLY; local data stays.
//   deleteAccountFlow()— explicit, separate: deletes Firestore user data +
//                        the Firebase user + the uid link, then resets the
//                        local snapshot (fresh guest). Never wired to sign-out.
//   loadMyLeague()     — reads the player's league for the current week, or
//                        the honest "not placed yet" state.

import { isFirebaseConfigured } from './firebase';
import { ensureAnonymousUser, type AuthPort, type AuthUser } from './auth';
import {
  pushSnapshot,
  syncNow,
  type FirestorePort,
  type MergeReport,
} from './sync';
import { weekIdFor, rankLeague, type League } from './leagues';
import { enqueueSnapshot, peekOutbox, removeFromOutbox, clearOutbox } from './outbox';
import {
  clearLinkedFirebaseUid,
  getLastMergeJson,
  getLinkedFirebaseUid,
  isExplicitlySignedOut,
  setExplicitlySignedOut,
  setLastMergeJson,
  setLinkedFirebaseUid,
} from './identity';
import type { ProgressionSnapshot } from '../storage/progress';

export interface SyncManagerDeps {
  authPort: AuthPort;
  fsPort: FirestorePort;
  guestId: string;
  /** Current local snapshot (may be null before hydrate). */
  getSnapshot: () => ProgressionSnapshot | null;
  /** Adopt a merged snapshot into the store + SQLite. */
  adoptSnapshot: (snapshot: ProgressionSnapshot) => void;
  /** Reset local state to a fresh guest (account deletion). */
  resetLocal: () => void;
}

export type InitAuthResult =
  | { status: 'unconfigured' }
  | { status: 'signed-out' }
  | { status: 'offline' }
  | { status: 'synced'; user: AuthUser; report: MergeReport; outboxFlushed: number }
  | { status: 'queued'; user: AuthUser; dropped: number };

export function readLastMerge(): MergeReport | null {
  try {
    const raw = getLastMergeJson();
    return raw ? (JSON.parse(raw) as MergeReport) : null;
  } catch {
    return null;
  }
}

function recordMerge(report: MergeReport): void {
  try {
    setLastMergeJson(JSON.stringify(report));
  } catch {
    // ignore
  }
}

async function flushOutbox(deps: SyncManagerDeps, uid: string): Promise<number> {
  const entries = peekOutbox();
  if (entries.length === 0) return 0;
  const snapshot = deps.getSnapshot();
  if (!snapshot) return 0;
  // Entries are full snapshots; replaying the LATEST one is the correct
  // resolution — syncNow merges and never lowers xp/gems/streak.
  try {
    await syncNow(deps.fsPort, uid, snapshot);
    removeFromOutbox(entries.map(e => e.id));
    return entries.length;
  } catch {
    return 0;
  }
}

export async function initAuthAndSync(deps: SyncManagerDeps): Promise<InitAuthResult> {
  if (!isFirebaseConfigured()) return { status: 'unconfigured' };
  if (isExplicitlySignedOut()) return { status: 'signed-out' };
  const user = await ensureAnonymousUser(deps.authPort);
  if (!user) return { status: 'offline' };
  setLinkedFirebaseUid(user.uid);
  const snapshot = deps.getSnapshot();
  if (!snapshot) return { status: 'synced', user, report: { source: 'local-only', xpKept: 'local', gemsKept: 'local', streakKept: 'local', nodesMerged: 0, nodesLocalWon: 0, nodesRemoteWon: 0, nodesTiedLocal: 0 }, outboxFlushed: 0 };
  try {
    const { snapshot: merged, report } = await syncNow(deps.fsPort, user.uid, snapshot);
    deps.adoptSnapshot(merged);
    recordMerge(report);
    const flushed = await flushOutbox(deps, user.uid);
    return { status: 'synced', user, report, outboxFlushed: flushed };
  } catch {
    const { dropped } = enqueueSnapshot(deps.guestId, JSON.stringify(snapshot));
    return { status: 'queued', user, dropped };
  }
}

/** Fire-and-forget after a fight. Returns what happened; never throws. */
export async function afterFightSync(deps: SyncManagerDeps): Promise<'synced' | 'queued' | 'skipped'> {
  try {
    if (!isFirebaseConfigured()) {
      const snapshot = deps.getSnapshot();
      if (snapshot) enqueueSnapshot(deps.guestId, JSON.stringify(snapshot));
      return 'queued';
    }
    const uid = getLinkedFirebaseUid() ?? deps.authPort.currentUser()?.uid ?? null;
    const snapshot = deps.getSnapshot();
    if (!uid || !snapshot) return 'skipped';
    try {
      const { snapshot: merged, report } = await syncNow(deps.fsPort, uid, snapshot);
      deps.adoptSnapshot(merged);
      recordMerge(report);
      await flushOutbox(deps, uid);
      return 'synced';
    } catch {
      enqueueSnapshot(deps.guestId, JSON.stringify(snapshot));
      return 'queued';
    }
  } catch {
    // Sync must never break a fight.
    return 'skipped';
  }
}

export async function signOutFlow(deps: SyncManagerDeps): Promise<void> {
  try {
    await deps.authPort.signOut();
  } catch {
    // Even if the native sign-out fails, mark signed-out locally so the
    // next launch does not silently re-create an anonymous account.
  }
  setExplicitlySignedOut(true);
  // Local data is deliberately KEPT (SQLite + MMKV) — sign-out is not deletion.
}

export async function signBackInFlow(deps: SyncManagerDeps): Promise<InitAuthResult> {
  setExplicitlySignedOut(false);
  return initAuthAndSync(deps);
}

export interface DeleteAccountResult {
  deletedRemote: boolean;
  /** The uid whose data was deleted (for the confirmation copy). */
  uid: string | null;
}

/**
 * EXPLICIT account deletion — separate from sign-out, called only from a
 * confirm dialog. Deletes Firestore user data + league membership (when
 * the current league is known) + the Firebase user, clears the uid link
 * and the outbox, and resets local state to a fresh guest.
 */
export async function deleteAccountFlow(
  deps: SyncManagerDeps,
  currentLeague: { weekId: string; leagueId: string } | null,
): Promise<DeleteAccountResult> {
  const uid = getLinkedFirebaseUid() ?? deps.authPort.currentUser()?.uid ?? null;
  let deletedRemote = false;
  if (uid && isFirebaseConfigured()) {
    try {
      if (currentLeague) {
        await deps.fsPort.deleteLeagueMember(currentLeague.weekId, currentLeague.leagueId, uid);
      }
      await deps.fsPort.deleteUserData(uid);
      // Only delete the Firebase user when one is actually signed in —
      // the uid may come from the stored link alone (e.g. after a restart
      // with no session). Deleting with no current user must not fail the
      // whole deletion: the Firestore data is already gone.
      if (deps.authPort.currentUser()) {
        await deps.authPort.deleteCurrentUser();
      }
      deletedRemote = true;
    } catch {
      deletedRemote = false;
    }
  }
  clearLinkedFirebaseUid();
  setExplicitlySignedOut(false);
  clearOutbox();
  deps.resetLocal();
  return { deletedRemote, uid };
}

// ---------------------------------------------------------------------------
// Leagues (read path)
// ---------------------------------------------------------------------------

export type MyLeagueResult =
  | { status: 'not-configured' }
  | { status: 'not-placed'; weekId: string }
  | { status: 'placed'; weekId: string; league: League; myRank: number | null };

export async function loadMyLeague(
  fsPort: FirestorePort,
  uid: string,
  nowMs: number = Date.now(),
): Promise<MyLeagueResult> {
  if (!isFirebaseConfigured()) return { status: 'not-configured' };
  const weekId = weekIdFor(nowMs);
  const userDoc = await fsPort.getUserDoc(uid);
  const current = userDoc?.currentLeague ?? null;
  if (!current || current.weekId !== weekId) return { status: 'not-placed', weekId };
  const [members, group] = await Promise.all([
    fsPort.getLeagueMembers(current.weekId, current.leagueId),
    fsPort.getLeagueGroup(current.weekId, current.leagueId),
  ]);
  const ranked = rankLeague(members.map(m => ({ uid: m.uid, displayName: m.displayName, weeklyXp: m.weeklyXp })));
  const me = ranked.find(m => m.uid === uid);
  return {
    status: 'placed',
    weekId,
    league: { id: current.leagueId, weekId, tier: group?.tier ?? 'Bronze', members: ranked },
    myRank: me ? me.rank : null,
  };
}

/** Push this week's XP into the player's league member doc (after a sync). */
export async function pushLeagueXp(
  fsPort: FirestorePort,
  uid: string,
  weekId: string,
  leagueId: string,
  weeklyXp: number,
  displayName: string | null,
): Promise<void> {
  await fsPort.setLeagueMember(weekId, leagueId, uid, { weeklyXp, displayName });
}
