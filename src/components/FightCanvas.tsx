// TechieMan — M2 fight-engine spike: Skia canvas fight scene.
// Draws the crimson stickman fighter + the `?` Goblin enemy as pure vector
// Skia paths (no fonts, no raster sprites — plan §5.2).
//
// API note (verified against the INSTALLED @shopify/react-native-skia 2.14.0
// types, 25 Nov 2026 — Skia 2.x is NOT Skia 1.x):
//  - No useValue / useComputedValue / runTiming / runSpring in Skia anymore.
//    Animation values are Reanimated shared values (useSharedValue /
//    useDerivedValue / withTiming / withSpring); Skia components accept them
//    directly as props. useClock() returns a SharedValue<number> (.value).
//  - Paths are built with Skia.PathBuilder.Make() (mutable builder with
//    moveTo/lineTo/addCircle/addArc) and .build() -> SkPath. Skia.Path.Make()
//    returns an IMMUTABLE SkPath with no mutation methods.
//  - Rects: Skia.XYWHRect(x, y, w, h).
// All per-frame work runs on the UI thread; React state is never touched
// per-frame. Reanimated also owns the FPS meter + screen shake (see FpsMeter).
//
// Fallback note (plan §6.3): if rive-react-native fails to mount under RN 0.88
// New Architecture, THIS component is the fighter — Skia-drawn stickmen are
// the production fallback, not a placeholder.

import React, { useEffect } from 'react';
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  useClock,
  type SkPath,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { colors, fighter } from '../theme/tokens';

export type FighterPose = 'idle' | 'attack' | 'hurt' | 'ko' | 'win';

export interface FightCanvasProps {
  width: number;
  height: number;
  /** 'attack' | 'hurt' | 'ko' | 'win' are transient — parent flips back to 'idle' */
  pose: FighterPose;
  enemyPose: 'idle' | 'hurt' | 'ko';
  /** increment to fire an impact particle burst */
  burstKey: number;
}

const PARTICLES = 14;

/** Deterministic particle seeds (angle, speed, size) — no Math.random in render. */
const PARTICLE_SEEDS = Array.from({ length: PARTICLES }, (_, i) => ({
  angle: (i / PARTICLES) * Math.PI * 2 + 0.35,
  speed: 60 + ((i * 37) % 90),
  size: 2 + ((i * 13) % 4),
}));

/** Pose encoded as a number so derived values can read it. */
const POSE_CODE: Record<FighterPose, number> = {
  idle: 0,
  attack: 1,
  hurt: 2,
  ko: 3,
  win: 4,
};

/**
 * Builds a stickman path centred at (cx, cy) — head circle + body + limbs.
 * poseCode changes limb angles. All coordinates are in canvas space.
 */
function stickmanPath(cx: number, cy: number, scale: number, poseCode: number): SkPath {
  const b = Skia.PathBuilder.Make();
  if (poseCode === 3) {
    // KO: lying flat on the floor, head to the right, limbs sprawled.
    // (Rotation is drawn into the path itself — Skia 2.x Group transform
    // takes plain numbers only, so the fall is baked into the geometry.)
    const floorY = cy + 30 * scale;
    b.addCircle(cx + 34 * scale, floorY - 8 * scale, 11 * scale); // head
    b.moveTo(cx + 24 * scale, floorY - 4 * scale);
    b.lineTo(cx - 10 * scale, floorY); // body, horizontal
    b.moveTo(cx + 10 * scale, floorY);
    b.lineTo(cx + 22 * scale, floorY - 16 * scale); // arm up
    b.moveTo(cx + 10 * scale, floorY);
    b.lineTo(cx + 20 * scale, floorY + 8 * scale); // arm down
    b.moveTo(cx - 10 * scale, floorY);
    b.lineTo(cx - 30 * scale, floorY - 10 * scale); // legs
    b.moveTo(cx - 10 * scale, floorY);
    b.lineTo(cx - 28 * scale, floorY + 10 * scale);
    return b.build();
  }
  const headR = 11 * scale;
  const headCy = cy - 34 * scale;
  // head
  b.addCircle(cx, headCy, headR);
  // body
  b.moveTo(cx, headCy + headR);
  b.lineTo(cx, cy + 6 * scale);
  const armSwing = poseCode === 1 ? 26 : poseCode === 2 ? -14 : 0;
  const legSpread = poseCode === 1 ? 16 : 10;
  // arms (attack = one arm punched forward)
  if (poseCode === 1) {
    b.moveTo(cx, cy - 22 * scale);
    b.lineTo(cx + 30 * scale, cy - 26 * scale); // punching arm
    b.moveTo(cx, cy - 22 * scale);
    b.lineTo(cx - 14 * scale, cy - 6 * scale); // back arm
  } else {
    b.moveTo(cx, cy - 22 * scale);
    b.lineTo(cx - 16 * scale, cy - 6 * scale + armSwing);
    b.moveTo(cx, cy - 22 * scale);
    b.lineTo(cx + 16 * scale, cy - 6 * scale - armSwing);
  }
  // legs
  b.moveTo(cx, cy + 6 * scale);
  b.lineTo(cx - legSpread * scale, cy + 30 * scale);
  b.moveTo(cx, cy + 6 * scale);
  b.lineTo(cx + legSpread * scale, cy + 30 * scale);
  return b.build();
}

