// TechieMan — live-level runtime (M7 / Live Levels).
// The deterministic mini-runtime behind the Live Level Rule (user, 26 Nov
// 2026): each concept is a LIVE LEVEL — the concept runs live in code inside
// the level, with its test cases and complex cases in the same code. The
// player plays the live scenario (observe → diagnose → act → survive); the
// question bank is the fight ammunition, not the whole game.
//
// Design rules (enforced here, not just documented):
// - DETERMINISTIC. Virtual clock (100 ms ticks), seeded PRNG, scripted
//   mocked fetch. Same seed + same action sequence → identical event log,
//   identical server log, identical state. A level can be replayed exactly.
// - REAL, not animated. Scenario code is real TypeScript functions that
//   actually run (no eval / new Function — Hermes has neither). A null crash
//   is a REAL TypeError thrown by the scenario script, caught here and
//   recorded with its real message. A duplicate POST is a REAL second entry
//   in the mock server's log. Objectives are REAL assertions over the world.
// - NO REAL NETWORK, NO REAL TIMERS. fetch is mocked and synchronous;
//   timers are virtual and fire on tick(). The app never touches the network
//   from a level, and a level can never hang the UI thread.
// - WHAT YOU SEE IS WHAT RUNS. The UI renders a scenario function's source
//   via fn.toString() — the displayed code is literally the code that runs.
//   Tests assert the displayed source contains the mechanism's key tokens.
// - FRAME-COST MODEL. frameCostMs = renderedRows × ROW_RENDER_COST_MS is a
//   deterministic MODEL (calibrated from the 16.6 ms frame budget), never a
//   device measurement. The render loop really iterates the rows it claims
//   to render; the model converts the count to a frame cost. Labelled as a
//   model wherever it is shown.
// - THE VILLAIN FEEDS ON THE LIVE BUG. The villain's HP floors at 1 while
//   any scenario objective is unmet — you cannot kill the concept until the
//   live failure is actually fixed. Questions damage the villain; wrong
//   answers damage you AND fire the level's villainAttack (the live failure
//   escalates: another crash tick / jank spike / extra duplicate POST).
//
// Pure TypeScript, zero React Native imports — safe to import in Jest.
// Fight HP/damage rules are reused from fightMath.ts (never reimplemented).

import {
  applyAnswer,
  newFight,
  type AnswerResult,
  type FightState,
} from './fightMath';

export const TICK_MS = 100;

/** Frame budget: 60 fps = 16.6 ms per frame (plan §2.1). */
export const FRAME_BUDGET_MS = 16.6;

/**
 * Render-cost MODEL: one list row costs this much JS time on a mid-range
 * phone. Deterministic model constant, not a measurement — see header.
 * 1000 rows × 0.16 ms = 160 ms/frame (~6 fps, visible jank); a 12-row
 * window × 0.16 ms = 1.9 ms/frame (60 fps, headroom to spare).
 */
export const ROW_RENDER_COST_MS = 0.16;

/** A fast answer for the fast-answers quest (same threshold as fights). */
export const FAST_ANSWER_SECONDS = 8;

export type WorldEventKind =
  | 'info'
  | 'attack'
  | 'fix'
  | 'crash'
  | 'request'
  | 'objective'
  | 'question';

/** One line in the level's live feed. Ticks and virtual ms, never wall time. */
export interface WorldEvent {
  tick: number;
  atMs: number;
  kind: WorldEventKind;
  message: string;
}

/**
 * What the mocked transport can do to a request. 'lost' is the real
 * double-add cause: the request REACHED the server and was applied, but the
 * response never came back — so the client retries and the server applies it
 * again. 'drop' never reached the server at all. 'fail' is a 500: rejected
 * before applying, safe to retry.
 */
export type TransportOutcome = 'ok' | 'lost' | 'fail' | 'drop';

export interface MockRequest {
  id: number;
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body: unknown;
  /** 1 = first try, 2+ = retry of the same logical operation. */
  attempt: number;
  atMs: number;
  outcome: TransportOutcome;
  /** true when the server recognised a repeated Idempotency-Key. */
  deduped: boolean;
}

/**
 * The live state every level shares. Levels read/write this directly in
 * their script/fix/objective functions; the UI renders it live.
 */
