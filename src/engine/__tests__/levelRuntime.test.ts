// TechieMan — live-level runtime tests (M7 / Live Levels).
// Pure Jest: determinism, virtual clock, mocked fetch + dedupe, the villain
// HP floor rule, wrong-answer escalation, phase transitions.

import {
  FRAME_BUDGET_MS,
  createLevelSession,
  seededRandom,
  type LevelDefinition,
} from '../levelRuntime';

function tinyLevel(overrides: Partial<LevelDefinition> = {}): LevelDefinition {
  return {
    id: 'level-test-tiny',
    nodeId: '1.1-js-basics',
    title: 'Tiny test level',
    villainName: 'The Test Variable',
    villainAccent: '#ffffff',
    intro: 'A test.',
    difficulty: 1,
    createState: () => ({
      gauges: {},
      crashed: false,
      crashMessage: null,
      renderedRows: 0,
      totalRows: 0,
      frameCostMs: 0,
      serverReceived: 0,
      serverProcessed: 0,
    }),
    script: () => undefined,
    objectives: [
      {
        id: 'always',
        label: 'Always true',
        check: () => true,
        hint: '',
      },
    ],
    fixActions: [],
    complexCases: [],
    ...overrides,
  };
}

describe('seededRandom', () => {
  it('is deterministic for the same seed and differs across seeds', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const c = seededRandom(8);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual([c(), c(), c(), c()]);
    for (const v of seqA) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of seqA) expect(v).toBeLessThan(1);
  });
});

describe('virtual clock and timers', () => {
  it('advances 100ms per tick and fires timers only when due, in order', () => {
    const fired: string[] = [];
    const s = createLevelSession(
      tinyLevel({
        script: api => {
          if (api.world.tick === 1) {
            api.after(250, () => fired.push('late'));
            api.after(100, () => fired.push('early'));
          }
        },
      }),
    );
    s.tick(); // t=100: timers scheduled (due 200, 350)
    expect(fired).toEqual([]);
    s.tick(); // t=200: 'early' fires
    expect(fired).toEqual(['early']);
    s.tick(); // t=300
    expect(fired).toEqual(['early']);
    s.tick(); // t=400: 'late' fires (due 350)
    expect(fired).toEqual(['early', 'late']);
    expect(s.world.nowMs).toBe(400);
    expect(s.world.tick).toBe(4);
  });

  it('moves observe → diagnose on the first tick', () => {
    const s = createLevelSession(tinyLevel());
    expect(s.phase).toBe('observe');
    s.tick();
    expect(s.phase).toBe('diagnose');
  });
});

describe('mocked fetch', () => {
  it('drop never reaches the server; fail is recorded but not processed; ok processes', () => {
    const outcomes = ['drop', 'fail', 'ok'] as const;
    let i = 0;
    const s = createLevelSession(
      tinyLevel({
        script: api => {
          if (api.world.tick === 1) {
            api.fetch('POST', '/x', {});
            api.fetch('POST', '/x', {});
            api.fetch('POST', '/x', {});
          }
        },
        transport: () => outcomes[i++ % 3],
      }),
    );
    s.tick();
    expect(s.requests).toHaveLength(2); // the drop never arrived
    expect(s.requests[0].outcome).toBe('fail');
    expect(s.requests[1].outcome).toBe('ok');
    expect(s.state.serverReceived).toBe(2);
    expect(s.state.serverProcessed).toBe(1); // only the ok applied
  });

  it('dedupes POSTs by Idempotency-Key and processes each key once', () => {
    // Drive fetch through a script that posts the same key twice.
    const s2 = createLevelSession(
      tinyLevel({
        script: a => {
          if (a.world.tick === 1) {
            a.fetch('POST', '/cart/items', { headers: { 'Idempotency-Key': 'op-1' } });
            a.fetch('POST', '/cart/items', { headers: { 'Idempotency-Key': 'op-1' } });
            a.fetch('POST', '/cart/items', { headers: { 'Idempotency-Key': 'op-2' } });
            a.fetch('POST', '/cart/items', {}); // no key: always applies
          }
        },
      }),
    );
    s2.tick();
    expect(s2.requests).toHaveLength(4);
    expect(s2.requests[1].deduped).toBe(true);
    expect(s2.requests[0].deduped).toBe(false);
    expect(s2.state.serverReceived).toBe(4);
    expect(s2.state.serverProcessed).toBe(3); // op-1 once + op-2 + the keyless one
  });

  it('never touches the real network: fetch is synchronous and clock-bound', () => {
    const s = createLevelSession(
      tinyLevel({
        script: a => {
          if (a.world.tick === 1) {
            const res = a.fetch('GET', '/ping', {});
            a.state.gauges.status = res.status;
          }
        },
      }),
    );
    s.tick();
    expect(s.state.gauges.status).toBe(200);
    expect(s.world.nowMs).toBe(100); // no real waiting happened
  });
});

