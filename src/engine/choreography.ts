// TechieMan — fight choreography (pure TypeScript, zero RN imports).
// The beat timeline for one answered question: solve fast → punch harder,
// mirroring the viral math stickman fights (plan §1, §5.3). The parent
// (FightScreen) sets `beat`, and clears it after BEAT_DURATION_MS[beat.kind].
// Terminal ko/win poses override the beat — see FightCanvas.
//
// Worklet note: phaseAt / phaseProgress / layout-adjacent helpers carry a
// 'worklet' directive so FightCanvas may call them from Reanimated derived
// values on the UI thread. The directive is a plain string-literal
// statement in Jest/Node — it changes nothing headless. The single source
// of truth for every timeline is BEAT_KEYFRAME_TABLE (plain data);
// beatKeyframes() and phaseAt() are pure views over it, so the canvas's
// UI-thread lookup and the Jest assertions below can never drift apart.

export type BeatKind =
  | 'jab'
  | 'cross'
  | 'kick'
  | 'combo'
  | 'enemyStrike'
  | 'enemyDodge'
  | 'special';

export interface Beat {
  kind: BeatKind;
  /** parent-incremented key — a new key restarts the timeline */
  key: number;
}

/**
 * Which move an answer earns. Rules (plan §2.1 — speed is a damage
 * multiplier, not just a timer):
 *  - wrong + timeout (secondsUsed >= 15): the enemy dodges your whiff.
 *  - wrong otherwise: the enemy strikes you.
 *  - correct + fast (<5s) + combo>=2: a combo (boss finisher 'special'
 *    once the combo reaches 4 on a boss — the boss deserves a finisher).
 *  - correct + <8s: a kick.
 *  - correct otherwise: jab/cross alternating by combo parity.
 * isBoss changes only the combo>=4 finisher; boss damage itself is
 * fightMath's job (damageForWrongAnswer), not choreography's.
 */
export function moveForAnswer(
  correct: boolean,
  secondsUsed: number,
  comboBefore: number,
  isBoss: boolean,
): BeatKind {
  if (!correct) {
    return secondsUsed >= 15 ? 'enemyDodge' : 'enemyStrike';
  }
  if (secondsUsed < 5 && comboBefore >= 2) {
    return isBoss && comboBefore >= 4 ? 'special' : 'combo';
  }
  if (secondsUsed < 8) {
    return 'kick';
  }
  return comboBefore % 2 === 0 ? 'jab' : 'cross';
}

/** Every beat runs 1200–2200ms (asserted in choreography.test.ts). */
export const BEAT_DURATION_MS: Record<BeatKind, number> = {
  jab: 1400,
  cross: 1500,
  kick: 1700,
  combo: 2100,
  enemyStrike: 1600,
  enemyDodge: 1400,
  special: 2200,
};

export type ChoreoPhase =
  | 'idle'
  | 'walkin'
  | 'windup'
  | 'strike'
  | 'impact'
  | 'recover'
  | 'stagger'
  | 'ko'
  | 'victory';

/**
 * [atMs, phase] keyframes per beat. Every beat covers
 * windup → strike → impact → recover and ends idle at its duration.
 * 'walkin' is the enemy entrance (introKey in FightCanvas, not a beat),
 * 'stagger' is the enemy's hurt reaction (enemyPose='hurt' in FightCanvas),
 * 'ko'/'victory' are terminal poses (props), not beat phases.
 * The enemyDodge 'impact' keyframe is the whiff moment — the enemy slips
 * away at the strike's climax; nothing lands.
 */
export const BEAT_KEYFRAME_TABLE: Record<
  BeatKind,
  readonly (readonly [number, ChoreoPhase])[]
