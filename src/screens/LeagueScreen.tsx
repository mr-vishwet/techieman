// TechieMan — weekly league screen (M5).
// Shows the player's league for the current week, or the honest empty
// state. Leagues are NEVER faked: members come from Firestore only.
// Anonymous by default — members show as "Techie #1234" unless they set
// a display name.

import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGameStore } from '../store/useGameStore';
import { displayLabel } from '../firebase/leagues';
import { colors, spacing, typography } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'League'>;

export function LeagueScreen({ navigation }: Props) {
  const league = useGameStore(s => s.league);
  const leagueLoading = useGameStore(s => s.leagueLoading);
  const authStatus = useGameStore(s => s.authStatus);
  const authUid = useGameStore(s => s.authUid);
  const refreshLeague = useGameStore(s => s.refreshLeague);

  useEffect(() => {
    void refreshLeague();
  }, [refreshLeague]);

  if (leagueLoading || !league) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Weekly league</Text>
        <Text style={styles.body}>Loading…</Text>
      </View>
    );
  }

  if (league.status === 'not-configured') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Weekly league</Text>
        <Text style={styles.body}>
          Leagues need Firebase, which is not configured in this build yet.
          Your fights still count locally — they will join a league once
          cloud save is set up.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (authStatus === 'guest' || authStatus === 'anonymous') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Weekly league</Text>
        <Text style={styles.body}>
          Leagues are for signed-in players — your weekly XP needs an account
          to be ranked against other players. Your progress is safe either way.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.buttonText}>Sign in to join</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Not now</Text>
        </Pressable>
      </View>
    );
  }

  if (league.status === 'not-placed') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Weekly league</Text>
        <Text style={styles.body}>
          You are not placed in a league for week {league.weekId} yet. Leagues
          are formed weekly (30 players, Bronze → Diamond) — play a few fights
          and check back. Top 3 promote, bottom 3 demote.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Roadmap')}>
          <Text style={styles.buttonText}>Go fight</Text>
        </Pressable>
      </View>
    );
  }

  const { league: placed, myRank } = league;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {placed.tier} League · Week {placed.weekId}
      </Text>
      <Text style={styles.body}>
        {myRank ? `You are #${myRank} of ${placed.members.length}` : 'You are in this league'} · Top 3
        promote, bottom 3 demote.
      </Text>
      <FlatList
        data={placed.members}
        keyExtractor={m => m.uid}
        renderItem={({ item: m }) => {
          const isMe = m.uid === authUid;
          return (
            <View style={[styles.row, isMe && styles.meRow]}>
              <Text style={styles.rank}>#{m.rank}</Text>
              <Text style={[styles.name, isMe && styles.meText]}>
                {displayLabel(m)}
                {isMe ? ' (you)' : ''}
              </Text>
              <Text style={styles.xp}>{m.weeklyXp} XP</Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.body}>No members yet this week.</Text>}
      />
      <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.void, padding: spacing.lg },
  title: { ...typography.title, color: colors.cream },
  body: { ...typography.body, color: colors.creamDim, marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.voidCard,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.voidSoft,
  },
  meRow: { borderColor: colors.crimson },
  rank: { ...typography.body, color: colors.gold, fontWeight: '700', width: 44 },
  name: { ...typography.body, color: colors.cream, flex: 1 },
  meText: { fontWeight: '700' },
  xp: { ...typography.body, color: colors.creamDim },
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
  buttonText: { ...typography.body, color: colors.cream, fontWeight: '700' },
});
