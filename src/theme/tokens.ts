// TechieMan design tokens — portfolio brand (plan §5.2).
// void #140509 / cream #fff0dc / crimson #e8494f, one neon accent per roadmap.

export const colors = {
  void: '#140509',
  voidSoft: '#1e0a12',
  voidCard: '#241019',
  cream: '#fff0dc',
  creamDim: '#d8c9ae',
  crimson: '#e8494f',
  crimsonDark: '#b32d33',
  gold: '#f5c542',
  // Roadmap accents
  accentReactNative: '#22d3ee', // cyan
  accentFlutter: '#38bdf8', // sky blue
  accentAndroid: '#4ade80', // green
  // Fight UI
  hpPlayer: '#e8494f',
  hpEnemy: '#22d3ee',
  success: '#4ade80',
  danger: '#ef4444',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '800' as const },
  chapterTitle: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  hpLabel: { fontSize: 12, fontWeight: '700' as const },
} as const;

export const fighter = {
  /** stickman stroke width (plan §5.2: 3px, round caps) */
  strokeWidth: 3,
  playerColor: colors.crimson,
  enemyColor: colors.accentReactNative,
} as const;