> = {
  jab: [
    [0, 'idle'],
    [150, 'windup'],
    [550, 'strike'],
    [750, 'impact'],
    [950, 'recover'],
    [1400, 'idle'],
  ],
  cross: [
    [0, 'idle'],
    [180, 'windup'],
    [600, 'strike'],
    [800, 'impact'],
    [1050, 'recover'],
    [1500, 'idle'],
  ],
  kick: [
    [0, 'idle'],
    [200, 'windup'],
    [700, 'strike'],
    [950, 'impact'],
    [1200, 'recover'],
    [1700, 'idle'],
  ],
  combo: [
    [0, 'idle'],
    [150, 'windup'],
    [500, 'strike'],
    [700, 'impact'],
    [950, 'strike'],
    [1150, 'impact'],
    [1400, 'strike'],
    [1600, 'impact'],
    [1800, 'recover'],
    [2100, 'idle'],
  ],
  enemyStrike: [
    [0, 'idle'],
    [250, 'windup'],
    [700, 'strike'],
    [950, 'impact'],
    [1200, 'recover'],
    [1600, 'idle'],
  ],
  enemyDodge: [
    [0, 'idle'],
    [200, 'windup'],
    [600, 'strike'],
    [800, 'impact'],
    [1000, 'recover'],
    [1400, 'idle'],
  ],
  special: [
    [0, 'idle'],
    [250, 'windup'],
    [650, 'strike'],
    [900, 'impact'],
    [1150, 'strike'],
    [1400, 'impact'],
    [1650, 'strike'],
    [1850, 'impact'],
    [2000, 'recover'],
    [2200, 'idle'],
  ],
};

/** Keyframes for a beat as {at, phase} objects. Pure view over the table. */
export function beatKeyframes(beat: BeatKind): { at: number; phase: ChoreoPhase }[] {
  'worklet';
  return BEAT_KEYFRAME_TABLE[beat].map(([at, phase]) => ({ at, phase }));
}

/** Phase at tMs into a beat (clamped: before start → first, past end → last). */
export function phaseAt(beat: BeatKind, tMs: number): ChoreoPhase {
  'worklet';
  const frames = BEAT_KEYFRAME_TABLE[beat];
  let phase = frames[0][1];
  for (let i = 0; i < frames.length; i++) {
    if (tMs >= frames[i][0]) {
      phase = frames[i][1];
    } else {
      break;
    }
  }
  return phase;
}

/**
 * Progress 0..1 through the CURRENT phase at tMs (for smooth lunges:
 * strike interpolates the dash in, recover interpolates it back out).
 * 0 before the beat starts, 1 in the final (idle) phase's tail.
 */
export function phaseProgress(beat: BeatKind, tMs: number): number {
  'worklet';
  const frames = BEAT_KEYFRAME_TABLE[beat];
  let idx = 0;
  for (let i = 0; i < frames.length; i++) {
    if (tMs >= frames[i][0]) {
      idx = i;
    } else {
      break;
    }
  }
  const start = frames[idx][0];
  const end = idx + 1 < frames.length ? frames[idx + 1][0] : BEAT_DURATION_MS[beat];
  if (end <= start) {
    return 1;
  }
  const p = (tMs - start) / (end - start);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

/**
 * How many 'strike' keyframes have started by tMs (0-based count).
 * Combo/special cycle jab → cross → kick across their three strikes.
 */
export function strikeIndex(beat: BeatKind, tMs: number): number {
  'worklet';
  const frames = BEAT_KEYFRAME_TABLE[beat];
  let count = 0;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i][1] === 'strike' && tMs >= frames[i][0]) {
      count++;
    }
  }
  return Math.max(0, count - 1);
}

/** Floating damage label, plan §5.3's "+32 DMG" pill. */
export function damageLabel(damage: number): string {
  return `+${Math.max(0, Math.round(damage))} DMG`;
}

// ---------------------------------------------------------------------------
// Player pose geometry — the pose library, as pure data.
// Creature-local coords, origin = ground centre between the feet, y down.
// Feet at y=+30, head centre y=-34, head radius 11 (matches the M2 rig).
// The canvas converts segments → SkPath (PathBuilder); the head circle is
// drawn separately so the cream headband can track it. KO geometry is
// baked flat (rotation drawn into the path — Group transform takes plain
// numbers only, per the M2 spike notes).
// ---------------------------------------------------------------------------