describe('phases, fixes, and the villain HP floor', () => {
  it('applyFix runs the real function, latches once, and moves to act', () => {
    let ran = 0;
    const s = createLevelSession(
      tinyLevel({
        fixActions: [
          {
            id: 'do-it',
            label: 'Do it',
            correct: true,
            apply: api => {
              ran += 1;
              api.state.gauges.done = true;
            },
            appliedNote: 'Done.',
          },
        ],
      }),
    );
    s.tick();
    expect(s.phase).toBe('diagnose');
    const first = s.applyFix('do-it');
    expect(first.ok).toBe(true);
    expect(ran).toBe(1);
    expect(s.state.gauges.done).toBe(true);
    expect(s.phase).toBe('act');
    const second = s.applyFix('do-it');
    expect(second.ok).toBe(false);
    expect(ran).toBe(1); // never runs twice
    expect(s.applyFix('nope').ok).toBe(false);
  });

  it('a throwing fix is reported, not fatal, and does not latch', () => {
    const s = createLevelSession(
      tinyLevel({
        fixActions: [
          {
            id: 'boom',
            label: 'Boom',
            correct: false,
            apply: () => {
              throw new Error('fix exploded');
            },
            appliedNote: 'Never lands.',
          },
        ],
      }),
    );
    const res = s.applyFix('boom');
    expect(res.ok).toBe(false);
    expect(res.note).toContain('fix exploded');
    expect(s.appliedFixIds).not.toContain('boom');
  });

  it('the villain cannot die while an objective is unmet (HP floors at 1)', () => {
    const s = createLevelSession(
      tinyLevel({
        difficulty: 1, // enemy HP 60
        objectives: [
          { id: 'never', label: 'Never passes', check: () => false, hint: '' },
        ],
      }),
    );
    // Five fast correct answers deal far more than 60 damage.
    for (let i = 0; i < 5; i++) s.answerQuestion(true, 2);
    expect(s.fight.enemy.hp).toBe(1);
    expect(s.outcome()).toBe('ongoing');
    expect(s.phase).not.toBe('survived');
  });

  it('a wrong answer damages the player and fires the villain attack', () => {
    let attacks = 0;
    const s = createLevelSession(
      tinyLevel({
        villainAttack: () => {
          attacks += 1;
        },
      }),
    );
    const hpBefore = s.fight.player.hp;
    s.answerQuestion(false, 5);
    expect(s.fight.player.hp).toBeLessThan(hpBefore);
    expect(attacks).toBe(1);
    expect(s.wrongCount).toBe(1);
    expect(s.fight.combo).toBe(0);
  });

  it('fast correct answers count for the fast-answers quest', () => {
    const s = createLevelSession(tinyLevel());
    s.answerQuestion(true, 3);
    s.answerQuestion(true, 12);
    expect(s.correctCount).toBe(2);
    expect(s.fastAnswers).toBe(1);
  });

  it('losing all HP fails the level', () => {
    const s = createLevelSession(tinyLevel());
    for (let i = 0; i < 5; i++) s.answerQuestion(false, 5);
    expect(s.fight.player.hp).toBe(0);
    expect(s.outcome()).toBe('lose');
    expect(s.phase).toBe('failed');
  });
});

describe('determinism', () => {
  it('same seed + same actions → identical events, requests, and state', () => {
    const def = tinyLevel({
      script: api => {
        if (api.world.tick === 1) {
          api.fetch('POST', '/x', { headers: { 'Idempotency-Key': 'k' } });
          api.after(200, () => api.log('info', 'timer fired'));
        }
        if (api.world.tick === 2) api.log('attack', 'tick two');
      },
      transport: () => 'ok',
    });
    const run = () => {
      const s = createLevelSession(def, 42);
      s.tick();
      s.tick();
      s.tick();
      s.answerQuestion(true, 4);
      s.answerQuestion(false, 9);
      return JSON.stringify({
        events: s.world.events,
        requests: s.requests,
        gauges: s.state.gauges,
        fight: { ...s.fight, startedAt: 0 }, // startedAt is Date.now(), not part of the replay
        phase: s.phase,
      });
    };
    expect(run()).toBe(run());
    const other = createLevelSession(def, 43);
    other.tick();
    other.tick();
    other.tick();
    // Different seed, same scripted world: events identical here (no random
    // use), but the seed is recorded — the run is reproducible per seed.
    expect(other.world.seed).toBe(43);
  });
});

describe('crash capture', () => {
  it('a throwing script is recorded with its real message and the session survives', () => {
    const s = createLevelSession(
      tinyLevel({
        script: () => {
          const items = undefined as unknown as number[];
          items.map(x => x); // real TypeError
        },
      }),
    );
    s.tick();
    expect(s.state.crashed).toBe(true);
    expect(s.state.crashMessage).toContain('undefined');
    expect(s.state.crashMessage).toContain('map');
    expect(s.world.events.some(e => e.kind === 'crash')).toBe(true);
    // Next tick with a fixed script would clear it — here it throws again.
    s.tick();
    expect(s.state.crashed).toBe(true);
    expect(s.outcome()).toBe('ongoing');
  });
});

describe('frame budget constants', () => {
  it('1000 rows at the model cost blow the 16.6ms budget; a 12-row window does not', () => {
    expect(1000 * 0.16).toBeGreaterThan(FRAME_BUDGET_MS);
    expect(12 * 0.16).toBeLessThan(FRAME_BUDGET_MS);
  });
});
