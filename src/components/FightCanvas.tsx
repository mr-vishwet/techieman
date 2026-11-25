// TechieMan — fight canvas rebuild (2026-11-26): the villain is the
// language itself. The generic cyan "?" Goblin is DELETED — the enemy is
// now a living stick-creature built from its own symbols (EnemyDesign),
// rendered as Skia <Text> glyphs in a bundled monospace font, and the
// fight mirrors the viral math stickman videos: wind-up, punch/kick,
// impact flash, hit-stop, damage number, stagger, KO fall, victory pose.
// No dialogue in the canvas.
//
// Skia 2.14 facts (verified by the M2 spike — do not re-litigate):
//  - No useValue / runTiming; animation values are Reanimated shared
//    values on the UI thread; React state is never touched per-frame.
//  - Paths via Skia.PathBuilder.Make() + .build(); Group transform takes
//    plain numbers only — rotations/falls are baked into path geometry.
//  - <Text> glyphs cannot rotate (no per-glyph rotation on Skia Text, and
//    Group transform is plain numbers): live glyphs bob on x/y instead,
//    and `rot` from the design is baked into the diamond fallback only.
//
// FONT: JetBrains Mono Bold (OFL-1.1), v2.304 from the official GitHub
// release (api.github.com/repos/JetBrains/JetBrainsMono/releases/latest,
// asset JetBrainsMono-2.304.zip, 277,828-byte TTF, md5
// 8658ffe39dbfa1c12436789a50212180) at src/assets/fonts/
// JetBrainsMono-Bold.ttf, loaded with useFont at sizes 16/24/32 and
// bucketed per glyph. Fallback chain: if a bucket font is null, the
// nearest loaded size is used; if ALL three are null (font failed to
// load), every glyph renders as a small stroked diamond marker in the
// enemy accent, so the scene never crashes. Glyph coverage was verified
// with fontTools: every char used in enemies.ts is in the font.
// System fallback that was NOT needed: DejaVu Sans Mono Bold at
// /usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf (on this VM).
//
// BEAT FLOW (parent = FightScreen, rewiring against this API): the parent
// sets `beat` on an answer and clears it after BEAT_DURATION_MS[beat.kind].
// The beat drives phaseAt() on the UI thread — windup → strike → impact
// → recover. Terminal playerPose 'ko'/'win' and enemyPose 'ko' override
// the beat. damageEvent fires the white flash + hit-stop + shake +
// damage number + particle burst; burstKey re-fires particles on its own.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Canvas,
  Circle,
  Group,
  Path,
  Rect,
  Skia,
  Text,
  useClock,
  useFont,
  type SkFont,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, fighter } from '../theme/tokens';
import {
  layoutEnemyGlyphs,
  type EnemyDesign,
  type EnemyLayoutPose,
} from '../data/enemies';
import {
  damageLabel,
  phaseAt,
  phaseProgress,
  playerPoseGeometry,
  strikeIndex,
  type Beat,
  type BeatKind,
  type PlayerPose,
} from '../engine/choreography';

/** @deprecated — old M2 pose type; FightScreen is being rewired by the
 *  parent against the new props below. Kept only so the import in the
 *  not-yet-rewired FightScreen still resolves. */
export type FighterPose = 'idle' | 'attack' | 'hurt' | 'ko' | 'win';

export interface FightCanvasProps {
  width: number;
  height: number;
  enemy: EnemyDesign;
  /** parent sets on an answer, clears after BEAT_DURATION_MS[beat.kind] */
  beat: Beat | null;
  playerPose: 'idle' | 'hurt' | 'ko' | 'win';
  enemyPose: 'idle' | 'hurt' | 'ko';
  /** fires flash + hit-stop + shake + damage number on a landed hit */
  damageEvent: { key: number; value: number; kind: 'dealt' | 'taken' } | null;
  /** increment to fire an impact particle burst */
  burstKey: number;
  /** increment to replay the enemy walk-in */
  introKey: number;
}