export interface LevelLiveState {
  /** Free-form gauges (counts, flags, labels) the level updates. */
  gauges: Record<string, number | string | boolean>;
  /** True while the live render is crashed (real exception captured). */
  crashed: boolean;
  /** The real error message, e.g. "Cannot read properties of undefined (reading 'map')". */
  crashMessage: string | null;
  /** Rows the live list actually rendered this tick (the loop really runs). */
  renderedRows: number;
  totalRows: number;
  /** Deterministic render-cost model output for this tick (see header). */
  frameCostMs: number;
  /** Requests that reached the mock server (dropped ones never arrive). */
  serverReceived: number;
  /** Requests the server actually applied (deduped repeats excluded). */
  serverProcessed: number;
}

export function defaultLiveState(): LevelLiveState {
  return {
    gauges: {},
    crashed: false,
    crashMessage: null,
    renderedRows: 0,
    totalRows: 0,
    frameCostMs: 0,
    serverReceived: 0,
    serverProcessed: 0,
  };
}

/** Deterministic PRNG (mulberry32). Same seed → same sequence, always. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LevelWorld {
  nowMs: number;
  tick: number;
  seed: number;
  events: WorldEvent[];
  log(kind: WorldEventKind, message: string): void;
  /** Schedule fn on the virtual clock; fires from tick(), never the real one. */
  after(ms: number, fn: () => void): void;
  /** Seeded random in [0, 1). */
  random(): number;
}

export interface FetchResult {
  status: number;
  body: unknown;
  /** True when the response reached the client (false on drop/lost/fail). */
  responseSeen: boolean;
  /** True when the server answered from a repeated Idempotency-Key. */
  deduped: boolean;
}

/** Everything a level's code can touch. Passed to script/fix/objectives. */
export interface LevelApi {
  world: LevelWorld;
  state: LevelLiveState;
  /** The mock server's received log, in order (read-only view for replay). */
  requests: MockRequest[];
  /**
   * Synchronous mocked fetch. Records the request on the mock server
   * (unless the transport drops it), applies the transport outcome, and
   * dedupes POSTs by Idempotency-Key. Never real network.
   */
  fetch(
    method: 'GET' | 'POST',
    url: string,
    opts?: { headers?: Record<string, string>; body?: unknown },
  ): FetchResult;
  log(kind: WorldEventKind, message: string): void;
  after(ms: number, fn: () => void): void;
  random(): number;
}

export interface FixAction {
  id: string;
  label: string;
  /** Whether this is the correct fix — decoy fixes exist and must fail. */
  correct: boolean;
  /** The real code that runs — the UI shows this via fn.toString(). */
  apply: (api: LevelApi) => void;
  /** What the level says when this fix is applied. */
  appliedNote: string;
}

export interface LevelObjective {
  id: string;
  label: string;
  /** Real assertion over the world. Must be pure and deterministic. */
  check: (api: LevelApi) => boolean;
  hint: string;
}

export interface ComplexCase {
  id: string;
  label: string;
  description: string;
  /** Injects the hard case into the live run, for real. */
  trigger: (api: LevelApi) => void;
}

/**
 * Decides what the mocked transport does to each request. Pure and
 * deterministic: same (method, url, attempt, callIndex) → same outcome.
 * Omit it and every request succeeds ('ok').
 */
export type TransportScript = (
  method: 'GET' | 'POST',
  url: string,
  attempt: number,
  callIndex: number,
) => TransportOutcome;

export interface LevelDefinition {
  id: string;
  nodeId: string;
  title: string;
  /** Enemy name from enemies.ts — the language itself, never a goblin. */
  villainName: string;
  villainAccent: string;
  /** 1–2 lines: the live situation the player walks into. */
  intro: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  createState: () => LevelLiveState;
  /** Runs every tick. The live scenario — real code, real failures. */
  script: (api: LevelApi) => void;
  /** Runs on every wrong answer: the live failure escalates, for real. */
  villainAttack?: (api: LevelApi) => void;
  transport?: TransportScript;
  objectives: LevelObjective[];
  fixActions: FixAction[];
  complexCases: ComplexCase[];
}

export type LevelPhase = 'observe' | 'diagnose' | 'act' | 'survived' | 'failed';

export interface ObjectiveState {
  id: string;
  label: string;
  passed: boolean;
  hint: string;
}

