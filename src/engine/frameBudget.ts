// TechieMan — headless frame-budget check (pure TypeScript, no RN imports).
// The JS-side cost of one fight-frame tick must be far below the 16.6ms
// frame budget, so the JS thread can never starve the UI-thread Skia draw.
// This does NOT measure render — on-device FPS is measured by useFpsMeter
// (src/components/FpsMeter.ts) during a real fight on a real device.
//
// Measuring note (fixed 25 Nov 2026 after a flaky failure): the first ticks
// include JIT warm-up, and a single GC pause can spike one tick to >100ms
// under parallel-suite load even though the steady-state cost is ~0.006ms.
// So: warm up first, measure with performance.now(), and judge on mean/p95 —
// max is reported for information only and is NOT asserted on. A single
// spike is not a frame-budget violation; sustained cost is.

// Hermes (React Native) and Jest both provide performance.now() at runtime,
// but the RN tsconfig has no DOM lib, so declare the sliver we use.
declare const performance: { now: () => number };

export function measureTickCost(
  tick: () => void,
  iterations = 1000,
): { meanMs: number; maxMs: number; p95Ms: number } {
  for (let i = 0; i < 50; i++) tick(); // warm-up: JIT + first allocations
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    tick();
    times.push(performance.now() - t0);
  }
  const sorted = [...times].sort((a, b) => a - b);
  const meanMs = times.reduce((a, b) => a + b, 0) / times.length;
  const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return { meanMs, maxMs: Math.max(...times), p95Ms };
}
