// TechieMan — enemy designs: the villain is the language itself.
// Every opponent is a living stick-creature built from its own subject's
// symbols (user correction, 2026-11-26 00:45 IST — the generic cyan "?"
// Goblin is DELETED). E.g. the JavaScript boss is a creature of
// `undefined`, `{}`, `;`, `===`; the React Native boss of `<View>`,
// `{...props}`, hooks. The 8 boss names are FIXED (plan §3.2); each boss is
// its chapter's concepts personified, and the enemy HP bar names the
// language/concept (see `language`).
//
// NOTE (collision, 2026-11-26): this file REPLACES the M6 aggregator that
// lived here (NodeEnemy {nodeId, enemyName, symbols, accent} + ENEMIES_CHn
// imports). That aggregator imported ENEMIES_CH3/CH6/CH7/CH8 from modules
// that do not exist yet and nothing imported it; its per-chapter arrays
// still live in questions-ch2.ts / questions-ch4.ts / questions-ch5.ts.
// This file is the fight-canvas contract: EnemyDesign with positioned
// glyphs (x/y/size/rot), bodyKind, attackGlyph and bosses included.
// Glyph rule: every char is ASCII printable and <=10 chars, so the
// bundled JetBrains Mono Bold covers it (verified with fontTools);
// the M6 symbols used non-ASCII arrows/✓ and >10-char tokens, which the
// canvas font cannot render.
//
// Pure TypeScript, zero React Native imports — safe to import in Jest.
// `layoutEnemyGlyphs` is the headless reference implementation of the
// canvas's per-frame glyph math (src/components/FightCanvas.tsx mirrors
// the same formula in its derived values); the frame-budget test measures
// it. It carries a 'worklet' directive so the canvas may also call it
// from a Reanimated derived value on the UI thread.
//
// BOSS ACCENT PALETTE — one distinct neon per boss (never the player's
// crimson #e8494f, never reused across bosses):
//   boss-1 The Undefined Variable  #a78bfa violet
//   boss-2 The Red Screen          #ff3355 signal red
//   boss-3 The FlatList Phantom    #22d3ee cyan (RN accent)
//   boss-4 The Flexbox Gremlin     #f59e0b amber
//   boss-5 The Lost Route          #4ade80 green
//   boss-6 The Retry Storm         #f97316 orange
//   boss-7 The Vanishing Token     #e879f9 fuchsia
//   boss-8 FINAL BOSS: The Store Review #f5c542 gold
// Node enemies reuse neons from the same family but stay distinct from
// their chapter boss where the subject overlaps.

export type EnemyBodyKind = 'wisp' | 'brute' | 'serpent' | 'swarm' | 'tower';

/** One glyph of the creature, in creature-local coords (centre 0,0). */
export interface EnemyGlyph {
  /** ASCII printable, 1–10 chars (monospace font coverage — see above). */
  char: string;
  /** creature-local x, roughly -40..40 */
  x: number;
  /** creature-local y, roughly -40..40 */
  y: number;
  /** font size in px at render time (bucketed to 16/24/32 by the canvas) */
  size: number;
  /** base tilt in degrees (canvas: baked into the diamond fallback only —
   * Skia <Text> has no per-glyph rotation; the live glyphs bob instead) */
  rot: number;
}

export interface EnemyDesign {
  /** node id (e.g. '1.1-js-basics') or 'boss-<chapter>' */
  id: string;
  /** short, concept-true name from the subject — no invented APIs */
  name: string;
  /** language/concept the HP bar names, e.g. 'JavaScript', 'React Native' */
  language: string;
  /** one bottom-pill line, plain words (style bible §5: one idea per line) */
  tagline: string;
  /** neon accent hex for this enemy's glyphs + particles */
  accent: string;
  /** 2–4 glyphs for nodes, 5–8 for bosses */
  glyphs: EnemyGlyph[];
  bodyKind: EnemyBodyKind;
  /** the token the enemy "throws" when it strikes — its most iconic symbol */
  attackGlyph: string;
  boss: boolean;
  chapter: number;
}

/** Glyph layout pose — mirrors the canvas's enemyPose prop. */
export type EnemyLayoutPose = 'idle' | 'hurt' | 'ko';

/** One laid-out glyph: absolute creature-local position for one frame. */
export interface LaidOutGlyph {
  char: string;
  x: number;
  y: number;
  rot: number;
  opacity: number;
  size: number;
}

