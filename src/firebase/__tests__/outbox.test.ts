// Tests for the M5 offline sync outbox (outbox.ts).
// MMKV is lazy-required and falls back to process memory under Jest —
// __resetOutboxForTests() in beforeEach gives every test a clean queue.
import {
  MAX_OUTBOX_ENTRIES,
  __resetOutboxForTests,
  clearOutbox,
  enqueueSnapshot,
  peekOutbox,
  removeFromOutbox,
} from '../outbox';

const NOW = Date.UTC(2026, 10, 25, 12, 0, 0);

beforeEach(() => {
  __resetOutboxForTests();
});

describe('outbox', () => {
  it('starts empty', () => {
    expect(peekOutbox()).toEqual([]);
  });

  it('enqueue → peek returns the entry, oldest-first', () => {
    const first = enqueueSnapshot('guest-1', '{"xp":100}', NOW);
    enqueueSnapshot('guest-1', '{"xp":200}', NOW + 1000);
    const entries = peekOutbox();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: first.id,
      guestId: 'guest-1',
      enqueuedAt: NOW,
      kind: 'snapshot',
      payload: '{"xp":100}',
    });
    expect(entries[1].payload).toBe('{"xp":200}');
    expect(first.dropped).toBe(0);
  });

  it('enqueue returns the entry id and dropped: 0 while under the cap', () => {
    const { id, dropped } = enqueueSnapshot('guest-1', '{}', NOW);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(dropped).toBe(0);
    expect(peekOutbox()[0].id).toBe(id);
  });

  it('removeFromOutbox removes by id and keeps the rest', () => {
    const a = enqueueSnapshot('guest-1', 'a', NOW);
    const b = enqueueSnapshot('guest-1', 'b', NOW + 1);
    const c = enqueueSnapshot('guest-1', 'c', NOW + 2);
    removeFromOutbox([b.id]);
    expect(peekOutbox().map(e => e.id)).toEqual([a.id, c.id]);
  });

  it('removeFromOutbox with an unknown id is a no-op', () => {
    const a = enqueueSnapshot('guest-1', 'a', NOW);
    removeFromOutbox(['ob-does-not-exist']);
    expect(peekOutbox().map(e => e.id)).toEqual([a.id]);
  });

  it('clearOutbox empties the queue', () => {
    enqueueSnapshot('guest-1', 'a', NOW);
    enqueueSnapshot('guest-1', 'b', NOW + 1);
    clearOutbox();
    expect(peekOutbox()).toEqual([]);
  });

  it('the 51st enqueue drops the oldest (dropped: 1) and keeps the newest 50', () => {
    expect(MAX_OUTBOX_ENTRIES).toBe(50);
    const ids: string[] = [];
    let lastDropped = 0;
    for (let i = 0; i < 51; i++) {
      const { id, dropped } = enqueueSnapshot('guest-1', `p${i}`, NOW + i);
      ids.push(id);
      lastDropped = dropped;
      if (i < 50) expect(dropped).toBe(0);
    }
    expect(lastDropped).toBe(1);
    const entries = peekOutbox();
    expect(entries).toHaveLength(50);
    expect(entries.map(e => e.id)).not.toContain(ids[0]); // oldest dropped
    expect(entries[0].id).toBe(ids[1]);
    expect(entries[49].id).toBe(ids[50]);
    expect(entries[49].payload).toBe('p50');
  });

  it('peek returns a copy — mutating it does not corrupt the queue', () => {
    enqueueSnapshot('guest-1', 'a', NOW);
    const peeked = peekOutbox();
    peeked.pop();
    expect(peekOutbox()).toHaveLength(1);
  });
});