const BEAT_KIND_ORDER: BeatKind[] = [
  'jab',
  'cross',
  'kick',
  'combo',
  'enemyStrike',
  'enemyDodge',
  'special',
];

const BEAT_KIND_CODE: Record<BeatKind, number> = {
  jab: 0,
  cross: 1,
  kick: 2,
  combo: 3,
  enemyStrike: 4,
  enemyDodge: 5,
  special: 6,
};

const PLAYER_POSE_CODE: Record<FightCanvasProps['playerPose'], number> = {
  idle: 0,
  hurt: 1,
  ko: 2,
  win: 3,
};

const ENEMY_POSE_CODE: Record<FightCanvasProps['enemyPose'], number> = {
  idle: 0,
  hurt: 1,
  ko: 2,
};

const PARTICLES = 18;

/** Deterministic particle seeds (angle, speed, size) — no Math.random. */
const PARTICLE_SEEDS = Array.from({ length: PARTICLES }, (_, i) => ({
  angle: (i / PARTICLES) * Math.PI * 2 + 0.35,
  speed: 60 + ((i * 37) % 90),
  size: 2 + ((i * 13) % 4),
}));

/** Monospace advance ≈ 0.6em — centres a glyph string on its anchor. */
const CHAR_ADVANCE = 0.6;

/** Nearest loaded font for a glyph size (16/24/32 buckets). */
function fontForSize(
  size: number,
  f16: SkFont | null,
  f24: SkFont | null,
  f32: SkFont | null,
): SkFont | null {
  const bucket = size <= 18 ? f16 : size <= 28 ? f24 : f32;
  return bucket ?? f24 ?? f16 ?? f32;
}

interface EnemyGlyphProps {
  enemy: EnemyDesign;
  index: number;
  enemyX: SharedValue<number>;
  enemyY: SharedValue<number>;
  clock: SharedValue<number>;
  enemyPoseSV: SharedValue<number>;
  font16: SkFont | null;
  font24: SkFont | null;
  font32: SkFont | null;
}

/**
 * One enemy glyph as Skia <Text>. Its x/y/opacity are Reanimated derived
 * values driven by layoutEnemyGlyphs() (bob / scatter / fall) — one
 * component instance per glyph, so hooks stay fixed per instance.
 */
function EnemyGlyph({
  enemy,
  index,
  enemyX,
  enemyY,
  clock,
  enemyPoseSV,
  font16,
  font24,
  font32,
}: EnemyGlyphProps) {
  const glyph = enemy.glyphs[index];
  const font = fontForSize(glyph.size, font16, font24, font32);

  const laid = useDerivedValue(() => {
    const pose: EnemyLayoutPose =
      enemyPoseSV.value === 2 ? 'ko' : enemyPoseSV.value === 1 ? 'hurt' : 'idle';
    return layoutEnemyGlyphs(enemy, clock.value, pose)[index];
  }, [enemy, index, enemyPoseSV, clock]);

  const x = useDerivedValue(
    () => enemyX.value + laid.value.x - (glyph.char.length * glyph.size * CHAR_ADVANCE) / 2,
    [enemyX, laid, glyph],
  );
  const y = useDerivedValue(
    () => enemyY.value + laid.value.y + glyph.size * 0.35,
    [enemyY, laid, glyph],
  );
  const opacity = useDerivedValue(() => laid.value.opacity, [laid]);

  if (!font) {
    // Diamond fallback covers this glyph (see fallbackPath in FightCanvas).
    return null;
  }
  return (
    <Group opacity={opacity}>
      <Text x={x} y={y} font={font} text={glyph.char} color={enemy.accent} />
    </Group>
  );
}

