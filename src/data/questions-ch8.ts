// TechieMan — Chapter 8, "Ship It" (FINAL chapter, boss: The Store Review).
// Nodes 8.1 (Testing: Jest & RNTL) + 8.2 (E2E: Detox & Appium) +
// 8.3 (Performance) + 8.4 (Publishing), 40 questions (18 mcq / 14 code / 8 bug).
// Authored 2026-11-26. Every question verified: run-mode snippets were
// executed with node (outputs below); compile-mode snippets type-check
// against RN 0.88 (tsc is the API-index check); mcq questions against the
// fetched source page (see log below).
//
// VERIFICATION LOG
// --- node execution (scratch run ~/workspace/verify-ch8-scratch.mjs + one node -e) ---
//   8.1-q06 mock expect/toBe:  pass                                            -> 'pass'
//   8.1-q07 mock jest.fn calls: 2                                              -> '2'
//   8.1-q09 un-awaited save:   undefined                                       -> 'undefined'
//   8.1-q10 snapshot vs typo:  snapshot differs                               -> 'snapshot differs'
//   8.2-q06 mock Detox tap:    tapped:Login                                    -> 'tapped:Login'
//   8.2-q07 mock waitFor poll: found after 3 tries                            -> 'found after 3 tries'
//   8.2-q08 retry backoff:     400                                             -> '400'
//   8.2-q09 fixed-sleep check: not ready yet                                   -> 'not ready yet'
//   8.2-q10 tap by index:      Cancel                                          -> 'Cancel'
//   8.3-q05 frame budget:      16.67                                           -> '16.67'
//   8.3-q06 200ms dropped:     12                                              -> '12'
//   8.3-q07 windowSize 21:     10                                              -> '10'
//   8.3-q09 getItemLayout off: offset wrong by 70                              -> 'offset wrong by 70'
//   8.3-q10 initialNumToRender: blank area: 9 rows missing                     -> 'blank area: 9 rows missing'
//   8.4-q05 next versionCode:  4                                               -> '4'
//   8.4-q06 downgrade install: install blocked: downgrade                      -> 'install blocked: downgrade'
//   8.4-q07 Hermes check:      Hermes                                          -> 'Hermes'
//   8.4-q08 Play max code:     rejected: over Play limit                       -> 'rejected: over Play limit'
//   8.4-q09 reused code:       rejected: versionCode already used              -> 'rejected: versionCode already used'
//   8.4-q10 gradle in git:     android/gradle.properties is tracked: secrets leak
// --- compile-mode snippets (tsc against RN 0.88 types, run by validate.mjs) ---
//   8.1-q08 <Text testID="welcome"> — testID is a valid prop on Text (tsc proves it)
//   8.3-q08 FlatList getItemLayout/windowSize/maxToRenderPerBatch/removeClippedSubviews
// --- source pages fetched (browser.open, 2026-11-26) ---
//   testing-overview  https://reactnative.dev/docs/testing-overview
//   flatlist config   https://reactnative.dev/docs/optimizing-flatlist-configuration
//   performance       https://reactnative.dev/docs/performance
//   signed APK        https://reactnative.dev/docs/signed-apk-android
//   app store         https://reactnative.dev/docs/publishing-to-app-store
//   hermes            https://reactnative.dev/docs/hermes
//   android versioning https://developer.android.com/studio/publish/versioning
//   (8.1-q09's quote is carried over verbatim from the questions-ch1a.ts
//    verification log — MDN async_function, fetched 2026-11-25.)
// --- deliberately left out (unverified / no allowed-host source) ---
//   Exact Detox API signatures (expect().toBeVisible(), by.id(), device.reloadReactNative())
//   and Appium locator prefixes / driver commands — Detox/Appium docs live on
//   github.com / appium.io, which are NOT allowed hosts; the chapter covers them
//   only at the general level the RN testing-overview page documents, plus
//   clearly-labelled local mocks of the API SHAPE (logic, not the library).
//   Exact RNTL API signatures (getByRole, queryByText, toHaveTextContent) —
//   RNTL docs live on callstack.github.io (not an allowed host); covered only
//   via the RN testing-overview page's render/fireEvent/getByText example.
//   FlatList getItemLayout signature page, R8/shrink-code page, react.dev memo
//   page — fetch attempts hit the browser 429 rate limit; the same facts are
//   quoted from the already-fetched optimizing-flatlist-configuration page.
//   Apple App Store Review Guidelines specifics and Play Console track
//   (internal/closed/open testing) details — no allowed-host page fetched;
//   iOS questions cite the RN publishing-to-app-store page only.
//   AUDIT (M6 coordinator, 2026-11-26): 8.2-q08's flaky-test quote is
//   VERBATIM on the live testing-overview page ("they are more prone to
//   flakiness (a \"flaky\" test is a test which randomly passes and fails
//   without any change to code)"). The quote gives the flakiness context;
//   the doubling-backoff math (100→200→400ms) is execution-verified, not
//   quoted. 0 quarantined.
// All 40 verified: true, status: 'approved'.

