// TechieMan — proof-level tests (M7 / Live Levels).
// Every proof level is played headlessly through the real runtime:
// objectives fail before the fix, pass after the correct fix, each decoy
// fails with its own reason, and each complex case manifests for real
// (exact counts — not a fake animation).

import { createLevelSession } from '../../engine/levelRuntime';
import { applyFight, emptySnapshot } from '../../storage/progress';
import { NODES } from '../roadmap';
import { enemyForNode } from '../enemies';
import { LEVELS, hasLevel, levelForNode } from '../levels';

function objectives(s: ReturnType<typeof createLevelSession>) {
  const out: Record<string, boolean> = {};
  for (const o of s.objectives()) out[o.id] = o.passed;
  return out;
}

describe('registry', () => {
  it('ships exactly the 3 proof levels, each bound to a real roadmap node', () => {
    expect(LEVELS).toHaveLength(3);
    for (const level of LEVELS) {
      expect(NODES.some(n => n.id === level.nodeId)).toBe(true);
      expect(level.objectives.length).toBeGreaterThanOrEqual(3);
      expect(level.fixActions.some(f => f.correct)).toBe(true);
      expect(level.complexCases.length).toBeGreaterThanOrEqual(2);
      const enemy = enemyForNode(level.nodeId);
      expect(enemy).toBeDefined();
      expect(level.villainName).toBe(enemy!.name);
    }
  });

  it('the other 29 nodes honestly have no level yet', () => {
    expect(hasLevel('3.3-lists')).toBe(true);
    expect(hasLevel('1.1-js-basics')).toBe(true);
    expect(hasLevel('6.1-fetch')).toBe(true);
    expect(hasLevel('2.1-what-is-rn')).toBe(false);
    expect(hasLevel('8.4-publishing')).toBe(false);
    expect(levelForNode('5.2-forms')).toBeUndefined();
    const withLevel = NODES.filter(n => hasLevel(n.id));
    expect(withLevel).toHaveLength(3);
  });
});

describe('level 1 — FlatList 1000 items (3.3-lists)', () => {
  const fresh = () => createLevelSession(levelForNode('3.3-lists')!);

  it('renders all 1000 rows on mount and blows the frame budget for real', () => {
    const s = fresh();
    s.tick();
    expect(s.state.totalRows).toBe(1000);
    expect(s.state.renderedRows).toBe(1000);
    expect(s.state.frameCostMs).toBe(160);
    expect(s.state.gauges.fps).toBe(6); // 1000 / 160ms
    expect(objectives(s)).toEqual({
      'frame-budget': false,
      'jump-to-end': false,
      'heavy-rows': false,
    });
  });

  it('windowing passes the frame budget; the rapid-scroll case proves the jump', () => {
    const s = fresh();
    s.tick();
    s.applyFix('enable-windowing');
    s.tick();
    expect(s.state.renderedRows).toBe(12);
    expect(s.state.frameCostMs).toBeCloseTo(1.92, 6);
    expect(s.state.gauges.fps).toBe(521); // model value: 1000ms / 1.92ms
    expect(objectives(s)['frame-budget']).toBe(true);
    s.triggerCase('rapid-scroll');
    s.tick();
    expect(s.state.gauges.windowStart).toBe(988);
    expect(s.state.renderedRows).toBe(12);
    expect(objectives(s)['jump-to-end']).toBe(true);
  });

  it('heavy rows still stay in budget once windowed', () => {
    const s = fresh();
    s.tick();
    s.applyFix('enable-windowing');
    s.triggerCase('heavy-rows');
    s.tick();
    expect(s.state.gauges.imageRows).toBe(true);
    expect(s.state.frameCostMs).toBeCloseTo(7.68, 6); // 12 × 0.64ms
    expect(objectives(s)['heavy-rows']).toBe(true);
    expect(objectives(s)['frame-budget']).toBe(true);
  });

  it('memoize is a decoy: first mount still renders 1000 rows', () => {
    const s = fresh();
    s.tick();
    s.applyFix('memoize-rows');
    s.tick();
    expect(s.state.renderedRows).toBe(1000);
    expect(s.state.frameCostMs).toBe(160);
    expect(objectives(s)['frame-budget']).toBe(false);
  });

  it('paginate-50 is a decoy: row 999 stays 19 taps away and heavy rows fail', () => {
    const s = fresh();
    s.tick();
    s.applyFix('paginate-50');
    s.tick();
    expect(s.state.renderedRows).toBe(50);
    expect(s.state.frameCostMs).toBe(8); // in budget — but that is not the level
    expect(objectives(s)['frame-budget']).toBe(true);
    expect(objectives(s)['jump-to-end']).toBe(false);
    s.triggerCase('heavy-rows');
    s.tick();
    expect(objectives(s)['heavy-rows']).toBe(false); // 50 × 0.64 = 32ms
  });

  it('the villain attack is a rerender storm: +8ms per tick for 3 ticks', () => {
    const s = fresh();
    s.tick();
    s.applyFix('enable-windowing');
    s.triggerCase('heavy-rows');
    s.tick();
    s.answerQuestion(false, 5); // wrong answer → storm
    s.tick();
    expect(s.state.frameCostMs).toBeCloseTo(15.68, 6); // 7.68 + 8
    expect(s.state.gauges.stormTicks).toBe(2);
    s.tick();
    s.tick();
    expect(s.state.gauges.stormTicks).toBe(0);
  });
});