export function FightCanvas({
  width,
  height,
  enemy,
  beat,
  playerPose,
  enemyPose,
  damageEvent,
  burstKey,
  introKey,
}: FightCanvasProps) {
  const clock = useClock();
  const beatKindSV = useSharedValue(-1); // -1 = no beat; else BEAT_KIND_CODE
  const beatT0SV = useSharedValue(0); // clock ms when the current beat started
  const playerPoseSV = useSharedValue(0); // PLAYER_POSE_CODE
  const enemyPoseSV = useSharedValue(0); // ENEMY_POSE_CODE
  const introSV = useSharedValue(0); // 0..1 — enemy walk-in
  const burstSV = useSharedValue(0); // 0..1 — particle burst progress
  const flashSV = useSharedValue(0); // 0..1 — white impact flash
  const shakeSV = useSharedValue(0); // px — screen shake
  const freezeUntilSV = useSharedValue(0); // hit-stop: bob freezes until this clock ms
  const frozenAtSV = useSharedValue(0); // clock value frozen at during hit-stop
  const recoilSV = useSharedValue(0); // px — enemy recoil on hurt
  const dmgT0SV = useSharedValue(-10000); // clock ms of the last damage event
  const dmgKindSV = useSharedValue(0); // 0 = dealt (over enemy), 1 = taken (over player)
  const [dmgLabelText, setDmgLabelText] = useState<string | null>(null);

  // Bundled JetBrains Mono Bold at three sizes (see header). All three
  // null => diamond fallback; a single null => nearest loaded size.
  const font16 = useFont(require('../assets/fonts/JetBrainsMono-Bold.ttf'), 16);
  const font24 = useFont(require('../assets/fonts/JetBrainsMono-Bold.ttf'), 24);
  const font32 = useFont(require('../assets/fonts/JetBrainsMono-Bold.ttf'), 32);
  const fontsLoaded = font16 !== null || font24 !== null || font32 !== null;
  const dmgFont = font24 ?? font16 ?? font32;

  const floorY = height - 24;
  const fighterBaseX = width * 0.28;
  const enemyBaseX = width * 0.72;
  const groundY = floorY - 30;

  // --- Beat / pose inputs (JS thread -> shared values; per-frame work
  // stays on the UI thread in the derived values below). ---
  useEffect(() => {
    if (beat === null) {
      beatKindSV.value = -1;
    } else {
      beatKindSV.value = BEAT_KIND_CODE[beat.kind];
      beatT0SV.value = clock.value;
    }
  }, [beat, beatKindSV, beatT0SV, clock]);

  useEffect(() => {
    playerPoseSV.value = PLAYER_POSE_CODE[playerPose];
  }, [playerPose, playerPoseSV]);

  useEffect(() => {
    enemyPoseSV.value = ENEMY_POSE_CODE[enemyPose];
    if (enemyPose === 'hurt') {
      recoilSV.value = withSpring(-14, { damping: 12, stiffness: 180 }, () => {
        recoilSV.value = withTiming(0, { duration: 300 });
      });
    } else if (enemyPose === 'ko') {
      // KO shatter: glyphs fall (layout 'ko') + a longer particle burst.
      burstSV.value = 0;
      burstSV.value = withTiming(1, { duration: 800 }, () => {
        burstSV.value = 0;
      });
    }
  }, [enemyPose, enemyPoseSV, recoilSV, burstSV]);

  // Enemy walk-in on introKey (slides in from the right edge).
  useEffect(() => {
    introSV.value = 0;
    introSV.value = withTiming(1, { duration: 600 });
  }, [introKey, introSV]);

  // Impact particle burst, re-fired whenever burstKey increments.
  useEffect(() => {
    if (burstKey > 0) {
      burstSV.value = 0;
      burstSV.value = withTiming(1, { duration: 500 }, () => {
        burstSV.value = 0;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstKey]);

  // Damage event: white flash (~80ms) + hit-stop (~90ms frozen bob) +
  // screen shake + damage number (label via React state — the text itself
  // changes once per hit, never per frame; position/opacity are derived).
  useEffect(() => {
    if (damageEvent === null) {
      return;
    }
    dmgT0SV.value = clock.value;
    dmgKindSV.value = damageEvent.kind === 'taken' ? 1 : 0;
    setDmgLabelText(damageLabel(damageEvent.value));
    flashSV.value = 1;
    flashSV.value = withTiming(0, { duration: 80 });
    frozenAtSV.value = clock.value;
    freezeUntilSV.value = clock.value + 90;
    shakeSV.value = withTiming(7, { duration: 60 }, () => {
      shakeSV.value = withTiming(-7, { duration: 60 }, () => {
        shakeSV.value = withTiming(0, { duration: 90 });
      });
    });
  }, [damageEvent, clock, dmgT0SV, dmgKindSV, flashSV, frozenAtSV, freezeUntilSV, shakeSV]);

  // --- UI-thread derived values (clock + shared values only). ---

  // Hit-stop: while frozen, the bob reads the frozen clock value.
  const bobClock = useDerivedValue(
    () => (clock.value < freezeUntilSV.value ? frozenAtSV.value : clock.value),
    [clock, freezeUntilSV, frozenAtSV],
  );
  const bobY = useDerivedValue(
    () => Math.sin((bobClock.value / 1000) * (Math.PI * 2) * 0.8) * 4,
    [bobClock],
  );
  const enemyBobY = useDerivedValue(
    () =>
      enemyPoseSV.value === 2
        ? 0 // KO: no bob — the glyphs are on the floor
        : Math.sin((bobClock.value / 1000) * (Math.PI * 2) * 0.8 + Math.PI) * 4,
    [bobClock, enemyPoseSV],
  );

  /** Player pose for this frame: terminal poses override the beat. */
  const pose = useDerivedValue((): PlayerPose => {
    if (playerPoseSV.value === 2) {
      return 'ko';
    }
    if (playerPoseSV.value === 3) {
      return 'win';
    }
    if (beatKindSV.value === -1) {
      return playerPoseSV.value === 1 ? 'hurt' : 'idle';
    }
    const kind = BEAT_KIND_ORDER[beatKindSV.value];
    const t = clock.value - beatT0SV.value;
    const ph = phaseAt(kind, t);
    if (ph === 'windup') {
      // Enemy winding up: the player braces (idle), not windup.
      return kind === 'enemyStrike' ? 'idle' : 'windup';
    }
    if (ph === 'strike' || ph === 'impact') {
      if (kind === 'enemyStrike') {
        return 'hurt';
      }
      if (kind === 'jab' || kind === 'enemyDodge') {
        return 'jab';
      }
      if (kind === 'cross') {
        return 'cross';
      }
      if (kind === 'kick') {
        return 'kick';
      }
      // combo / special cycle jab -> cross -> kick across their strikes.
      const idx = strikeIndex(kind, t);
      return idx === 0 ? 'jab' : idx === 1 ? 'cross' : 'kick';
    }
    return playerPoseSV.value === 1 ? 'hurt' : 'idle';
  }, [playerPoseSV, beatKindSV, beatT0SV, clock]);

  /** Player lunge 0..1 (windup pulls back to -0.06); 0 when not attacking. */
  const lunge = useDerivedValue(() => {
    if (beatKindSV.value === -1) {
      return 0;
    }
    const kind = BEAT_KIND_ORDER[beatKindSV.value];
    if (kind === 'enemyStrike') {
      return 0;
    }
    const t = clock.value - beatT0SV.value;
    const ph = phaseAt(kind, t);
    const p = phaseProgress(kind, t);
    if (ph === 'windup') {
      return -0.06;
    }
    if (ph === 'strike') {
      return p;
    }
    if (ph === 'impact') {
      return 1;
    }
    if (ph === 'recover') {
      return 1 - p;
    }
    return 0;
  }, [beatKindSV, beatT0SV, clock]);

  /** Enemy shift in px: negative = lunges at the player (enemyStrike),
   *  positive = slips away (enemyDodge). */
  const enemyShift = useDerivedValue(() => {
    if (beatKindSV.value === -1) {
      return 0;
    }
    const kind = BEAT_KIND_ORDER[beatKindSV.value];
    if (kind !== 'enemyStrike' && kind !== 'enemyDodge') {
      return 0;
    }
    const t = clock.value - beatT0SV.value;
    const ph = phaseAt(kind, t);
    const p = phaseProgress(kind, t);
    let curve = 0;
    if (ph === 'windup') {
      curve = kind === 'enemyStrike' ? -0.04 : 0;
    } else if (ph === 'strike') {
      curve = p;
    } else if (ph === 'impact') {
      curve = 1;
    } else if (ph === 'recover') {
      curve = 1 - p;
    }
    return kind === 'enemyStrike' ? -curve * width * 0.18 : curve * width * 0.12;
  }, [beatKindSV, beatT0SV, clock, width]);

  const fighterX = useDerivedValue(
    () => fighterBaseX + lunge.value * width * 0.22 + shakeSV.value,
    [lunge, shakeSV, fighterBaseX, width],
  );
  const fighterY = useDerivedValue(() => {
    const winLift =
      playerPoseSV.value === 3 ? -12 + Math.sin(clock.value / 300) * 4 : 0;
    return groundY + bobY.value + winLift;
  }, [bobY, playerPoseSV, clock, groundY]);

  const enemyX = useDerivedValue(
    () =>
      enemyBaseX +
      (1 - introSV.value) * (width - enemyBaseX + 90) +
      enemyShift.value +
      recoilSV.value +
      shakeSV.value,
    [introSV, enemyShift, recoilSV, shakeSV, enemyBaseX, width],
  );
  const enemyY = useDerivedValue(
    () => groundY + enemyBobY.value,
    [enemyBobY, groundY],
  );

  const fighterPath = useDerivedValue(() => {
    const g = playerPoseGeometry(pose.value);
    const b = Skia.PathBuilder.Make();
    const s = 1.1;
    const cx = fighterX.value;
    const cy = fighterY.value;
    b.addCircle(cx + g.head.x * s, cy + g.head.y * s, g.head.r * s);
    for (const [x1, y1, x2, y2] of g.lines) {
      b.moveTo(cx + x1 * s, cy + y1 * s);
      b.lineTo(cx + x2 * s, cy + y2 * s);
    }
    return b.build();
  }, [pose, fighterX, fighterY]);

  const headbandX = useDerivedValue(() => {
    const g = playerPoseGeometry(pose.value);
    return fighterX.value + g.head.x * 1.1;
  }, [pose, fighterX]);
  const headbandY = useDerivedValue(() => {
    const g = playerPoseGeometry(pose.value);
    return fighterY.value + g.head.y * 1.1;
  }, [pose, fighterY]);

  // Impact particles in the enemy's accent colour.
  const particlePath = useDerivedValue(() => {
    const t = burstSV.value;
    const b = Skia.PathBuilder.Make();
    if (t > 0 && t < 1) {
      for (const s of PARTICLE_SEEDS) {
        const d = s.speed * t;
        const x = enemyX.value + Math.cos(s.angle) * d;
        const y = enemyY.value - 10 + Math.sin(s.angle) * d - 40 * t * t;
        b.addCircle(x, y, s.size * (1 - t * 0.6));
      }
    }
    return b.build();
  }, [burstSV, enemyX, enemyY]);

  // Diamond fallback (font null): one stroked diamond per glyph, rot
  // baked into the geometry. Only rendered when no font loaded at all.
  const fallbackPath = useDerivedValue(() => {
    const b = Skia.PathBuilder.Make();
    const poseName: EnemyLayoutPose =
      enemyPoseSV.value === 2 ? 'ko' : enemyPoseSV.value === 1 ? 'hurt' : 'idle';
    const laid = layoutEnemyGlyphs(enemy, clock.value, poseName);
    for (const g of laid) {
      const r = 8;
      const rad = (g.rot * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cx = enemyX.value + g.x;
      const cy = enemyY.value + g.y;
      const pts: [number, number][] = [
        [0, -r],
        [r, 0],
        [0, r],
        [-r, 0],
      ];
      pts.forEach(([px, py], i) => {
        const x = cx + px * cos - py * sin;
        const y = cy + px * sin + py * cos;
        if (i === 0) {
          b.moveTo(x, y);
        } else {
          b.lineTo(x, y);
        }
      });
      b.close();
    }
    return b.build();
  }, [enemy, clock, enemyPoseSV, enemyX, enemyY]);

  // Damage number: rises + fades over ~700ms after a damage event.
  const dmgProgress = useDerivedValue(
    () => (clock.value - dmgT0SV.value) / 700,
    [clock, dmgT0SV],
  );
  const dmgX = useDerivedValue(() => {
    const anchorX = dmgKindSV.value === 1 ? fighterX.value : enemyX.value;
    const label = dmgLabelText ?? '';
    return anchorX - (label.length * 24 * CHAR_ADVANCE) / 2;
  }, [dmgKindSV, fighterX, enemyX, dmgLabelText]);
  const dmgY = useDerivedValue(() => {
    const p = dmgProgress.value;
    return groundY - 70 - 40 * p;
  }, [dmgProgress, groundY]);
  const dmgOpacity = useDerivedValue(() => {
    const p = dmgProgress.value;
    return p <= 0 || p >= 1 ? 0 : 1 - p;
  }, [dmgProgress]);

  // Static scenery: floor glow line + faint grid (built once per size).
  const scenery = useMemo(() => {
    const floor = Skia.PathBuilder.Make();
    floor.moveTo(16, floorY);
    floor.lineTo(width - 16, floorY);
    const grid = Skia.PathBuilder.Make();
    for (let x = 20; x < width - 16; x += 40) {
      grid.moveTo(x, 16);
      grid.lineTo(x, floorY);
    }
    return { floor: floor.build(), grid: grid.build() };
  }, [width, floorY]);

  return (
    <Canvas style={{ width, height }}>
      {/* faint grid */}
      <Path path={scenery.grid} color={colors.cream} style="stroke" strokeWidth={1} opacity={0.05} />
      {/* floor glow line, in the enemy's accent */}
      <Path path={scenery.floor} color={enemy.accent} style="stroke" strokeWidth={1} opacity={0.35} />
      {/* enemy: living symbol-creature */}
      <Group opacity={enemyPose === 'ko' ? 0.9 : 1}>
        {fontsLoaded
          ? enemy.glyphs.map((_, i) => (
              <EnemyGlyph
                key={`${enemy.id}-${i}`}
                enemy={enemy}
                index={i}
                enemyX={enemyX}
                enemyY={enemyY}
                clock={clock}
                enemyPoseSV={enemyPoseSV}
                font16={font16}
                font24={font24}
                font32={font32}
              />
            ))
          : null}
        {!fontsLoaded ? (
          <Path
            path={fallbackPath}
            color={enemy.accent}
            style="stroke"
            strokeWidth={2}
            strokeCap="round"
          />
        ) : null}
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
        {/* cream headband, tracking the pose's head */}
        <Circle
          cx={headbandX}
          cy={headbandY}
          r={12}
          color={colors.cream}
          style="stroke"
          strokeWidth={2}
          opacity={0.9}
        />
      </Group>
      {/* impact particles in the enemy accent */}
      <Path path={particlePath} color={enemy.accent} style="fill" />
      {/* damage number (font-gated: no font => particles + flash carry it) */}
      {dmgLabelText !== null && dmgFont !== null ? (
        <Group opacity={dmgOpacity}>
          <Text x={dmgX} y={dmgY} font={dmgFont} text={dmgLabelText} color={colors.gold} />
        </Group>
      ) : null}
      {/* white impact flash (~80ms, driven by the damage-event effect) */}
      <Rect x={0} y={0} width={width} height={height} color="#ffffff" opacity={flashSV} />
    </Canvas>
  );
}
