// TechieMan — React Native roadmap data.
// Node names are taken VERBATIM from roadmap.sh's React Native roadmap
// (uploaded ~/workspace/user/files/react-native.pdf). Chapters/bosses are
// TechieMan's grouping of those nodes (plan §3.2, v1.1). No invented content.

export interface RoadmapNode {
  id: string;
  chapterId: string;
  order: number;
  title: string;
  /** verbatim roadmap.sh area this node comes from */
  sourceArea: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  isSideQuest: boolean;
}

export interface RoadmapChapter {
  id: string;
  order: number;
  title: string;
  sourceArea: string;
  bossName: string;
  bossTagline: string;
}

export const ROADMAP = {
  id: 'react-native',
  slug: 'react-native',
  title: 'React Native',
  accentColor: '#22d3ee', // cyan — RN roadmap accent (plan §5.2)
  sourceUrl: 'https://roadmap.sh/react-native',
  version: 'roadmap.sh 2025-09',
} as const;

export const CHAPTERS: RoadmapChapter[] = [
  {
    id: 'ch1-prerequisites',
    order: 1,
    title: 'Prerequisites',
    sourceArea: 'JavaScript Basics, CSS Basics, React Basics',
    bossName: 'The Undefined Variable',
    bossTagline: '"is not a function"',
  },
  {
    id: 'ch2-setup',
    order: 2,
    title: 'Setup & Workflow',
    sourceArea: 'Introduction, Environment Setup, Development Workflow',
    bossName: 'The Red Screen',
    bossTagline: "Metro won't bundle",
  },
  {
    id: 'ch3-components',
    order: 3,
    title: 'Core Components',
    sourceArea: 'View, Text, Text Input, Button, Image, Switch, ScrollView, ListViews, Touchables',
    bossName: 'The FlatList Phantom',
    bossTagline: 'blank list, no keys',
  },
  {
    id: 'ch4-styling',
    order: 4,
    title: 'Styling & Layout',
    sourceArea: 'Styling, Writing Platform Specific Code',
    bossName: 'The Flexbox Gremlin',
    bossTagline: 'everything is flex: 1 and nothing fits',
  },
  {
    id: 'ch5-interactions',
    order: 5,
    title: 'Interactions & Navigation',
    sourceArea: 'Gesture Handling, Scrolling & Swiping, Screen Navigation, Animations, DeepLinking',
    bossName: 'The Lost Route',
    bossTagline: 'a deep link to nowhere',
  },
  {
    id: 'ch6-networking',
    order: 6,
    title: 'Networking & Data',
    sourceArea: 'Networking, Push Notifications',
    bossName: 'The Retry Storm',
    bossTagline: 'double POSTs, no idempotency key',
  },
  {
    id: 'ch7-storage',
    order: 7,
    title: 'Storage & Security',
    sourceArea: 'Storage, Security',
    bossName: 'The Vanishing Token',
    bossTagline: 'stored in plain text, gone on update',
  },
  {
    id: 'ch8-ship',
    order: 8,
    title: 'Ship It',
    sourceArea: 'Testing, Performance, Publishing Apps',
    bossName: 'The Store Review',
    bossTagline: 'FINAL BOSS — defend your app, ship it',
  },
];