describe('level 2 — the null crash (1.1-js-basics)', () => {
  const fresh = () => createLevelSession(levelForNode('1.1-js-basics')!);

  it('the render REALLY crashes on undefined.items.map with the real TypeError', () => {
    const s = fresh();
    s.tick();
    expect(s.state.crashed).toBe(true);
    expect(s.state.crashMessage).toBe("Cannot read properties of undefined (reading 'map')");
    expect(s.state.gauges.ordersVisible).toBe(0);
    expect(objectives(s)).toEqual({
      'survive-undefined': false,
      'orders-visible': false,
      'survive-null': false,
    });
  });

  it('guard + reload passes everything: no crash, 3 orders, null survives', () => {
    const s = fresh();
    s.tick();
    expect(s.applyFix('guard-and-reload').ok).toBe(true);
    s.tick(); // t=100 — reload pending
    expect(s.state.gauges.payloadKind).toBe('undefined');
    s.tick();
    s.tick(); // t=300 — the virtual 300ms reload fires
    expect(s.state.gauges.payloadKind).toBe('orders');
    expect(s.state.gauges.ordersVisible).toBe(3);
    expect(s.state.crashed).toBe(false);
    expect(objectives(s)['survive-undefined']).toBe(true);
    expect(objectives(s)['orders-visible']).toBe(true);
    s.triggerCase('null-payload');
    s.tick();
    expect(s.state.crashed).toBe(false);
    expect(objectives(s)['survive-null']).toBe(true);
  });

  it('assert-non-null is a decoy: it still throws on the same line', () => {
    const s = fresh();
    s.tick();
    s.applyFix('assert-non-null');
    s.tick();
    expect(s.state.crashed).toBe(true);
    expect(s.state.crashMessage).toBe("Cannot read properties of undefined (reading 'map')");
  });

  it('swallow-error is a decoy: no crash, but no orders either', () => {
    const s = fresh();
    s.tick();
    s.applyFix('swallow-error');
    s.tick();
    expect(s.state.crashed).toBe(false);
    expect(s.state.gauges.ordersVisible).toBe(0);
    expect(objectives(s)['survive-undefined']).toBe(true);
    expect(objectives(s)['orders-visible']).toBe(false);
  });

  it('undefined-only-guard is a decoy: the null complex case still crashes it', () => {
    const s = fresh();
    s.tick();
    s.applyFix('undefined-only-guard');
    s.tick();
    expect(s.state.crashed).toBe(false);
    expect(objectives(s)['survive-undefined']).toBe(true);
    s.triggerCase('null-payload');
    s.tick();
    expect(s.state.crashed).toBe(true);
    expect(s.state.crashMessage).toBe("Cannot read properties of null (reading 'map')");
    expect(objectives(s)['survive-null']).toBe(false);
  });

  it('a wrong answer after the fix flips the payload and the guard holds', () => {
    const s = fresh();
    s.tick();
    s.applyFix('guard-and-reload');
    s.tick();
    s.tick();
    s.tick();
    expect(s.state.gauges.ordersVisible).toBe(3);
    s.answerQuestion(false, 5); // villain flips payload to undefined
    s.tick();
    expect(s.state.crashed).toBe(false); // guarded render holds
    expect(s.state.gauges.ordersVisible).toBe(0); // but the list is empty again
  });
});

