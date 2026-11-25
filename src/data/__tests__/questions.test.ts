// Tests for the M3 question bank: shape, per-node counts, no duplicates.
// The bank is the product's credibility — a bad question teaches wrong
// React Native — so these invariants are enforced in CI, not by review.
import { ALL_QUESTIONS, questionsForNode } from '../allQuestions';

describe('ALL_QUESTIONS', () => {
  it('has exactly 40 questions: 10 per Chapter 1 node', () => {
    expect(ALL_QUESTIONS).toHaveLength(40);
    expect(questionsForNode('1.1-js-basics')).toHaveLength(10);
    expect(questionsForNode('1.2-css-basics')).toHaveLength(10);
    expect(questionsForNode('1.3-jsx')).toHaveLength(10);
    expect(questionsForNode('1.4-components-state-props')).toHaveLength(10);
  });

  it('has no duplicate ids or stems', () => {
    const ids = ALL_QUESTIONS.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const stems = ALL_QUESTIONS.map(q => q.stem);
    expect(new Set(stems).size).toBe(stems.length);
  });

  it('every question is approved + verified, with 4 options and a real source', () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.status).toBe('approved');
      expect(q.verified).toBe(true);
      expect(q.options).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThanOrEqual(3);
      expect(q.sourceUrl.startsWith('https://')).toBe(true);
      expect(q.sourceQuote.length).toBeGreaterThan(10);
      expect(q.explanation.length).toBeGreaterThan(0);
      expect(q.sdkVersion).toBe('RN 0.88');
      // The correct option must not appear twice (accidentally-correct distractor).
      const correct = q.options[q.correctIndex];
      expect(q.options.filter(o => o === correct)).toHaveLength(1);
    }
  });

  it('questionsForNode returns approved questions in id order', () => {
    const qs = questionsForNode('1.1-js-basics');
    const ids = qs.map(q => q.id);
    expect(ids).toEqual([...ids].sort());
    expect(qs.every(q => q.nodeId === '1.1-js-basics')).toBe(true);
  });

  it('nodes outside Chapter 1 have no questions yet (never invented)', () => {
    expect(questionsForNode('2.1-state-management')).toHaveLength(0);
  });
});