export const NODES: RoadmapNode[] = [
  // Chapter 1 — Prerequisites
  { id: '1.1-js-basics', chapterId: 'ch1-prerequisites', order: 1, title: 'JavaScript Basics', sourceArea: 'Learn the Pre-requisites', difficulty: 1, isSideQuest: false },
  { id: '1.2-css-basics', chapterId: 'ch1-prerequisites', order: 2, title: 'CSS Basics', sourceArea: 'Learn the Pre-requisites', difficulty: 1, isSideQuest: false },
  { id: '1.3-jsx', chapterId: 'ch1-prerequisites', order: 3, title: 'JSX', sourceArea: 'React Basics', difficulty: 2, isSideQuest: false },
  { id: '1.4-components-state-props', chapterId: 'ch1-prerequisites', order: 4, title: 'Components, State & Props', sourceArea: 'React Basics', difficulty: 2, isSideQuest: false },
  // Chapter 2 — Setup & Workflow
  { id: '2.1-what-is-rn', chapterId: 'ch2-setup', order: 1, title: 'What is React Native?', sourceArea: 'Introduction', difficulty: 1, isSideQuest: false },
  { id: '2.2-cli-metro', chapterId: 'ch2-setup', order: 2, title: 'Environment Setup: React Native CLI & Metro Bundler', sourceArea: 'Environment Setup', difficulty: 2, isSideQuest: false },
  { id: '2.3-expo', chapterId: 'ch2-setup', order: 3, title: 'Expo, create-expo-app & Expo Snack', sourceArea: 'Environment Setup', difficulty: 2, isSideQuest: true },
  { id: '2.4-debugging', chapterId: 'ch2-setup', order: 4, title: 'Debugging, Fast Refresh, LogBox & DevTools', sourceArea: 'Development Workflow', difficulty: 2, isSideQuest: false },
  // Chapter 3 — Core Components
  { id: '3.1-view-text-input', chapterId: 'ch3-components', order: 1, title: 'View, Text & Text Input', sourceArea: 'Core Components', difficulty: 1, isSideQuest: false },
  { id: '3.2-buttons-images', chapterId: 'ch3-components', order: 2, title: 'Button, Image & Pressables', sourceArea: 'Core Components', difficulty: 2, isSideQuest: false },
  { id: '3.3-lists', chapterId: 'ch3-components', order: 3, title: 'ScrollView & Lists: FlatList, SectionList, RefreshControl', sourceArea: 'Core Components', difficulty: 3, isSideQuest: false },
  { id: '3.4-modal-status', chapterId: 'ch3-components', order: 4, title: 'Modal, Switch, ActivityIndicator & StatusBar', sourceArea: 'Core Components', difficulty: 2, isSideQuest: false },
  // Chapter 4 — Styling & Layout
  { id: '4.1-stylesheets', chapterId: 'ch4-styling', order: 1, title: 'Stylesheets', sourceArea: 'Styling', difficulty: 2, isSideQuest: false },
  { id: '4.2-flexbox', chapterId: 'ch4-styling', order: 2, title: 'Layouts & Flexbox', sourceArea: 'Styling', difficulty: 3, isSideQuest: false },
  { id: '4.3-platform-code', chapterId: 'ch4-styling', order: 3, title: 'Platform Specific Code: Platform Module, File Extensions, react-native-web', sourceArea: 'Writing Platform Specific Code', difficulty: 3, isSideQuest: false },
  { id: '4.4-accessibility', chapterId: 'ch4-styling', order: 4, title: 'Accessibility', sourceArea: 'Styling', difficulty: 2, isSideQuest: true },
  // Chapter 5 — Interactions & Navigation
  { id: '5.1-gestures', chapterId: 'ch5-interactions', order: 1, title: 'Gesture Handling', sourceArea: 'Interactions', difficulty: 3, isSideQuest: false },
  { id: '5.2-navigation', chapterId: 'ch5-interactions', order: 2, title: 'Screen Navigation', sourceArea: 'Interactions', difficulty: 3, isSideQuest: false },
  { id: '5.3-animations', chapterId: 'ch5-interactions', order: 3, title: 'Animations', sourceArea: 'Interactions', difficulty: 3, isSideQuest: false },
  { id: '5.4-deeplinking', chapterId: 'ch5-interactions', order: 4, title: 'DeepLinking', sourceArea: 'Interactions', difficulty: 4, isSideQuest: false },
  // Chapter 6 — Networking & Data
  { id: '6.1-fetch', chapterId: 'ch6-networking', order: 1, title: 'Fetch & REST', sourceArea: 'Networking', difficulty: 3, isSideQuest: false },
  { id: '6.2-websockets', chapterId: 'ch6-networking', order: 2, title: 'WebSockets', sourceArea: 'Networking', difficulty: 4, isSideQuest: false },
  { id: '6.3-auth', chapterId: 'ch6-networking', order: 3, title: 'Authentication', sourceArea: 'Networking', difficulty: 3, isSideQuest: false },
  { id: '6.4-push-connectivity', chapterId: 'ch6-networking', order: 4, title: 'Push Notifications & Connectivity Status', sourceArea: 'Networking', difficulty: 3, isSideQuest: false },
  // Chapter 7 — Storage & Security
  { id: '7.1-async-storage', chapterId: 'ch7-storage', order: 1, title: 'react-native-async-storage', sourceArea: 'Storage', difficulty: 2, isSideQuest: false },
  { id: '7.2-secure-file', chapterId: 'ch7-storage', order: 2, title: 'expo-secure-store & expo-file-system', sourceArea: 'Storage', difficulty: 3, isSideQuest: false },
  { id: '7.3-sqlite', chapterId: 'ch7-storage', order: 3, title: 'expo-sqlite', sourceArea: 'Storage', difficulty: 3, isSideQuest: false },
  { id: '7.4-security', chapterId: 'ch7-storage', order: 4, title: 'Security', sourceArea: 'Security', difficulty: 3, isSideQuest: false },
  // Chapter 8 — Ship It
  { id: '8.1-testing', chapterId: 'ch8-ship', order: 1, title: 'Testing: Jest & React Native Testing Library', sourceArea: 'Testing', difficulty: 3, isSideQuest: false },
  { id: '8.2-e2e', chapterId: 'ch8-ship', order: 2, title: 'E2E: Detox & Appium', sourceArea: 'Testing', difficulty: 4, isSideQuest: false },
  { id: '8.3-performance', chapterId: 'ch8-ship', order: 3, title: 'Performance: Frame Rates, FlatList Config & Profiling', sourceArea: 'Performance', difficulty: 4, isSideQuest: false },
  { id: '8.4-publishing', chapterId: 'ch8-ship', order: 4, title: 'Publishing: App Store & Play Store', sourceArea: 'Publishing Apps', difficulty: 3, isSideQuest: false },
];

