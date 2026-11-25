// TechieMan — canonical question bank types + Chapter 1 seed (M3).
// Single source of truth for questions: the TS arrays in this file and
// questions-ch1a.ts / questions-ch1b.ts. The SQLite `questions` table is
// seeded FROM these arrays at app start (see storage/bank.ts), so the
// bundle and the DB can never diverge. Plan §4.2 guardrails apply:
// every question cites a source + a short verbatim quote from it;
// `verified` is true ONLY if the fact was checked against the fetched
// source page, or — for type 'code' — the snippet was actually executed
// and the correct answer matches the real output.

export type QuestionType = 'mcq' | 'code' | 'bug';

/**
 * How a code/bug question was machine-checked (M6 pipeline, plan §4.2).
 * - 'run': `codeSnippet` was executed with node; stdout must equal
 *   `expectedStdout`, and the correct option must be that output.
 * - 'compile': `codeSnippet` is RN/TS that must type-check against the
 *   pinned SDK (tsc) — this is the API-index check: a hallucinated API
 *   does not exist on the type and fails the build.
 * - 'legacy': Chapter 1 code questions, hand-verified in M3 before the
 *   pipeline existed (see the verification log in questions-ch1a.ts).
 *   Grandfathered; no new question may use this mode.
 * - 'none': mcq questions carry no snippet.
 */
export type CheckMode = 'run' | 'compile' | 'legacy' | 'none';

/**
 * The villain rule (user correction, 2026-11-26): the enemy IS the
 * language/concept itself — a living stick-creature built from the
 * concept's own symbols. Never a generic goblin. One entry per node;
 * chapter bosses live in roadmap.ts (CHAPTERS[].bossName).
 */
export interface NodeEnemy {
  nodeId: string;
  /** The concept personified, e.g. 'The Keyless List'. Never the boss name. */
  enemyName: string;
  /** 1–6 symbols the creature is drawn from, e.g. ['key?', '[]', '...']. */
  symbols: string[];
  /** Neon accent, #hex — the creature's glow colour. */
  accent: string;
}

export interface Question {
  id: string; // e.g. '1.1-q03' — unique across the whole bank
  nodeId: string; // roadmap node id, e.g. '1.1-js-basics'
  type: QuestionType; // mcq = concept, code = predict the output, bug = spot the bug
  stem: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  /** One line, plain words — the teaching moment shown after the move lands. */
  explanation: string;
  /** Real URL only — reactnative.dev, react.dev, developer.mozilla.org, roadmap.sh. */
  sourceUrl: string;
  /** Short verbatim excerpt from the source page that supports the answer. */
  sourceQuote: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** SDK version the question was validated against, e.g. 'RN 0.88'. */
  sdkVersion: string;
  verified: boolean;
  status: 'approved' | 'draft' | 'quarantined';
  /** Runnable snippet for type 'code' (and 'bug'). Required for Ch2–8 code/bug. */
  codeSnippet?: string;
  /** Machine-check mode for the snippet. 'none' for mcq. */
  checkMode?: CheckMode;
  /** Exact stdout of `codeSnippet` under `node` (run mode) — must equal options[correctIndex] for code, and the buggy output for bug. */
  expectedStdout?: string;
}

/** The 5 Chapter 1 questions from the M1 scaffold, converted to the full shape. */
export const CHAPTER_1_SEED_QUESTIONS: Question[] = [
  {
    id: '1.1-q01',
    nodeId: '1.1-js-basics',
    type: 'mcq',
    stem: 'What does `typeof null` return in JavaScript?',
    options: ['"null"', '"object"', '"undefined"', '"void"'],
    correctIndex: 1,
    explanation: '`typeof null` is "object" — a famous language quirk from the first JS implementation.',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof',
    sourceQuote: "typeof null === 'object'",
    difficulty: 1,
    sdkVersion: 'RN 0.88',
    verified: true, // executed: node prints "object"
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '1.1-q02',
    nodeId: '1.1-js-basics',
    type: 'code',
    stem: 'What does `[1, 2, 3].map(n => n * 2)` return?',
    options: ['[2, 4, 6]', '[1, 2, 3]', '6', 'undefined'],
    correctIndex: 0,
    explanation: '`map` returns a NEW array with the function applied to every element; the original is untouched.',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map',
    sourceQuote: 'map() creates a new array populated with the results of calling a provided function on every element in the calling array.',
    difficulty: 1,
    sdkVersion: 'RN 0.88',
    verified: true, // executed: node prints [2, 4, 6]
    status: 'approved',
    codeSnippet: 'console.log(JSON.stringify([1, 2, 3].map(n => n * 2)));',
    checkMode: 'run',
    expectedStdout: '[2,4,6]',
  },
  {
    id: '1.3-q01',
    nodeId: '1.3-jsx',
    type: 'mcq',
    stem: 'In JSX, how do you render a variable called `name` inside text?',
    options: ['{name}', '{{name}}', '$name', '<name />'],
    correctIndex: 0,
    explanation: 'Curly braces embed a JS expression in JSX: `<Text>Hello, {name}</Text>`.',
    sourceUrl: 'https://reactnative.dev/docs/intro-react#jsx',
    sourceQuote: 'Any JavaScript expression will work between curly braces, including function calls like `{getFullName("Rum", "Tum", "Tugger")}`',
    difficulty: 1,
    sdkVersion: 'RN 0.88',
    verified: true, // quote corrected to verbatim text from the fetched page (M3 fix, 2026-11-25)
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '1.4-q01',
    nodeId: '1.4-components-state-props',
    type: 'mcq',
    stem: 'In React Native, what is the difference between props and state?',
    options: [
      'Props are passed in by a parent; state is owned and changed by the component itself',
      'Props change over time; state never changes',
      'State is passed by a parent; props are owned by the component',
      'There is no difference',
    ],
    correctIndex: 0,
    explanation: 'Props flow down from the parent and are read-only; state lives inside the component and changes with setState/useState.',
    sourceUrl: 'https://reactnative.dev/docs/intro-react#state',
    sourceQuote: 'As a general rule, use props to configure a component when it renders. Use state to keep track of any component data that you expect to change over time.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true, // quote corrected to verbatim text from the fetched page (M3 fix, 2026-11-25)
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '1.4-q02',
    nodeId: '1.4-components-state-props',
    type: 'code',
    stem: 'What happens when you call a state setter from `useState`?',
    options: [
      'The component re-renders with the new value',
      'Only the variable changes, nothing re-renders',
      'The app reloads from Metro',
      'The old value is kept until the next mount',
    ],
    correctIndex: 0,
    explanation: 'Calling the setter schedules a re-render; the component function runs again with the new state.',
    sourceUrl: 'https://react.dev/reference/react/useState',
    sourceQuote: 'The `set` function returned by `useState` lets you update the state to a different value and trigger a re-render.',
    difficulty: 2,
    sdkVersion: 'RN 0.88',
    verified: true, // quote corrected to verbatim text from the fetched page (M3 fix, 2026-11-25)
    status: 'approved',
    checkMode: 'legacy', // conceptual code question: no runnable node snippet (state setter needs React)
  },
];
