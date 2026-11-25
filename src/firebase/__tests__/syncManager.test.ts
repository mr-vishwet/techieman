// Tests for the M5 auth + sync orchestration (syncManager.ts).
//
// isFirebaseConfigured() is false under Jest for real (the native module
// is absent), so it is mocked in THIS file only via jest.mock('../firebase')
// — the mock toggles per test, letting both the real 'unconfigured' path
// and the fake-port 'synced'/'queued'/delete paths run. The source is
// untouched: syncManager imports isFirebaseConfigured from './firebase',
// which resolves to the same module this mock replaces.
//
// Two honest limits under Jest (see report): identity.ts stores the uid
// link / explicit-sign-out flag in MMKV, which is absent under Jest, so
// getLinkedFirebaseUid() always returns null here (the uid therefore comes
// from the fake AuthPort's currentUser) and the 'signed-out' init path
// (isExplicitlySignedOut() === true) cannot be reached.
import { isFirebaseConfigured } from '../firebase';

jest.mock('../firebase', () => ({
  isFirebaseConfigured: jest.fn(() => true),
  PLACEHOLDER_PROJECT_ID: 'techieman-placeholder',
  getFirebaseProjectId: jest.fn(() => 'real-project'),
}));

import { type AuthPort, type AuthUser } from '../auth';
import { type LeagueTier } from '../leagues';
import { __resetOutboxForTests, peekOutbox, enqueueSnapshot } from '../outbox';
import {
  __resetIdentityForTests,
  getLinkedFirebaseUid,
  setExplicitlySignedOut,
  setLinkedFirebaseUid,
} from '../identity';
import { emptySnapshot, type ProgressionSnapshot } from '../../storage/progress';
import { levelForXp } from '../../engine/progression';
import {
  afterFightSync,
  deleteAccountFlow,
  initAuthAndSync,
  loadMyLeague,
  pushLeagueXp,
  signBackInFlow,
  signOutFlow,
  type SyncManagerDeps,
} from '../syncManager';
import {
  type FirestorePort,
  type RemoteProgressRow,
  type RemoteUserDoc,
} from '../sync';

const mockedIsConfigured = isFirebaseConfigured as jest.Mock;

const NOW = Date.UTC(2026, 10, 25, 12, 0, 0); // Wed 2026-11-25 → week 2026-W48

function setConfigured(value: boolean): void {
  mockedIsConfigured.mockReturnValue(value);
}

function authUser(uid: string, partial: Partial<AuthUser> = {}): AuthUser {
  return { uid, email: null, isAnonymous: true, providerId: 'anonymous', ...partial };
}

