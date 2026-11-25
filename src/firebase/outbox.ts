// TechieMan — offline sync outbox (M5).
// When a fight finishes while offline (or Firebase is unconfigured), the
// sync payload is queued in MMKV instead of dropped. The queue flushes on
// the next hydrate / successful sync, oldest first. It is capped — an
// unbounded queue on a phone that never signs in would grow forever.
//
// Entries carry the LOCAL guest id; at flush time the caller supplies the
// current Firebase uid (or null — in which case the queue is kept, not
// dropped, and flushing is retried later). Entries are snapshots, not
// deltas: replaying an old snapshot is harmless because syncNow merges
// with last-write-wins and never lowers xp/gems/streak.

import { MMKV_KEYS } from '../storage/schema';

export const OUTBOX_KEY = 'techieman.syncOutbox.v1';
export const MAX_OUTBOX_ENTRIES = 50;

export interface OutboxEntry {
  id: string;
  /** Local guest id that owns the payload. */
  guestId: string;
  enqueuedAt: number;
  /** 'snapshot' = a full progression snapshot payload (JSON string). */
  kind: 'snapshot';
  payload: string;
}

function randomId(): string {
  return `ob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

let memoryQueue: OutboxEntry[] | null = null;

function loadRaw(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv') as {
      MMKV: new (opts?: Record<string, unknown>) => {
        getString: (key: string) => string | undefined;
        set: (key: string, value: string) => void;
      };
    };
    return new MMKV().getString(MMKV_KEYS.syncOutbox) ?? null;
  } catch {
    return null;
  }
}

function saveRaw(json: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv') as {
      MMKV: new (opts?: Record<string, unknown>) => {
        set: (key: string, value: string) => void;
      };
    };
    new MMKV().set(MMKV_KEYS.syncOutbox, json);
  } catch {
    // MMKV unavailable (Jest / cold start): memory-only, same as guest.ts.
  }
}

function readQueue(): OutboxEntry[] {
  if (memoryQueue) return memoryQueue;
  const raw = loadRaw();
  if (!raw) {
    memoryQueue = [];
    return memoryQueue;
  }
  try {
    const parsed = JSON.parse(raw) as OutboxEntry[];
    memoryQueue = Array.isArray(parsed) ? parsed : [];
  } catch {
    memoryQueue = [];
  }
  return memoryQueue;
}

function writeQueue(queue: OutboxEntry[]): void {
  memoryQueue = queue;
  saveRaw(JSON.stringify(queue));
}

/** All queued entries, oldest first. Never throws. */
export function peekOutbox(): OutboxEntry[] {
  try {
    return [...readQueue()];
  } catch {
    return [];
  }
}

/**
 * Queue a snapshot payload. Returns the entry id, or null when the queue
 * is full and the oldest entry was dropped (the drop is counted, not hidden).
 */
export function enqueueSnapshot(guestId: string, payload: string, nowMs: number = Date.now()): { id: string; dropped: number } {
  const queue = readQueue();
  let dropped = 0;
  while (queue.length >= MAX_OUTBOX_ENTRIES) {
    queue.shift();
    dropped += 1;
  }
  const entry: OutboxEntry = { id: randomId(), guestId, enqueuedAt: nowMs, kind: 'snapshot', payload };
  queue.push(entry);
  writeQueue(queue);
  return { id: entry.id, dropped };
}

/** Remove entries by id (after a successful flush). */
export function removeFromOutbox(ids: string[]): void {
  const remaining = readQueue().filter(e => !ids.includes(e.id));
  writeQueue(remaining);
}

/** Drop the whole queue (account deletion). */
export function clearOutbox(): void {
  writeQueue([]);
}

/** Test-only reset. */
export function __resetOutboxForTests(): void {
  memoryQueue = null;
}
