// TechieMan — Login / guest-upgrade screen (M5).
// Guest-first: this screen is OPTIONAL. Everything here upgrades the
// existing anonymous/local progress — it never wipes it. Linking email or
// Google keeps the same Firebase uid; signing into an existing account
// merges instead (local never loses — see sync.ts mergeSnapshots).
// When Firebase is not configured, the screen says so honestly and the
// guest keeps playing.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useGameStore } from '../store/useGameStore';
import { colors, spacing, typography } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const firebaseReady = useGameStore(s => s.firebaseReady);
  const authStatus = useGameStore(s => s.authStatus);
  const authEmail = useGameStore(s => s.authEmail);
  const authError = useGameStore(s => s.authError);
  const authBusy = useGameStore(s => s.authBusy);
  const signInWithEmail = useGameStore(s => s.signInWithEmail);
  const signInWithGoogle = useGameStore(s => s.signInWithGoogle);
  const signOut = useGameStore(s => s.signOut);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'create'>('create');

  const emailValid = /.+@.+\..+/.test(email.trim());
  const passwordValid = password.length >= 6;

  if (!firebaseReady) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Save your progress</Text>
        <Text style={styles.body}>
          Cloud save is not set up in this build yet — Firebase config is
          missing. Your progress is safe on this device and nothing is lost.
          The developer adds the real config files (see FIREBASE_SETUP.md),
          then sign-in appears here.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Continue as guest</Text>
        </Pressable>
      </View>
    );
  }

  if (authStatus !== 'guest' && authStatus !== 'anonymous') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>You&apos;re signed in</Text>
        <Text style={styles.body}>
          Signed in as {authEmail ?? 'your account'} ({authStatus}). Your
          progress syncs when you&apos;re online and stays on this device when
          you&apos;re not.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={async () => {
            await signOut();
            navigation.goBack();
          }}>
          <Text style={styles.buttonText}>Sign out (keeps local progress)</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Save your progress</Text>
      <Text style={styles.body}>
        {mode === 'create'
          ? 'Create an account and your guest progress moves with it — same fighter, same XP, nothing wiped.'
          : 'Sign in to the account your progress was saved to. If the account lives on another device, your two progress records merge — the higher XP wins, nothing is wiped.'}
      </Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor={colors.creamDim}
      />
      <Text style={styles.label}>Password (6+ characters)</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={colors.creamDim}
      />

      {authError ? <Text style={styles.error}>{authError}</Text> : null}

      <Pressable
        style={[styles.primaryButton, (!emailValid || !passwordValid || authBusy) && styles.disabledButton]}
        disabled={!emailValid || !passwordValid || authBusy}
        onPress={() => void signInWithEmail(email.trim(), password)}>
        <Text style={styles.buttonText}>
          {authBusy ? 'Working…' : mode === 'create' ? 'Create account & keep my progress' : 'Sign in'}
        </Text>
      </Pressable>

      <Pressable style={styles.secondaryButton} onPress={() => setMode(mode === 'create' ? 'signin' : 'create')}>
        <Text style={styles.buttonText}>
          {mode === 'create' ? 'I already have an account' : 'I want to create an account'}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, authBusy && styles.disabledButton]}
        disabled={authBusy}
        onPress={() => void signInWithGoogle()}>
        <Text style={styles.buttonText}>Continue with Google</Text>
      </Pressable>

      <Pressable style={styles.ghostButton} onPress={() => navigation.goBack()}>
        <Text style={styles.ghostText}>Not now — keep playing as guest</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.void, padding: spacing.lg },
  title: { ...typography.title, color: colors.cream },
  body: { ...typography.body, color: colors.creamDim, marginTop: spacing.sm },
  label: { ...typography.body, color: colors.cream, fontWeight: '700', marginTop: spacing.md },
  input: {
    backgroundColor: colors.voidCard,
    borderColor: colors.voidSoft,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.xs,
    color: colors.cream,
    ...typography.body,
  },
  error: { ...typography.body, color: colors.crimson, marginTop: spacing.md },
  primaryButton: {
    backgroundColor: colors.crimson,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.lg,
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
  disabledButton: { opacity: 0.45 },
  buttonText: { ...typography.body, color: colors.cream, fontWeight: '700' },
  ghostButton: { padding: spacing.md, marginTop: spacing.sm, alignItems: 'center' },
  ghostText: { ...typography.body, color: colors.creamDim },
});