/**
 * Lays out an enemy's glyphs for one frame (tMs = clock ms).
 * idle: glyphs bob/rotate gently, phase-shifted per glyph.
 * hurt: recoil — glyphs scatter outward and tilt.
 * ko: glyphs fall to the floor (y = 36) and fade.
 * Pure + worklet-safe: only Math + the enemy data.
 */
export function layoutEnemyGlyphs(
  enemy: EnemyDesign,
  tMs: number,
  pose: EnemyLayoutPose,
): LaidOutGlyph[] {
  'worklet';
  const n = enemy.glyphs.length;
  const out: LaidOutGlyph[] = [];
  for (let i = 0; i < n; i++) {
    const g = enemy.glyphs[i];
    if (pose === 'ko') {
      out.push({
        char: g.char,
        x: g.x + (i - (n - 1) / 2) * 10,
        y: 36,
        rot: (i % 2 === 0 ? 70 : -70) + g.rot,
        opacity: 0.25,
        size: g.size,
      });
    } else if (pose === 'hurt') {
      const dir = i % 2 === 0 ? -1 : 1;
      out.push({
        char: g.char,
        x: g.x + dir * (8 + i * 3),
        y: g.y - 6,
        rot: g.rot + dir * 12,
        opacity: 0.9,
        size: g.size,
      });
    } else {
      out.push({
        char: g.char,
        x: g.x + Math.sin(tMs / 450 + i * 1.1) * 3,
        y: g.y + Math.sin(tMs / 450 + i * 1.1 + 0.6) * 3,
        rot: g.rot + Math.sin(tMs / 700 + i) * 4,
        opacity: 1,
        size: g.size,
      });
    }
  }
  return out;
}

/** Node enemy lookup by roadmap node id. */
export function enemyForNode(nodeId: string): EnemyDesign | undefined {
  return NODE_ENEMIES.find(e => e.id === nodeId);
}

/** Boss lookup by chapter number (1–8). */
export function bossForChapter(chapter: number): EnemyDesign | undefined {
  return BOSS_ENEMIES.find(e => e.chapter === chapter);
}

// ---------------------------------------------------------------------------
// Chapter 1 — Prerequisites (JavaScript / CSS / JSX / React)
// ---------------------------------------------------------------------------

const CH1: EnemyDesign[] = [
  {
    id: '1.1-js-basics',
    name: 'The Loose Variable',
    language: 'JavaScript',
    tagline: 'var leaks, let holds, const locks',
    accent: '#f5c542',
    glyphs: [
      { char: 'let', x: -24, y: -14, size: 24, rot: -6 },
      { char: 'const', x: 22, y: -18, size: 20, rot: 5 },
      { char: '=>', x: 0, y: 14, size: 28, rot: 0 },
      { char: '===', x: 0, y: 32, size: 20, rot: 0 },
    ],
    bodyKind: 'wisp',
    attackGlyph: 'undefined',
    boss: false,
    chapter: 1,
  },
  {
    id: '1.2-css-basics',
    name: 'The Unstyled Box',
    language: 'CSS',
    tagline: 'no cascade here, style it yourself',
    accent: '#38bdf8',
    glyphs: [
      { char: '{', x: -26, y: -10, size: 32, rot: -4 },
      { char: '}', x: 26, y: -10, size: 32, rot: 4 },
      { char: 'px', x: 0, y: 14, size: 24, rot: 0 },
      { char: ':', x: 0, y: -30, size: 28, rot: 0 },
    ],
    bodyKind: 'tower',
    attackGlyph: 'margin',
    boss: false,
    chapter: 1,
  },
  {
    id: '1.3-jsx',
    name: 'The Curly Brace',
    language: 'JSX',
    tagline: 'braces open, JavaScript walks in',
    accent: '#22d3ee',
    glyphs: [
      { char: '<', x: -28, y: -8, size: 32, rot: -4 },
      { char: '{', x: -8, y: -26, size: 24, rot: 0 },
      { char: '}', x: 10, y: -26, size: 24, rot: 0 },
      { char: '/>', x: 24, y: 10, size: 28, rot: 4 },
    ],
    bodyKind: 'wisp',
    attackGlyph: '{name}',
    boss: false,
    chapter: 1,
  },
  {
    id: '1.4-components-state-props',
    name: 'The Rerender',
    language: 'React',
    tagline: 'props flow down, state lives inside',
    accent: '#61dafb',
    glyphs: [
      { char: 'props', x: -22, y: -16, size: 20, rot: -5 },
      { char: 'state', x: 22, y: -16, size: 20, rot: 5 },
      { char: '=>', x: 0, y: 10, size: 28, rot: 0 },
      { char: '{...}', x: 0, y: 32, size: 18, rot: 0 },
    ],
    bodyKind: 'swarm',
    attackGlyph: 'setState',
    boss: false,
    chapter: 1,
  },
];

