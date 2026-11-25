// TechieMan — Home screen (M4 progression shell).
// XP + level, streak, today's 3 quests, and the weak-area rematch card.
// Guest-first: no login anywhere on this screen. All data comes from the
// game store, which mirrors the SQLite snapshot.

import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NODES } from '../data/roadmap';
import { xpToNextLevel } from '../engine/progression';
import { useGameStore } from '../store/useGameStore';
import { colors, spacing, typography } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function syncLine(
  syncState: string,
  firebaseReady: boolean,
  lastMerge: { xpKept: string; nodesMerged: number } | null,
): string {
  if (!firebaseReady) return 'Cloud save: not set up in this build';
  if (syncState === 'synced') {
    return lastMerge && lastMerge.nodesMerged > 0
      ? `Synced ✓ · merged ${lastMerge.nodesMerged} nodes (kept your higher XP)`
      : 'Synced ✓';
  }
  if (syncState === 'queued') return 'Sync queued — will send when online';
  if (syncState === 'offline') return 'Offline — progress saved on this device';
  if (syncState === 'syncing') return 'Syncing…';
  return 'Local only';
}

export function HomeScreen({ navigation }: Props) {
  const hydrated = useGameStore(s => s.hydrated);
  const xp = useGameStore(s => s.xp);
  const level = useGameStore(s => s.level);
  const gems = useGameStore(s => s.gems);
  const streak = useGameStore(s => s.streak);
  const streakFreeze = useGameStore(s => s.streakFreeze);
  const quests = useGameStore(s => s.quests);
  const rematchNodeId = useGameStore(s => s.rematchNodeId);
  const rematchTag = useGameStore(s => s.rematchTag);
  const clearedNodeIds = useGameStore(s => s.clearedNodeIds);
  const authStatus = useGameStore(s => s.authStatus);
  const authEmail = useGameStore(s => s.authEmail);
  const firebaseReady = useGameStore(s => s.firebaseReady);
  const syncState = useGameStore(s => s.syncState);
  const lastMerge = useGameStore(s => s.lastMerge);
  const deleteAccount = useGameStore(s => s.deleteAccount);

  if (!hydrated) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>TechieMan</Text>
        <Text style={styles.body}>Loading your progress…</Text>
      </View>
    );
  }

  const rematchNode = rematchNodeId ? NODES.find(n => n.id === rematchNodeId) : null;
  const xpIntoLevel = xp % 100;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Learn Everything With Techie</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Level {level} · {xp} XP
        </Text>
        <Text style={styles.body}>
          {xpToNextLevel(xp)} XP to level {level + 1} ({xpIntoLevel}/100 this level)
        </Text>
        <Text style={styles.stat}>
          🔥 {streak}-day streak
          {streakFreeze > 0 ? ` · 🛡️ ${streakFreeze} freeze banked` : ''}
          {'  ·  '}💎 {gems} gems
        </Text>
        <Text style={styles.body}>
          {clearedNodeIds.length}/{NODES.length} nodes cleared
        </Text>
      </View>

      {rematchNode ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚔️ Rematch: {rematchNode.title}</Text>
          <Text style={styles.body}>
            Weak spot{rematchTag ? ` — missed ${rematchTag}` : ''}. Spaced repetition
            says this is the highest-value fight right now.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Fight', { nodeId: rematchNode.id })}>
            <Text style={styles.buttonText}>Fight the rematch</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No rematch due</Text>
          <Text style={styles.body}>
            Nothing is due for spaced repetition right now — clear a node and
            come back tomorrow.
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Today&apos;s quests</Text>
      <FlatList
        data={quests}
        keyExtractor={q => q.id}
        renderItem={({ item: q }) => (
          <View style={styles.questRow}>
            <Text style={styles.questTitle}>
              {q.done ? '✅ ' : ''}{q.title}
            </Text>
            <Text style={styles.questMeta}>
              {q.progress}/{q.target} · +{q.rewardGems} 💎
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.body}>Quests appear after your first fight.</Text>
        }
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <Text style={styles.body}>
          {authStatus === 'guest'
            ? 'Playing as guest — progress lives on this device.'
            : authStatus === 'anonymous'
              ? 'Anonymous cloud save — progress is backed up, no email needed.'
              : `Signed in as ${authEmail ?? 'your account'} (${authStatus}).`}
        </Text>
        <Text style={styles.body}>{syncLine(syncState, firebaseReady, lastMerge)}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.buttonText}>
            {authStatus === 'guest' || authStatus === 'anonymous' ? 'Save progress — sign in' : 'Account settings'}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('League')}>
          <Text style={styles.buttonText}>Weekly league</Text>
        </Pressable>
        {authStatus !== 'guest' && authStatus !== 'anonymous' ? (
          <Pressable
            style={styles.dangerButton}
            onPress={() =>
              Alert.alert(
                'Delete account?',
                'This permanently deletes your cloud save (profile, progress, fights, league membership) and your sign-in. Your local progress on this device is reset too. This cannot be undone.',
                [
                  { text: 'Keep my account', style: 'cancel' },
                  {
                    text: 'Delete everything',
                    style: 'destructive',
                    onPress: () => {
                      void deleteAccount();
                    },
                  },
                ],
              )
            }>
            <Text style={styles.buttonText}>Delete account…</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() => navigation.navigate('Roadmap')}>
        <Text style={styles.buttonText}>Open the roadmap</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.void, padding: spacing.lg },
  title: { ...typography.title, color: colors.cream },
  body: { ...typography.body, color: colors.creamDim, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.voidCard,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.voidSoft,
  },
  cardTitle: { ...typography.chapterTitle, color: colors.cream },
  stat: { ...typography.body, color: colors.gold, marginTop: spacing.sm },
  sectionTitle: { ...typography.chapterTitle, color: colors.cream, marginTop: spacing.lg },
  questRow: {
    backgroundColor: colors.voidCard,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.voidSoft,
  },
  questTitle: { ...typography.body, color: colors.cream, fontWeight: '700' },
  questMeta: { ...typography.caption, color: colors.creamDim, marginTop: 4 },
  primaryButton: {
    backgroundColor: colors.crimson,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.voidCard,
    borderColor: colors.voidSoft,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: colors.voidCard,
    borderColor: colors.crimson,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  buttonText: { ...typography.body, color: colors.cream, fontWeight: '700' },
});
