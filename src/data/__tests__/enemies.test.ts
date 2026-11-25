import {
  ALL_ENEMIES,
  BOSS_ENEMIES,
  NODE_ENEMIES,
  bossForChapter,
  enemyForNode,
  layoutEnemyGlyphs,
} from '../enemies';
import { NODES } from '../roadmap';

const ASCII_PRINTABLE = /^[\x20-\x7E]+$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

const BOSS_NAMES = [
  'The Undefined Variable',
  'The Red Screen',
  'The FlatList Phantom',
  'The Flexbox Gremlin',
  'The Lost Route',
  'The Retry Storm',
  'The Vanishing Token',
  'FINAL BOSS: The Store Review',
];

describe('enemies — 32 nodes + 8 bosses', () => {
  it('has all 32 node enemies and all 8 bosses (40 total)', () => {
    expect(NODE_ENEMIES).toHaveLength(32);
    expect(BOSS_ENEMIES).toHaveLength(8);
    expect(ALL_ENEMIES).toHaveLength(40);
  });

  it('every node id matches a roadmap NODES id, exactly once', () => {
    const nodeIds = NODES.map(n => n.id).sort();
    const enemyIds = NODE_ENEMIES.map(e => e.id).sort();
    expect(enemyIds).toEqual(nodeIds);
    expect(new Set(enemyIds).size).toBe(32);
  });

  it('boss names are the FIXED eight from the plan', () => {
    expect(BOSS_ENEMIES.map(b => b.name).sort()).toEqual([...BOSS_NAMES].sort());
    expect(BOSS_ENEMIES.map(b => b.id).sort()).toEqual([
      'boss-1',
      'boss-2',
      'boss-3',
      'boss-4',
      'boss-5',
      'boss-6',
      'boss-7',
      'boss-8',
    ]);
  });

  it('bosses carry boss=true and chapters 1–8; nodes carry boss=false', () => {
    expect(BOSS_ENEMIES.every(b => b.boss)).toBe(true);
    expect(BOSS_ENEMIES.map(b => b.chapter).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(NODE_ENEMIES.every(e => !e.boss)).toBe(true);
    for (const e of NODE_ENEMIES) {
      expect(e.chapter).toBeGreaterThanOrEqual(1);
      expect(e.chapter).toBeLessThanOrEqual(8);
    }
  });

  it('every glyph is ASCII printable and <=10 chars (font coverage)', () => {
    for (const e of ALL_ENEMIES) {
      for (const g of e.glyphs) {
        expect(g.char.length).toBeGreaterThanOrEqual(1);
        expect(g.char.length).toBeLessThanOrEqual(10);
        expect(g.char).toMatch(ASCII_PRINTABLE);
        expect(Math.abs(g.x)).toBeLessThanOrEqual(40);
        expect(Math.abs(g.y)).toBeLessThanOrEqual(40);
        expect(g.size).toBeGreaterThanOrEqual(14);
        expect(g.size).toBeLessThanOrEqual(32);
      }
      expect(e.attackGlyph).toMatch(ASCII_PRINTABLE);
      expect(e.attackGlyph.length).toBeLessThanOrEqual(10);
    }
  });

  it('nodes have 2–4 glyphs, bosses 5–8', () => {
    for (const e of NODE_ENEMIES) {
      expect(e.glyphs.length).toBeGreaterThanOrEqual(2);
      expect(e.glyphs.length).toBeLessThanOrEqual(4);
    }
    for (const b of BOSS_ENEMIES) {
      expect(b.glyphs.length).toBeGreaterThanOrEqual(5);
      expect(b.glyphs.length).toBeLessThanOrEqual(8);
    }
  });

  it('accents are valid hex; boss accents are all distinct', () => {
    for (const e of ALL_ENEMIES) {
      expect(e.accent).toMatch(HEX);
    }
    const bossAccents = BOSS_ENEMIES.map(b => b.accent.toLowerCase());
    expect(new Set(bossAccents).size).toBe(8);
    // No boss wears the player's crimson.
    expect(bossAccents).not.toContain('#e8494f');
  });

  it('names, languages and taglines are non-empty plain words', () => {
    for (const e of ALL_ENEMIES) {
      expect(e.name.trim().length).toBeGreaterThan(0);
      expect(e.language.trim().length).toBeGreaterThan(0);
      expect(e.tagline.trim().length).toBeGreaterThan(0);
      expect(['wisp', 'brute', 'serpent', 'swarm', 'tower']).toContain(e.bodyKind);
    }
  });

  it('lookups resolve node and boss enemies', () => {
    expect(enemyForNode('1.1-js-basics')?.name).toBe('The Loose Variable');
    expect(enemyForNode('3.3-lists')?.language).toBe('React Native');
    expect(enemyForNode('8.4-publishing')?.boss).toBe(false);
    expect(enemyForNode('nope')).toBeUndefined();
    expect(bossForChapter(1)?.name).toBe('The Undefined Variable');
    expect(bossForChapter(8)?.name).toBe('FINAL BOSS: The Store Review');
    expect(bossForChapter(3)?.glyphs.map(g => g.char)).toContain('FlatList');
    expect(bossForChapter(9)).toBeUndefined();
  });
});

describe('layoutEnemyGlyphs', () => {
  it('idle bobs phase-shifted: positions move over time', () => {
    const boss = BOSS_ENEMIES[0];
    const t0 = layoutEnemyGlyphs(boss, 0, 'idle');
    const t1 = layoutEnemyGlyphs(boss, 1000, 'idle');
    expect(t0).toHaveLength(boss.glyphs.length);
    expect(t0.every(g => g.opacity === 1)).toBe(true);
    expect(t0.map(g => g.x)).not.toEqual(t1.map(g => g.x));
  });

  it('hurt scatters glyphs outward from their base spots', () => {
    const boss = BOSS_ENEMIES[0];
    const idle = layoutEnemyGlyphs(boss, 0, 'idle');
    const hurt = layoutEnemyGlyphs(boss, 0, 'hurt');
    const spread = (arr: { x: number }[]) => Math.max(...arr.map(g => g.x)) - Math.min(...arr.map(g => g.x));
    expect(spread(hurt)).toBeGreaterThan(spread(idle));
    expect(hurt.every(g => g.opacity === 0.9)).toBe(true);
  });

  it('ko drops every glyph to the floor and fades it', () => {
    const boss = BOSS_ENEMIES[7];
    const ko = layoutEnemyGlyphs(boss, 0, 'ko');
    expect(ko).toHaveLength(boss.glyphs.length);
    expect(ko.every(g => g.y === 36)).toBe(true);
    expect(ko.every(g => g.opacity === 0.25)).toBe(true);
  });
});
