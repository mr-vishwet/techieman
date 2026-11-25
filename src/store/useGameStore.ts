// TechieMan — Zustand game store (M1 scaffold → M5 auth + sync + leagues).
// The store is the in-memory mirror of the SQLite progression snapshot:
// every mutation runs the SAME pure applyFight() the DB shell runs, so the
// UI and the database can never disagree. Persistence is fire-and-forget —
// if the native module is unavailable (Jest, or a cold start) the in-memory
// state still updates and the DB catches up on the next hydrate.
//
// M5: the store also owns auth + sync state. Local SQLite/MMKV is always
// the source of truth; Firestore sync is fire-and-forget and offline-first.
// Guest-first: hydrate() works with no Firebase config at all (guest-only
// mode); auth is an optional upgrade, never a wall.

import { create } from 'zustand';
import { ALL_QUESTIONS } from '../data/allQuestions';
import { initDb } from '../storage/bank';
import { getGuestId, regenerateGuestId } from '../storage/guest';
import {
  applyArcadeXp,
  applyFight,
  dayString,
  emptySnapshot,
  loadSnapshot,
  persistCommands,
  snapshotRematch,
  type FightInput,
  type FightSummary,
  type ProgressionSnapshot,
} from '../storage/progress';
import { generateDailyQuests, type Quest } from '../engine/progression';
import { isFirebaseConfigured } from '../firebase/firebase';
import {
  authStatusFor,
  authUnavailableReason,
  upgradeToEmail,
  FirebaseAuthPort,
  type AuthStatus,
} from '../firebase/auth';
import { FirebaseFirestorePort, loadLocalFights } from '../firebase/sync';
import {
  afterFightSync,
  deleteAccountFlow,
  initAuthAndSync,
  loadMyLeague,
  pushLeagueXp,
  readLastMerge,
  signBackInFlow,
  signOutFlow,
  type MyLeagueResult,
  type SyncManagerDeps,
} from '../firebase/syncManager';
import type { MergeReport } from '../firebase/sync';
import { weekIdFor, weeklyXpForFights } from '../firebase/leagues';
import { setLinkedFirebaseUid } from '../firebase/identity';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'queued' | 'offline' | 'unavailable';

interface GameState {
  userId: string | null;
  hydrated: boolean;
  xp: number;
  level: number;
  gems: number;
  streak: number;
  streakFreeze: number;
  lastPlayedDay: string | null;
  clearedNodeIds: string[];
  masteredNodeIds: string[];
  quests: Quest[];
  questDay: string;
  rematchNodeId: string | null;
  rematchTag: string | null;
  /** Full snapshot (source of truth for progress rows). */
  snapshot: ProgressionSnapshot | null;
  hydrate: () => Promise<void>;
  finishFight: (nodeId: string, input: Omit<FightInput, 'nodeId'>) => FightSummary;
  /** Bank arcade XP (new-best-only, pre-computed by the screen). Returns the XP banked. */
  finishArcadeRun: (xpEarned: number) => number;
  setCurrentNode: (nodeId: string | null) => void;
  currentNodeId: string | null;

  // --- M5: auth + sync + leagues ---
  authStatus: AuthStatus;
  authUid: string | null;
  authEmail: string | null;
  firebaseReady: boolean;
  syncState: SyncState;
  authError: string | null;
  authBusy: boolean;
  lastMerge: MergeReport | null;
  league: MyLeagueResult | null;
  leagueLoading: boolean;
  initAuth: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Explicit, confirmed account deletion — separate from sign-out. */
  deleteAccount: () => Promise<boolean>;
  refreshLeague: () => Promise<void>;
}

function derive(snapshot: ProgressionSnapshot, nowMs: number) {
  const rows = Object.values(snapshot.progress);
  const rematch = snapshotRematch(snapshot, nowMs);
  return {
    xp: snapshot.xp,
    level: snapshot.level,
    gems: snapshot.gems,
    streak: snapshot.streak,
    streakFreeze: snapshot.streakFreeze,
    lastPlayedDay: snapshot.lastPlayedDay,
    clearedNodeIds: rows.filter(r => r.state === 'cleared' || r.state === 'mastered').map(r => r.nodeId),
    masteredNodeIds: rows.filter(r => r.state === 'mastered').map(r => r.nodeId),
    quests: snapshot.quests,
    questDay: snapshot.questDay,
    rematchNodeId: rematch?.nodeId ?? null,
    rematchTag: rematch?.wrongTags[0] ?? null,
  };
}