// ---------------------------------------------------------------------------
// Chapter 2 — Setup & Workflow (React Native / Metro / Expo)
// ---------------------------------------------------------------------------

const CH2: EnemyDesign[] = [
  {
    id: '2.1-what-is-rn',
    name: 'The Two Threads',
    language: 'React Native',
    tagline: 'JavaScript on one side, native on the other',
    accent: '#22d3ee',
    glyphs: [
      { char: '<View>', x: -22, y: -14, size: 20, rot: -4 },
      { char: 'JS', x: 20, y: -20, size: 22, rot: 6 },
      { char: 'UI', x: 0, y: 14, size: 24, rot: 0 },
      { char: '=>', x: -2, y: 32, size: 18, rot: 0 },
    ],
    bodyKind: 'tower',
    attackGlyph: '<View>',
    boss: false,
    chapter: 2,
  },
  {
    id: '2.2-cli-metro',
    name: 'The Bundler',
    language: 'Metro',
    tagline: 'one bundle to rule the reload',
    accent: '#f59e0b',
    glyphs: [
      { char: 'metro', x: -20, y: -20, size: 20, rot: -5 },
      { char: 'npx', x: 22, y: -8, size: 22, rot: 5 },
      { char: 'bundle', x: 0, y: 16, size: 18, rot: 0 },
      { char: '...', x: 0, y: 34, size: 20, rot: 0 },
    ],
    bodyKind: 'brute',
    attackGlyph: 'ERROR',
    boss: false,
    chapter: 2,
  },
  {
    id: '2.3-expo',
    name: 'The Snack Wrapper',
    language: 'Expo',
    tagline: 'managed, until it is not',
    accent: '#c084fc',
    glyphs: [
      { char: 'expo', x: -22, y: -14, size: 22, rot: -5 },
      { char: 'snack', x: 20, y: 10, size: 20, rot: 5 },
      { char: 'SDK', x: 0, y: 28, size: 20, rot: 0 },
      { char: 'go', x: -2, y: -32, size: 18, rot: 0 },
    ],
    bodyKind: 'wisp',
    attackGlyph: 'expo',
    boss: false,
    chapter: 2,
  },
  {
    id: '2.4-debugging',
    name: 'The LogBox',
    language: 'React Native',
    tagline: 'red box, calm hands',
    accent: '#ef4444',
    glyphs: [
      { char: 'log', x: -24, y: -12, size: 22, rot: -5 },
      { char: 'warn', x: 20, y: -18, size: 18, rot: 5 },
      { char: '!!!', x: 0, y: 12, size: 28, rot: 0 },
      { char: '...', x: 0, y: 32, size: 18, rot: 0 },
    ],
    bodyKind: 'swarm',
    attackGlyph: '!!!',
    boss: false,
    chapter: 2,
  },
];

// ---------------------------------------------------------------------------
// Chapter 3 — Core Components (React Native)
// ---------------------------------------------------------------------------

