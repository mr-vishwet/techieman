// M6 pipeline integrity: the Jest-side mirror of the gates in
// scripts/ai-pipeline/validate.mjs, plus a cross-check of the validator's
// own report. The validator EXECUTES every snippet (node/tsc); these tests
// assert the structural invariants that must hold for the bank to ship:
// counts, dedup, sources, machine-check modes, and a green report.
// If a question is ever quarantined it must stay OUT of the bank — the
// bank layer filters on status === 'approved' (see storage/bank.ts).
// The report is imported as JSON (resolveJsonModule is on in the RN
// tsconfig); if the file is missing, this import fails the suite loudly.
import { ALL_QUESTIONS, questionsForNode } from '../allQuestions';
import { NODES } from '../roadmap';
import report from '../../../../scripts/ai-pipeline/verification-report.json';

/** Mirror of validate.mjs's stem normalisation (line 64). */
function normStem(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[`*_#]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The one grandfathered exception: M3 hand-verified before the pipeline. */
const LEGACY_IDS = new Set(['1.4-q02']);

describe('bank integrity (M6 pipeline mirror)', () => {
  it('has exactly 10 approved questions per node, 320 total', () => {
    expect(NODES).toHaveLength(32);
    expect(ALL_QUESTIONS).toHaveLength(320);
    for (const node of NODES) {
      const qs = questionsForNode(node.id);
      expect(qs).toHaveLength(10);
      expect(qs.every(q => q.status === 'approved')).toBe(true);
    }
  });

  it('has no duplicate ids or normalised stems bank-wide', () => {
    const ids = ALL_QUESTIONS.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    const stems = ALL_QUESTIONS.map(q => normStem(q.stem));
    expect(new Set(stems).size).toBe(stems.length);
  });

  it('every question has a real source URL and a verbatim quote', () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.sourceUrl.startsWith('https://')).toBe(true);
      expect(q.sourceUrl.length).toBeGreaterThan(20);
      expect(q.sourceQuote.trim().length).toBeGreaterThan(10);
    }
  });

  it('every code/bug question carries a machine-checked snippet (except Ch1, hand-verified in M3)', () => {
    for (const q of ALL_QUESTIONS) {
      if (q.type === 'mcq') {
        expect(q.checkMode ?? 'none').toBe('none');
        continue;
      }
      // Chapters 2–8 (M6 pipeline, validate.mjs G6): every code/bug
      // question must carry a snippet machine-checked as run|compile…
      if (!q.id.startsWith('1.')) {
        expect(q.codeSnippet).toBeTruthy();
        expect(['run', 'compile']).toContain(q.checkMode);
      } else {
        // …Chapter 1 predates the pipeline (M3 hand-verified): most code/bug
        // questions have no snippet and no checkMode; the only exceptions
        // are 1.1-q02 (run) and 1.4-q02 (legacy). Never grant 'legacy' to
        // a new question — it is grandfathered, not a mode.
        expect([undefined, 'run', 'legacy']).toContain(q.checkMode);
      }
      if (q.checkMode === 'run') {
        expect(q.expectedStdout).toBeDefined();
        // …and for type 'code' the correct option IS the snippet output.
        if (q.type === 'code') {
          expect(q.options[q.correctIndex].replace(/\s+/g, '')).toBe(
            String(q.expectedStdout).replace(/\s+/g, ''),
          );
        }
      }
    }
    // …and 'legacy' is grandfathered, never granted to new questions.
    const legacy = ALL_QUESTIONS.filter(q => q.checkMode === 'legacy').map(
      q => q.id,
    );
    expect(legacy.sort()).toEqual([...LEGACY_IDS].sort());
  });

  it('the pipeline verification report exists, is green, and matches the bank', () => {
    // The import at the top of this file IS the existence check: if
    // verification-report.json is missing, Jest fails to resolve it.
    expect(report.scope).toBe('full bank');
    expect(report.pass).toBe(true);
    expect(report.failures).toEqual([]);
    expect(report.quarantined).toEqual([]);
    expect(report.questionsChecked).toBe(ALL_QUESTIONS.length);
    expect(report.liveQuestions).toBe(ALL_QUESTIONS.length);
    expect(report.checksRun).toBeGreaterThan(0);
    // The report's executed-snippet count must equal the bank's
    // machine-checked snippet count — the report and the bank cannot drift.
    const machineChecked = ALL_QUESTIONS.filter(q =>
      ['run', 'compile'].includes(q.checkMode ?? ''),
    ).length;
    expect(report.executed).toHaveLength(machineChecked);
    // Warnings are expected (Ch1 legacy + punctuation) but each must
    // reference a real question id.
    expect(Array.isArray(report.warnings)).toBe(true);
    const ids = new Set(ALL_QUESTIONS.map(q => q.id));
    for (const w of report.warnings) {
      expect(ids.has(w.id)).toBe(true);
    }
  });
});
