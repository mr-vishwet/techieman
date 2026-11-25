// TechieMan — guest identity (M4, guest-first).
// Every player gets a stable local id with no login wall. The id lives in
// MMKV when the native module is available; under Jest (or if MMKV fails)
// it falls back to a process-local id so the pure logic stays testable.
// No Firebase Auth in M4 — that is M5.

import { MMKV_KEYS } from './schema';

let memoryGuestId: string | null = null;

function randomGuestId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `guest-${Date.now().toString(36)}-${rand}`;
}

/** Stable guest id for this install. Never throws. */
export function getGuestId(): string {
  if (memoryGuestId) return memoryGuestId;
  try {
    // Lazy require: MMKV is native and cannot load under Jest.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv') as {
      MMKV: new (opts?: Record<string, unknown>) => {
        getString: (key: string) => string | undefined;
        set: (key: string, value: string) => void;
      };
    };
    const mmkv = new MMKV();
    const existing = mmkv.getString(MMKV_KEYS.guestId);
    if (existing) {
      memoryGuestId = existing;
      return existing;
    }
    const fresh = randomGuestId();
    mmkv.set(MMKV_KEYS.guestId, fresh);
    memoryGuestId = fresh;
    return fresh;
  } catch {
    memoryGuestId = randomGuestId();
    return memoryGuestId;
  }
}

/** Test-only reset so each test gets a fresh guest. */
export function __resetGuestIdForTests(): void {
  memoryGuestId = null;
}

/**
 * Account deletion (M5): forget the current guest id and issue a fresh one.
 * The old SQLite rows stay under the old id but are unreachable from the
 * new identity; the store resets its snapshot at the same time.
 */
export function regenerateGuestId(): string {
  memoryGuestId = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv') as {
      MMKV: new (opts?: Record<string, unknown>) => {
        set: (key: string, value: string) => void;
        delete: (key: string) => void;
      };
    };
    const mmkv = new MMKV();
    mmkv.delete(MMKV_KEYS.guestId);
    const fresh = randomGuestId();
    mmkv.set(MMKV_KEYS.guestId, fresh);
    memoryGuestId = fresh;
    return fresh;
  } catch {
    memoryGuestId = randomGuestId();
    return memoryGuestId;
  }
}