export function nodesForChapter(chapterId: string): RoadmapNode[] {
  return NODES.filter(n => n.chapterId === chapterId).sort((a, b) => a.order - b.order);
}

/** Chapter 1 starter questions — hand-authored, real RN knowledge (plan §7.4 step 3 starts here). */
export interface StarterQuestion {
  nodeId: string;
  stem: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  sourceUrl: string;
}

export const CHAPTER_1_QUESTIONS: StarterQuestion[] = [
  {
    nodeId: '1.1-js-basics',
    stem: 'What does `typeof null` return in JavaScript?',
    options: ['"null"', '"object"', '"undefined"', '"void"'],
    correctIndex: 1,
    explanation: '`typeof null` is "object" — a famous language quirk from the first JS implementation.',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof',
  },
  {
    nodeId: '1.1-js-basics',
    stem: 'What does `[1, 2, 3].map(n => n * 2)` return?',
    options: ['[2, 4, 6]', '[1, 2, 3]', '6', 'undefined'],
    correctIndex: 0,
    explanation: '`map` returns a NEW array with the function applied to every element; the original is untouched.',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map',
  },
  {
    nodeId: '1.3-jsx',
    stem: 'In JSX, how do you render a variable called `name` inside text?',
    options: ['{name}', '{{name}}', '$name', '<name />'],
    correctIndex: 0,
    explanation: 'Curly braces embed a JS expression in JSX: `<Text>Hello, {name}</Text>`.',
    sourceUrl: 'https://reactnative.dev/docs/intro-react#jsx',
  },
  {
    nodeId: '1.4-components-state-props',
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
  },
  {
    nodeId: '1.4-components-state-props',
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
  },
];
