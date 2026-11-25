// Tests for the M5 Firestore sync core (sync.ts) — pure merge logic plus
// the port-injected syncNow / pushSnapshot orchestration against a fake
// in-memory FirestorePort. No network, no native modules: loadLocalFights
// throws under Jest (native SQLite absent) and syncNow must treat fights
// as [] — that path is asserted explicitly.
import { levelForXp, type ProgressRow, type Quest } from '../../engine/progression';
import { emptySnapshot, type ProgressionSnapshot } from '../../storage/progress';
import {
  MAX_FIGHTS_SYNCED,
  buildProgressDocs,
  buildUserDoc,
  mergeSnapshots,
  pruneFights,
  pushSnapshot,
  resolveNodeConflict,
  syncNow,
  type FirestorePort,
  type RemoteFight,
  type RemoteProgressRow,
  type RemoteSnapshot,
  type RemoteUserDoc,
} from '../sync';

const DAY = 86_400_000;
// Noon UTC — safely inside one local day on either side of the dateline.
const NOW = Date.UTC(2026, 10, 25, 12, 0, 0); // Wed 2026-11-25

/** Local YYYY-MM-DD, mirroring the dayString helper inside sync.ts. */
function localDayString(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

function row(nodeId: string, partial: Partial<ProgressRow> = {}): ProgressRow {
  return {
    nodeId,
    state: 'open',
    bestCombo: 0,
    lastPlayedAt: null,
    nextRematchAt: null,
    wrongTags: [],
    rematchWins: 0,
    ...partial,
  };
}

function remoteRow(partial: Partial<RemoteProgressRow> = {}): RemoteProgressRow {
  return {
    state: 'open',
    bestCombo: 0,
    lastPlayedAt: null,
    nextRematchAt: null,
    wrongTags: [],
    ...partial,
  };
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

function remoteSnapshot(partial: Partial<RemoteSnapshot> = {}): RemoteSnapshot {
  return { user: remoteUser(), progress: {}, ...partial };
}

function quest(id: string): Quest {
  return {
    id,
    type: 'win-fights',
    title: 'Win 2 fights',
    target: 2,
    progress: 0,
    rewardGems: 10,
    expiresAt: localDayString(NOW),
    done: false,
  };
}

function localSnapshot(partial: Partial<ProgressionSnapshot> = {}): ProgressionSnapshot {
  return { ...emptySnapshot('guest-1'), ...partial };
}

function fight(endedAt: number, partial: Partial<RemoteFight> = {}): RemoteFight {
  return {
    nodeId: '1.1',
    result: 'win',
    correctCount: 10,
    wrongCount: 0,
    bestCombo: 4,
    xpEarned: 50,
    startedAt: endedAt - 60_000,
    endedAt,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// mergeSnapshots
// ---------------------------------------------------------------------------

describe('mergeSnapshots', () => {
  it('remote null → local-only, snapshot returned untouched', () => {
    const local = localSnapshot({ xp: 120, gems: 5 });
    const { snapshot, report } = mergeSnapshots(local, null, NOW);
    expect(snapshot).toBe(local);
    expect(report).toEqual({
      source: 'local-only',
      xpKept: 'local',
      gemsKept: 'local',
      streakKept: 'local',
      nodesMerged: 0,
      nodesLocalWon: 0,
      nodesRemoteWon: 0,
      nodesTiedLocal: 0,
    });
  });

  it('remote higher xp/gems/streak wins; report says remote', () => {
    const local = localSnapshot({ xp: 100, gems: 5, streak: 2 });
    const { snapshot, report } = mergeSnapshots(
      local,
      remoteSnapshot({ user: remoteUser({ xp: 320, gems: 9, streak: 4 }) }),
      NOW,
    );
    expect(snapshot.xp).toBe(320);
    expect(snapshot.gems).toBe(9);
    expect(snapshot.streak).toBe(4);
    expect(snapshot.level).toBe(levelForXp(320));
    expect(report).toMatchObject({ source: 'merged', xpKept: 'remote', gemsKept: 'remote', streakKept: 'remote' });
  });

  it('local higher xp/gems/streak wins; report says local', () => {
    const local = localSnapshot({ xp: 500, gems: 12, streak: 7 });
    const { snapshot, report } = mergeSnapshots(
      local,
      remoteSnapshot({ user: remoteUser({ xp: 320, gems: 9, streak: 4 }) }),
      NOW,
    );
    expect(snapshot.xp).toBe(500);
    expect(snapshot.gems).toBe(12);
    expect(snapshot.streak).toBe(7);
    expect(report).toMatchObject({ xpKept: 'local', gemsKept: 'local', streakKept: 'local' });
  });

  it('equal xp/gems/streak → kept is equal, values unchanged', () => {
    const local = localSnapshot({ xp: 200, gems: 3, streak: 1 });
    const { snapshot, report } = mergeSnapshots(
      local,
      remoteSnapshot({ user: remoteUser({ xp: 200, gems: 3, streak: 1 }) }),
      NOW,
    );
    expect(snapshot.xp).toBe(200);
    expect(report).toMatchObject({ xpKept: 'equal', gemsKept: 'equal', streakKept: 'equal' });
  });

  it('streakFreeze is maxed, never lowered', () => {
    const local = localSnapshot({ streakFreeze: 1 });
    const { snapshot } = mergeSnapshots(local, remoteSnapshot({ user: remoteUser({ streakFreeze: 0 }) }), NOW);
    expect(snapshot.streakFreeze).toBe(1);
    const local2 = localSnapshot({ streakFreeze: 0 });
    const { snapshot: snap2 } = mergeSnapshots(local2, remoteSnapshot({ user: remoteUser({ streakFreeze: 1 }) }), NOW);
    expect(snap2.streakFreeze).toBe(1);
  });

  it('lastPlayedDay: the later day wins, either side', () => {
    const local = localSnapshot({ lastPlayedDay: '2026-11-24' });
    const { snapshot } = mergeSnapshots(
      local,
      remoteSnapshot({ user: remoteUser({ lastPlayedDay: '2026-11-25' }) }),
      NOW,
    );
    expect(snapshot.lastPlayedDay).toBe('2026-11-25');
    const local2 = localSnapshot({ lastPlayedDay: '2026-11-25' });
    const { snapshot: snap2 } = mergeSnapshots(
      local2,
      remoteSnapshot({ user: remoteUser({ lastPlayedDay: '2026-11-20' }) }),
      NOW,
    );
    expect(snap2.lastPlayedDay).toBe('2026-11-25');
  });

  it('winsByNode is maxed per node', () => {
    const local = localSnapshot({ winsByNode: { a: 3, b: 1 } });
    const { snapshot } = mergeSnapshots(
      local,
      remoteSnapshot({ user: remoteUser({ winsByNode: { a: 1, b: 5, c: 2 } }) }),
      NOW,
    );
    expect(snapshot.winsByNode).toEqual({ a: 3, b: 5, c: 2 });
  });

  it('remote-only node appears in progress and counts as remote-won', () => {
    const local = localSnapshot();
    const { snapshot, report } = mergeSnapshots(
      local,
      remoteSnapshot({
        progress: { '2.1': remoteRow({ state: 'cleared', bestCombo: 6, lastPlayedAt: NOW - DAY, wrongTags: ['keys'] }) },
      }),
      NOW,
    );
    expect(snapshot.progress['2.1']).toMatchObject({
      nodeId: '2.1',
      state: 'cleared',
      bestCombo: 6,
      wrongTags: ['keys'],
      rematchWins: 0,
    });
    expect(report.nodesMerged).toBe(1);
    expect(report.nodesRemoteWon).toBe(1);
  });

  it('local-only node is kept', () => {
    const local = localSnapshot({ progress: { '1.1': row('1.1', { state: 'cleared', bestCombo: 3 }) } });
    const { snapshot, report } = mergeSnapshots(local, remoteSnapshot(), NOW);
    expect(snapshot.progress['1.1'].state).toBe('cleared');
    expect(report.nodesLocalWon).toBe(1);
  });

  it('state rank beats recency: remote mastered wins over local cleared even when local is newer', () => {
    const local = localSnapshot({
      progress: { '1.1': row('1.1', { state: 'cleared', bestCombo: 9, lastPlayedAt: NOW }) },
    });
    const { snapshot, report } = mergeSnapshots(
      local,
      remoteSnapshot({ progress: { '1.1': remoteRow({ state: 'mastered', bestCombo: 1, lastPlayedAt: NOW - 7 * DAY }) } }),
      NOW,
    );
    expect(snapshot.progress['1.1'].state).toBe('mastered');
    expect(snapshot.progress['1.1'].bestCombo).toBe(1);
    expect(report.nodesRemoteWon).toBe(1);
  });

  it('same state → later lastPlayedAt wins, either side', () => {
    const localNewer = localSnapshot({
      progress: { '1.1': row('1.1', { state: 'cleared', bestCombo: 2, lastPlayedAt: NOW }) },
    });
    const { snapshot: s1 } = mergeSnapshots(
      localNewer,
      remoteSnapshot({ progress: { '1.1': remoteRow({ state: 'cleared', bestCombo: 8, lastPlayedAt: NOW - DAY }) } }),
      NOW,
    );
    expect(s1.progress['1.1'].bestCombo).toBe(2);

    const remoteNewer = localSnapshot({
      progress: { '1.1': row('1.1', { state: 'cleared', bestCombo: 2, lastPlayedAt: NOW - DAY }) },
    });
    const { snapshot: s2 } = mergeSnapshots(
      remoteNewer,
      remoteSnapshot({ progress: { '1.1': remoteRow({ state: 'cleared', bestCombo: 8, lastPlayedAt: NOW }) } }),
      NOW,
    );
    expect(s2.progress['1.1'].bestCombo).toBe(8);
  });

  it('same state and time → higher bestCombo wins', () => {
    const local = localSnapshot({
      progress: { '1.1': row('1.1', { state: 'cleared', bestCombo: 9, lastPlayedAt: NOW }) },
    });
    const { snapshot } = mergeSnapshots(
      local,
      remoteSnapshot({ progress: { '1.1': remoteRow({ state: 'cleared', bestCombo: 4, lastPlayedAt: NOW }) } }),
      NOW,
    );
    expect(snapshot.progress['1.1'].bestCombo).toBe(9);
  });

  it('exact tie → local wins and wrongTags are unioned', () => {
    const local = localSnapshot({
      progress: { '1.1': row('1.1', { state: 'cleared', bestCombo: 5, lastPlayedAt: NOW, wrongTags: ['a'] }) },
    });
    const { snapshot, report } = mergeSnapshots(
      local,
      remoteSnapshot({ progress: { '1.1': remoteRow({ state: 'cleared', bestCombo: 5, lastPlayedAt: NOW, wrongTags: ['b', 'a'] }) } }),
      NOW,
    );
    expect(snapshot.progress['1.1'].bestCombo).toBe(5);
    expect([...snapshot.progress['1.1'].wrongTags].sort()).toEqual(['a', 'b']);
    expect(report.nodesTiedLocal).toBe(1);
  });

  it("local today's quest set is kept", () => {
    const quests = [quest('q1'), quest('q2'), quest('q3')];
    const local = localSnapshot({ quests, questDay: localDayString(NOW) });
    const { snapshot } = mergeSnapshots(local, remoteSnapshot(), NOW);
    expect(snapshot.quests).toEqual(quests);
    expect(snapshot.questDay).toBe(localDayString(NOW));
  });

  it('stale questDay rolls forward to today (quests themselves stay local)', () => {
    const quests = [quest('q1'), quest('q2'), quest('q3')];
    const local = localSnapshot({ quests, questDay: '2026-11-20' });
    const { snapshot } = mergeSnapshots(local, remoteSnapshot(), NOW);
    expect(snapshot.questDay).toBe(localDayString(NOW));
    expect(snapshot.quests).toEqual(quests);
  });
});

// ---------------------------------------------------------------------------
// resolveNodeConflict — each rule separately
// ---------------------------------------------------------------------------

describe('resolveNodeConflict', () => {
  it('remote null → local, winner local', () => {
    const local = row('1.1', { state: 'cleared' });
    expect(resolveNodeConflict(local, null)).toEqual({ row: local, winner: 'local' });
  });

  it('locked ranks below open: a played remote row beats a local locked row', () => {
    const local = row('1.1', { state: 'locked', lastPlayedAt: NOW });
    const { row: won, winner } = resolveNodeConflict(
      local,
      remoteRow({ state: 'open', bestCombo: 0, lastPlayedAt: NOW - DAY }),
    );
    expect(winner).toBe('remote');
    expect(won.state).toBe('open');
    const localOpen = row('1.1', { state: 'open', lastPlayedAt: NOW - DAY });
    expect(resolveNodeConflict(localOpen, remoteRow({ state: 'locked', lastPlayedAt: NOW })).winner).toBe('local');
  });

  it('higher state rank wins: local mastered beats remote cleared even when remote is newer', () => {
    const local = row('1.1', { state: 'mastered', bestCombo: 1, lastPlayedAt: NOW - 7 * DAY });
    const { row: won, winner } = resolveNodeConflict(
      local,
      remoteRow({ state: 'cleared', bestCombo: 9, lastPlayedAt: NOW }),
    );
    expect(winner).toBe('local');
    expect(won).toBe(local);
  });

  it('higher state rank wins: remote mastered beats local cleared even when local is newer', () => {
    const local = row('1.1', { state: 'cleared', bestCombo: 9, lastPlayedAt: NOW });
    const { row: won, winner } = resolveNodeConflict(
      local,
      remoteRow({ state: 'mastered', bestCombo: 1, lastPlayedAt: NOW - 7 * DAY }),
    );
    expect(winner).toBe('remote');
    expect(won.state).toBe('mastered');
    expect(won.bestCombo).toBe(1);
    expect(won.rematchWins).toBe(0); // derived on load, never synced
  });

  it('same state: later lastPlayedAt wins (remote)', () => {
    const local = row('1.1', { state: 'cleared', bestCombo: 2, lastPlayedAt: NOW - DAY });
    const { winner } = resolveNodeConflict(local, remoteRow({ state: 'cleared', bestCombo: 2, lastPlayedAt: NOW }));
    expect(winner).toBe('remote');
  });

  it('same state: later lastPlayedAt wins (local)', () => {
    const local = row('1.1', { state: 'cleared', bestCombo: 2, lastPlayedAt: NOW });
    const { winner } = resolveNodeConflict(local, remoteRow({ state: 'cleared', bestCombo: 2, lastPlayedAt: NOW - DAY }));
    expect(winner).toBe('local');
  });

  it('null lastPlayedAt counts as 0 — a dated write beats an undated one', () => {
    const undated = row('1.1', { state: 'cleared', lastPlayedAt: null });
    expect(resolveNodeConflict(undated, remoteRow({ state: 'cleared', lastPlayedAt: 1000 })).winner).toBe('remote');
    const dated = row('1.1', { state: 'cleared', lastPlayedAt: 1000 });
    expect(resolveNodeConflict(dated, remoteRow({ state: 'cleared', lastPlayedAt: null })).winner).toBe('local');
  });

  it('same state and time: higher bestCombo wins (remote)', () => {
    const local = row('1.1', { state: 'cleared', bestCombo: 3, lastPlayedAt: NOW });
    const { winner } = resolveNodeConflict(local, remoteRow({ state: 'cleared', bestCombo: 7, lastPlayedAt: NOW }));
    expect(winner).toBe('remote');
  });

  it('same state and time: higher bestCombo wins (local)', () => {
    const local = row('1.1', { state: 'cleared', bestCombo: 7, lastPlayedAt: NOW });
    const { winner } = resolveNodeConflict(local, remoteRow({ state: 'cleared', bestCombo: 3, lastPlayedAt: NOW }));
    expect(winner).toBe('local');
  });

  it('exact tie → local wins with unioned wrongTags', () => {
    const local = row('1.1', { state: 'cleared', bestCombo: 5, lastPlayedAt: NOW, wrongTags: ['useState'] });
    const { row: won, winner } = resolveNodeConflict(
      local,
      remoteRow({ state: 'cleared', bestCombo: 5, lastPlayedAt: NOW, wrongTags: ['keys', 'useState'] }),
    );
    expect(winner).toBe('tie-local');
    expect([...won.wrongTags].sort()).toEqual(['keys', 'useState']);
  });
});

// ---------------------------------------------------------------------------
// buildUserDoc / buildProgressDocs
// ---------------------------------------------------------------------------

describe('buildUserDoc', () => {
  it('carries the profile fields and stamps updatedAt', () => {
    const snap = localSnapshot({
      xp: 320,
      level: levelForXp(320),
      gems: 7,
      streak: 3,
      streakFreeze: 1,
      lastPlayedDay: '2026-11-25',
      winsByNode: { '1.1': 2 },
    });
    const doc = buildUserDoc(snap, NOW);
    expect(doc).toEqual({
      xp: 320,
      level: levelForXp(320),
      gems: 7,
      streak: 3,
      streakFreeze: 1,
      lastPlayedDay: '2026-11-25',
      winsByNode: { '1.1': 2 },
      updatedAt: NOW,
    });
    expect(doc.weeklyXp).toBeUndefined();
    expect(doc.weeklyXpWeekId).toBeUndefined();
  });

  it('passes weekly XP + weekId through when given', () => {
    const doc = buildUserDoc(localSnapshot(), NOW, { xp: 150, weekId: '2026-W48' });
    expect(doc.weeklyXp).toBe(150);
    expect(doc.weeklyXpWeekId).toBe('2026-W48');
  });
});

describe('buildProgressDocs', () => {
  it('one doc per node, syncable fields only (rematchWins dropped)', () => {
    const snap = localSnapshot({
      progress: {
        '1.1': row('1.1', { state: 'cleared', bestCombo: 6, lastPlayedAt: NOW, nextRematchAt: NOW + DAY, wrongTags: ['keys'] }),
        '1.2': row('1.2', { state: 'open' }),
      },
    });
    const docs = buildProgressDocs(snap);
    expect(Object.keys(docs).sort()).toEqual(['1.1', '1.2']);
    expect(docs['1.1']).toEqual({
      state: 'cleared',
      bestCombo: 6,
      lastPlayedAt: NOW,
      nextRematchAt: NOW + DAY,
      wrongTags: ['keys'],
    });
    expect(docs['1.2']).toEqual({
      state: 'open',
      bestCombo: 0,
      lastPlayedAt: null,
      nextRematchAt: null,
      wrongTags: [],
    });
    expect('rematchWins' in docs['1.1']).toBe(false);
  });

  it('empty progress → empty docs', () => {
    expect(buildProgressDocs(localSnapshot())).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// pruneFights
// ---------------------------------------------------------------------------

describe('pruneFights', () => {
  it('caps at 100, most-recent-first by endedAt', () => {
    const fights = Array.from({ length: 150 }, (_, i) => fight(NOW - i * 1000, { nodeId: `n${i}` }));
    const pruned = pruneFights(fights);
    expect(pruned).toHaveLength(MAX_FIGHTS_SYNCED);
    expect(pruned).toHaveLength(100);
    expect(pruned[0].endedAt).toBe(NOW);
    expect(pruned[99].endedAt).toBe(NOW - 99 * 1000);
    expect(pruned.map(f => f.endedAt)).toEqual(
      [...pruned.map(f => f.endedAt)].sort((a, b) => b - a),
    );
  });

  it('fewer than 100 → all kept, most-recent-first', () => {
    const fights = [fight(NOW - 2000), fight(NOW), fight(NOW - 1000)];
    const pruned = pruneFights(fights);
    expect(pruned.map(f => f.endedAt)).toEqual([NOW, NOW - 1000, NOW - 2000]);
  });

  it('custom limit is honoured and the input array is not mutated', () => {
    const fights = [fight(NOW - 2000), fight(NOW), fight(NOW - 1000)];
    const pruned = pruneFights(fights, 2);
    expect(pruned).toHaveLength(2);
    expect(pruned[0].endedAt).toBe(NOW);
    expect(fights.map(f => f.endedAt)).toEqual([NOW - 2000, NOW, NOW - 1000]);
  });
});

// ---------------------------------------------------------------------------
// syncNow / pushSnapshot against a fake port
// ---------------------------------------------------------------------------

class FakeFirestorePort implements FirestorePort {
  userDoc: RemoteUserDoc | null = null;
  progress: Record<string, RemoteProgressRow> = {};
  setUserDocCalls: RemoteUserDoc[] = [];
  setProgressCalls: Record<string, RemoteProgressRow>[] = [];
  addFightsCalls: RemoteFight[][] = [];
  getUserDocCalls = 0;
  throwOnGet: Error | null = null;

  async getUserDoc(): Promise<RemoteUserDoc | null> {
    this.getUserDocCalls += 1;
    if (this.throwOnGet) throw this.throwOnGet;
    return this.userDoc;
  }
  async setUserDoc(_uid: string, doc: RemoteUserDoc): Promise<void> {
    this.setUserDocCalls.push(doc);
    this.userDoc = doc;
  }
  async getProgress(): Promise<Record<string, RemoteProgressRow>> {
    return this.progress;
  }
  async setProgress(_uid: string, docs: Record<string, RemoteProgressRow>): Promise<void> {
    this.setProgressCalls.push(docs);
    this.progress = docs;
  }
  async addFights(_uid: string, fights: RemoteFight[]): Promise<void> {
    this.addFightsCalls.push(fights);
  }
  async deleteUserData(): Promise<void> {
    this.userDoc = null;
    this.progress = {};
  }
  async deleteLeagueMember(): Promise<void> {}
  async setLeagueMember(): Promise<void> {}
  async getLeagueMembers(): Promise<{ uid: string; weeklyXp: number; displayName: string | null }[]> {
    return [];
  }
  async getLeagueGroup(): Promise<{ tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' } | null> {
    return null;
  }
}

describe('syncNow with a fake port', () => {
  it('pulls remote higher XP, adopts it, and pushes the merged docs back', async () => {
    const port = new FakeFirestorePort();
    port.userDoc = remoteUser({ xp: 400, gems: 2, streak: 5 });
    const local = localSnapshot({ xp: 100, gems: 8, streak: 1 });

    const { snapshot, report, pushed } = await syncNow(port, 'uid-1', local, NOW);

    expect(pushed).toBe(true);
    expect(snapshot.xp).toBe(400); // remote wins xp
    expect(snapshot.gems).toBe(8); // local wins gems
    expect(snapshot.streak).toBe(5); // remote wins streak
    expect(report.source).toBe('merged');
    expect(port.setUserDocCalls).toHaveLength(1);
    expect(port.setUserDocCalls[0]).toMatchObject({
      xp: 400,
      gems: 8,
      streak: 5,
      weeklyXp: 0, // no local fights readable under Jest
      weeklyXpWeekId: '2026-W48',
      updatedAt: NOW,
    });
    expect(port.setProgressCalls).toHaveLength(1);
    // Native SQLite is absent under Jest: loadLocalFights throws, syncNow
    // treats fights as [] and still pushes the user doc + progress.
    expect(port.addFightsCalls).toEqual([[]]);
  });

  it('remote null → local-only merge, local state pushed', async () => {
    const port = new FakeFirestorePort();
    const local = localSnapshot({ xp: 250, gems: 4 });
    const { snapshot, report } = await syncNow(port, 'uid-1', local, NOW);
    expect(snapshot.xp).toBe(250);
    expect(report.source).toBe('local-only');
    expect(port.setUserDocCalls[0].xp).toBe(250);
  });

  it('throws when the port fails — callers must catch and stay local', async () => {
    const port = new FakeFirestorePort();
    port.throwOnGet = new Error('network down');
    await expect(syncNow(port, 'uid-1', localSnapshot(), NOW)).rejects.toThrow('network down');
    expect(port.setUserDocCalls).toHaveLength(0);
  });
});

describe('pushSnapshot with a fake port', () => {
  it('uploads without pulling: getUserDoc never called', async () => {
    const port = new FakeFirestorePort();
    const local = localSnapshot({
      xp: 180,
      progress: { '1.1': row('1.1', { state: 'cleared', bestCombo: 5 }) },
    });
    await pushSnapshot(port, 'uid-1', local, NOW);
    expect(port.getUserDocCalls).toBe(0);
    expect(port.setUserDocCalls).toHaveLength(1);
    expect(port.setUserDocCalls[0]).toMatchObject({ xp: 180, weeklyXp: 0, weeklyXpWeekId: '2026-W48' });
    expect(port.setProgressCalls[0]['1.1']).toMatchObject({ state: 'cleared', bestCombo: 5 });
    expect(port.addFightsCalls).toEqual([[]]);
  });
});
