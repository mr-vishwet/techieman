import { measureTickCost } from '../../engine/frameBudget';
import { applyAnswer, newFight } from '../../engine/fightMath';

// Headless M2 check: the JS-side cost of one fight-frame tick must be far
// below the 16.6ms frame budget, so the JS thread can never starve the
// UI-thread Skia draw. This does NOT measure render — on-device FPS is
// measured by useFpsMeter (see BUILD_REPORT_RN.md).

describe('measureTickCost', () => {
  it('one fight-logic tick costs well under a 16.6ms frame', () => {
    let state = newFight(3);
    const { meanMs, maxMs, p95Ms } = measureTickCost(() => {
      const r = applyAnswer(state, true, 4);
      state = r.state;
      if (r.outcome !== 'ongoing') state = newFight(3);
    }, 500);
    // Printed so the numbers are visible in CI output, not just the assertion.
    console.log(`fight-tick cost: mean ${meanMs.toFixed(3)}ms, p95 ${p95Ms.toFixed(3)}ms, max ${maxMs.toFixed(3)}ms (budget 16.6ms)`);
    expect(meanMs).toBeLessThan(16.6);
    expect(p95Ms).toBeLessThan(16.6);
    // NOTE: max is deliberately NOT asserted — a single JIT/GC spike under
    // parallel-suite load (observed: 162ms once) is not a frame-budget
    // violation. Sustained cost is what matters, and the on-device FPS
    // meter is the real gate for render.
  });
});
