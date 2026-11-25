import {
  newFight,
  applyAnswer,
  damageForCorrectAnswer,
  damageForWrongAnswer,
  comboMultiplier,
  xpForFight,
  nextRematchAt,
  enemyMaxHp,
} from '../fightMath';

describe('comboMultiplier', () => {
  it('scales 1.0 / 1.25 / 1.5 / 2.0 at 0-1 / 2 / 3 / 4+', () => {
    expect(comboMultiplier(0)).toBe(1.0);
    expect(comboMultiplier(1)).toBe(1.0);
    expect(comboMultiplier(2)).toBe(1.25);
    expect(comboMultiplier(3)).toBe(1.5);
    expect(comboMultiplier(4)).toBe(2.0);
    expect(comboMultiplier(9)).toBe(2.0);
  });
});

describe('damageForCorrectAnswer', () => {
  it('fast correct answer deals more than a slow one', () => {
    expect(damageForCorrectAnswer(2, 0)).toBeGreaterThan(damageForCorrectAnswer(14, 0));
  });
  it('never deals less than base 20', () => {
    expect(damageForCorrectAnswer(15, 0)).toBe(20);
    expect(damageForCorrectAnswer(99, 0)).toBe(20);
  });
  it('applies the combo multiplier', () => {
    expect(damageForCorrectAnswer(2, 4)).toBeGreaterThan(damageForCorrectAnswer(2, 0));
  });
});

describe('damageForWrongAnswer', () => {
  it('bosses hit harder than normal enemies', () => {
    expect(damageForWrongAnswer(true)).toBeGreaterThan(damageForWrongAnswer(false));
  });
});

describe('enemyMaxHp', () => {
  it('bosses have 300 HP, normal enemies scale with difficulty', () => {
    expect(enemyMaxHp(1, true)).toBe(300);
    expect(enemyMaxHp(1, false)).toBe(60);
    expect(enemyMaxHp(5, false)).toBe(150);
    expect(enemyMaxHp(3, false)).toBeGreaterThan(enemyMaxHp(1, false));
  });
});

describe('applyAnswer — a full fight', () => {
  it('correct answers drain enemy HP and build combo; wrong answers drain player HP and reset combo', () => {
    let s = newFight(1);
    const r1 = applyAnswer(s, true, 3);
    expect(r1.damageDealt).toBeGreaterThan(0);
    expect(r1.state.enemy.hp).toBeLessThan(s.enemy.hp);
    expect(r1.state.combo).toBe(1);
    expect(r1.outcome).toBe('ongoing');
    s = r1.state;

    const r2 = applyAnswer(s, false, 15);
    expect(r2.damageTaken).toBe(20);
    expect(r2.state.player.hp).toBe(80);
    expect(r2.state.combo).toBe(0);
    expect(r2.state.wrongCount).toBe(1);
  });

  it('enemy HP hitting 0 is a win; flawless requires zero wrong answers', () => {
    let s = newFight(1);
    let last = applyAnswer(s, true, 1);
    while (last.outcome === 'ongoing') {
      last = applyAnswer(last.state, true, 1);
    }
    expect(last.outcome).toBe('win');
    expect(last.flawless).toBe(true);
  });

  it('player HP hitting 0 is a loss', () => {
    let s = newFight(5);
    let last = applyAnswer(s, false, 15);
    while (last.outcome === 'ongoing') {
      last = applyAnswer(last.state, false, 15);
    }
    expect(last.outcome).toBe('lose');
    expect(last.state.player.hp).toBe(0);
  });

  it('a win after a wrong answer is not flawless', () => {
    let s = newFight(1);
    let last = applyAnswer(s, false, 15);
    while (last.outcome === 'ongoing') {
      last = applyAnswer(last.state, true, 1);
    }
    expect(last.outcome).toBe('win');
    expect(last.flawless).toBe(false);
  });
});

describe('xpForFight', () => {
  it('replays pay 10% — no farming', () => {
    const first = xpForFight(8, 8, true, true, false);
    const replay = xpForFight(8, 8, true, false, false);
    expect(replay).toBe(Math.round(first * 0.1));
    expect(first).toBeGreaterThan(replay);
  });
  it('bosses and flawless clears pay a bonus', () => {
    expect(xpForFight(8, 10, false, true, true)).toBeGreaterThan(
      xpForFight(8, 10, false, true, false),
    );
    expect(xpForFight(8, 8, true, true, false)).toBeGreaterThan(
      xpForFight(8, 8, false, true, false),
    );
  });
});

describe('nextRematchAt', () => {
  it('spaced repetition intervals are 1d, 3d, 7d', () => {
    const day = 24 * 60 * 60 * 1000;
    const t0 = 1_700_000_000_000;
    expect(nextRematchAt(t0, 0)).toBe(t0 + 1 * day);
    expect(nextRematchAt(t0, 1)).toBe(t0 + 3 * day);
    expect(nextRematchAt(t0, 2)).toBe(t0 + 7 * day);
    expect(nextRematchAt(t0, 9)).toBe(t0 + 7 * day);
  });
});
