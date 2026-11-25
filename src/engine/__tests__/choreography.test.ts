import {
  BEAT_DURATION_MS,
  BEAT_KEYFRAME_TABLE,
  beatKeyframes,
  damageLabel,
  moveForAnswer,
  phaseAt,
  phaseProgress,
  playerPoseGeometry,
  strikeIndex,
  type BeatKind,
} from '../choreography';

const ALL_BEATS: BeatKind[] = [
  'jab',
  'cross',
  'kick',
  'combo',
  'enemyStrike',
  'enemyDodge',
  'special',
];

describe('moveForAnswer — solve fast, punch harder', () => {
  it('fast (<5s) + combo>=2 is a combo', () => {
    expect(moveForAnswer(true, 3, 2, false)).toBe('combo');
    expect(moveForAnswer(true, 4.9, 3, false)).toBe('combo');
  });
  it('boss finisher: fast + combo>=4 on a boss is a special', () => {
    expect(moveForAnswer(true, 3, 4, true)).toBe('special');
    expect(moveForAnswer(true, 3, 9, true)).toBe('special');
    // Same combo off-boss stays a combo; below 4 on a boss stays a combo.
    expect(moveForAnswer(true, 3, 4, false)).toBe('combo');
    expect(moveForAnswer(true, 3, 3, true)).toBe('combo');
  });
  it('under 8s without the combo is a kick', () => {
    expect(moveForAnswer(true, 4, 0, false)).toBe('kick');
    expect(moveForAnswer(true, 7.9, 1, false)).toBe('kick');
    expect(moveForAnswer(true, 5, 2, false)).toBe('kick');
  });
  it('slow answers alternate jab/cross by combo parity', () => {
    expect(moveForAnswer(true, 10, 0, false)).toBe('jab');
    expect(moveForAnswer(true, 10, 2, false)).toBe('jab');
    expect(moveForAnswer(true, 10, 1, false)).toBe('cross');
    expect(moveForAnswer(true, 14, 3, false)).toBe('cross');
  });
  it('wrong answers let the enemy strike', () => {
    expect(moveForAnswer(false, 5, 0, false)).toBe('enemyStrike');
    expect(moveForAnswer(false, 14, 2, true)).toBe('enemyStrike');
  });
  it('timeout (>=15s) is a dodge, not a strike', () => {
    expect(moveForAnswer(false, 15, 0, false)).toBe('enemyDodge');
    expect(moveForAnswer(false, 20, 0, true)).toBe('enemyDodge');
    expect(moveForAnswer(false, 14.9, 0, false)).toBe('enemyStrike');
  });
});

describe('BEAT_DURATION_MS — every beat 1200–2200ms', () => {
  it('covers every BeatKind inside the window', () => {
    for (const kind of ALL_BEATS) {
      expect(BEAT_DURATION_MS[kind]).toBeGreaterThanOrEqual(1200);
      expect(BEAT_DURATION_MS[kind]).toBeLessThanOrEqual(2200);
    }
  });
  it('keyframe tables end at the beat duration', () => {
    for (const kind of ALL_BEATS) {
      const frames = BEAT_KEYFRAME_TABLE[kind];
      expect(frames[frames.length - 1][0]).toBe(BEAT_DURATION_MS[kind]);
      expect(frames[frames.length - 1][1]).toBe('idle');
      expect(frames[0][0]).toBe(0);
      expect(frames[0][1]).toBe('idle');
    }
  });
});

describe('beatKeyframes — every beat covers windup → strike → impact → recover', () => {
  it('each kind has the four phases in order', () => {
    for (const kind of ALL_BEATS) {
      const phases = beatKeyframes(kind).map(k => k.phase);
      const idx = (p: string) => phases.indexOf(p as never);
      expect(idx('windup')).toBeGreaterThanOrEqual(0);
      expect(idx('strike')).toBeGreaterThan(idx('windup'));
      expect(idx('impact')).toBeGreaterThan(idx('strike'));
      expect(idx('recover')).toBeGreaterThan(idx('impact'));
    }
  });
  it('keyframes are strictly increasing in time', () => {
    for (const kind of ALL_BEATS) {
      const frames = beatKeyframes(kind);
      for (let i = 1; i < frames.length; i++) {
        expect(frames[i].at).toBeGreaterThan(frames[i - 1].at);
      }
    }
  });
});