const CH3: EnemyDesign[] = [
  {
    id: '3.1-view-text-input',
    name: 'The Empty View',
    language: 'React Native',
    tagline: 'a box with nothing in it yet',
    accent: '#22d3ee',
    glyphs: [
      { char: '<View>', x: -22, y: -16, size: 20, rot: -4 },
      { char: '<Text>', x: 20, y: 12, size: 18, rot: 4 },
      { char: 'input', x: 0, y: 30, size: 16, rot: 0 },
    ],
    bodyKind: 'tower',
    attackGlyph: '<View>',
    boss: false,
    chapter: 3,
  },
  {
    id: '3.2-buttons-images',
    name: 'The Unpressed Button',
    language: 'React Native',
    tagline: 'press me, I dare you',
    accent: '#f97316',
    glyphs: [
      { char: 'onPress', x: -24, y: -16, size: 18, rot: -5 },
      { char: '<Image>', x: 20, y: -18, size: 18, rot: 5 },
      { char: 'press', x: 0, y: 12, size: 20, rot: 0 },
      { char: 'uri', x: 0, y: 32, size: 18, rot: 0 },
    ],
    bodyKind: 'brute',
    attackGlyph: 'onPress',
    boss: false,
    chapter: 3,
  },
  {
    id: '3.3-lists',
    name: 'The Keyless Row',
    language: 'React Native',
    tagline: 'same row, no key, blank list',
    accent: '#4ade80',
    glyphs: [
      { char: 'FlatList', x: 0, y: -28, size: 20, rot: 0 },
      { char: 'key', x: -26, y: 8, size: 22, rot: -6 },
      { char: 'data', x: 22, y: 14, size: 18, rot: 6 },
      { char: '[]', x: 0, y: 32, size: 24, rot: 0 },
    ],
    bodyKind: 'serpent',
    attackGlyph: 'key',
    boss: false,
    chapter: 3,
  },
  {
    id: '3.4-modal-status',
    name: 'The Stuck Modal',
    language: 'React Native',
    tagline: 'open, but never closes',
    accent: '#e879f9',
    glyphs: [
      { char: 'Modal', x: -22, y: -16, size: 20, rot: -5 },
      { char: 'Switch', x: 20, y: 12, size: 18, rot: 5 },
      { char: 'on/off', x: 0, y: -32, size: 16, rot: 0 },
      { char: '...', x: 0, y: 30, size: 20, rot: 0 },
    ],
    bodyKind: 'tower',
    attackGlyph: 'Modal',
    boss: false,
    chapter: 3,
  },
];

// ---------------------------------------------------------------------------
// Chapter 4 — Styling & Layout (React Native / Flexbox)
// ---------------------------------------------------------------------------

const CH4: EnemyDesign[] = [
  {
    id: '4.1-stylesheets',
    name: 'The Style Object',
    language: 'React Native',
    tagline: 'camelCase or nothing',
    accent: '#38bdf8',
    glyphs: [
      { char: 'style', x: -20, y: -16, size: 20, rot: -5 },
      { char: '{{', x: 24, y: -20, size: 24, rot: 5 },
      { char: '}}', x: 24, y: 10, size: 24, rot: -5 },
      { char: 'flex', x: -20, y: 16, size: 20, rot: 0 },
    ],
    bodyKind: 'wisp',
    attackGlyph: 'style',
    boss: false,
    chapter: 4,
  },
  {
    id: '4.2-flexbox',
    name: 'The Flex Child',
    language: 'Flexbox',
    tagline: 'flex one, and nothing fits',
    accent: '#f59e0b',
    glyphs: [
      { char: 'flex:1', x: -22, y: -14, size: 20, rot: -5 },
      { char: 'row', x: 22, y: -18, size: 20, rot: 5 },
      { char: 'column', x: 0, y: 12, size: 18, rot: 0 },
      { char: 'wrap', x: 0, y: 32, size: 18, rot: 0 },
    ],
    bodyKind: 'brute',
    attackGlyph: 'flex:1',
    boss: false,
    chapter: 4,
  },
  {
    id: '4.3-platform-code',
    name: 'The Wrong Platform',
    language: 'React Native',
    tagline: 'iOS code on Android, Android on web',
    accent: '#4ade80',
    glyphs: [
      { char: 'Platform', x: 0, y: -30, size: 16, rot: 0 },
      { char: 'iOS', x: -26, y: 4, size: 20, rot: -6 },
      { char: 'android', x: 24, y: 10, size: 18, rot: 6 },
      { char: 'web', x: 0, y: 32, size: 18, rot: 0 },
    ],
    bodyKind: 'swarm',
    attackGlyph: 'Platform',
    boss: false,
    chapter: 4,
  },
  {
    id: '4.4-accessibility',
    name: 'The Silent Label',
    language: 'React Native',
    tagline: 'no label, no voice, no way in',
    accent: '#f5c542',
    glyphs: [
      { char: 'a11y', x: -22, y: -14, size: 22, rot: -5 },
      { char: 'label', x: 22, y: -6, size: 18, rot: 5 },
      { char: 'role', x: 0, y: 16, size: 20, rot: 0 },
      { char: 'hint', x: 0, y: 34, size: 16, rot: 0 },
    ],
    bodyKind: 'wisp',
    attackGlyph: 'a11y',
    boss: false,
    chapter: 4,
  },
];

// ---------------------------------------------------------------------------
// Chapter 5 — Interactions & Navigation
// ---------------------------------------------------------------------------