export const useGameStore = create<GameState>()((set, get) => {
  function deps(): SyncManagerDeps {
    return {
      authPort: FirebaseAuthPort,
      fsPort: FirebaseFirestorePort,
      guestId: get().userId ?? getGuestId(),
      getSnapshot: () => get().snapshot,
      adoptSnapshot: snapshot => set({ snapshot, ...derive(snapshot, Date.now()) }),
      resetLocal: () => {
        const freshId = regenerateGuestId();
        const fresh = emptySnapshot(freshId);
        const today = dayString(Date.now());
        fresh.quests = generateDailyQuests(today);
        fresh.questDay = today;
        set({
          userId: freshId,
          snapshot: fresh,
          authStatus: 'guest',
          authUid: null,
          authEmail: null,
          syncState: 'idle',
          lastMerge: null,
          league: null,
          ...derive(fresh, Date.now()),
        });
      },
    };
  }

  /** After a successful auth + sync, load the league and push this week's XP. */
  async function refreshLeagueInner(): Promise<void> {
    const uid = get().authUid;
    if (!uid || !isFirebaseConfigured()) return;
    set({ leagueLoading: true });
    try {
      const league = await loadMyLeague(FirebaseFirestorePort, uid);
      set({ league, leagueLoading: false });
      if (league.status === 'placed') {
        try {
          const fights = await loadLocalFights(get().userId ?? getGuestId());
          const weeklyXp = weeklyXpForFights(fights, Date.now());
          await pushLeagueXp(
            FirebaseFirestorePort,
            uid,
            league.weekId,
            league.league.id,
            weeklyXp,
            get().authEmail,
          );
        } catch {
          // League XP push is best-effort; the user doc already carries weeklyXp.
        }
      }
    } catch {
      set({ leagueLoading: false });
    }
  }

  return {
    userId: null,
    hydrated: false,
    xp: 0,
    level: 1,
    gems: 0,
    streak: 0,
    streakFreeze: 0,
    lastPlayedDay: null,
    clearedNodeIds: [],
    masteredNodeIds: [],
    quests: [],
    questDay: '',
    rematchNodeId: null,
    rematchTag: null,
    snapshot: null,
    currentNodeId: null,

    authStatus: 'guest',
    authUid: null,
    authEmail: null,
    firebaseReady: false,
    syncState: 'idle',
    authError: null,
    authBusy: false,
    lastMerge: null,
    league: null,
    leagueLoading: false,

    setCurrentNode: nodeId => set({ currentNodeId: nodeId }),

    hydrate: async () => {
      const userId = getGuestId();
      let snapshot: ProgressionSnapshot;
      try {
        await initDb(ALL_QUESTIONS);
        snapshot = await loadSnapshot(userId, Date.now());
      } catch {
        // Native module unavailable (tests / cold start): in-memory only.
        // Today's quests are generated locally; the DB catches up on the
        // next successful hydrate.
        snapshot = emptySnapshot(userId);
        const today = dayString(Date.now());
        snapshot.quests = generateDailyQuests(today);
        snapshot.questDay = today;
      }
      set({ userId, hydrated: true, snapshot, ...derive(snapshot, Date.now()) });
      void get().initAuth();
    },

    finishFight: (nodeId, input) => {
      const nowMs = Date.now();
      const prev = get().snapshot ?? emptySnapshot(get().userId ?? getGuestId());
      const result = applyFight(prev, { ...input, nodeId }, nowMs);
      set({ snapshot: result.snapshot, ...derive(result.snapshot, nowMs) });
      // Fire-and-forget persistence; a failure must never break a fight.
      void persistCommands(result.commands).catch(() => undefined);
      // Fire-and-forget sync; a failure queues the payload for later.
      if (get().firebaseReady || get().authStatus !== 'guest') {
        set({ syncState: 'syncing' });
        void afterFightSync(deps()).then(status => {
          set({ syncState: status === 'synced' ? 'synced' : status === 'queued' ? 'queued' : 'idle' });
          if (status === 'synced') set({ lastMerge: readLastMerge() });
        });
      }
      return result.summary;
    },

    finishArcadeRun: (xpEarned: number) => {
      const nowMs = Date.now();
      const prev = get().snapshot ?? emptySnapshot(get().userId ?? getGuestId());
      const result = applyArcadeXp(prev, xpEarned, nowMs);
      set({ snapshot: result.snapshot, ...derive(result.snapshot, nowMs) });
      // Fire-and-forget persistence; a failure must never break a run.
      void persistCommands(result.commands).catch(() => undefined);
      // Fire-and-forget sync, mirroring finishFight — the users doc carries XP.
      if (get().firebaseReady || get().authStatus !== 'guest') {
        set({ syncState: 'syncing' });
        void afterFightSync(deps()).then(status => {
          set({ syncState: status === 'synced' ? 'synced' : status === 'queued' ? 'queued' : 'idle' });
          if (status === 'synced') set({ lastMerge: readLastMerge() });
        });
      }
      return xpEarned;
    },

    initAuth: async () => {
      const ready = isFirebaseConfigured();
      set({ firebaseReady: ready, lastMerge: readLastMerge() });
      if (!ready) {
        set({ syncState: 'unavailable', authStatus: 'guest' });
        return;
      }
      const result = await initAuthAndSync(deps());
      if (result.status === 'synced') {
        set({
          authStatus: authStatusFor(result.user),
          authUid: result.user.uid,
          authEmail: result.user.email,
          syncState: 'synced',
          lastMerge: result.report,
        });
        await refreshLeagueInner();
      } else if (result.status === 'queued') {
        set({
          authStatus: authStatusFor(result.user),
          authUid: result.user.uid,
          authEmail: result.user.email,
          syncState: 'queued',
        });
      } else if (result.status === 'signed-out') {
        set({ authStatus: 'guest', authUid: null, authEmail: null, syncState: 'idle' });
      } else {
        // 'offline': Firebase configured but unreachable — stay a local guest.
        set({ syncState: 'offline' });
      }
    },

    signInWithEmail: async (email, password) => {
      const reason = authUnavailableReason();
      if (reason) {
        set({ authError: reason });
        return;
      }
      set({ authBusy: true, authError: null });
      try {
        const { user } = await upgradeToEmail(FirebaseAuthPort, email, password);
        // upgradeToEmail links (same uid) or signs into an existing account
        // (different uid) — either way the next sync merges, local never loses.
        setLinkedFirebaseUid(user.uid);
        set({ authStatus: authStatusFor(user), authUid: user.uid, authEmail: user.email });
        const result = await initAuthAndSync(deps());
        if (result.status === 'synced') {
          set({ syncState: 'synced', lastMerge: result.report });
          await refreshLeagueInner();
        } else if (result.status === 'queued') {
          set({ syncState: 'queued' });
        }
      } catch (e) {
        set({ authError: friendlyAuthError(e) });
      } finally {
        set({ authBusy: false });
      }
    },

    signInWithGoogle: async () => {
      const reason = authUnavailableReason();
      if (reason) {
        set({ authError: reason });
        return;
      }
      set({ authBusy: true, authError: null });
      try {
        const user = await FirebaseAuthPort.signInWithGoogle();
        setLinkedFirebaseUid(user.uid);
        set({ authStatus: authStatusFor(user), authUid: user.uid, authEmail: user.email });
        const result = await initAuthAndSync(deps());
        if (result.status === 'synced') {
          set({ syncState: 'synced', lastMerge: result.report });
          await refreshLeagueInner();
        } else if (result.status === 'queued') {
          set({ syncState: 'queued' });
        }
      } catch (e) {
        set({ authError: friendlyAuthError(e) });
      } finally {
        set({ authBusy: false });
      }
    },

    signOut: async () => {
      await signOutFlow(deps());
      set({ authStatus: 'guest', authUid: null, authEmail: null, syncState: 'idle', league: null });
    },

    deleteAccount: async () => {
      const league = get().league;
      const currentLeague =
        league && league.status === 'placed' ? { weekId: league.weekId, leagueId: league.league.id } : null;
      const result = await deleteAccountFlow(deps(), currentLeague);
      return result.deletedRemote;
    },

    refreshLeague: async () => {
      await refreshLeagueInner();
    },
  };
});

function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const message = e instanceof Error ? e.message : String(e);
  if (code.includes('email-already-in-use') || message.includes('email-already-in-use')) {
    return 'That email already has an account — sign in with it instead of creating a new one.';
  }
  if (code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Wrong email or password. Try again.';
  }
  if (code.includes('user-not-found')) {
    return 'No account with that email — create one instead.';
  }
  if (code.includes('network') || message.includes('network')) {
    return 'No connection — your progress is safe locally. Try again when you are online.';
  }
  if (code.includes('SIGN_IN_CANCELLED') || message.includes('cancelled')) {
    return 'Google sign-in was cancelled.';
  }
  return `Could not sign in (${message}). Your progress is safe locally.`;
}
