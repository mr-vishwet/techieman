import { CHAPTERS, NODES, nodesForChapter } from '../roadmap';

describe('React Native roadmap data (plan §3.2, v1.1)', () => {
  it('has 8 chapters and 32 nodes', () => {
    expect(CHAPTERS).toHaveLength(8);
    expect(NODES).toHaveLength(32);
  });

  it('every node belongs to a real chapter and has a unique id', () => {
    const chapterIds = new Set(CHAPTERS.map(c => c.id));
    const nodeIds = new Set<string>();
    for (const n of NODES) {
      expect(chapterIds.has(n.chapterId)).toBe(true);
      expect(nodeIds.has(n.id)).toBe(false);
      nodeIds.add(n.id);
      expect(n.title.trim().length).toBeGreaterThan(0);
      expect(n.sourceArea.trim().length).toBeGreaterThan(0);
      expect(n.difficulty).toBeGreaterThanOrEqual(1);
      expect(n.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it('every chapter has 4 nodes and a named boss', () => {
    for (const c of CHAPTERS) {
      expect(nodesForChapter(c.id)).toHaveLength(4);
      expect(c.bossName.trim().length).toBeGreaterThan(0);
    }
  });

  it('node titles come from the roadmap.sh React Native roadmap', () => {
    const titles = NODES.map(n => n.title);
    expect(titles).toContain('JavaScript Basics');
    expect(titles).toContain('JSX');
    expect(titles).toContain('Components, State & Props');
    expect(titles).toContain('What is React Native?');
    expect(titles).toContain('ScrollView & Lists: FlatList, SectionList, RefreshControl');
    expect(titles).toContain('Layouts & Flexbox');
    expect(titles).toContain('DeepLinking');
    expect(titles).toContain('WebSockets');
    expect(titles).toContain('react-native-async-storage');
    expect(titles).toContain('Testing: Jest & React Native Testing Library');
  });
});