/** The `?` Goblin: a circle body + a vector question mark (arc + dot). */
function goblinPath(cx: number, cy: number, scale: number): SkPath {
  const b = Skia.PathBuilder.Make();
  b.addCircle(cx, cy, 34 * scale); // body
  // question-mark hook: arc over the top
  const r = Skia.XYWHRect(cx - 13 * scale, cy - 24 * scale, 26 * scale, 26 * scale);
  b.addArc(r, 180, 270);
  b.moveTo(cx + 11 * scale, cy - 2 * scale);
  b.lineTo(cx + 2 * scale, cy + 6 * scale);
  // dot
  b.addCircle(cx + 1 * scale, cy + 14 * scale, 3 * scale);
  return b.build();
}

export function FightCanvas({ width, height, pose, enemyPose, burstKey }: FightCanvasProps) {
  const clock = useClock();
  const lunge = useSharedValue(0); // 0..1 — fighter dashes toward the enemy on attack
  const lean = useSharedValue(0); // -1..1 — hurt lean
  const burst = useSharedValue(0); // 0..1 — particle burst progress
  const poseCode = useSharedValue(0);

  const floorY = height - 24;
  const fighterBaseX = width * 0.28;
  const enemyBaseX = width * 0.72;
  const groundY = floorY - 30;

  // Idle bob (shared by both fighters, phase-shifted for the enemy).
  const bobY = useDerivedValue(
    () => Math.sin((clock.value / 1000) * (Math.PI * 2) * 0.8) * 4,
    [clock],
  );
  const enemyBobY = useDerivedValue(
    () => Math.sin((clock.value / 1000) * (Math.PI * 2) * 0.8 + Math.PI) * 4,
    [clock],
  );

  const fighterX = useDerivedValue(
    () => fighterBaseX + lunge.value * width * 0.22,
    [lunge, width],
  );
  const fighterY = useDerivedValue(
    () => groundY + bobY.value + lean.value * 6,
    [bobY, lean, groundY],
  );
  const headbandCy = useDerivedValue(() => fighterY.value - 40, [fighterY]);

  const fighterPath = useDerivedValue(
    () => stickmanPath(fighterX.value, fighterY.value, 1.1, poseCode.value),
    [fighterX, fighterY, poseCode],
  );

  const enemyPath = useDerivedValue(
    () => goblinPath(enemyBaseX, groundY + enemyBobY.value, 1.0),
    [enemyBobY, enemyBaseX, groundY],
  );

  // Impact particles: burst out from the enemy on a hit, fade over 500ms.
  const particlePath = useDerivedValue(() => {
    const t = burst.value;
    const b = Skia.PathBuilder.Make();
    if (t > 0 && t < 1) {
      for (const s of PARTICLE_SEEDS) {
        const d = s.speed * t;
        const x = enemyBaseX + Math.cos(s.angle) * d;
        const y = groundY - 10 + Math.sin(s.angle) * d - 40 * t * t;
        b.addCircle(x, y, s.size * (1 - t * 0.6));
      }
    }
    return b.build();
  }, [burst, enemyBaseX, groundY]);

  const floorPath = useDerivedValue(() => {
    const b = Skia.PathBuilder.Make();
    b.moveTo(16, floorY);
    b.lineTo(width - 16, floorY);
    return b.build();
  }, [width, floorY]);

  // Pose transitions (UI-thread Reanimated animations).
  useEffect(() => {
    poseCode.value = POSE_CODE[pose];
    if (pose === 'attack') {
      lunge.value = withTiming(1, { duration: 180 }, () => {
        lunge.value = withTiming(0, { duration: 260 });
      });
    } else if (pose === 'hurt') {
      lean.value = withSpring(-1, { damping: 12, stiffness: 180 }, () => {
        lean.value = withTiming(0, { duration: 300 });
      });
    } else if (pose === 'ko') {
      // KO geometry is baked into the path (see stickmanPath) — nothing to animate.
    } else {
      // idle / win: no lunge, lean or fall to run.
    }
  }, [pose, lunge, lean, poseCode]);

  // Impact burst, re-fired whenever burstKey increments.
  useEffect(() => {
    if (burstKey > 0) {
      burst.value = 0;
      burst.value = withTiming(1, { duration: 500 }, () => {
        burst.value = 0;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstKey]);

  return (
    <Canvas style={{ width, height }}>
      {/* floor glow line */}
      <Path
        path={floorPath}
        color={colors.accentReactNative}
        style="stroke"
        strokeWidth={1}
        opacity={0.35}
      />
      {/* enemy: `?` Goblin (cyan) */}
      <Group opacity={enemyPose === 'ko' ? 0.35 : 1}>
        <Path
          path={enemyPath}
          color={colors.accentReactNative}
          style="stroke"
          strokeWidth={fighter.strokeWidth}
          strokeCap="round"
        />
      </Group>
      {/* player: crimson stickman */}
      <Group>
        <Path
          path={fighterPath}
          color={fighter.playerColor}
          style="stroke"
          strokeWidth={fighter.strokeWidth}
          strokeCap="round"
        />
        {/* cream headband */}
        <Circle
          cx={fighterX}
          cy={headbandCy}
          r={12}
          color={colors.cream}
          style="stroke"
          strokeWidth={2}
          opacity={0.9}
        />
      </Group>
      {/* impact particles */}
      <Path path={particlePath} color={colors.gold} style="fill" />
    </Canvas>
  );
}