const CH5: EnemyDesign[] = [
  {
    id: '5.1-gestures',
    name: 'The Missed Swipe',
    language: 'Gesture Handler',
    tagline: 'you swiped, it shrugged',
    accent: '#22d3ee',
    glyphs: [
      { char: 'swipe', x: -20, y: -16, size: 20, rot: -5 },
      { char: 'tap', x: 22, y: 10, size: 20, rot: 5 },
      { char: 'pan', x: 0, y: 30, size: 20, rot: 0 },
      { char: '=>', x: 0, y: -30, size: 22, rot: 0 },
    ],
    bodyKind: 'serpent',
    attackGlyph: 'swipe',
    boss: false,
    chapter: 5,
  },
  {
    id: '5.2-navigation',
    name: 'The Unmounted Screen',
    language: 'React Navigation',
    tagline: 'go back, and it is gone',
    accent: '#a78bfa',
    glyphs: [
      { char: 'navigate', x: 0, y: -28, size: 18, rot: 0 },
      { char: 'goBack', x: -24, y: 10, size: 18, rot: -5 },
      { char: 'route', x: 22, y: 14, size: 18, rot: 5 },
      { char: 'stack', x: 0, y: 32, size: 18, rot: 0 },
    ],
    bodyKind: 'serpent',
    attackGlyph: 'navigate',
    boss: false,
    chapter: 5,
  },
  {
    id: '5.3-animations',
    name: 'The Dropped Frame',
    language: 'Reanimated',
    tagline: 'sixty frames, fifty-nine lost',
    accent: '#f97316',
    glyphs: [
      { char: 'spring', x: -20, y: -16, size: 18, rot: -5 },
      { char: 'timing', x: 20, y: 12, size: 18, rot: 5 },
      { char: '60fps', x: 0, y: 30, size: 18, rot: 0 },
      { char: 'worklet', x: 0, y: -30, size: 16, rot: 0 },
    ],
    bodyKind: 'wisp',
    attackGlyph: 'spring',
    boss: false,
    chapter: 5,
  },
  {
    id: '5.4-deeplinking',
    name: 'The Dead Link',
    language: 'DeepLinking',
    tagline: 'a link to nowhere at all',
    accent: '#e879f9',
    glyphs: [
      { char: 'myapp://', x: 0, y: -26, size: 18, rot: 0 },
      { char: '://', x: -26, y: 10, size: 22, rot: -6 },
      { char: '404', x: 22, y: 12, size: 20, rot: 6 },
      { char: 'link', x: 0, y: 32, size: 18, rot: 0 },
    ],
    bodyKind: 'serpent',
    attackGlyph: 'myapp://',
    boss: false,
    chapter: 5,
  },
];

// ---------------------------------------------------------------------------
// Chapter 6 — Networking & Data
// ---------------------------------------------------------------------------

const CH6: EnemyDesign[] = [
  {
    id: '6.1-fetch',
    name: 'The Unawaited Promise',
    language: 'JavaScript',
    tagline: 'a Promise, not the data',
    accent: '#38bdf8',
    glyphs: [
      { char: 'fetch', x: -22, y: -14, size: 20, rot: -5 },
      { char: 'await', x: 20, y: 10, size: 18, rot: 5 },
      { char: 'Promise', x: 0, y: 28, size: 16, rot: 0 },
      { char: '.then', x: 0, y: -30, size: 18, rot: 0 },
    ],
    bodyKind: 'swarm',
    attackGlyph: 'fetch',
    boss: false,
    chapter: 6,
  },
  {
    id: '6.2-websockets',
    name: 'The Dropped Socket',
    language: 'WebSocket',
    tagline: 'open, message, gone',
    accent: '#4ade80',
    glyphs: [
      { char: 'socket', x: -20, y: -16, size: 18, rot: -5 },
      { char: 'onmessage', x: 0, y: -30, size: 14, rot: 0 },
      { char: 'send', x: 22, y: 12, size: 18, rot: 5 },
      { char: 'close', x: 0, y: 30, size: 18, rot: 0 },
    ],
    bodyKind: 'serpent',
    attackGlyph: 'socket',
    boss: false,
    chapter: 6,
  },
  {
    id: '6.3-auth',
    name: 'The Expired Session',
    language: 'Authentication',
    tagline: 'logged in yesterday, stranger today',
    accent: '#f5c542',
    glyphs: [
      { char: 'token', x: -22, y: -14, size: 20, rot: -5 },
      { char: '401', x: 22, y: -18, size: 20, rot: 5 },
      { char: 'login', x: 0, y: 10, size: 20, rot: 0 },
      { char: 'jwt', x: 0, y: 32, size: 18, rot: 0 },
    ],
    bodyKind: 'wisp',
    attackGlyph: '401',
    boss: false,
    chapter: 6,
  },
  {
    id: '6.4-push-connectivity',
    name: 'The Silent Push',
    language: 'Push Notifications',
    tagline: 'sent, never seen, never tapped',
    accent: '#ef4444',
    glyphs: [
      { char: 'push', x: -22, y: -14, size: 20, rot: -5 },
      { char: 'badge', x: 20, y: 8, size: 18, rot: 5 },
      { char: 'offline', x: 0, y: 28, size: 16, rot: 0 },
      { char: '...', x: 0, y: -30, size: 20, rot: 0 },
    ],
    bodyKind: 'swarm',
    attackGlyph: 'push',
    boss: false,
    chapter: 6,
  },
];

