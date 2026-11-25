// TechieMan — Arcade Mode persistence (local only, MMKV).
// Best score + last-10 run history. Same pattern as storage/guest.ts:
// lazy MMKV require (native module cannot load under Jest), in-memory
// fallback so the pure logic stays testable. Never throws.
// Best score is LOCAL ONLY in this milestone — the leaderboard tie-in
// (weekly leagues) is the defined next step, see ARCADE_MODE_SPEC.md §7.
import { MMKV_KEYS } from './schema';
import { ARCADE_RUN_HISTORY_CAP, arcadeXpForRun } from '../engine/arcade';

export interface ArcadeRunRecord {
  id: string;
  score: number;
  wave: number;
  kills: number;
  bestCombo: number;
  correct: number;
  wrong: number;
  durationMs: number;
  endedAt: number;
  newBest: boolean;
  xpEarned: number;
}

export interface ArcadeBest {
  score: number;
  wave: number;
  at: number;
}

export interface ArcadeRunInput {
  score: number;
  wave: number;
  kills: number;
  bestCombo: number;
  correct: number;
  wrong: number;
  durationMs: number;
  endedAt: number;
}

type Store = {
  getString: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
};

const memoryStore = new Map<string, string>();

function getStore(): Store {
  try {
    // Lazy require: MMKV is native and cannot load under Jest.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MMKV } = require('react-native-mmkv') as {
      MMKV: new (opts?: Record<string, unknown>) => Store;
    };
    return new MMKV();
  } catch {
    return {
      getString: (key: string) => memoryStore.get(key),
      set: (key: string, value: string) => {
        memoryStore.set(key, value);
      },
    };
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = getStore().getString(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    getStore().set(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort; a failed write must never break a run.
  }
}

/** Best arcade score ever (null when no run has been recorded yet). */
export function loadArcadeBest(): ArcadeBest | null {
  return readJson<ArcadeBest>(MMKV_KEYS.arcadeBest);
}

/** Last runs, newest first (max ARCADE_RUN_HISTORY_CAP). */
export function loadArcadeRuns(): ArcadeRunRecord[] {
  const runs = readJson<ArcadeRunRecord[]>(MMKV_KEYS.arcadeRuns);
  return Array.isArray(runs) ? runs : [];
}

export interface ArcadeSummary {
  best: ArcadeBest | null;
  runs: ArcadeRunRecord[];
  totalRuns: number;
}

/** Everything Home needs for the Arcade card, in one read. */
export function loadArcadeSummary(): ArcadeSummary {
  const runs = loadArcadeRuns();
  return { best: loadArcadeBest(), runs, totalRuns: runs.length };
}

/**
 * Record a finished run. Computes newBest + xpEarned itself (compares
 * against the stored best, updates the best when beaten) so the screen
 * can never record a run with the wrong flags. Returns the stored record.
 */
export function recordArcadeRun(input: ArcadeRunInput): ArcadeRunRecord {
  const prevBest = loadArcadeBest();
  const newBest = input.score > (prevBest?.score ?? -1);
  const xpEarned = arcadeXpForRun(input.score, prevBest?.score ?? null);
  const record: ArcadeRunRecord = {
    id: `arcade-${input.endedAt}-${Math.random().toString(36).slice(2, 8)}`,
    score: input.score,
    wave: input.wave,
    kills: input.kills,
    bestCombo: input.bestCombo,
    correct: input.correct,
    wrong: input.wrong,
    durationMs: input.durationMs,
    endedAt: input.endedAt,
    newBest,
    xpEarned,
  };
  if (newBest) {
    writeJson(MMKV_KEYS.arcadeBest, {
      score: input.score,
      wave: input.wave,
      at: input.endedAt,
    } satisfies ArcadeBest);
  }
  const runs = [record, ...loadArcadeRuns()].slice(0, ARCADE_RUN_HISTORY_CAP);
  writeJson(MMKV_KEYS.arcadeRuns, runs);
  return record;
}

/** Test-only reset so each test starts with no best and no runs. */
export function __resetArcadeForTests(): void {
  memoryStore.delete(MMKV_KEYS.arcadeBest);
  memoryStore.delete(MMKV_KEYS.arcadeRuns);
}
