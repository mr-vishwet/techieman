import { measureTickCost } from '../../engine/frameBudget';
import { playerPoseGeometry, type PlayerPose } from '../../engine/choreography';
import { BOSS_ENEMIES, layoutEnemyGlyphs } from '../../data/enemies';

// Headless frame-budget check for the fight-canvas rebuild (extends the
// fpsMeter pattern): one tick builds the player pose paths for every pose
// (geometry -> PathBuilder-style segment walk, the canvas's exact per-frame
// work minus the Skia call itself) + lays out a boss enemy's glyphs in
// all three poses. Judged on mean/p95 vs 16.6ms after a 50-tick warm-up
// (measureTickCost); max is informational only, per frameBudget.ts.

const POSES: PlayerPose[] = ['idle', 'windup', 'jab', 'cross', 'kick', 'hurt', 'ko', 'win'];

describe('fight-canvas frame budget', () => {
  it('pose paths + boss glyph layout cost well under a 16.6ms frame', () => {
    const boss = BOSS_ENEMIES[7]; // FINAL BOSS — the most glyphs (6)
    let t = 0;
    let sink = 0;
    const { meanMs, maxMs, p95Ms } = measureTickCost(() => {
      t += 16;
      for (const pose of POSES) {
        const g = playerPoseGeometry(pose);
        // Walk the segments exactly as FightCanvas builds its SkPath:
        // head circle + one moveTo/lineTo pair per segment.
        sink += g.head.x + g.head.y + g.head.r;
        for (const [x1, y1, x2, y2] of g.lines) {
          sink += x1 + y1 + x2 + y2;
        }
      }
      for (const pose of ['idle', 'hurt', 'ko'] as const) {
        const laid = layoutEnemyGlyphs(boss, t, pose);
        for (const glyph of laid) {
          sink += glyph.x + glyph.y + glyph.rot + glyph.opacity;
        }
      }
    }, 500);
    // Printed so the numbers are visible in CI output, not just the assertion.
    console.log(
      `fight-canvas tick cost: mean ${meanMs.toFixed(3)}ms, p95 ${p95Ms.toFixed(3)}ms, max ${maxMs.toFixed(3)}ms (budget 16.6ms)`,
    );
    expect(Number.isFinite(sink)).toBe(true);
    expect(meanMs).toBeLessThan(16.6);
    expect(p95Ms).toBeLessThan(16.6);
    // NOTE: max is deliberately NOT asserted — a single JIT/GC spike under
    // parallel-suite load is not a frame-budget violation (frameBudget.ts).
  });
});
