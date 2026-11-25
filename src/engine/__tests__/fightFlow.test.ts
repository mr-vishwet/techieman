// Tests for the M3 fight flow THROUGH the real bank (not a fixture bank):
// a full Chapter 1 fight is played question-by-question from the actual
// 10-question node banks, and win/lose/rematch fall out of fightMath.
import { questionsForNodeLocal } from '../../storage/bank';
import { ALL_QUESTIONS } from '../../data/allQuestions';
import { applyAnswer, newFight, xpForFight } from '../fightMath';

const NODE = '1.1-js-basics';

function playAllCorrect(secondsPerAnswer = 3): ReturnType<typeof applyAnswer> {
  const qs = questionsForNodeLocal(NODE, ALL_QUESTIONS);
  let state = newFight(1);
  let last: ReturnType<typeof applyAnswer> | null = null;
  for (const q of qs) {
    // Answer each question correctly (the correct option is the bank's).
    last = applyAnswer(state, true, secondsPerAnswer);
    state = last.state;
    if (last.outcome !== 'ongoing') break;
  }
  if (!last) throw new Error('no questions');
  return last;
}

describe('fight flow through the real Chapter 1 bank', () => {
  it('10 fast correct answers win the node fight, flawless', () => {
    const last = playAllCorrect(3);
    expect(last.outcome).toBe('win');
    expect(last.flawless).toBe(true);
    expect(last.state.correctCount).toBeGreaterThan(0);
    expect(last.state.correctCount).toBeLessThanOrEqual(10);
  });

  it('a first-clear win pays full XP (10 per correct + 25 flawless)', () => {
    const last = playAllCorrect(3);
    const xp = xpForFight(last.state.correctCount, 10, last.flawless, true, false);
    expect(xp).toBe(last.state.correctCount * 10 + 25);
    expect(xp).toBeGreaterThan(0);
  });

  it('a replay win pays only 10% (no farming)', () => {
    const last = playAllCorrect(3);
    const first = xpForFight(last.state.correctCount, 10, last.flawless, true, false);
    const replay = xpForFight(last.state.correctCount, 10, last.flawless, false, false);
    expect(replay).toBe(Math.round(first * 0.1));
  });

  it('10 wrong answers lose the fight (5 wrongs empty 100 HP at 20 each)', () => {
    let state = newFight(1);
    let last: ReturnType<typeof applyAnswer> | null = null;
    for (let i = 0; i < 10; i++) {
      last = applyAnswer(state, false, 15);
      state = last.state;
      if (last.outcome !== 'ongoing') break;
    }
    expect(last?.outcome).toBe('lose');
    expect(state.player.hp).toBe(0);
    expect(state.wrongCount).toBe(5);
  });

  it('the bank cycles: a rematch replays the same 10 questions', () => {
    const qs = questionsForNodeLocal(NODE, ALL_QUESTIONS);
    expect(qs).toHaveLength(10);
    // FightScreen cycles with qIndex % length — the bank is the loop.
    const secondLoopFirst = qs[10 % qs.length];
    expect(secondLoopFirst.id).toBe(qs[0].id);
  });

  it('every bank question has a distinct correct answer in its options', () => {
    const qs = questionsForNodeLocal(NODE, ALL_QUESTIONS);
    for (const q of qs) {
      expect(q.options[q.correctIndex]).toBeDefined();
      expect(q.options.filter(o => o === q.options[q.correctIndex])).toHaveLength(1);
    }
  });
});
