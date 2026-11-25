// TechieMan — guest ↔ Firebase identity mapping (M5).
// Local progress is keyed by the MMKV guest id (see storage/guest.ts).
// Firebase data is keyed by the Firebase uid. This module stores the
// link between the two, plus the explicit sign-out flag.
//
// Linking keeps ONE uid for life: anonymous sign-in creates it, and
// linking email/Google (linkWithCredential) keeps it. The local guest id
// never changes, so SQLite rows are never re-keyed.

import { MMKV_KEYS } from '../storage/schema';

// In-memory mirrors (same pattern as storage/guest.ts): under Jest — or if
// MMKV fails — the values live in process memory so the logic stays
// testable. The MMKV store is authoritative on device; the mirror is only
// a fallback, never a second source of truth.
let memoryUid: string | null = null;
let memorySignedOut = false;
let memoryLastMerge: string | null = null;

function mmkv() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MMKV } = require('react-native-mmkv') as {
    MMKV: new (opts?: Record<string, unknown>) => {
      getString: (key: string) => string | undefined;
      set: (key: string, value: string) => void;
      delete: (key: string) => void;
    };
  };
  return new MMKV();
}

export function getLinkedFirebaseUid(): string | null {
  try {
    const stored = mmkv().getString(MMKV_KEYS.firebaseUid) ?? null;
    if (stored) memoryUid = stored;
    return stored;
  } catch {
    return memoryUid;
  }
}

export function setLinkedFirebaseUid(uid: string): void {
  memoryUid = uid;
  try {
    mmkv().set(MMKV_KEYS.firebaseUid, uid);
  } catch {
    // MMKV unavailable (Jest): the in-memory mirror holds it.
  }
}

export function clearLinkedFirebaseUid(): void {
  memoryUid = null;
  try {
    mmkv().delete(MMKV_KEYS.firebaseUid);
  } catch {
    // ignore
  }
}

/** True when the user explicitly signed out — auto anonymous sign-in stays off. */
export function isExplicitlySignedOut(): boolean {
  try {
    const stored = mmkv().getString(MMKV_KEYS.authSignedOut) === '1';
    memorySignedOut = stored;
    return stored;
  } catch {
    return memorySignedOut;
  }
}

export function setExplicitlySignedOut(value: boolean): void {
  memorySignedOut = value;
  try {
    mmkv().set(MMKV_KEYS.authSignedOut, value ? '1' : '0');
  } catch {
    // ignore
  }
}

export function getLastMergeJson(): string | null {
  try {
    const stored = mmkv().getString(MMKV_KEYS.lastMerge) ?? null;
    if (stored) memoryLastMerge = stored;
    return stored;
  } catch {
    return memoryLastMerge;
  }
}

export function setLastMergeJson(json: string): void {
  memoryLastMerge = json;
  try {
    mmkv().set(MMKV_KEYS.lastMerge, json);
  } catch {
    // ignore
  }
}

/** Test-only reset of the in-memory mirrors. */
export function __resetIdentityForTests(): void {
  memoryUid = null;
  memorySignedOut = false;
  memoryLastMerge = null;
}