// ---------------------------------------------------------------------------
// Chapter 7 — Storage & Security
// ---------------------------------------------------------------------------

const CH7: EnemyDesign[] = [
  {
    id: '7.1-async-storage',
    name: 'The Lost Key',
    language: 'AsyncStorage',
    tagline: 'set it, get null',
    accent: '#f59e0b',
    glyphs: [
      { char: 'setItem', x: -20, y: -16, size: 18, rot: -5 },
      { char: 'getItem', x: 20, y: 10, size: 18, rot: 5 },
      { char: 'null', x: 0, y: 30, size: 20, rot: 0 },
      { char: '@key', x: 0, y: -30, size: 18, rot: 0 },
    ],
    bodyKind: 'wisp',
    attackGlyph: 'null',
    boss: false,
    chapter: 7,
  },
  {
    id: '7.2-secure-file',
    name: 'The Plaintext Secret',
    language: 'Expo SecureStore',
    tagline: 'secure in the name only',
    accent: '#a78bfa',
    glyphs: [
      { char: 'secret', x: -20, y: -16, size: 18, rot: -5 },
      { char: 'store', x: 20, y: 8, size: 18, rot: 5 },
      { char: 'file', x: 0, y: 28, size: 20, rot: 0 },
      { char: '***', x: 0, y: -30, size: 22, rot: 0 },
    ],
    bodyKind: 'tower',
    attackGlyph: 'secret',
    boss: false,
    chapter: 7,
  },
  {
    id: '7.3-sqlite',
    name: 'The Locked Table',
    language: 'SQLite',
    tagline: 'one writer, everyone waits',
    accent: '#38bdf8',
    glyphs: [
      { char: 'SELECT', x: -22, y: -16, size: 16, rot: -5 },
      { char: 'INSERT', x: 20, y: 8, size: 16, rot: 5 },
      { char: 'table', x: 0, y: 28, size: 18, rot: 0 },
      { char: '*', x: 0, y: -30, size: 24, rot: 0 },
    ],
    bodyKind: 'brute',
    attackGlyph: 'SELECT',
    boss: false,
    chapter: 7,
  },
  {
    id: '7.4-security',
    name: 'The Leaked Key',
    language: 'App Security',
    tagline: 'hardcoded, shipped, stolen',
    accent: '#ef4444',
    glyphs: [
      { char: 'API_KEY', x: -20, y: -16, size: 16, rot: -5 },
      { char: 'https', x: 20, y: 10, size: 18, rot: 5 },
      { char: 'hash', x: 0, y: 30, size: 20, rot: 0 },
      { char: '!!!', x: 0, y: -30, size: 22, rot: 0 },
    ],
    bodyKind: 'brute',
    attackGlyph: 'API_KEY',
    boss: false,
    chapter: 7,
  },
];

// ---------------------------------------------------------------------------
// Chapter 8 — Ship It (Testing / Performance / Publishing)
// ---------------------------------------------------------------------------