export type PlayerPose =
  | 'idle'
  | 'windup'
  | 'jab'
  | 'cross'
  | 'kick'
  | 'hurt'
  | 'ko'
  | 'win';

/** [x1, y1, x2, y2] — one stick segment. */
export type PoseLine = readonly [number, number, number, number];

export interface PoseGeometry {
  head: { x: number; y: number; r: number };
  lines: PoseLine[];
}

export const POSE_GEOMETRY: Record<PlayerPose, PoseGeometry> = {
  idle: {
    head: { x: 0, y: -34, r: 11 },
    lines: [
      [0, -23, 0, 6], // body
      [-16, -6, 0, -22], // arm L
      [16, -6, 0, -22], // arm R
      [-10, 30, 0, 6], // leg L
      [10, 30, 0, 6], // leg R
    ],
  },
  windup: {
    // coiled: torso back, punching arm pulled behind, guard arm up.
    head: { x: -4, y: -34, r: 11 },
    lines: [
      [-4, -23, -2, 6],
      [-28, -16, -2, -22], // pulled-back arm
      [12, -30, -2, -22], // guard arm
      [-16, 30, -2, 6],
      [14, 30, -2, 6],
    ],
  },
  jab: {
    // lead arm extended straight at the enemy.
    head: { x: 2, y: -34, r: 11 },
    lines: [
      [2, -23, 0, 6],
      [30, -26, 2, -22], // punching arm
      [-14, -6, 2, -22], // back arm
      [-14, 30, 0, 6],
      [16, 30, 0, 6],
    ],
  },
  cross: {
    // torso twist, rear arm extended across.
    head: { x: -2, y: -34, r: 11 },
    lines: [
      [-2, -23, 0, 6],
      [28, -20, -2, -22], // crossing arm
      [-20, -10, -2, -22], // lead arm pulled back
      [-16, 30, 0, 6],
      [14, 30, 0, 6],
    ],
  },
  kick: {
    // one leg extended horizontal, arms out for balance.
    head: { x: 0, y: -34, r: 11 },
    lines: [
      [0, -23, 0, 6],
      [32, 2, 0, 6], // kicking leg
      [-8, 30, 0, 6], // standing leg
      [-18, -12, 0, -22],
      [12, -28, 0, -22],
    ],
  },
  hurt: {
    // leaning back, both arms up to guard the face.
    head: { x: -8, y: -34, r: 11 },
    lines: [
      [-8, -23, 0, 6],
      [-20, -32, -6, -22],
      [14, -34, -6, -22],
      [-14, 30, 0, 6],
      [10, 30, 0, 6],
    ],
  },
  ko: {
    // lying flat on the floor, head to the right, limbs sprawled.
    // Local y is measured from the same origin: floor is y=+30.
    head: { x: 34, y: 22, r: 11 },
    lines: [
      [24, 30, -10, 30], // body, horizontal on the floor
      [22, 14, 10, 30], // arm flung up
      [20, 38, 10, 30], // arm down
      [-30, 20, -10, 30], // leg up
      [-28, 40, -10, 30], // leg down
    ],
  },
  win: {
    // mid-jump, fist pumped: feet tucked (y=20), one arm raised.
    head: { x: 0, y: -44, r: 11 },
    lines: [
      [0, -33, 0, -4],
      [10, -54, 0, -32], // pumped fist
      [-16, -22, 0, -32], // other arm bent out
      [-12, 20, 0, -4], // tucked leg L
      [12, 20, 0, -4], // tucked leg R
    ],
  },
};

/** Pose geometry accessor (pure — the frame-budget test measures this). */
export function playerPoseGeometry(pose: PlayerPose): PoseGeometry {
  'worklet';
  return POSE_GEOMETRY[pose];
}