describe('level 3 — retry storm / double-add (6.1-fetch)', () => {
  const fresh = () => createLevelSession(levelForNode('6.1-fetch')!);

  it('the demo checkout double-adds live: 2 deliveries, 2 processed, 1 confirmed', () => {
    const s = fresh();
    s.tick();
    expect(s.state.gauges.operationsFired).toBe(1);
    expect(s.state.gauges.ordersConfirmed).toBe(1);
    expect(s.state.serverReceived).toBe(2);
    expect(s.state.serverProcessed).toBe(2);
    expect(objectives(s)['clean-checkout']).toBe(false);
    expect(objectives(s)['no-lost-orders']).toBe(true); // nothing lost — just doubled
  });

  it('the idempotency key passes the single checkout: 2 deliveries, 1 processed', () => {
    const s = fresh();
    s.tick();
    s.applyFix('idempotency-key');
    s.triggerCase('checkout-single');
    s.tick();
    expect(s.state.gauges.operationsFired).toBe(2);
    expect(s.state.gauges.ordersConfirmed).toBe(2);
    expect(s.state.serverReceived).toBe(4);
    expect(s.state.serverProcessed).toBe(3); // demo 2 + this run 1
    expect(objectives(s)['clean-checkout']).toBe(true);
  });

  it('the 1000-op burst is clean after the fix: 2000 deliveries, 1000 processed', () => {
    const s = fresh();
    s.tick();
    s.applyFix('idempotency-key');
    s.triggerCase('burst-1000');
    s.tick();
    expect(s.state.gauges.operationsFired).toBe(1001);
    expect(s.state.gauges.ordersConfirmed).toBe(1001);
    expect(s.state.serverReceived).toBe(2002); // 2 demo + 2000 burst
    expect(s.state.serverProcessed).toBe(1002); // 2 demo + 1000 burst
    expect(objectives(s)['burst-clean']).toBe(true);
    expect(objectives(s)['no-lost-orders']).toBe(true);
  });

  it('without a fix the burst charges twice: 2000 deliveries, 2000 processed', () => {
    const s = fresh();
    s.tick();
    s.triggerCase('burst-1000');
    s.tick();
    expect(s.state.serverReceived).toBe(2002);
    expect(s.state.serverProcessed).toBe(2002);
    expect(objectives(s)['burst-clean']).toBe(false);
  });

  it('fresh-key-per-attempt is a decoy: the retry gets a new key, so it charges twice', () => {
    const s = fresh();
    s.tick();
    s.applyFix('fresh-key-per-attempt');
    s.triggerCase('checkout-single');
    s.tick();
    expect(s.state.serverReceived).toBe(4);
    expect(s.state.serverProcessed).toBe(4);
    expect(objectives(s)['clean-checkout']).toBe(false);
  });

  it('disable-retries is a decoy: the order is never confirmed and counts as lost', () => {
    const s = fresh();
    s.tick();
    s.applyFix('disable-retries');
    s.triggerCase('checkout-single');
    s.tick();
    expect(s.state.gauges.operationsFired).toBe(2);
    expect(s.state.gauges.ordersConfirmed).toBe(1);
    expect(objectives(s)['no-lost-orders']).toBe(false);
    expect(objectives(s)['clean-checkout']).toBe(false);
  });

  it('the replay storm dedupes after the fix and doubles without it', () => {
    const fixed = fresh();
    fixed.tick();
    fixed.applyFix('idempotency-key');
    fixed.triggerCase('burst-1000');
    fixed.tick();
    expect(fixed.state.serverProcessed).toBe(1002);
    fixed.triggerCase('replay-storm');
    fixed.tick();
    expect(fixed.state.serverProcessed).toBe(1002); // 0 extra charges

    const raw = fresh();
    raw.tick();
    raw.triggerCase('burst-1000');
    raw.tick();
    expect(raw.state.serverProcessed).toBe(2002);
    raw.triggerCase('replay-storm');
    raw.tick();
    expect(raw.state.serverProcessed).toBe(2102); // all 100 replayed charges land
  });

  it('the villain attack replays order-1 ten times raw', () => {
    const s = fresh();
    s.tick();
    s.applyFix('idempotency-key');
    const processedBefore = s.state.serverProcessed;
    s.answerQuestion(false, 5); // villain replay
    expect(s.state.serverReceived).toBe(12); // 2 demo + 10 replay
    // Exactly ONE extra charge, not zero: the demo order was placed BEFORE
    // the fix, so it never carried a key — the first keyed replay is a
    // genuinely new key to the server, and it applies once. Replays 2–10
    // carry the same key and dedupe. Without the fix all 10 land.
    expect(s.state.serverProcessed).toBe(processedBefore + 1);
    // Without the fix the same attack charges 10 more times.
    const raw = fresh();
    raw.tick();
    const rawBefore = raw.state.serverProcessed;
    raw.answerQuestion(false, 5);
    expect(raw.state.serverReceived).toBe(12);
    expect(raw.state.serverProcessed).toBe(rawBefore + 10);
  });
});