export interface LevelSession {
  def: LevelDefinition;
  fight: FightState;
  phase: LevelPhase;
  world: LevelWorld;
  state: LevelLiveState;
  appliedFixIds: string[];
  triggeredCaseIds: string[];
  correctCount: number;
  wrongCount: number;
  fastAnswers: number;
  startedAt: number;
  /** The mock server's received log (in order). Dropped requests never appear. */
  requests: MockRequest[];
  tick(): void;
  applyFix(fixId: string): { ok: boolean; note: string };
  triggerCase(caseId: string): void;
  /** A question answered mid-level: correct damages the villain, wrong damages you + fires villainAttack. */
  answerQuestion(correct: boolean, secondsUsed: number): AnswerResult;
  objectives(): ObjectiveState[];
  allObjectivesPassed(): boolean;
  outcome(): 'win' | 'lose' | 'ongoing';
}

interface TimerEntry {
  dueMs: number;
  fn: () => void;
}

export function createLevelSession(def: LevelDefinition, seed = 1): LevelSession {
  const state = def.createState();
  const rand = seededRandom(seed);
  const timers: TimerEntry[] = [];
  const seenKeys = new Set<string>();
  const attemptsByEndpoint = new Map<string, number>();
  const requests: MockRequest[] = [];
  let requestId = 0;
  let fetchCalls = 0;

  const world: LevelWorld = {
    nowMs: 0,
    tick: 0,
    seed,
    events: [],
    log(kind, message) {
      world.events.push({ tick: world.tick, atMs: world.nowMs, kind, message });
    },
    after(ms, fn) {
      timers.push({ dueMs: world.nowMs + ms, fn });
    },
    random: rand,
  };

  // Outcome refresh: win = villain down AND every objective green;
  // lose = your HP hit 0. Declared here so every session method can call it.
  function refreshOutcome(): void {
    const out = session.outcome();
    if (out === 'win' && session.phase !== 'survived') {
      session.phase = 'survived';
      world.log('objective', 'LEVEL SURVIVED — every objective green, villain down.');
    } else if (out === 'lose' && session.phase !== 'failed') {
      session.phase = 'failed';
      world.log('attack', 'KNOCKED OUT — the concept wins this round.');
    }
  }

  const session: LevelSession = {
    def,
    fight: newFight(def.difficulty),
    phase: 'observe',
    world,
    state,
    appliedFixIds: [],
    triggeredCaseIds: [],
    correctCount: 0,
    wrongCount: 0,
    fastAnswers: 0,
    startedAt: Date.now(),
    requests,

    tick() {
      world.tick += 1;
      world.nowMs += TICK_MS;
      // Fire due virtual timers, in due order. A timer may schedule more.
      timers.sort((a, b) => a.dueMs - b.dueMs);
      while (timers.length > 0 && timers[0].dueMs <= world.nowMs) {
        const t = timers.shift()!;
        try {
          t.fn();
        } catch (e) {
          world.log('crash', `Timer crashed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      // "Crashed" reflects the LATEST tick: a clean render clears the red
      // screen, a throwing render sets it again (with the real message).
      state.crashed = false;
      state.crashMessage = null;
      // The live scenario runs — for real, every tick. A throw is a real
      // crash: record it with the real message, keep the session alive.
      try {
        def.script(api);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!state.crashed || state.crashMessage !== message) {
          world.log('crash', `CRASH — ${message}`);
        }
        state.crashed = true;
        state.crashMessage = message;
      }
      if (session.phase === 'observe') session.phase = 'diagnose';
      refreshOutcome();
    },

    applyFix(fixId) {
      const fix = def.fixActions.find(f => f.id === fixId);
      if (!fix) return { ok: false, note: `No fix action '${fixId}' in this level.` };
      if (session.appliedFixIds.includes(fixId)) {
        return { ok: false, note: `'${fix.label}' is already applied.` };
      }
      try {
        fix.apply(api);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        world.log('crash', `Fix '${fix.label}' crashed: ${message}`);
        state.crashed = true;
        state.crashMessage = message;
        return { ok: false, note: `The fix itself crashed: ${message}` };
      }
      session.appliedFixIds.push(fixId);
      world.log('fix', `${fix.label} — ${fix.appliedNote}`);
      if (session.phase === 'observe' || session.phase === 'diagnose') {
        session.phase = 'act';
      }
      refreshOutcome();
      return { ok: true, note: fix.appliedNote };
    },

    triggerCase(caseId) {
      const c = def.complexCases.find(x => x.id === caseId);
      if (!c || session.triggeredCaseIds.includes(caseId)) return;
      session.triggeredCaseIds.push(caseId);
      world.log('attack', `COMPLEX CASE — ${c.label}: ${c.description}`);
      try {
        c.trigger(api);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        world.log('crash', `Complex case crashed: ${message}`);
        state.crashed = true;
        state.crashMessage = message;
      }
      refreshOutcome();
    },

    answerQuestion(correct, secondsUsed) {
      const result = applyAnswer(session.fight, correct, secondsUsed);
      session.fight = result.state;
      if (correct) {
        session.correctCount += 1;
        if (secondsUsed < FAST_ANSWER_SECONDS) session.fastAnswers += 1;
        world.log('question', `Correct — hit landed, ${result.damageDealt} damage.`);
        // THE VILLAIN FEEDS ON THE LIVE BUG: no killing blow while any
        // objective is unmet. The HP floor is the rule, not a display quirk.
        if (result.state.enemy.hp <= 0 && !session.allObjectivesPassed()) {
          session.fight = {
            ...result.state,
            enemy: { ...result.state.enemy, hp: 1 },
          };
          world.log(
            'attack',
            `${def.villainName} clings to life at 1 HP — the live bug is still feeding it. Fix the scenario to land the killing blow.`,
          );
          return { ...result, state: session.fight, outcome: 'ongoing' as const };
        }
      } else {
        session.wrongCount += 1;
        world.log(
          'question',
          `Wrong — ${def.villainName} hits back for ${result.damageTaken} damage.`,
        );
        // Wrong answers escalate the live failure, for real.
        if (def.villainAttack) {
          try {
            def.villainAttack(api);
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            world.log('crash', `Villain attack crashed: ${message}`);
            state.crashed = true;
            state.crashMessage = message;
          }
        }
      }
      refreshOutcome();
      return result;
    },

    objectives() {
      return def.objectives.map(o => {
        let passed = false;
        try {
          passed = o.check(api);
        } catch {
          passed = false;
        }
        return { id: o.id, label: o.label, passed, hint: o.hint };
      });
    },

    allObjectivesPassed() {
      return session.objectives().every(o => o.passed);
    },

    outcome() {
      if (session.fight.player.hp <= 0) return 'lose';
      if (session.fight.enemy.hp <= 0 && session.allObjectivesPassed()) return 'win';
      return 'ongoing';
    },
  };


  const api: LevelApi = {
    world,
    state,
    requests,
    fetch(method, url, opts = {}) {
      fetchCalls += 1;
      const endpointKey = `${method} ${url}`;
      const attempt = (attemptsByEndpoint.get(endpointKey) ?? 0) + 1;
      attemptsByEndpoint.set(endpointKey, attempt);
      const outcome: TransportOutcome = def.transport
        ? def.transport(method, url, attempt, fetchCalls)
        : 'ok';
      const headers = { ...(opts.headers ?? {}) };
      if (outcome === 'drop') {
        world.log('request', `${method} ${url} (attempt ${attempt}) → DROPPED, no response.`);
        return { status: 0, body: null, responseSeen: false, deduped: false };
      }
      const key = headers['Idempotency-Key'];
      let deduped = false;
      if (method === 'POST' && typeof key === 'string' && key.length > 0) {
        if (seenKeys.has(key)) {
          deduped = true;
        } else {
          seenKeys.add(key);
        }
      }
      requestId += 1;
      requests.push({
        id: requestId,
        method,
        url,
        headers,
        body: opts.body ?? null,
        attempt,
        atMs: world.nowMs,
        outcome,
        deduped,
      });
      state.serverReceived = requests.length;
      if (!deduped && outcome !== 'fail') {
        // 'ok' and 'lost' both applied server-side; 'fail' (500) did not.
        state.serverProcessed += 1;
      }
      if (outcome === 'lost') {
        world.log(
          'request',
          `${method} ${url} (attempt ${attempt}) → LOST: server applied it, response never arrived.`,
        );
        return { status: 0, body: null, responseSeen: false, deduped };
      }
      if (outcome === 'fail') {
        world.log('request', `${method} ${url} (attempt ${attempt}) → 500, rejected.`);
        return { status: 500, body: { error: 'Internal Server Error' }, responseSeen: true, deduped };
      }
      world.log('request', `${method} ${url} (attempt ${attempt}) → 200${deduped ? ' (deduped)' : ''}.`);
      return { status: 200, body: { ok: true, deduped }, responseSeen: true, deduped };
    },
    log(kind, message) {
      world.log(kind, message);
    },
    after(ms, fn) {
      world.after(ms, fn);
    },
    random: rand,
  };

  world.log('info', `${def.title} — ${def.intro}`);
  return session;
}