const CH8: EnemyDesign[] = [
  {
    id: '8.1-testing',
    name: 'The Flaky Test',
    language: 'Jest',
    tagline: 'green alone, red together',
    accent: '#4ade80',
    glyphs: [
      { char: 'expect', x: -20, y: -16, size: 18, rot: -5 },
      { char: 'test()', x: 20, y: 10, size: 18, rot: 5 },
      { char: 'mock', x: 0, y: 30, size: 20, rot: 0 },
      { char: 'FAIL', x: 0, y: -30, size: 20, rot: 0 },
    ],
    bodyKind: 'swarm',
    attackGlyph: 'FAIL',
    boss: false,
    chapter: 8,
  },
  {
    id: '8.2-e2e',
    name: 'The Flaky Device',
    language: 'Detox',
    tagline: 'works on my emulator',
    accent: '#f97316',
    glyphs: [
      { char: 'detox', x: -20, y: -16, size: 18, rot: -5 },
      { char: 'tap', x: 22, y: 8, size: 20, rot: 5 },
      { char: 'waitFor', x: 0, y: 28, size: 16, rot: 0 },
      { char: 'e2e', x: 0, y: -30, size: 20, rot: 0 },
    ],
    bodyKind: 'brute',
    attackGlyph: 'detox',
    boss: false,
    chapter: 8,
  },
  {
    id: '8.3-performance',
    name: 'The Janky Frame',
    language: 'React Native',
    tagline: 'sixteen milliseconds, gone',
    accent: '#f59e0b',
    glyphs: [
      { char: '16.6ms', x: -20, y: -16, size: 16, rot: -5 },
      { char: 'fps', x: 22, y: -18, size: 20, rot: 5 },
      { char: 'memo', x: 0, y: 10, size: 20, rot: 0 },
      { char: 'lag', x: 0, y: 32, size: 18, rot: 0 },
    ],
    bodyKind: 'serpent',
    attackGlyph: '16.6ms',
    boss: false,
    chapter: 8,
  },
  {
    id: '8.4-publishing',
    name: 'The Rejected Build',
    language: 'App Store',
    tagline: 'guideline four point three',
    accent: '#22d3ee',
    glyphs: [
      { char: 'review', x: -20, y: -16, size: 18, rot: -5 },
      { char: '4.3', x: 22, y: -14, size: 20, rot: 5 },
      { char: 'build', x: 0, y: 10, size: 20, rot: 0 },
      { char: 'ship', x: 0, y: 32, size: 18, rot: 0 },
    ],
    bodyKind: 'tower',
    attackGlyph: 'review',
    boss: false,
    chapter: 8,
  },
];

/** All 32 node enemies, in roadmap order. */
export const NODE_ENEMIES: EnemyDesign[] = [
  ...CH1,
  ...CH2,
  ...CH3,
  ...CH4,
  ...CH5,
  ...CH6,
  ...CH7,
  ...CH8,
];

// ---------------------------------------------------------------------------
// Bosses — fixed names (plan §3.2), each a fusion of its chapter's concepts.
// ---------------------------------------------------------------------------

