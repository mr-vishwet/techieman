// Tests for the full TechieMan question bank (M3 Ch1 + M6 Ch2–8): shape,
// per-node counts, per-chapter mix, no duplicates.
// The bank is the product's credibility — a bad question teaches wrong
// React Native — so these invariants are enforced in CI, not by review.
// (M3 version asserted 40 questions / Chapter 1 only; M6 rewrote it for
// the 320-question bank. The pipeline validator in
// scripts/ai-pipeline/validate.mjs is the same invariants plus execution;
// bank-integrity.test.ts cross-checks its report.)
import { ALL_QUESTIONS, questionsForNode } from '../allQuestions';
import { CHAPTERS, NODES, nodesForChapter } from '../roadmap';

/** Mirror of validate.mjs's stem normalisation (line 64). */
function normStem(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[`*_#]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

describe('ALL_QUESTIONS', () => {
  it('has exactly 320 questions: 10 per node across all 32 nodes', () => {
    expect(NODES).toHaveLength(32);
    expect(ALL_QUESTIONS).toHaveLength(320);
    for (const node of NODES) {
      expect(questionsForNode(node.id)).toHaveLength(10);
    }
  });

  it('has exactly 40 questions per chapter with the 18 mcq / 14 code / 8 bug mix', () => {
    expect(CHAPTERS).toHaveLength(8);
    for (const chapter of CHAPTERS) {
      const nodes = nodesForChapter(chapter.id);
      expect(nodes).toHaveLength(4);
      const qs = nodes.flatMap(n => questionsForNode(n.id));
      expect(qs).toHaveLength(40);
      expect(qs.filter(q => q.type === 'mcq')).toHaveLength(18);
      expect(qs.filter(q => q.type === 'code')).toHaveLength(14);
      expect(qs.filter(q => q.type === 'bug')).toHaveLength(8);
    }
  });

  it('follows the per-node mix: Ch2–8 nodes 1–2 are 5/3/2, nodes 3–4 are 4/4/2', () => {
    // The deterministic per-node rule is an M6 pipeline rule (Ch2–8).
    // Chapter 1 predates it (M3): its chapter mix is still 18/14/8, but
    // the split across nodes differs — 1.1 is 3/6/1, 1.2 is 6/2/2,
    // 1.3 is 5/2/3, 1.4 is 4/4/2. Asserted exactly, not smoothed over.
    const ch1Mix: Record<string, [number, number, number]> = {
      '1.1-js-basics': [3, 6, 1],
      '1.2-css-basics': [6, 2, 2],
      '1.3-jsx': [5, 2, 3],
      '1.4-components-state-props': [4, 4, 2],
    };
    for (const node of NODES) {
      const qs = questionsForNode(node.id);
      const mcq = qs.filter(q => q.type === 'mcq').length;
      const code = qs.filter(q => q.type === 'code').length;
      const bug = qs.filter(q => q.type === 'bug').length;
      if (node.id.startsWith('1.')) {
        expect([mcq, code, bug]).toEqual(ch1Mix[node.id]);
      } else if (node.order <= 2) {
        expect([mcq, code, bug]).toEqual([5, 3, 2]);
      } else {
        expect([mcq, code, bug]).toEqual([4, 4, 2]);
      }
    }
  });

  it('has no duplicate ids or stems (raw or normalised)', () => {
    const ids = ALL_QUESTIONS.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const stems = ALL_QUESTIONS.map(q => q.stem);
    expect(new Set(stems).size).toBe(stems.length);
    const normed = ALL_QUESTIONS.map(q => normStem(q.stem));
    expect(new Set(normed).size).toBe(normed.length);
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
      // Id must match its node: 'N.M-qNN' on node 'N.M-…'.
      expect(q.id).toMatch(/^[1-8]\.[1-4]-q\d{2}$/);
      const prefix = q.nodeId.split('-')[0];
      expect(q.id.startsWith(prefix + '-q')).toBe(true);
    }
  });

  it('questionsForNode returns approved questions in id order', () => {
    for (const node of NODES) {
      const qs = questionsForNode(node.id);
      const ids = qs.map(q => q.id);
      expect(ids).toEqual([...ids].sort());
      expect(qs.every(q => q.nodeId === node.id)).toBe(true);
    }
  });

  it('an unknown node has no questions (never invented)', () => {
    expect(questionsForNode('9.9-not-a-node')).toHaveLength(0);
  });
});
