// TechieMan — live level definitions (M7 / Live Levels).
// The concept runs live in code inside the level: the scenario script is
// real TypeScript that actually executes against the deterministic runtime
// (src/engine/levelRuntime.ts). What you see is what runs — the UI renders
// each function via fn.toString(), so the displayed code IS the code that
// runs. Tests assert the displayed source contains the mechanism's tokens.
//
// The three proof levels (the full range, by design):
//  1. FlatList 1000 items — render jank vs virtualized windowing (3.3-lists)
//  2. The null crash — items.map on undefined, orders-screen pattern (1.1-js-basics)
//  3. Retry storm / double-add under flaky network — idempotency key (6.1-fetch)
//
// HONESTY: the retry storm is the verified LearnTube Mission 2 mechanic
// (duplicate POST /cart/items ~1.2s apart; server supports an idempotency
// header). The null crash is the CANONICAL orders-screen pattern — never
// claimed to be a verified LearnTube incident (see LIVE_LEVELS_SPEC.md).
// The frame-cost numbers are a deterministic MODEL (levelRuntime.ts), not
// device measurements.

import { enemyForNode } from './enemies';
import {
  FRAME_BUDGET_MS,
  ROW_RENDER_COST_MS,
  type LevelApi,
  type LevelDefinition,
  type LevelLiveState,
} from '../engine/levelRuntime';

/** Rows in the FlatList viewport window (the virtualized render count). */
export const VIEWPORT_ROWS = 12;

/** Orders the null-crash level renders once the payload actually arrives. */
export const NULL_LEVEL_ORDERS = [
  { id: 'ord-101', title: 'Order #101 — 2 items' },
  { id: 'ord-102', title: 'Order #102 — 1 item' },
  { id: 'ord-103', title: 'Order #103 — 5 items' },
];

/** The retry level's endpoint (the verified LearnTube shape: POST /cart/items). */
export const CART_URL = '/cart/items';

function numGauge(state: LevelLiveState, key: string, fallback = 0): number {
  const v = state.gauges[key];
  return typeof v === 'number' ? v : fallback;
}

// ---------------------------------------------------------------------------
// Level 1 — FlatList, 1000 rows (node 3.3-lists)
// ---------------------------------------------------------------------------

function flatListScript(api: LevelApi): void {
  const s = api.state;
  const total = 1000;
  s.totalRows = total;
  const heavy = s.gauges.imageRows === true;
  const perRow = ROW_RENDER_COST_MS * (heavy ? 4 : 1);
  const windowed = s.gauges.windowing === true;
  const pageSize = numGauge(s, 'pageSize', 0);
  const scroll = numGauge(s, 'scrollOffset', 0);
  // The render loop really iterates the rows it claims to render.
  let rendered = 0;
  if (windowed) {
    const start = Math.max(0, Math.min(scroll, total - VIEWPORT_ROWS));
    s.gauges.windowStart = start;
    for (let i = start; i < start + VIEWPORT_ROWS; i++) rendered += 1;
    s.gauges.maxReachableRow = total - 1;
  } else if (pageSize > 0) {
    const loaded = Math.min(pageSize * numGauge(s, 'pagesLoaded', 1), total);
    s.gauges.maxReachableRow = loaded - 1;
    for (let i = 0; i < loaded; i++) rendered += 1;
  } else {
    s.gauges.maxReachableRow = total - 1;
    for (let i = 0; i < total; i++) rendered += 1;
  }
  let cost = rendered * perRow;
  const storm = numGauge(s, 'stormTicks', 0);
  if (storm > 0) {
    cost += 8;
    s.gauges.stormTicks = storm - 1;
  }
  s.renderedRows = rendered;
  s.frameCostMs = Math.round(cost * 100) / 100;
  s.gauges.fps = Math.round(1000 / Math.max(s.frameCostMs, 0.1));
  if (s.frameCostMs > FRAME_BUDGET_MS && s.gauges.jankLogged !== true) {
    api.log(
      'attack',
      `JANK — ${rendered} rows rendered, ${s.frameCostMs}ms/frame (budget ${FRAME_BUDGET_MS}ms). The list stutters; the user feels every frame.`,
    );
    s.gauges.jankLogged = true;
  } else if (s.frameCostMs <= FRAME_BUDGET_MS) {
    s.gauges.jankLogged = false;
  }
}