describe('phaseAt — boundaries (jab: 1400ms)', () => {
  it('walks the jab timeline exactly', () => {
    expect(phaseAt('jab', 0)).toBe('idle');
    expect(phaseAt('jab', 149)).toBe('idle');
    expect(phaseAt('jab', 150)).toBe('windup');
    expect(phaseAt('jab', 549)).toBe('windup');
    expect(phaseAt('jab', 550)).toBe('strike');
    expect(phaseAt('jab', 750)).toBe('impact');
    expect(phaseAt('jab', 950)).toBe('recover');
    expect(phaseAt('jab', 1399)).toBe('recover');
    expect(phaseAt('jab', 1400)).toBe('idle');
  });
  it('clamps outside the timeline', () => {
    expect(phaseAt('jab', -100)).toBe('idle');
    expect(phaseAt('jab', 5000)).toBe('idle');
    expect(phaseAt('combo', 99999)).toBe('idle');
  });
  it('combo has three strikes with impacts between them', () => {
    expect(phaseAt('combo', 500)).toBe('strike');
    expect(phaseAt('combo', 700)).toBe('impact');
    expect(phaseAt('combo', 950)).toBe('strike');
    expect(phaseAt('combo', 1400)).toBe('strike');
    expect(phaseAt('combo', 1600)).toBe('impact');
    expect(phaseAt('combo', 1800)).toBe('recover');
  });
});

describe('phaseProgress + strikeIndex', () => {
  it('progress runs 0..1 inside a phase', () => {
    expect(phaseProgress('jab', 0)).toBe(0);
    expect(phaseProgress('jab', 150)).toBe(0);
    expect(phaseProgress('jab', 350)).toBeCloseTo(0.5, 5); // windup 150→550
    expect(phaseProgress('jab', 550)).toBe(0);
    expect(phaseProgress('jab', 2000)).toBe(1);
  });
  it('strikeIndex cycles combo strikes 0, 1, 2', () => {
    expect(strikeIndex('combo', 400)).toBe(0);
    expect(strikeIndex('combo', 500)).toBe(0);
    expect(strikeIndex('combo', 1000)).toBe(1);
    expect(strikeIndex('combo', 1500)).toBe(2);
    expect(strikeIndex('jab', 600)).toBe(0);
    expect(strikeIndex('special', 1700)).toBe(2);
  });
});

describe('damageLabel', () => {
  it('matches the plan §5.3 "+32 DMG" pill', () => {
    expect(damageLabel(32)).toBe('+32 DMG');
    expect(damageLabel(0)).toBe('+0 DMG');
    expect(damageLabel(12.6)).toBe('+13 DMG');
    expect(damageLabel(-5)).toBe('+0 DMG');
  });
});

describe('playerPoseGeometry — the pose library', () => {
  it('all eight poses have a head and five segments', () => {
    const poses = ['idle', 'windup', 'jab', 'cross', 'kick', 'hurt', 'ko', 'win'] as const;
    for (const pose of poses) {
      const g = playerPoseGeometry(pose);
      expect(g.head.r).toBe(11);
      expect(g.lines).toHaveLength(5);
      for (const line of g.lines) {
        expect(line).toHaveLength(4);
      }
    }
  });
  it('ko is baked flat (head near the floor, body horizontal)', () => {
    const ko = playerPoseGeometry('ko');
    const idle = playerPoseGeometry('idle');
    expect(ko.head.y).toBeGreaterThan(0);
    expect(idle.head.y).toBe(-34);
    // KO body line is horizontal (same y both ends).
    expect(ko.lines[0][1]).toBe(ko.lines[0][3]);
  });
  it('win jumps (head higher than idle) and windup coils back', () => {
    expect(playerPoseGeometry('win').head.y).toBeLessThan(
      playerPoseGeometry('idle').head.y,
    );
    // windup's pulled-back arm reaches further back than any idle arm.
    expect(playerPoseGeometry('windup').lines[1][0]).toBeLessThan(-16);
    // jab's punching arm reaches further forward than any idle arm.
    expect(playerPoseGeometry('jab').lines[1][0]).toBeGreaterThan(16);
    // kick's leg extends horizontally past the idle stance.
    expect(playerPoseGeometry('kick').lines[1][0]).toBeGreaterThan(16);
  });
});