import type { NodeEnemy, Question } from './questions';

export const QUESTIONS_CH8: Question[] = [
  // ---- Node 8.1 — Testing: Jest & React Native Testing Library (5 mcq, 3 code, 2 bug) ----
  {
    id: '8.1-q01',
    nodeId: '8.1-testing',
    type: 'mcq',
    stem: 'Which testing framework ships with the default React Native template?',
    options: ['Jest', 'Mocha', 'Vitest', 'Jasmine'],
    correctIndex: 0,
    explanation: 'The RN template comes with Jest preconfigured, including a preset tailored to the environment.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'The default template of React Native ships with Jest testing framework.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.1-q02',
    nodeId: '8.1-testing',
    type: 'mcq',
    stem: 'What does a unit test cover?',
    options: [
      'The smallest parts of code, like individual functions or classes',
      'The whole app running on a real device',
      'Only the navigation flow, end to end',
      'Only the app store listing and screenshots',
    ],
    correctIndex: 0,
    explanation: 'Unit tests target the smallest testable pieces — one function or class at a time — so you get fast feedback.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'Unit tests cover the smallest parts of code, like individual functions or classes.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.1-q03',
    nodeId: '8.1-testing',
    type: 'mcq',
    stem: 'In testing, what does it mean to "mock out" a dependency?',
    options: [
      'Replace the dependency with your own implementation',
      'Delete the dependency from package.json',
      'Run the dependency on a real device instead of Node',
      'Copy the dependency into every test file',
    ],
    correctIndex: 0,
    explanation: 'A mock stands in for a real dependency — e.g. a weather service — so tests stay fast and deterministic.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: '"Mocking" is when you replace some dependency of your code with your own implementation.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.1-q04',
    nodeId: '8.1-testing',
    type: 'mcq',
    stem: 'React Native Testing Library builds on top of React\'s test renderer and adds which APIs?',
    options: ['`fireEvent` and `query` APIs', '`mount` and `shallow` APIs', '`render` and `hydrate` APIs', '`act` and `create` APIs'],
    correctIndex: 0,
    explanation: 'RNTL adds fireEvent (simulate user interaction) and query functions (find rendered output) on top of the test renderer.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'React Native Testing Library builds on top of React’s test renderer and adds `fireEvent` and `query` APIs described in the next paragraph.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.1-q05',
    nodeId: '8.1-testing',
    type: 'mcq',
    stem: 'Why should you avoid making assertions on component props, state, or testID queries?',
    options: [
      'They test implementation details that break when you refactor, instead of how users interact with the component',
      'They make tests run ten times slower',
      'They only work on iOS, not Android',
      'Jest cannot read props or state at all',
    ],
    correctIndex: 0,
    explanation: 'Props and state are internals — users see rendered text and behaviour. Assert on what users can see or hear.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'Avoid testing implementation details like props or state—while such tests work, they are not oriented toward how users will interact with the component and tend to break by refactoring (for example when you\'d like to rename some things or rewrite class component using hooks).',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.1-q06',
    nodeId: '8.1-testing',
    type: 'code',
    stem: 'A mock of Jest\'s expect().toBe() runs the docs\' own example check on a past date. What does it print?',
    options: ['pass', 'fail', 'red', 'TypeError: colorForDueDate is not defined'],
    correctIndex: 0,
    explanation: '2000-10-20 is in the past, so colorForDueDate returns "red" — and toBe("red") passes.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'expect(colorForDueDate(\'2000-10-20\')).toBe(\'red\');',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `// MOCK of Jest's expect().toBe() - tests the LOGIC, not the library.
const colorForDueDate = (d) => (new Date(d) < new Date('2026-01-01') ? 'red' : 'green');
const expect = (actual) => ({ toBe: (e) => (actual === e ? 'pass' : 'fail') });
console.log(expect(colorForDueDate('2000-10-20')).toBe('red'));`,
    checkMode: 'run',
    expectedStdout: 'pass',
  },
  {
    id: '8.1-q07',
    nodeId: '8.1-testing',
    type: 'code',
    stem: 'A mock of jest.fn() records every call it receives. After two calls, what does it print?',
    options: ['2', '1', '0', '8'],
    correctIndex: 0,
    explanation: 'Mock functions record their calls — checking calls.length tells you the function ran exactly twice.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'Jest comes with support for mocking from function level all the way to module level mocking.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `// MOCK of jest.fn() call tracking - tests the LOGIC, not the library.
const fn = (...args) => { fn.calls.push(args); return args[0] * 2; };
fn.calls = [];
fn(3); fn(4);
console.log(fn.calls.length);`,
    checkMode: 'run',
    expectedStdout: '2',
  },
  {
    id: '8.1-q08',
    nodeId: '8.1-testing',
    type: 'code',
    stem: 'Does this snippet type-check against RN 0.88, and what does it prove? `<Text testID="welcome">Hello</Text>`',
    options: [
      'Yes — testID is a valid prop on Text, so a test can query the element by test ID',
      'No — testID is not a valid prop on Text',
      'No — testID only exists on View, not Text',
      'Yes — but testID can only hold a number, not a string',
    ],
    correctIndex: 0,
    explanation: 'tsc accepts testID on Text — the compile check is the proof the prop exists. Prefer visible-text queries in real tests, but the prop itself is valid.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'React Native Testing Library builds on top of React’s test renderer and adds `fireEvent` and `query` APIs described in the next paragraph.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { Text } from 'react-native';
const el = <Text testID="welcome">Hello</Text>;
export default el;`,
    checkMode: 'compile',
  },
  {
    id: '8.1-q09',
    nodeId: '8.1-testing',
    type: 'bug',
    stem: 'A test calls an async save(), then immediately checks the result — and logs `undefined`. What is the bug? `let saved; save(); console.log(saved);` where save() resolves after a setTimeout.',
    options: [
      'The test never awaited the promise, so the check ran before save() finished',
      'save() returns 42 synchronously, so the test itself is wrong',
      'setTimeout with 0ms runs before the console.log',
      'Promises cannot assign to outer variables',
    ],
    correctIndex: 0,
    explanation: 'await suspends the function until the promise settles — without it, the assertion runs while saved is still undefined.',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function',
    sourceQuote: 'Await expressions make promise-returning functions behave as though they\'re synchronous by suspending execution until the returned promise is fulfilled or rejected.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `let saved;
const save = () => new Promise((r) => setTimeout(() => { saved = 42; r(); }, 0));
save();
console.log(saved);`,
    checkMode: 'run',
    expectedStdout: 'undefined',
  },
  {
    id: '8.1-q10',
    nodeId: '8.1-testing',
    type: 'bug',
    stem: 'A snapshot test fails after a one-letter typo slipped into a component ("Welcom"). A teammate runs Jest with --updateSnapshot and the suite goes green. What is the bug in this workflow?',
    options: [
      'Updating the snapshot blessed the typo — snapshots only guard against change, they never prove the output is correct',
      'Snapshots auto-fix typos in components',
      'The snapshot file was corrupted and must be deleted',
      '--updateSnapshot only works for unit tests, not snapshots',
    ],
    correctIndex: 0,
    explanation: 'A snapshot is considered correct the moment it is created — even when the output is wrong. Investigate the diff before updating.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'When a snapshot fails, it\'s tempting to update it using the `--updateSnapshot` jest option without taking proper care to investigate whether the change is expected.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const snapshot = '<Text>Welcome</Text>';
const output = '<Text>Welcom</Text>';
console.log(output === snapshot ? 'snapshot matches' : 'snapshot differs');`,
    checkMode: 'run',
    expectedStdout: 'snapshot differs',
  },
  // ---- Node 8.2 — E2E: Detox & Appium (5 mcq, 3 code, 2 bug) ----
  {
    id: '8.2-q01',
    nodeId: '8.2-e2e',
    type: 'mcq',
    stem: 'What do end-to-end (E2E) tests verify?',
    options: [
      'The app working as expected on a device or simulator, from the user perspective',
      'Individual functions in isolation in Node.js',
      'Only the JavaScript bundle size',
      'The app store review guidelines',
    ],
    correctIndex: 0,
    explanation: 'E2E tests drive the real app on a device or emulator exactly as a user would — taps, typing, and all.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'In end-to-end (E2E) tests, you verify your app is working as expected on a device (or a simulator / emulator) from the user perspective.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.2-q02',
    nodeId: '8.2-e2e',
    type: 'mcq',
    stem: 'E2E tests are run against a build in which configuration?',
    options: ['release', 'debug', 'Metro dev server only', 'Jest watch mode'],
    correctIndex: 0,
    explanation: 'E2E runs the release build — the same optimised binary users get — never a debug build.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'This is done by building your app in the release configuration and running the tests against it.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.2-q03',
    nodeId: '8.2-e2e',
    type: 'mcq',
    stem: 'Which E2E framework is popular in the React Native community because it is tailored for React Native apps?',
    options: ['Detox', 'Appium', 'Maestro', 'Jest'],
    correctIndex: 0,
    explanation: 'Detox is built for React Native; Appium is the popular general-purpose choice across iOS and Android apps.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'in the React Native community, Detox is a popular framework because it’s tailored for React Native apps. Another popular library in the space of iOS and Android apps is Appium',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.2-q04',
    nodeId: '8.2-e2e',
    type: 'mcq',
    stem: 'What is a "flaky" test?',
    options: [
      'A test that randomly passes and fails with no change to the code',
      'A test that always fails on CI but passes locally',
      'A test with no assertions at all',
      'A test that only runs on one platform',
    ],
    correctIndex: 0,
    explanation: 'Flaky tests pass and fail at random — usually timing or ordering — and they destroy trust in the whole suite.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'they are more prone to flakiness (a "flaky" test is a test which randomly passes and fails without any change to code)',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.2-q05',
    nodeId: '8.2-e2e',
    type: 'mcq',
    stem: 'Which of these is NOT one of the listed tradeoffs of E2E tests?',
    options: [
      'They are slower to run',
      'Writing them is more time consuming',
      'They are more prone to flakiness',
      'They run in Node.js and need no device or simulator',
    ],
    correctIndex: 3,
    explanation: 'E2E tests run on a real device or simulator — they are slower, take longer to write, and flake more, but "no device needed" is false.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'In end-to-end (E2E) tests, you verify your app is working as expected on a device (or a simulator / emulator) from the user perspective.',
    difficulty: 5,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.2-q06',
    nodeId: '8.2-e2e',
    type: 'code',
    stem: 'A mock of Detox-style `element(by.text()).tap()` runs on a Login button. What does it print?',
    options: ['tapped:Login', 'Login', 'visible:Login', 'undefined'],
    correctIndex: 0,
    explanation: 'E2E libraries find an element by its text and drive it like a user — here the mock tap resolves to "tapped:Login".',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'E2E testing libraries allow you to find and control elements in the screen of your app: for example, you can *actually* tap buttons or insert text into `TextInputs` the same way a real user would.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `// MOCK of Detox-style element(by.text()).tap() - tests the LOGIC, not the library.
const by = { text: (t) => ({ kind: 'text', value: t }) };
const element = (m) => ({ tap: () => 'tapped:' + m.value, toBeVisible: () => 'visible:' + m.value });
console.log(element(by.text('Login')).tap());`,
    checkMode: 'run',
    expectedStdout: 'tapped:Login',
  },
  {
    id: '8.2-q07',
    nodeId: '8.2-e2e',
    type: 'code',
    stem: 'A mock of waitFor polling checks for an element up to 5 times, and the element appears on try 3. What does it print?',
    options: ['found after 3 tries', 'timeout', 'found after 5 tries', 'found after 1 tries'],
    correctIndex: 0,
    explanation: 'Good E2E tests wait for an element to appear instead of assuming it is there — polling stops the moment it is found.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'E2E testing libraries allow you to find and control elements in the screen of your app: for example, you can *actually* tap buttons or insert text into `TextInputs` the same way a real user would.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `// MOCK of waitFor polling - tests the LOGIC, not the library.
let visible = false; let attempts = 0;
while (!visible && attempts < 5) { attempts++; if (attempts === 3) visible = true; }
console.log(visible ? 'found after ' + attempts + ' tries' : 'timeout');`,
    checkMode: 'run',
    expectedStdout: 'found after 3 tries',
  },
  {
    id: '8.2-q08',
    nodeId: '8.2-e2e',
    type: 'code',
    stem: 'A flaky-test retry policy doubles the wait before each retry, starting at 100ms. What is the delay before the third attempt?',
    options: ['400', '200', '300', '100'],
    correctIndex: 0,
    explanation: 'Doubling backoff: 100ms, then 200ms, then 400ms — retries give a slow element time to appear instead of failing instantly.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'they are more prone to flakiness (a "flaky" test is a test which randomly passes and fails without any change to code)',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `let delay = 100;
delay *= 2; delay *= 2;
console.log(delay);`,
    checkMode: 'run',
    expectedStdout: '400',
  },
  {
    id: '8.2-q09',
    nodeId: '8.2-e2e',
    type: 'bug',
    stem: 'A test sleeps 100ms then taps a button, but the button only appears after 500ms. The snippet below models the check — it logs `not ready yet`. What is the bug?',
    options: [
      'The test checked readiness before the element appeared — a fixed sleep is racy; wait for the element instead',
      'The button is missing from the app entirely',
      'sleep(100) waits 100 seconds, not 100ms',
      'setTimeout cannot be used in tests',
    ],
    correctIndex: 0,
    explanation: 'Fixed sleeps are a classic flakiness factory: on a slow device the element still is not there. Wait for the element, not the clock.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'they are more prone to flakiness (a "flaky" test is a test which randomly passes and fails without any change to code)',
    difficulty: 5,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `let ready = false;
setTimeout(() => { ready = true; }, 500);
console.log(ready ? 'ready' : 'not ready yet');`,
    checkMode: 'run',
    expectedStdout: 'not ready yet',
  },
  {
    id: '8.2-q10',
    nodeId: '8.2-e2e',
    type: 'bug',
    stem: 'A test taps `buttons[0]` assuming it is the Login button, but after a redesign the first button is Cancel. The snippet logs `Cancel`. What is the bug?',
    options: [
      'The test tapped by position, not by identity — it must find the Login button by its text or label',
      'buttons[0] is always the Login button',
      'The redesign broke the app, not the test',
      'Cancel and Login are the same button',
    ],
    correctIndex: 0,
    explanation: 'A real user taps the button that says Login. Find elements by what they show, never by their index in a list.',
    sourceUrl: 'https://reactnative.dev/docs/testing-overview',
    sourceQuote: 'E2E testing libraries allow you to find and control elements in the screen of your app: for example, you can *actually* tap buttons or insert text into `TextInputs` the same way a real user would.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const buttons = ['Cancel', 'Login'];
console.log(buttons[0]);`,
    checkMode: 'run',
    expectedStdout: 'Cancel',
  },
  // ---- Node 8.3 — Performance: Frame Rates, FlatList Config & Profiling (4 mcq, 4 code, 2 bug) ----
  {
    id: '8.3-q01',
    nodeId: '8.3-performance',
    type: 'mcq',
    stem: 'Why choose React Native over WebView-based tools, in performance terms?',
    options: [
      'To achieve at least 60 frames per second with a native look and feel',
      'To avoid ever writing native code',
      'To make the JS bundle smaller than 1 KB',
      'To run the app without a JS thread',
    ],
    correctIndex: 0,
    explanation: 'Native-backed views at 60fps is the whole point of React Native versus a WebView wrapper.',
    sourceUrl: 'https://reactnative.dev/docs/performance',
    sourceQuote: 'A compelling reason to use React Native instead of WebView-based tools is to achieve at least 60 frames per second and provide a native look and feel to your apps.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.3-q02',
    nodeId: '8.3-performance',
    type: 'mcq',
    stem: 'Why can you still scroll a ScrollView smoothly while the JavaScript thread is locked up?',
    options: [
      'The ScrollView lives on the main thread, so scrolling does not need the JS thread',
      'ScrollView runs on the JS thread but faster',
      'Scrolling pauses the JS thread entirely',
      'The JS thread is never used for touch events',
    ],
    correctIndex: 0,
    explanation: 'Two frame rates exist: JS thread and UI (main) thread. Scrolling is native, so it survives a busy JS thread.',
    sourceUrl: 'https://reactnative.dev/docs/performance',
    sourceQuote: 'you can happily scroll up and down through a `ScrollView` when the JavaScript thread is locked up because the `ScrollView` lives on the main thread.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.3-q03',
    nodeId: '8.3-performance',
    type: 'mcq',
    stem: 'Where should you measure your app\'s performance?',
    options: [
      'In release builds — dev mode slows the JS thread greatly',
      'In dev mode, where warnings are most accurate',
      'Only in the iOS Simulator',
      'Only with console.log statements left in',
    ],
    correctIndex: 0,
    explanation: 'Dev mode does far more runtime work for warnings and errors. Numbers measured there mean nothing — measure release.',
    sourceUrl: 'https://reactnative.dev/docs/performance',
    sourceQuote: 'Always make sure to test performance in release builds.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.3-q04',
    nodeId: '8.3-performance',
    type: 'mcq',
    stem: 'What does setting `useNativeDriver: true` do for the Animated API?',
    options: [
      'It stops calculating each keyframe on the JavaScript thread',
      'It disables all animations',
      'It moves animation work onto the JS thread',
      'It only works for LayoutAnimation',
    ],
    correctIndex: 0,
    explanation: 'Without the native driver, Animated computes every keyframe on the JS thread — a busy thread freezes your animation.',
    sourceUrl: 'https://reactnative.dev/docs/performance',
    sourceQuote: 'The `Animated API` currently calculates each keyframe on-demand on the JavaScript thread unless you set `useNativeDriver: true`',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.3-q05',
    nodeId: '8.3-performance',
    type: 'code',
    stem: 'At 60 frames per second, how many milliseconds does the UI system get to draw one frame?',
    options: ['16.67', '60', '33.33', '100'],
    correctIndex: 0,
    explanation: '1000ms / 60 frames = 16.67ms per frame. Miss that budget and you drop a frame.',
    sourceUrl: 'https://reactnative.dev/docs/performance',
    sourceQuote: 'iOS and Android devices display at least 60 frames per second, which gives you and the UI system at most 16.67ms to do all of the work needed to generate the static image (frame) that the user will see on the screen for that interval.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `console.log((1000 / 60).toFixed(2));`,
    checkMode: 'run',
    expectedStdout: '16.67',
  },
  {
    id: '8.3-q06',
    nodeId: '8.3-performance',
    type: 'code',
    stem: 'A root setState re-render takes 200ms. About how many 60fps frames does it drop?',
    options: ['12', '200', '60', '2'],
    correctIndex: 0,
    explanation: '200ms / 16.67ms per frame is 12 frames — the UI freezes for a fifth of a second while the JS thread re-renders.',
    sourceUrl: 'https://reactnative.dev/docs/performance',
    sourceQuote: "if you were to set a new state on the root component of a complex application and it resulted in re-rendering computationally expensive component subtrees, it's conceivable that this might take 200ms and result in 12 frames being dropped.",
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `console.log(Math.round(200 / (1000 / 60)));`,
    checkMode: 'run',
    expectedStdout: '12',
  },
  {
    id: '8.3-q07',
    nodeId: '8.3-performance',
    type: 'code',
    stem: 'FlatList\'s default windowSize is 21 viewports. How many viewports are rendered ABOVE the visible one?',
    options: ['10', '21', '20', '11'],
    correctIndex: 0,
    explanation: 'windowSize 21 means 10 viewports above, 1 visible, 10 below. Bigger window = fewer blank areas, more memory.',
    sourceUrl: 'https://reactnative.dev/docs/optimizing-flatlist-configuration',
    sourceQuote: 'The number passed here is a measurement unit where 1 is equivalent to your viewport height. The default value is 21 (10 viewports above, 10 below, and one in between).',
    difficulty: 5,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `console.log((21 - 1) / 2);`,
    checkMode: 'run',
    expectedStdout: '10',
  },
  {
    id: '8.3-q08',
    nodeId: '8.3-performance',
    type: 'code',
    stem: 'Which FlatList config type-checks against RN 0.88 for fixed 50pt rows?',
    options: [
      'getItemLayout returning { length: 50, offset: 50 * index, index } with windowSize 5 and maxToRenderPerBatch 10',
      'getItemLayout returning { height: 50 } with no offset',
      'windowSize: "5" as a string',
      'maxToRenderPerBatch: "10" as a string',
    ],
    correctIndex: 0,
    explanation: 'getItemLayout returns { length, offset, index } — handing FlatList the layout skips async measurement of every row.',
    sourceUrl: 'https://reactnative.dev/docs/optimizing-flatlist-configuration',
    sourceQuote: 'If all your list item components have the same height (or width, for a horizontal list), providing the `getItemLayout` prop removes the need for your `FlatList` to manage async layout calculations.',
    difficulty: 5,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `import { FlatList } from 'react-native';
import type { ComponentProps } from 'react';
type Props = ComponentProps<typeof FlatList<number>>;
const props: Props = {
  data: [1, 2, 3],
  renderItem: ({ item }) => null,
  getItemLayout: (_data, index) => ({ length: 50, offset: 50 * index, index }),
  windowSize: 5,
  maxToRenderPerBatch: 10,
  removeClippedSubviews: true,
};
export default props;`,
    checkMode: 'compile',
  },
  {
    id: '8.3-q09',
    nodeId: '8.3-performance',
    type: 'bug',
    stem: 'getItemLayout assumes every row is 50pt tall, but one row is actually 120pt. The snippet computes the offset for index 2 — it is wrong by 70. What is the bug?',
    options: [
      'getItemLayout must only be used when all items share the same height — the fixed 50pt assumption breaks the offset',
      'getItemLayout is only for horizontal lists',
      'The offset should be 50 * 3, not 50 * 2',
      'FlatList ignores getItemLayout entirely',
    ],
    correctIndex: 0,
    explanation: 'getItemLayout is a promise that every row is the same size. Break the promise and scroll positions land in the wrong place.',
    sourceUrl: 'https://reactnative.dev/docs/optimizing-flatlist-configuration',
    sourceQuote: 'If all your list item components have the same height (or width, for a horizontal list), providing the `getItemLayout` prop removes the need for your `FlatList` to manage async layout calculations.',
    difficulty: 5,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const heights = [50, 120, 50];
const assumed = 50 * 2;
const actual = heights[0] + heights[1];
console.log(assumed === actual ? 'offset ok' : 'offset wrong by ' + (actual - assumed));`,
    checkMode: 'run',
    expectedStdout: 'offset wrong by 70',
  },
  {
    id: '8.3-q10',
    nodeId: '8.3-performance',
    type: 'bug',
    stem: 'A FlatList sets initialNumToRender to 3, but 12 rows fill the first screen. The snippet reports 9 rows missing. What is the bug?',
    options: [
      'initialNumToRender is too small to cover the viewport — raise it so the first screen renders fully',
      'initialNumToRender must always be 3',
      'FlatList renders all rows at once regardless',
      'The viewport is 3 rows tall',
    ],
    correctIndex: 0,
    explanation: 'Too few initial rows means the list cannot fill the screen on first paint — the user sees blank space while the rest renders.',
    sourceUrl: 'https://reactnative.dev/docs/optimizing-flatlist-configuration',
    sourceQuote: 'When `VirtualizedList` can\'t render your items fast enough, you may enter a part of your list with non-rendered components that appear as blank space.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const viewportRows = 12;
const initialNumToRender = 3;
console.log(initialNumToRender >= viewportRows ? 'covers screen' : 'blank area: ' + (viewportRows - initialNumToRender) + ' rows missing');`,
    checkMode: 'run',
    expectedStdout: 'blank area: 9 rows missing',
  },
  // ---- Node 8.4 — Publishing: App Store & Play Store (4 mcq, 4 code, 2 bug) ----
  {
    id: '8.4-q01',
    nodeId: '8.4-publishing',
    type: 'mcq',
    stem: 'What must happen before an Android app can be installed on a device?',
    options: [
      'It must be digitally signed with a certificate',
      'It must be uploaded to Google Play first',
      'It must have Proguard enabled',
      'It must be built as an APK, never an AAB',
    ],
    correctIndex: 0,
    explanation: 'Android refuses unsigned apps — signing with a certificate is mandatory, even before any store is involved.',
    sourceUrl: 'https://reactnative.dev/docs/signed-apk-android',
    sourceQuote: 'Android requires that all apps be digitally signed with a certificate before they can be installed.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.4-q02',
    nodeId: '8.4-publishing',
    type: 'mcq',
    stem: 'Which Android version value is shown to users, and which is the internal integer?',
    options: [
      'versionName is shown to users; versionCode is the internal integer',
      'versionCode is shown to users; versionName is internal',
      'Both are shown to users',
      'Neither is ever shown',
    ],
    correctIndex: 0,
    explanation: 'versionName ("1.1") is the human label; versionCode (2) is the monotonic integer Android uses to judge newer vs older.',
    sourceUrl: 'https://developer.android.com/studio/publish/versioning',
    sourceQuote: 'The `versionName` is the only value displayed to users.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.4-q03',
    nodeId: '8.4-publishing',
    type: 'mcq',
    stem: 'Why must an iOS app be built with the Release scheme before App Store distribution?',
    options: [
      'Release builds disable the in-app Dev Menu and bundle the JavaScript locally',
      'Release builds enable the Dev Menu for testers',
      'The Debug scheme cannot run on a device',
      'Xcode only archives Debug builds',
    ],
    correctIndex: 0,
    explanation: 'A Release build locks users out of the Dev Menu and ships the JS bundle inside the app — no Metro needed.',
    sourceUrl: 'https://reactnative.dev/docs/publishing-to-app-store',
    sourceQuote: 'Apps built for `Release` will automatically disable the in-app Dev Menu, which will prevent your users from inadvertently accessing the menu in production.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.4-q04',
    nodeId: '8.4-publishing',
    type: 'mcq',
    stem: 'What does enabling Proguard do for a release build?',
    options: [
      'It strips parts of the React Native Java bytecode your app is not using, slightly reducing APK size',
      'It signs the app with your upload key',
      'It generates the AAB file',
      'It removes all JavaScript from the bundle',
    ],
    correctIndex: 0,
    explanation: 'Proguard shrinks Java bytecode by cutting unused code — but test thoroughly, since each native library may need its own rules.',
    sourceUrl: 'https://reactnative.dev/docs/signed-apk-android',
    sourceQuote: 'Proguard is a tool that can slightly reduce the size of the APK. It does this by stripping parts of the React Native Java bytecode (and its dependencies) that your app is not using.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    checkMode: 'none',
  },
  {
    id: '8.4-q05',
    nodeId: '8.4-publishing',
    type: 'code',
    stem: 'An app has shipped versionCodes 1, 2 and 3. What is the next versionCode?',
    options: ['4', '3', '1', '2'],
    correctIndex: 0,
    explanation: 'versionCode only ever goes up — first release 1, then monotonically increase with every release.',
    sourceUrl: 'https://developer.android.com/studio/publish/versioning',
    sourceQuote: 'Typically, you release the first version of your app with `versionCode` set to 1, then monotonically increase the value with each release',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const released = [1, 2, 3];
const next = released[released.length - 1] + 1;
console.log(next);`,
    checkMode: 'run',
    expectedStdout: '4',
  },
  {
    id: '8.4-q06',
    nodeId: '8.4-publishing',
    type: 'code',
    stem: 'A device has versionCode 5 installed. A user tries to install a build with versionCode 4. What happens?',
    options: ['install allowed', 'install blocked: downgrade', 'install blocked: unsigned', 'versionName mismatch'],
    correctIndex: 1,
    explanation: 'Android uses versionCode to protect against downgrades — a lower code than the installed one cannot install.',
    sourceUrl: 'https://developer.android.com/studio/publish/versioning',
    sourceQuote: 'The Android system uses the `versionCode` value to protect against downgrades by preventing users from installing an APK with a lower `versionCode` than the version currently installed on their device.',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const installed = 5;
const candidate = 4;
console.log(candidate >= installed ? 'install allowed' : 'install blocked: downgrade');`,
    checkMode: 'run',
    expectedStdout: 'install blocked: downgrade',
  },
  {
    id: '8.4-q07',
    nodeId: '8.4-publishing',
    type: 'code',
    stem: 'The docs check for Hermes with `!!global.HermesInternal`. This snippet runs that check on an object that has HermesInternal. What does it print?',
    options: ['Hermes', 'JavaScriptCore', 'HermesInternal', 'undefined'],
    correctIndex: 0,
    explanation: 'Hermes is the default engine in RN — the HermesInternal global is how you prove it is really running.',
    sourceUrl: 'https://reactnative.dev/docs/hermes',
    sourceQuote: 'A `HermesInternal` global variable will be available in JavaScript that can be used to verify that Hermes is in use',
    difficulty: 3,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `// The docs' own Hermes check: !!global.HermesInternal.
const globalObj = { HermesInternal: {} };
const isHermes = () => !!globalObj.HermesInternal;
console.log(isHermes() ? 'Hermes' : 'JavaScriptCore');`,
    checkMode: 'run',
    expectedStdout: 'Hermes',
  },
  {
    id: '8.4-q08',
    nodeId: '8.4-publishing',
    type: 'code',
    stem: 'A build uses versionCode 2,100,000,001. Google Play\'s greatest allowed versionCode is 2,100,000,000. What happens?',
    options: ['rejected: over Play limit', 'allowed', 'accepted with a warning', 'install blocked: downgrade'],
    correctIndex: 0,
    explanation: 'Play caps versionCode at 2,100,000,000 — anything above it is rejected at upload, so leave headroom in your scheme.',
    sourceUrl: 'https://developer.android.com/studio/publish/versioning',
    sourceQuote: 'The greatest value Google Play allows for `versionCode` is 2100000000.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const max = 2100000000;
const next = 2100000001;
console.log(next > max ? 'rejected: over Play limit' : 'allowed');`,
    checkMode: 'run',
    expectedStdout: 'rejected: over Play limit',
  },
  {
    id: '8.4-q09',
    nodeId: '8.4-publishing',
    type: 'bug',
    stem: 'A new build is uploaded with versionCode 2 — but versionCode 2 was already used by a previous release. The snippet logs `rejected: versionCode already used`. What is the bug?',
    options: [
      'Each release needs a greater, never-reused versionCode',
      'versionCode 2 is reserved by Google Play',
      'versionName must change, not versionCode',
      'The AAB file was built in debug mode',
    ],
    correctIndex: 0,
    explanation: 'Play rejects a versionCode you have already used — every upload needs a fresh, higher integer.',
    sourceUrl: 'https://developer.android.com/studio/publish/versioning',
    sourceQuote: 'You can\'t upload an APK to the Play Store with a `versionCode` you have already used for a previous version.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const used = [1, 2, 3];
const upload = 2;
console.log(used.includes(upload) ? 'rejected: versionCode already used' : 'accepted');`,
    checkMode: 'run',
    expectedStdout: 'rejected: versionCode already used',
  },
  {
    id: '8.4-q10',
    nodeId: '8.4-publishing',
    type: 'bug',
    stem: 'Signing passwords were saved in `android/gradle.properties` — a file the project commits to git. The snippet logs that the file is tracked. What is the bug?',
    options: [
      'Put the Gradle variables in ~/.gradle/gradle.properties so they never enter git',
      'Passwords must be stored in the AAB file itself',
      'The keystore file must be committed instead',
      'Gradle variables cannot hold passwords at all',
    ],
    correctIndex: 0,
    explanation: 'Secrets in a tracked file leak to everyone with repo access. The home-directory gradle.properties stays off git.',
    sourceUrl: 'https://reactnative.dev/docs/signed-apk-android',
    sourceQuote: 'Saving the above Gradle variables in `~/.gradle/gradle.properties` instead of `android/gradle.properties` prevents them from being checked in to git.',
    difficulty: 4,
    sdkVersion: 'RN 0.88',
    verified: true,
    status: 'approved',
    codeSnippet: `const inGit = true;
const file = 'android/gradle.properties';
console.log(inGit ? file + ' is tracked: secrets leak' : 'safe');`,
    checkMode: 'run',
    expectedStdout: 'android/gradle.properties is tracked: secrets leak',
  },
];

export const ENEMIES_CH8: NodeEnemy[] = [
  {
    nodeId: '8.1-testing',
    enemyName: 'The Failing Test',
    symbols: ['✗', 'expect', 'toBe'],
    accent: '#ef4444',
  },
  {
    nodeId: '8.2-e2e',
    enemyName: 'The Flaky Test',
    symbols: ['✓✗✓', 'timeout', 'retry'],
    accent: '#f97316',
  },
  {
    nodeId: '8.3-performance',
    enemyName: 'The Dropped Frame',
    symbols: ['16.67ms', '60fps', 'jank'],
    accent: '#22d3ee',
  },
  {
    nodeId: '8.4-publishing',
    enemyName: 'The Rejected Build',
    symbols: ['versionCode', 'signature', 'rejected'],
    accent: '#e8494f',
  },
];