function remoteUser(partial: Partial<RemoteUserDoc> = {}): RemoteUserDoc {
  return {
    xp: 0,
    level: 1,
    gems: 0,
    streak: 0,
    streakFreeze: 0,
    lastPlayedDay: null,
    winsByNode: {},
    updatedAt: 0,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeAuthPort implements AuthPort {
  current: AuthUser | null = null;
  signInCalls = 0;
  signOutCalls = 0;
  deleteCalls = 0;
  signOutError: Error | null = null;

  currentUser(): AuthUser | null {
    return this.current;
  }
  async signInAnonymously(): Promise<AuthUser> {
    this.signInCalls += 1;
    const created = authUser('fb-uid-1');
    this.current = created;
    return created;
  }
  async linkWithEmail(): Promise<AuthUser> {
    throw new Error('not exercised');
  }
  async signInWithEmail(): Promise<AuthUser> {
    throw new Error('not exercised');
  }
  async signInWithGoogle(): Promise<AuthUser> {
    throw new Error('not exercised');
  }
  async signOut(): Promise<void> {
    this.signOutCalls += 1;
    if (this.signOutError) throw this.signOutError;
  }
  async deleteCurrentUser(): Promise<void> {
    this.deleteCalls += 1;
    this.current = null;
  }
  onAuthStateChanged(): () => void {
    return () => {};
  }
}

type LeagueMemberRow = { uid: string; weeklyXp: number; displayName: string | null };

class FakeFirestorePort implements FirestorePort {
  users = new Map<string, RemoteUserDoc>();
  progress = new Map<string, Record<string, RemoteProgressRow>>();
  leagueMembers = new Map<string, LeagueMemberRow[]>();
  leagueGroups = new Map<string, LeagueTier>();
  setUserDocCalls: RemoteUserDoc[] = [];
  setLeagueMemberCalls: { weekId: string; leagueId: string; uid: string; weeklyXp: number }[] = [];
  deleteUserDataCalls: string[] = [];
  deleteLeagueMemberCalls: { weekId: string; leagueId: string; uid: string }[] = [];
  getUserDocCalls = 0;
  throwOnGet: Error | null = null;
  throwOnDelete: Error | null = null;

  async getUserDoc(uid: string): Promise<RemoteUserDoc | null> {
    this.getUserDocCalls += 1;
    if (this.throwOnGet) throw this.throwOnGet;
    return this.users.get(uid) ?? null;
  }
  async setUserDoc(uid: string, doc: RemoteUserDoc): Promise<void> {
    this.setUserDocCalls.push(doc);
    this.users.set(uid, doc);
  }
  async getProgress(uid: string): Promise<Record<string, RemoteProgressRow>> {
    return this.progress.get(uid) ?? {};
  }
  async setProgress(uid: string, docs: Record<string, RemoteProgressRow>): Promise<void> {
    this.progress.set(uid, docs);
  }
  async addFights(): Promise<void> {}
  async deleteUserData(uid: string): Promise<void> {
    if (this.throwOnDelete) throw this.throwOnDelete;
    this.deleteUserDataCalls.push(uid);
    this.users.delete(uid);
    this.progress.delete(uid);
  }
  async deleteLeagueMember(weekId: string, leagueId: string, uid: string): Promise<void> {
    this.deleteLeagueMemberCalls.push({ weekId, leagueId, uid });
    const key = `${weekId}/${leagueId}`;
    this.leagueMembers.set(key, (this.leagueMembers.get(key) ?? []).filter(m => m.uid !== uid));
  }
  async setLeagueMember(
    weekId: string,
    leagueId: string,
    uid: string,
    member: { weeklyXp: number; displayName: string | null },
  ): Promise<void> {
    this.setLeagueMemberCalls.push({ weekId, leagueId, uid, weeklyXp: member.weeklyXp });
    const key = `${weekId}/${leagueId}`;
    const members = this.leagueMembers.get(key) ?? [];
    const existing = members.find(m => m.uid === uid);
    if (existing) existing.weeklyXp = member.weeklyXp;
    else members.push({ uid, weeklyXp: member.weeklyXp, displayName: member.displayName });
    this.leagueMembers.set(key, members);
  }
  async getLeagueMembers(weekId: string, leagueId: string): Promise<LeagueMemberRow[]> {
    return this.leagueMembers.get(`${weekId}/${leagueId}`) ?? [];
  }
  async getLeagueGroup(
    weekId: string,
    leagueId: string,
  ): Promise<{ tier: LeagueTier } | null> {
    const tier = this.leagueGroups.get(`${weekId}/${leagueId}`);
    return tier ? { tier } : null;
  }
}

function makeDeps(overrides: Partial<SyncManagerDeps> = {}): {
  deps: SyncManagerDeps;
  authPort: FakeAuthPort;
  fsPort: FakeFirestorePort;
  adoptSnapshot: jest.Mock;
  resetLocal: jest.Mock;
  snapshot: ProgressionSnapshot;
} {
  const authPort = new FakeAuthPort();
  const fsPort = new FakeFirestorePort();
  const snapshot: ProgressionSnapshot = {
    ...emptySnapshot('guest-1'),
    xp: 100,
    level: levelForXp(100),
    gems: 3,
    streak: 2,
  };
  let currentSnapshot: ProgressionSnapshot | null = snapshot;
  const adoptSnapshot = jest.fn((s: ProgressionSnapshot) => {
    currentSnapshot = s;
  });
  const resetLocal = jest.fn(() => {
    currentSnapshot = null;
  });
  const deps: SyncManagerDeps = {
    authPort,
    fsPort,
    guestId: 'guest-1',
    getSnapshot: () => currentSnapshot,
    adoptSnapshot,
    resetLocal,
    ...overrides,
  };
  return { deps, authPort, fsPort, adoptSnapshot, resetLocal, snapshot };
}

beforeEach(() => {
  setConfigured(true);
  __resetOutboxForTests();
  __resetIdentityForTests();
});

// ---------------------------------------------------------------------------
// initAuthAndSync
// ---------------------------------------------------------------------------

describe('initAuthAndSync', () => {
  it("unconfigured (real isFirebaseConfigured=false) → 'unconfigured', ports untouched", async () => {
    setConfigured(false);
    const { deps, authPort, fsPort, adoptSnapshot } = makeDeps();
    const result = await initAuthAndSync(deps);
    expect(result).toEqual({ status: 'unconfigured' });
    expect(authPort.signInCalls).toBe(0);
    expect(fsPort.getUserDocCalls).toBe(0);
    expect(adoptSnapshot).not.toHaveBeenCalled();
  });

  it("synced: anonymous sign-in + local-only merge + push, outbox flushed 0", async () => {
    const { deps, authPort, fsPort, adoptSnapshot } = makeDeps();
    const result = await initAuthAndSync(deps);
    expect(result.status).toBe('synced');
    if (result.status !== 'synced') throw new Error('expected synced');
    expect(result.user.uid).toBe('fb-uid-1');
    expect(authPort.signInCalls).toBe(1);
    expect(result.report.source).toBe('local-only');
    expect(result.outboxFlushed).toBe(0);
    expect(adoptSnapshot).toHaveBeenCalledTimes(1);
    expect(adoptSnapshot.mock.calls[0][0].xp).toBe(100);
    expect(fsPort.setUserDocCalls).toHaveLength(1);
    expect(fsPort.setUserDocCalls[0].xp).toBe(100);
  });

  it('synced: remote higher XP is pulled and adopted', async () => {
    const { deps, fsPort, adoptSnapshot } = makeDeps();
    fsPort.users.set('fb-uid-1', remoteUser({ xp: 500, gems: 9, streak: 6 }));
    const result = await initAuthAndSync(deps);
    expect(result.status).toBe('synced');
    if (result.status !== 'synced') throw new Error('expected synced');
    expect(result.report.source).toBe('merged');
    expect(result.report.xpKept).toBe('remote');
    expect(adoptSnapshot.mock.calls[0][0].xp).toBe(500);
    expect(adoptSnapshot.mock.calls[0][0].gems).toBe(9); // local wins gems
  });

  it('no local snapshot yet → synced with a local-only report, no sync attempted', async () => {
    const { deps, fsPort, adoptSnapshot } = makeDeps({ getSnapshot: () => null });
    const result = await initAuthAndSync(deps);
    expect(result.status).toBe('synced');
    if (result.status !== 'synced') throw new Error('expected synced');
    expect(result.report.source).toBe('local-only');
    expect(fsPort.getUserDocCalls).toBe(0);
    expect(adoptSnapshot).not.toHaveBeenCalled();
  });

  it("sync failure → 'queued' and the snapshot lands in the outbox", async () => {
    const { deps, fsPort } = makeDeps();
    fsPort.throwOnGet = new Error('network down');
    const result = await initAuthAndSync(deps);
    expect(result.status).toBe('queued');
    if (result.status !== 'queued') throw new Error('expected queued');
    expect(result.user.uid).toBe('fb-uid-1');
    expect(result.dropped).toBe(0);
    expect(peekOutbox()).toHaveLength(1);
    expect(peekOutbox()[0].guestId).toBe('guest-1');
  });

  it('queued outbox entries flush on the next successful init', async () => {
    const { deps, fsPort } = makeDeps();
    enqueueSnapshot('guest-1', JSON.stringify({ xp: 100 }), NOW);
    expect(peekOutbox()).toHaveLength(1);
    const result = await initAuthAndSync(deps);
    expect(result.status).toBe('synced');
    if (result.status !== 'synced') throw new Error('expected synced');
    expect(result.outboxFlushed).toBe(1);
    expect(peekOutbox()).toHaveLength(0);
    expect(fsPort.setUserDocCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// afterFightSync
// ---------------------------------------------------------------------------

describe('afterFightSync', () => {
  it('unconfigured → enqueues the snapshot, never throws', async () => {
    setConfigured(false);
    const { deps, adoptSnapshot } = makeDeps();
    await afterFightSync(deps);
    expect(peekOutbox()).toHaveLength(1);
    expect(JSON.parse(peekOutbox()[0].payload).xp).toBe(100);
    expect(adoptSnapshot).not.toHaveBeenCalled();
  });

  it('configured → syncs and adopts the merged snapshot', async () => {
    const { deps, authPort, adoptSnapshot } = makeDeps();
    authPort.current = authUser('fb-uid-1');
    await afterFightSync(deps);
    expect(adoptSnapshot).toHaveBeenCalledTimes(1);
    expect(peekOutbox()).toHaveLength(0);
  });

  it('sync failure → enqueues instead of throwing', async () => {
    const { deps, authPort, fsPort, adoptSnapshot } = makeDeps();
    authPort.current = authUser('fb-uid-1');
    fsPort.throwOnGet = new Error('network down');
    await afterFightSync(deps);
    expect(adoptSnapshot).not.toHaveBeenCalled();
    expect(peekOutbox()).toHaveLength(1);
  });

  it('no snapshot and no uid → no-op', async () => {
    const { deps } = makeDeps({ getSnapshot: () => null });
    await afterFightSync(deps);
    expect(peekOutbox()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// signOutFlow / signBackInFlow
// ---------------------------------------------------------------------------

describe('signOutFlow', () => {
  it('calls auth signOut and does NOT reset local data', async () => {
    const { deps, authPort, resetLocal } = makeDeps();
    authPort.current = authUser('fb-uid-1');
    await signOutFlow(deps);
    expect(authPort.signOutCalls).toBe(1);
    expect(resetLocal).not.toHaveBeenCalled();
  });

  it('a failing native sign-out still completes the flow without throwing', async () => {
    const { deps, authPort, resetLocal } = makeDeps();
    authPort.signOutError = new Error('native sign-out failed');
    await expect(signOutFlow(deps)).resolves.toBeUndefined();
    expect(resetLocal).not.toHaveBeenCalled();
  });
});

describe('signBackInFlow', () => {
  it('runs init again and returns synced', async () => {
    const { deps } = makeDeps();
    const result = await signBackInFlow(deps);
    expect(result.status).toBe('synced');
  });
});

// ---------------------------------------------------------------------------
// deleteAccountFlow
// ---------------------------------------------------------------------------

describe('deleteAccountFlow', () => {
  it('deletes remote data + league membership + auth user, clears the link/outbox, resets local', async () => {
    const { deps, authPort, fsPort, resetLocal } = makeDeps();
    authPort.current = authUser('fb-uid-1');
    fsPort.users.set('fb-uid-1', remoteUser({ xp: 100 }));
    fsPort.leagueMembers.set('2026-W48/2026-W48-gold-1', [
      { uid: 'fb-uid-1', weeklyXp: 120, displayName: null },
    ]);
    enqueueSnapshot('guest-1', '{}', NOW);
    expect(peekOutbox()).toHaveLength(1);

    const result = await deleteAccountFlow(deps, { weekId: '2026-W48', leagueId: '2026-W48-gold-1' });

    expect(result).toEqual({ deletedRemote: true, uid: 'fb-uid-1' });
    expect(fsPort.deleteLeagueMemberCalls).toEqual([
      { weekId: '2026-W48', leagueId: '2026-W48-gold-1', uid: 'fb-uid-1' },
    ]);
    expect(fsPort.deleteUserDataCalls).toEqual(['fb-uid-1']);
    expect(authPort.deleteCalls).toBe(1);
    expect(peekOutbox()).toHaveLength(0);
    expect(resetLocal).toHaveBeenCalledTimes(1);
  });

  it('without a current league, skips the league-member delete', async () => {
    const { deps, authPort, fsPort, resetLocal } = makeDeps();
    authPort.current = authUser('fb-uid-1');
    const result = await deleteAccountFlow(deps, null);
    expect(result).toEqual({ deletedRemote: true, uid: 'fb-uid-1' });
    expect(fsPort.deleteLeagueMemberCalls).toEqual([]);
    expect(fsPort.deleteUserDataCalls).toEqual(['fb-uid-1']);
    expect(resetLocal).toHaveBeenCalledTimes(1);
  });

  it('remote delete failure → deletedRemote false, local reset still happens', async () => {
    const { deps, authPort, fsPort, resetLocal } = makeDeps();
    authPort.current = authUser('fb-uid-1');
    fsPort.throwOnDelete = new Error('permission denied');
    const result = await deleteAccountFlow(deps, null);
    expect(result).toEqual({ deletedRemote: false, uid: 'fb-uid-1' });
    expect(resetLocal).toHaveBeenCalledTimes(1);
  });

  it('unconfigured → no remote delete attempted, still resets local', async () => {
    setConfigured(false);
    const { deps, authPort, fsPort, resetLocal } = makeDeps();
    authPort.current = authUser('fb-uid-1');
    const result = await deleteAccountFlow(deps, null);
    expect(result).toEqual({ deletedRemote: false, uid: 'fb-uid-1' });
    expect(fsPort.deleteUserDataCalls).toEqual([]);
    expect(authPort.deleteCalls).toBe(0);
    expect(resetLocal).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// loadMyLeague / pushLeagueXp
// ---------------------------------------------------------------------------

describe('loadMyLeague', () => {
  it("not-configured when Firebase is unconfigured", async () => {
    setConfigured(false);
    const { fsPort } = makeDeps();
    await expect(loadMyLeague(fsPort, 'fb-uid-1', NOW)).resolves.toEqual({ status: 'not-configured' });
  });

  it('no user doc → not-placed for the current week', async () => {
    const { fsPort } = makeDeps();
    await expect(loadMyLeague(fsPort, 'fb-uid-1', NOW)).resolves.toEqual({
      status: 'not-placed',
      weekId: '2026-W48',
    });
  });

  it('currentLeague from a stale week → not-placed', async () => {
    const { fsPort } = makeDeps();
    fsPort.users.set(
      'fb-uid-1',
      remoteUser({ currentLeague: { weekId: '2026-W47', leagueId: '2026-W47-gold-1' } }),
    );
    await expect(loadMyLeague(fsPort, 'fb-uid-1', NOW)).resolves.toEqual({
      status: 'not-placed',
      weekId: '2026-W48',
    });
  });

  it('placed: correct rank + tier from the group doc', async () => {
    const { fsPort } = makeDeps();
    fsPort.users.set(
      'fb-uid-1',
      remoteUser({ currentLeague: { weekId: '2026-W48', leagueId: '2026-W48-gold-1' } }),
    );
    fsPort.leagueMembers.set('2026-W48/2026-W48-gold-1', [
      { uid: 'other-1', weeklyXp: 400, displayName: null },
      { uid: 'fb-uid-1', weeklyXp: 300, displayName: null },
      { uid: 'other-2', weeklyXp: 100, displayName: 'Asha' },
    ]);
    fsPort.leagueGroups.set('2026-W48/2026-W48-gold-1', 'Gold');

    const result = await loadMyLeague(fsPort, 'fb-uid-1', NOW);
    expect(result.status).toBe('placed');
    if (result.status !== 'placed') throw new Error('expected placed');
    expect(result.weekId).toBe('2026-W48');
    expect(result.league.id).toBe('2026-W48-gold-1');
    expect(result.league.tier).toBe('Gold');
    expect(result.league.members.map(m => m.uid)).toEqual(['other-1', 'fb-uid-1', 'other-2']);
    expect(result.league.members.map(m => m.rank)).toEqual([1, 2, 3]);
    expect(result.myRank).toBe(2);
  });

  it('placed but uid is not among the members → myRank null', async () => {
    const { fsPort } = makeDeps();
    fsPort.users.set(
      'fb-uid-1',
      remoteUser({ currentLeague: { weekId: '2026-W48', leagueId: '2026-W48-gold-1' } }),
    );
    fsPort.leagueMembers.set('2026-W48/2026-W48-gold-1', [
      { uid: 'other-1', weeklyXp: 400, displayName: null },
    ]);
    fsPort.leagueGroups.set('2026-W48/2026-W48-gold-1', 'Silver');
    const result = await loadMyLeague(fsPort, 'fb-uid-1', NOW);
    expect(result.status).toBe('placed');
    if (result.status !== 'placed') throw new Error('expected placed');
    expect(result.myRank).toBeNull();
    expect(result.league.tier).toBe('Silver');
  });

  it('missing group doc → tier falls back to Bronze', async () => {
    const { fsPort } = makeDeps();
    fsPort.users.set(
      'fb-uid-1',
      remoteUser({ currentLeague: { weekId: '2026-W48', leagueId: '2026-W48-gold-1' } }),
    );
    fsPort.leagueMembers.set('2026-W48/2026-W48-gold-1', [
      { uid: 'fb-uid-1', weeklyXp: 300, displayName: null },
    ]);
    const result = await loadMyLeague(fsPort, 'fb-uid-1', NOW);
    if (result.status !== 'placed') throw new Error('expected placed');
    expect(result.league.tier).toBe('Bronze');
    expect(result.myRank).toBe(1);
  });
});

describe('pushLeagueXp', () => {
  it('writes the weekly XP into the league member doc', async () => {
    const { fsPort } = makeDeps();
    await pushLeagueXp(fsPort, 'fb-uid-1', '2026-W48', '2026-W48-gold-1', 320, null);
    expect(fsPort.setLeagueMemberCalls).toEqual([
      { weekId: '2026-W48', leagueId: '2026-W48-gold-1', uid: 'fb-uid-1', weeklyXp: 320 },
    ]);
    expect(fsPort.leagueMembers.get('2026-W48/2026-W48-gold-1')).toEqual([
      { uid: 'fb-uid-1', weeklyXp: 320, displayName: null },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Identity-backed paths (uid link + explicit sign-out flag)
// ---------------------------------------------------------------------------

describe('identity-backed paths', () => {
  it("explicit sign-out flag → init returns 'signed-out', no anonymous sign-in", async () => {
    setExplicitlySignedOut(true);
    const { deps, authPort, fsPort, adoptSnapshot } = makeDeps();
    const result = await initAuthAndSync(deps);
    expect(result).toEqual({ status: 'signed-out' });
    expect(authPort.signInCalls).toBe(0);
    expect(fsPort.getUserDocCalls).toBe(0);
    expect(adoptSnapshot).not.toHaveBeenCalled();
  });

  it('signBackInFlow clears the flag and syncs again', async () => {
    setExplicitlySignedOut(true);
    const { deps } = makeDeps();
    const result = await signBackInFlow(deps);
    expect(result.status).toBe('synced');
  });

  it('deleteAccountFlow uses the LINKED uid when no Firebase user is in memory', async () => {
    setLinkedFirebaseUid('fb-uid-1');
    const { deps, authPort, fsPort, resetLocal } = makeDeps();
    // authPort.current stays null — the uid must come from the link.
    expect(authPort.current).toBeNull();
    fsPort.users.set('fb-uid-1', remoteUser({ xp: 100 }));

    const result = await deleteAccountFlow(deps, null);

    expect(result).toEqual({ deletedRemote: true, uid: 'fb-uid-1' });
    expect(fsPort.deleteUserDataCalls).toEqual(['fb-uid-1']);
    expect(authPort.deleteCalls).toBe(0); // no current user to delete
    expect(getLinkedFirebaseUid()).toBeNull();
    expect(resetLocal).toHaveBeenCalledTimes(1);
  });

  it('afterFightSync uses the LINKED uid when the port has no current user', async () => {
    setLinkedFirebaseUid('fb-uid-1');
    const { deps, authPort, adoptSnapshot } = makeDeps();
    expect(authPort.current).toBeNull();
    await afterFightSync(deps);
    expect(adoptSnapshot).toHaveBeenCalledTimes(1);
    expect(peekOutbox()).toHaveLength(0);
  });
});