const FLATLIST_LEVEL: LevelDefinition = {
  id: 'level-3.3-flatlist-1000',
  nodeId: '3.3-lists',
  title: 'FlatList: 1000 rows, 6 fps',
  villainName: enemyForNode('3.3-lists')?.name ?? 'The Keyless Row',
  villainAccent: enemyForNode('3.3-lists')?.accent ?? '#4ade80',
  intro:
    'A feed with 1000 rows just shipped. Every row mounts. The list stutters at ~6 fps and the user can feel it.',
  difficulty: 3,
  createState: () => ({
    gauges: { scrollOffset: 0 },
    crashed: false,
    crashMessage: null,
    renderedRows: 0,
    totalRows: 1000,
    frameCostMs: 0,
    serverReceived: 0,
    serverProcessed: 0,
  }),
  script: flatListScript,
  villainAttack(api) {
    const s = api.state;
    if (s.gauges.imageRows !== true) {
      s.gauges.imageRows = true;
      s.gauges.heavyRowsFaced = true;
      api.log(
        'attack',
        'The villain stuffs a photo into every row — 4× the render cost. Your window better be up.',
      );
    } else {
      s.gauges.stormTicks = 3;
      api.log('attack', 'Rerender storm — every row re-renders for 3 ticks. Hold the budget.');
    }
  },
  objectives: [
    {
      id: 'frame-budget',
      label: 'Hold 60 fps with 1000 rows loaded (≤ 16.6 ms/frame)',
      check: api => api.state.totalRows === 1000 && api.state.frameCostMs <= FRAME_BUDGET_MS,
      hint: 'Rendering every row costs 1000 × 0.16 ms. Only a window survives the budget.',
    },
    {
      id: 'jump-to-end',
      label: 'Jump to row 999 — the window must follow the scroll',
      check: api =>
        api.state.gauges.rapidScrollDone === true &&
        api.state.gauges.windowStart === 1000 - VIEWPORT_ROWS &&
        api.state.renderedRows === VIEWPORT_ROWS,
      hint: 'Trigger Rapid Scroll, then watch the window slide to rows 988–999.',
    },
    {
      id: 'heavy-rows',
      label: 'Survive photo rows: 4× cost, still inside the budget',
      check: api =>
        api.state.gauges.heavyRowsFaced === true &&
        api.state.frameCostMs <= FRAME_BUDGET_MS,
      hint: 'Heavy rows arrive via the complex case or a wrong answer. Windowing is the only fix that holds.',
    },
  ],
  fixActions: [
    {
      id: 'enable-windowing',
      label: 'Enable windowing (FlatList window)',
      correct: true,
      apply: api => {
        api.state.gauges.windowing = true;
      },
      appliedNote:
        'FlatList renders a 12-row window. 988 rows never mount; scroll just slides the window.',
    },
    {
      id: 'memoize-rows',
      label: 'Memoize every row (React.memo)',
      correct: false,
      apply: api => {
        api.state.gauges.memoized = true;
      },
      appliedNote:
        'Memo skips RE-renders — but the first mount still renders all 1000 rows. The jank is at mount, not update.',
    },
    {
      id: 'paginate-50',
      label: 'Paginate: 50 rows per page',
      correct: false,
      apply: api => {
        api.state.gauges.pageSize = 50;
        api.state.gauges.pagesLoaded = 1;
      },
      appliedNote:
        'First page renders fast — but row 999 is 19 "Load more" taps away, and photo rows still blow the budget.',
    },
  ],
  complexCases: [
    {
      id: 'rapid-scroll',
      label: 'Rapid scroll to the bottom',
      description: 'The user flings the list to row 999 in one swipe.',
      trigger: api => {
        api.state.gauges.scrollOffset = 999;
        api.state.gauges.rapidScrollDone = true;
      },
    },
    {
      id: 'heavy-rows',
      label: 'Photo rows (4× cost)',
      description: 'Every row now carries a photo — 4× the render cost per row.',
      trigger: api => {
        api.state.gauges.imageRows = true;
        api.state.gauges.heavyRowsFaced = true;
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Level 2 — the null crash (node 1.1-js-basics)
// The canonical orders-screen pattern: the API payload has no `items`
// field, the screen does items.map, and every open is a red screen.
// ---------------------------------------------------------------------------

/**
 * The real render function. items.map throws a REAL TypeError when items is
 * undefined or null and no guard is active — the runtime catches it and
 * records the real message. Each fix changes exactly what this function does.
 */
function renderOrders(api: LevelApi, items: unknown): string[] {
  const s = api.state;
  // Decoy: swallow the error — no crash, and no orders ever. The symptom
  // and the data both disappear.
  if (s.gauges.swallowed === true) return [];
  // The correct fix: ?? guards BOTH undefined and null, then the list renders.
  if (s.gauges.guarded === true) {
    const list = (items ?? []) as Array<{ id: string; title: string }>;
    return list.map(o => o.title);
  }
  // Decoy: guard only `undefined` — the API sent null, and null.map throws.
  if (s.gauges.guardedUndefined === true) {
    const list =
      items === undefined ? [] : (items as Array<{ id: string; title: string }>);
    return list.map(o => o.title);
  }
  // Decoy: the non-null assertion is a compile-time promise — at runtime
  // null still has no .map, and this line still throws.
  return (items as Array<{ id: string; title: string }>).map(o => o.title);
}

function nullCrashScript(api: LevelApi): void {
  const s = api.state;
  const kind = (s.gauges.payloadKind as string | undefined) ?? 'undefined';
  const items =
    kind === 'orders'
      ? NULL_LEVEL_ORDERS
      : kind === 'empty'
        ? []
        : kind === 'null'
          ? null
          : undefined;
  // Throws for real when unguarded — the runtime records the real TypeError.
  const rows = renderOrders(api, items);
  s.renderedRows = rows.length;
  s.totalRows = rows.length;
  s.gauges.ordersVisible = rows.length;
  // Latched proof: reaching this line means this tick rendered cleanly.
  if (kind === 'undefined') s.gauges.survivedUndefined = true;
  if (kind === 'null') s.gauges.survivedNull = true;
  if (kind === 'empty') s.gauges.emptyStateShown = rows.length === 0;
  // Latched: the 3 real orders rendered at least once. (The live gauge
  // drops back to 0 when a later payload is null — the latch remembers
  // the orders did render, so a later null case can't un-pass the level.)
  if (rows.length === 3) s.gauges.ordersRendered = true;
}

const NULL_LEVEL: LevelDefinition = {
  id: 'level-1.1-null-crash',
  nodeId: '1.1-js-basics',
  title: 'The orders screen that crashes on open',
  villainName: enemyForNode('1.1-js-basics')?.name ?? 'The Loose Variable',
  villainAccent: enemyForNode('1.1-js-basics')?.accent ?? '#f5c542',
  intro:
    'The orders screen opens. The API payload has no `items` field. The screen does items.map — and dies. Every open is a red screen.',
  difficulty: 1,
  createState: () => ({
    gauges: { payloadKind: 'undefined', ordersVisible: 0 },
    crashed: false,
    crashMessage: null,
    renderedRows: 0,
    totalRows: 0,
    frameCostMs: 0,
    serverReceived: 0,
    serverProcessed: 0,
  }),
  script: nullCrashScript,
  villainAttack(api) {
    const s = api.state;
    if (s.gauges.payloadKind !== 'undefined') {
      s.gauges.payloadKind = 'undefined';
      api.log('attack', 'The API flakes — the payload arrives with no `items` again.');
    } else {
      s.gauges.payloadKind = 'null';
      api.log('attack', 'This time the API sends null instead of undefined. Same crash, different word.');
    }
  },
  objectives: [
    {
      id: 'survive-undefined',
      label: 'Survive an undefined payload — no red screen',
      check: api => api.state.gauges.survivedUndefined === true,
      hint: 'Guard the render so an undefined payload shows an empty list, not a crash.',
    },
    {
      id: 'orders-visible',
      label: 'The 3 real orders actually render',
      check: api => api.state.gauges.ordersRendered === true,
      hint: 'A guard alone shows an empty list. Reload the data — the orders must render.',
    },
    {
      id: 'survive-null',
      label: 'Survive a null payload too',
      check: api => api.state.gauges.survivedNull === true,
      hint: 'null is not undefined. Your guard must handle both — trigger the null case and watch.',
    },
  ],
  fixActions: [
    {
      id: 'guard-and-reload',
      label: 'Guard with ?? [] and reload',
      correct: true,
      apply: api => {
        api.state.gauges.guarded = true;
        // The reload is real: a virtual timer delivers the orders 300 ms later.
        api.after(300, () => {
          api.state.gauges.payloadKind = 'orders';
          api.log('info', 'Orders loaded — 3 orders.');
        });
      },
      appliedNote:
        'Guarded with ?? [] (covers undefined AND null) and the data is reloading. The screen renders while it waits.',
    },
    {
      id: 'assert-non-null',
      label: 'Assert it non-null (items!)',
      correct: false,
      apply: api => {
        api.state.gauges.asserted = true;
      },
      appliedNote:
        "'!' is a compile-time promise — at runtime null still has no .map. The crash is unchanged.",
    },
    {
      id: 'swallow-error',
      label: 'Wrap it in try/catch and swallow',
      correct: false,
      apply: api => {
        api.state.gauges.swallowed = true;
      },
      appliedNote:
        'No crash — and no orders either. Swallowing the error hid the symptom and the data.',
    },
    {
      id: 'undefined-only-guard',
      label: "Guard only `undefined` (items === undefined ? [] : items)",
      correct: false,
      apply: api => {
        api.state.gauges.guardedUndefined = true;
      },
      appliedNote:
        'You guarded undefined. The API sent null — and null.map throws exactly the same way.',
    },
  ],
  complexCases: [
    {
      id: 'null-payload',
      label: 'Null payload',
      description: 'The API returns null instead of undefined.',
      trigger: api => {
        api.state.gauges.payloadKind = 'null';
      },
    },
    {
      id: 'empty-orders',
      label: 'Genuinely empty orders',
      description: 'The user has no orders — the screen must say so, not crash.',
      trigger: api => {
        api.state.gauges.payloadKind = 'empty';
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Level 3 — retry storm / double-add (node 6.1-fetch)
// The verified LearnTube Mission 2 mechanic: a POST is applied by the
// server but its response is lost, the client retries, the server applies
// it again — the cart shows 2 items for 1 order. The fix is a stable
// Idempotency-Key per logical operation, which the mock server dedupes.
// ---------------------------------------------------------------------------

/**
 * One logical checkout operation. Retries on lost/failed responses up to
 * the retry budget. The Idempotency-Key is stable per OPERATION when the
 * fix is on (one key for the whole operation, retries included) — and a
 * fresh key per ATTEMPT when the decoy fix is on (which is exactly why the
 * decoy fails: the server sees different operations).
 */
function submitOrder(api: LevelApi, opId: string): boolean {
  const s = api.state;
  const budget = numGauge(s, 'retryBudget', 3);
  const idempotent = s.gauges.idempotent === true;
  const keyPerAttempt = s.gauges.keyPerAttempt === true;
  // One logical operation fired — counted here so every entry point
  // (demo checkout, single checkout, burst) counts it exactly once.
  s.gauges.operationsFired = numGauge(s, 'operationsFired', 0) + 1;
  for (let a = 0; a < budget; a++) {
    const headers: Record<string, string> = {};
    if (idempotent) {
      headers['Idempotency-Key'] = keyPerAttempt ? `${opId}-attempt-${a}` : opId;
    }
    const res = api.fetch('POST', CART_URL, { headers, body: { opId, item: 'cart-item' } });
    if (res.responseSeen) {
      s.gauges.ordersConfirmed = numGauge(s, 'ordersConfirmed', 0) + 1;
      return true;
    }
    // No response (lost or dropped): retry — the bug, when the key is absent
    // or unstable, because the server already applied the first attempt.
  }
  return false;
}

/** A checkout run: one operation, with before/after server deltas measured. */
function runCheckout(api: LevelApi, opId: string): void {
  const s = api.state;
  const startProcessed = s.serverProcessed;
  const ok = submitOrder(api, opId);
  const delta = s.serverProcessed - startProcessed;
  if (delta === 1 && ok) {
    s.gauges.cleanSingles = numGauge(s, 'cleanSingles', 0) + 1;
  }
  api.log(
    'info',
    `Checkout ${opId}: server processed ${delta}× for 1 order${ok ? ' — confirmed.' : ' — NEVER CONFIRMED.'}`,
  );
}

/** The 1000-user burst: 1000 distinct operations, each with its own key. */
function runBurst(api: LevelApi): void {
  const s = api.state;
  const startReceived = s.serverReceived;
  const startProcessed = s.serverProcessed;
  for (let i = 0; i < 1000; i++) {
    submitOrder(api, `order-burst-${i}`);
  }
  const deltaReceived = s.serverReceived - startReceived;
  const deltaProcessed = s.serverProcessed - startProcessed;
  if (deltaProcessed === 1000 && deltaReceived === 2000) {
    s.gauges.burstClean = true;
  }
  api.log(
    'info',
    `BURST — 1000 users checked out: ${deltaReceived} deliveries, ${deltaProcessed} processed. ` +
      `Clean is 2000 deliveries / 1000 processed (every retry deduped).`,
  );
}

function retryStormScript(api: LevelApi): void {
  const s = api.state;
  // The demo: the first checkout fires the moment the level opens — the
  // player watches the double-add happen live, before touching any fix.
  if (s.gauges.submitted !== true) {
    s.gauges.submitted = true;
    runCheckout(api, 'order-1');
  }
}

const RETRY_LEVEL: LevelDefinition = {
  id: 'level-6.1-retry-storm',
  nodeId: '6.1-fetch',
  title: 'The retry storm: 1 order, 2 charges',
  villainName: enemyForNode('6.1-fetch')?.name ?? 'The Unawaited Promise',
  villainAccent: enemyForNode('6.1-fetch')?.accent ?? '#38bdf8',
  intro:
    'Checkout is live and the network is flaky. The first POST is applied by the server — but its response is lost. The client retries. The cart shows 2 items for 1 order.',
  difficulty: 3,
  createState: () => ({
    gauges: { retryBudget: 3, ordersConfirmed: 0, operationsFired: 0, cleanSingles: 0 },
    crashed: false,
    crashMessage: null,
    renderedRows: 0,
    totalRows: 0,
    frameCostMs: 0,
    serverReceived: 0,
    serverProcessed: 0,
  }),
  script: retryStormScript,
  // First attempt of every operation is LOST (server applied it, response
  // never arrived); the retry succeeds. Deterministic by attempt number.
  transport: (method, url, attempt) => {
    if (method === 'POST' && url === CART_URL) {
      return attempt % 2 === 1 ? 'lost' : 'ok';
    }
    return 'ok';
  },
  villainAttack(api) {
    const s = api.state;
    // Raw replays of the demo order — NOT counted as operations (they are
    // the villain's doing, not the player's). With the fix they dedupe;
    // without it they land as 10 extra charges.
    const headers: Record<string, string> = {};
    if (s.gauges.idempotent === true && s.gauges.keyPerAttempt !== true) {
      headers['Idempotency-Key'] = 'order-1';
    }
    for (let i = 0; i < 10; i++) {
      api.fetch('POST', CART_URL, { headers, body: { opId: 'order-1', item: 'cart-item' } });
    }
    api.log('attack', 'The storm replays your last order 10×. With a stable key they dedupe — without it, 10 extra charges.');
  },
  objectives: [
    {
      id: 'clean-checkout',
      label: 'A post-fix checkout processes exactly once',
      check: api => numGauge(api.state, 'cleanSingles', 0) >= 1,
      hint: 'Apply the fix, then run a checkout. The server must process it exactly once.',
    },
    {
      id: 'burst-clean',
      label: '1000 users at once: 2000 deliveries, exactly 1000 processed',
      check: api => api.state.gauges.burstClean === true,
      hint: 'Trigger the 1000-user burst AFTER the fix. Every retry must dedupe.',
    },
    {
      id: 'no-lost-orders',
      label: 'No lost orders — every fired operation confirms',
      check: api => {
        const fired = numGauge(api.state, 'operationsFired', 0);
        return fired > 0 && numGauge(api.state, 'ordersConfirmed', 0) === fired;
      },
      hint: 'Killing retries kills duplicates — and kills orders. Every fired operation must confirm.',
    },
  ],
  fixActions: [
    {
      id: 'idempotency-key',
      label: 'Stable Idempotency-Key per operation',
      correct: true,
      apply: api => {
        api.state.gauges.idempotent = true;
        api.state.gauges.keyPerAttempt = false;
      },
      appliedNote:
        'One stable key per logical operation. The server remembers it — a replay returns the first 200, no second charge.',
    },
    {
      id: 'fresh-key-per-attempt',
      label: 'New Idempotency-Key per attempt',
      correct: false,
      apply: api => {
        api.state.gauges.idempotent = true;
        api.state.gauges.keyPerAttempt = true;
      },
      appliedNote:
        'A new key per attempt looks identical — but the server sees 2 different operations. The duplicate sails straight through.',
    },
    {
      id: 'disable-retries',
      label: 'Disable retries entirely',
      correct: false,
      apply: api => {
        api.state.gauges.retryBudget = 1;
      },
      appliedNote:
        'No duplicates — because the order never completes. A lost response now means a lost order.',
    },
  ],
  complexCases: [
    {
      id: 'checkout-single',
      label: 'Run a checkout',
      description: 'Fire one checkout operation through the flaky network.',
      trigger: api => {
        const n = numGauge(api.state, 'operationsFired', 0) + 1;
        runCheckout(api, `order-${n}`);
      },
    },
    {
      id: 'burst-1000',
      label: '1000 users at once',
      description: '1000 distinct users check out in the same moment.',
      trigger: api => {
        runBurst(api);
        api.state.gauges.burstDone = true;
      },
    },
    {
      id: 'replay-storm',
      label: 'Replay storm (webhook replay)',
      description: 'The load balancer replays the last 100 deliveries.',
      trigger: api => {
        // Replay through the fetch path so dedupe rules apply exactly as live:
        // with a stable key every replay dedupes; without one each lands again.
        const recent = api.requests.slice(-100);
        const before = api.state.serverProcessed;
        for (const r of recent) {
          api.fetch(r.method, r.url, { headers: { ...r.headers }, body: r.body });
        }
        const extra = api.state.serverProcessed - before;
        api.log(
          'info',
          `Replay storm: ${recent.length} deliveries replayed, ${extra} extra charges. ` +
            `Clean is 0 extra — every replay deduped.`,
        );
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const LEVELS: LevelDefinition[] = [NULL_LEVEL, FLATLIST_LEVEL, RETRY_LEVEL];

export function levelForNode(nodeId: string): LevelDefinition | undefined {
  return LEVELS.find(l => l.nodeId === nodeId);
}

export function hasLevel(nodeId: string): boolean {
  return levelForNode(nodeId) !== undefined;
}