describe('code view honesty', () => {
  it('each level exposes its real source with the mechanism tokens in it', () => {
    const flat = levelForNode('3.3-lists')!;
    expect(flat.script.toString()).toContain('VIEWPORT_ROWS');
    expect(flat.script.toString()).toContain('frameCostMs');
    const nullLevel = levelForNode('1.1-js-basics')!;
    expect(nullLevel.script.toString()).toContain('renderOrders');
    const retry = levelForNode('6.1-fetch')!;
    expect(retry.script.toString()).toContain('runCheckout');
    expect(
      retry.complexCases.find(c => c.id === 'burst-1000')!.trigger.toString(),
    ).toContain('runBurst');
    // Fixes are distinguishable by their own code.
    expect(flat.fixActions.find(f => f.id === 'enable-windowing')!.apply.toString()).toContain('windowing');
    expect(flat.fixActions.find(f => f.id === 'memoize-rows')!.apply.toString()).toContain('memoized');
    expect(nullLevel.fixActions.find(f => f.id === 'guard-and-reload')!.apply.toString()).toContain('guarded');
    expect(retry.fixActions.find(f => f.id === 'idempotency-key')!.apply.toString()).toContain('keyPerAttempt');
  });
});

describe('full level playthrough → progression', () => {
  it('a won level feeds real XP through applyFight (no rewrite of progression)', () => {
    const def = levelForNode('1.1-js-basics')!;
    const s = createLevelSession(def);
    s.tick(); // observe the crash
    s.applyFix('guard-and-reload');
    s.tick();
    s.tick();
    s.tick(); // orders load
    s.triggerCase('null-payload');
    s.tick(); // survives null
    expect(s.allObjectivesPassed()).toBe(true);
    s.answerQuestion(true, 3); // 33 damage
    s.answerQuestion(true, 3); // 33 more — enemy HP 60 (difficulty 1) is gone
    expect(s.fight.enemy.hp).toBe(0);
    expect(s.outcome()).toBe('win');
    expect(s.phase).toBe('survived');

    const snapshot = emptySnapshot('guest-test');
    const input = {
      nodeId: def.nodeId,
      won: s.outcome() === 'win',
      correctCount: s.correctCount,
      wrongCount: s.wrongCount,
      bestCombo: s.fight.bestCombo,
      totalQuestions: s.correctCount + s.wrongCount,
      flawless: s.wrongCount === 0,
      isBoss: false,
      wrongTags: [] as string[],
      fastAnswers: s.fastAnswers,
      durationMs: s.world.nowMs,
      startedAt: Date.now(),
    };
    const { snapshot: next, summary } = applyFight(snapshot, input, Date.now());
    // 2 correct, flawless, first clear: 2×10 + 25 flawless bonus = 45 XP.
    expect(summary.xpEarned).toBe(45);
    expect(summary.newState).toBe('cleared');
    expect(summary.isFirstClear).toBe(true);
    expect(next.progress[def.nodeId]?.state).toBe('cleared');
    expect(next.xp).toBe(45);
  });

  it('a memoize-only run can never win: the villain floors at 1 HP', () => {
    const def = levelForNode('3.3-lists')!;
    const s = createLevelSession(def);
    s.tick();
    s.applyFix('memoize-rows');
    s.tick();
    for (let i = 0; i < 6; i++) s.answerQuestion(true, 2);
    expect(s.fight.enemy.hp).toBe(1);
    expect(s.outcome()).toBe('ongoing');
    expect(s.allObjectivesPassed()).toBe(false);
  });
});
