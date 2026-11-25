// TechieMan — Roadmap map screen (M1).
// Renders the REAL React Native roadmap (plan §3.2, v1.1) from src/data/roadmap.ts.
// No dummy data: every chapter/node name comes from roadmap.sh's RN roadmap.

import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CHAPTERS, NODES, ROADMAP, nodesForChapter } from '../data/roadmap';
import { hasLevel } from '../data/levels';
import { colors, spacing, typography } from '../theme/tokens';
import { useGameStore } from '../store/useGameStore';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Roadmap'>;

export function RoadmapMapScreen({ navigation }: Props) {
  const clearedNodeIds = useGameStore(s => s.clearedNodeIds);
  const xp = useGameStore(s => s.xp);
  const streak = useGameStore(s => s.streak);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Learn Everything With Techie</Text>
        <Text style={styles.subtitle}>
          {ROADMAP.title} roadmap · {NODES.length} fights · {CHAPTERS.length} bosses
        </Text>
        <View style={styles.statsRow}>
          <Text style={styles.stat}>⚡ {xp} XP</Text>
          <Text style={styles.stat}>🔥 {streak}-day streak</Text>
          <Text style={styles.stat}>
            {clearedNodeIds.length}/{NODES.length} cleared
          </Text>
        </View>
      </View>
      <FlatList
        data={CHAPTERS}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: chapter }) => {
          const nodes = nodesForChapter(chapter.id);
          const cleared = nodes.filter(n => clearedNodeIds.includes(n.id)).length;
          return (
            <View style={styles.chapterCard}>
              <View style={styles.chapterHeader}>
                <Text style={styles.chapterOrder}>CH {chapter.order}</Text>
                <Text style={styles.chapterTitle}>{chapter.title}</Text>
                <Text style={styles.chapterProgress}>
                  {cleared}/{nodes.length}
                </Text>
              </View>
              <Text style={styles.chapterSource}>{chapter.sourceArea}</Text>
              {nodes.map(node => {
                const isCleared = clearedNodeIds.includes(node.id);
                const isOpen = node.order === 1 || clearedNodeIds.includes(nodes[node.order - 2]?.id ?? '');
                const liveLevel = hasLevel(node.id);
                return (
                  <View key={node.id} style={[styles.nodeRow, !isOpen && styles.nodeLocked]}>
                    <Pressable
                      disabled={!isOpen}
                      onPress={() => navigation.navigate('Fight', { nodeId: node.id })}
                      style={styles.nodeMain}>
                      <Text style={styles.nodeDot}>{isCleared ? '✓' : isOpen ? '⚔️' : '🔒'}</Text>
                      <View style={styles.nodeText}>
                        <Text style={[styles.nodeTitle, !isOpen && styles.nodeTitleLocked]}>
                          {node.order}. {node.title}
                        </Text>
                        <Text style={styles.nodeMeta}>
                          Difficulty {node.difficulty}/5{node.isSideQuest ? ' · side quest' : ''}
                        </Text>
                      </View>
                    </Pressable>
                    {liveLevel ? (
                      <Pressable
                        disabled={!isOpen}
                        onPress={() => navigation.navigate('Level', { nodeId: node.id })}
                        style={styles.levelButton}>
                        <Text style={styles.levelButtonText}>▶ Live level</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.levelPending}>
                        <Text style={styles.levelPendingText}>Level in production</Text>
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={styles.bossRow}>
                <Text style={styles.bossSkull}>💀</Text>
                <View>
                  <Text style={styles.bossName}>BOSS — {chapter.bossName}</Text>
                  <Text style={styles.bossTagline}>{chapter.bossTagline}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.void },
  header: { padding: spacing.lg, paddingBottom: spacing.md },
  title: { ...typography.title, color: colors.cream },
  subtitle: { ...typography.body, color: colors.creamDim, marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  stat: { ...typography.caption, color: colors.gold },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  chapterCard: {
    backgroundColor: colors.voidCard,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.voidSoft,
  },
  chapterHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  chapterOrder: { ...typography.caption, color: colors.accentReactNative },
  chapterTitle: { ...typography.chapterTitle, color: colors.cream, flex: 1 },
  chapterProgress: { ...typography.caption, color: colors.creamDim },
  chapterSource: { ...typography.caption, color: colors.creamDim, marginTop: spacing.xs },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.voidSoft,
    marginTop: spacing.sm,
  },
  nodeMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  levelButton: {
    backgroundColor: colors.crimson,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  levelButtonText: { ...typography.caption, color: colors.cream, fontWeight: '700' },
  levelPending: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  levelPendingText: { ...typography.caption, color: colors.creamDim },
  nodeLocked: { opacity: 0.45 },
  nodeDot: { fontSize: 16 },
  nodeText: { flex: 1 },
  nodeTitle: { ...typography.body, color: colors.cream },
  nodeTitleLocked: { color: colors.creamDim },
  nodeMeta: { ...typography.caption, color: colors.creamDim },
  bossRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.void,
    borderRadius: 12,
  },
  bossSkull: { fontSize: 20 },
  bossName: { ...typography.body, color: colors.crimson, fontWeight: '700' },
  bossTagline: { ...typography.caption, color: colors.creamDim },
});