export const BOSS_ENEMIES: EnemyDesign[] = [
  {
    id: 'boss-1',
    name: 'The Undefined Variable',
    language: 'JavaScript',
    tagline: 'is not a function',
    accent: '#a78bfa',
    glyphs: [
      { char: 'undefined', x: 0, y: -30, size: 20, rot: 0 },
      { char: '{}', x: -28, y: -6, size: 24, rot: -6 },
      { char: ';', x: 26, y: -10, size: 28, rot: 6 },
      { char: '===', x: 0, y: 6, size: 22, rot: 0 },
      { char: 'NaN', x: -22, y: 24, size: 20, rot: -5 },
      { char: 'null', x: 24, y: 26, size: 18, rot: 5 },
    ],
    bodyKind: 'swarm',
    attackGlyph: 'undefined',
    boss: true,
    chapter: 1,
  },
  {
    id: 'boss-2',
    name: 'The Red Screen',
    language: 'Metro',
    tagline: "Metro won't bundle",
    accent: '#ff3355',
    glyphs: [
      { char: 'ERROR', x: 0, y: -30, size: 20, rot: 0 },
      { char: 'metro', x: -26, y: -8, size: 18, rot: -6 },
      { char: 'red', x: 24, y: 4, size: 22, rot: 6 },
      { char: '!!!', x: 0, y: 14, size: 26, rot: 0 },
      { char: 'bundle', x: 0, y: 32, size: 16, rot: 0 },
      { char: 'stack', x: -24, y: 26, size: 16, rot: -5 },
    ],
    bodyKind: 'tower',
    attackGlyph: 'ERROR',
    boss: true,
    chapter: 2,
  },
  {
    id: 'boss-3',
    name: 'The FlatList Phantom',
    language: 'React Native',
    tagline: 'blank list, no keys',
    accent: '#22d3ee',
    glyphs: [
      { char: 'FlatList', x: 0, y: -30, size: 18, rot: 0 },
      { char: 'key', x: -28, y: -8, size: 22, rot: -6 },
      { char: 'data', x: 26, y: -4, size: 18, rot: 6 },
      { char: '[]', x: 0, y: 10, size: 26, rot: 0 },
      { char: 'render', x: -22, y: 26, size: 16, rot: -5 },
      { char: 'blank', x: 24, y: 28, size: 16, rot: 5 },
    ],
    bodyKind: 'serpent',
    attackGlyph: 'key',
    boss: true,
    chapter: 3,
  },
  {
    id: 'boss-4',
    name: 'The Flexbox Gremlin',
    language: 'Flexbox',
    tagline: 'everything is flex: 1 and nothing fits',
    accent: '#f59e0b',
    glyphs: [
      { char: 'flex:1', x: 0, y: -30, size: 20, rot: 0 },
      { char: 'row', x: -28, y: -6, size: 20, rot: -6 },
      { char: 'column', x: 26, y: -2, size: 16, rot: 6 },
      { char: 'wrap', x: 0, y: 12, size: 20, rot: 0 },
      { char: 'center', x: -22, y: 28, size: 16, rot: -5 },
      { char: 'stretch', x: 24, y: 28, size: 14, rot: 5 },
    ],
    bodyKind: 'brute',
    attackGlyph: 'flex:1',
    boss: true,
    chapter: 4,
  },
  {
    id: 'boss-5',
    name: 'The Lost Route',
    language: 'React Navigation',
    tagline: 'a deep link to nowhere',
    accent: '#4ade80',
    glyphs: [
      { char: 'navigate', x: 0, y: -30, size: 16, rot: 0 },
      { char: 'route', x: -28, y: -8, size: 20, rot: -6 },
      { char: 'myapp://', x: 26, y: -6, size: 14, rot: 6 },
      { char: '404', x: 0, y: 12, size: 24, rot: 0 },
      { char: 'goBack', x: -24, y: 28, size: 16, rot: -5 },
      { char: 'stack', x: 24, y: 28, size: 16, rot: 5 },
    ],
    bodyKind: 'serpent',
    attackGlyph: '404',
    boss: true,
    chapter: 5,
  },
  {
    id: 'boss-6',
    name: 'The Retry Storm',
    language: 'Networking',
    tagline: 'double POSTs, no idempotency key',
    accent: '#f97316',
    glyphs: [
      { char: 'POST', x: -26, y: -14, size: 20, rot: -6 },
      { char: 'retry', x: 26, y: -16, size: 18, rot: 6 },
      { char: '500', x: 0, y: 2, size: 22, rot: 0 },
      { char: 'fetch', x: -22, y: 26, size: 16, rot: -5 },
      { char: 'await', x: 24, y: 28, size: 16, rot: 5 },
      { char: 'x2', x: 0, y: -32, size: 18, rot: 0 },
    ],
    bodyKind: 'swarm',
    attackGlyph: 'POST',
    boss: true,
    chapter: 6,
  },
  {
    id: 'boss-7',
    name: 'The Vanishing Token',
    language: 'Authentication',
    tagline: 'stored in plain text, gone on update',
    accent: '#e879f9',
    glyphs: [
      { char: 'token', x: 0, y: -30, size: 20, rot: 0 },
      { char: '401', x: -28, y: -6, size: 22, rot: -6 },
      { char: '***', x: 26, y: -8, size: 24, rot: 6 },
      { char: 'null', x: 0, y: 10, size: 22, rot: 0 },
      { char: 'expiry', x: -24, y: 28, size: 16, rot: -5 },
      { char: 'login', x: 24, y: 28, size: 16, rot: 5 },
    ],
    bodyKind: 'wisp',
    attackGlyph: '401',
    boss: true,
    chapter: 7,
  },
  {
    id: 'boss-8',
    name: 'FINAL BOSS: The Store Review',
    language: 'App Store',
    tagline: 'defend your app, ship it',
    accent: '#f5c542',
    glyphs: [
      { char: 'REVIEW', x: 0, y: -32, size: 18, rot: 0 },
      { char: '4.3', x: -28, y: -8, size: 20, rot: -6 },
      { char: 'reject', x: 26, y: -4, size: 16, rot: 6 },
      { char: 'build', x: 0, y: 10, size: 20, rot: 0 },
      { char: 'ship', x: -24, y: 28, size: 18, rot: -5 },
      { char: '1 star', x: 24, y: 28, size: 16, rot: 5 },
    ],
    bodyKind: 'tower',
    attackGlyph: 'REVIEW',
    boss: true,
    chapter: 8,
  },
];

/** All 40 enemies: 32 node enemies + 8 bosses. */
export const ALL_ENEMIES: EnemyDesign[] = [...NODE_ENEMIES, ...BOSS_ENEMIES];
