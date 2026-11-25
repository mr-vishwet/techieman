// TechieMan — Fight screen (M2 spike, M3 bank wiring, M4 progression shell).
// Wires the Skia fight canvas + pure-TS fight math + the Chapter 1 question
// bank (seeded SQLite, TS-array fallback) + the Reanimated FPS meter.
// Question/HP state lives in React; per-frame animation lives on the UI
// thread (Skia values + Reanimated). Finished fights are recorded once
// into the store (XP, streak, quests, rematch tags) via finishFight.
// Nodes without an authored question bank yet show an honest "being authored"
// card instead of invented questions (plan §4.2 — no hallucinated content).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ALL_QUESTIONS } from '../data/allQuestions';
import { NODES } from '../data/roadmap';
import type { Question } from '../data/questions';
import { loadQuestionsForNode, questionsForNodeLocal } from '../storage/bank';
import { applyAnswer, newFight, type FightState } from '../engine/fightMath';
import { FightCanvas, type FighterPose } from '../components/FightCanvas';
import { useFpsMeter, type FpsSample } from '../components/FpsMeter';
import { colors, spacing, typography } from '../theme/tokens';
import { useGameStore } from '../store/useGameStore';
import type { FightScreenProps } from '../navigation/types';

const QUESTION_SECONDS = 15;

export function FightScreen({ route, navigation }: FightScreenProps) {
  const { nodeId } = route.params;
  const node = NODES.find(n => n.id === nodeId);

  // M3: questions come from the seeded SQLite bank, with the TS arrays as
  // fallback when the DB is not seeded yet. null = still loading.
  const [bankQuestions, setBankQuestions] = useState<Question[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setBankQuestions(null);
    loadQuestionsForNode(nodeId)
      .then(dbQs => {
        if (cancelled) return;
        setBankQuestions(
          dbQs.length > 0 ? dbQs : questionsForNodeLocal(nodeId, ALL_QUESTIONS),
        );
      })
      .catch(() => {
        if (!cancelled) setBankQuestions(questionsForNodeLocal(nodeId, ALL_QUESTIONS));
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  const questions = bankQuestions ?? [];
  const demoQuestions = useMemo(
    () => questionsForNodeLocal('1.1-js-basics', ALL_QUESTIONS),
    [],
  );
  const { width } = useWindowDimensions();
  const canvasHeight = 260;

  const [fight, setFight] = useState<FightState>(() => newFight(node?.difficulty ?? 1));
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [pose, setPose] = useState<FighterPose>('idle');
  const [burstKey, setBurstKey] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [fps, setFps] = useState<FpsSample | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  // M4: per-fight tracking for the progression shell.
  const wrongQuestionIds = useRef<string[]>([]);
  const fastAnswers = useRef(0);
  const fightStartedAt = useRef<number>(Date.now());
  const recordedRef = useRef(false);
  const [xpEarned, setXpEarned] = useState<number | null>(null);

  const activeQuestions = demoMode ? demoQuestions : questions;
  const question = activeQuestions[qIndex];
  const finished = fight.enemy.hp <= 0 || fight.player.hp <= 0;
  const won = fight.enemy.hp <= 0;

  const playerHpWidth = useSharedValue(100);
  const enemyHpWidth = useSharedValue(100);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    playerHpWidth.value = withTiming((fight.player.hp / fight.player.maxHp) * 100, { duration: 300 });
    enemyHpWidth.value = withTiming((fight.enemy.hp / fight.enemy.maxHp) * 100, { duration: 300 });
  }, [fight, playerHpWidth, enemyHpWidth]);

  const playerBarStyle = useAnimatedStyle(() => ({ width: `${playerHpWidth.value}%` }));
  const enemyBarStyle = useAnimatedStyle(() => ({ width: `${enemyHpWidth.value}%` }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const onFpsSample = useCallback((s: FpsSample) => setFps(s), []);
  useFpsMeter(onFpsSample);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (finished || selected !== null) return;
    setTimeLeft(QUESTION_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [qIndex, finished, selected, demoMode]);

  // Timeout counts as a wrong answer.
  useEffect(() => {
    if (timeLeft === 0 && selected === null && !finished) {
      answer(-1, QUESTION_SECONDS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const finishFight = useGameStore(s => s.finishFight);

  function resetFightTracking() {
    wrongQuestionIds.current = [];
    fastAnswers.current = 0;
    fightStartedAt.current = Date.now();
    recordedRef.current = false;
    setXpEarned(null);
  }

  function shake() {
    shakeX.value = withTiming(7, { duration: 60 }, () => {
      shakeX.value = withTiming(-7, { duration: 60 }, () => {
        shakeX.value = withTiming(0, { duration: 90 });
      });
    });
  }

  function answer(optionIndex: number, secondsUsed: number) {
    if (selected !== null || finished || !question) return;
    const correct = optionIndex === question.correctIndex;
    setSelected(optionIndex);
    const result = applyAnswer(fight, correct, secondsUsed);
    setFight(result.state);
    setWhy(question.explanation);
    setPose(correct ? 'attack' : 'hurt');
    if (correct) {
      setBurstKey(k => k + 1);
      if (secondsUsed < 8) fastAnswers.current += 1;
    } else {
      wrongQuestionIds.current.push(question.id);
      shake();
    }
    setTimeout(() => {
      setPose('idle');
      setSelected(null);
      setWhy(null);
      if (result.outcome === 'ongoing') {
        setQIndex(i => (i + 1) % activeQuestions.length);
      } else if (!recordedRef.current) {
        // Terminal outcome (win OR lose): record once into the M4 shell.
        // A loss still counts as a played day and banks the wrong tags.
        recordedRef.current = true;
        const summary = finishFight(nodeId, {
          won: result.outcome === 'win',
          correctCount: result.state.correctCount,
          wrongCount: result.state.wrongCount,
          bestCombo: result.state.bestCombo,
          totalQuestions: activeQuestions.length,
          flawless: result.flawless,
          isBoss: false,
          wrongTags: wrongQuestionIds.current,
          fastAnswers: fastAnswers.current,
          durationMs: Date.now() - fightStartedAt.current,
          startedAt: fightStartedAt.current,
        });
        setXpEarned(summary.xpEarned);
      }
    }, 1100);
  }

  if (!node) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Unknown node</Text>
      </View>
    );
  }

  // Bank still loading — never flash the "being authored" card mid-load.
  if (bankQuestions === null && !demoMode) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{node.title}</Text>
        <Text style={styles.body}>Loading questions from the bank…</Text>
      </View>
    );
  }

  // No authored questions for this node yet — say so plainly.
  // Chapter 1 is fully authored (10 questions per node, M3); later chapters
  // land in their own milestones. No placeholder questions are ever shown,
  // because a wrong question teaches wrong React Native.
  if (questions.length === 0 && !demoMode) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{node.title}</Text>
        <Text style={styles.body}>
          The question bank for this node is being authored — 0 questions yet.
          No placeholder questions are shown, because a wrong question teaches
          wrong React Native.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => setDemoMode(true)}>
          <Text style={styles.buttonText}>Play the Chapter 1 demo fight instead</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back to roadmap</Text>
        </Pressable>
      </View>
    );
  }

  if (!question) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No questions loaded</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>
          {demoMode ? 'DEMO · ' : ''}{node.title}
        </Text>
        <Text style={styles.topBarText}>
          {fps ? `${fps.fps} fps · p95 ${fps.p95FrameMs}ms` : 'measuring fps…'}
        </Text>
      </View>

      <View style={styles.hpRow}>
        <View style={styles.hpBlock}>
          <Text style={styles.hpLabel}>YOU · {fight.player.hp}</Text>
          <View style={styles.hpTrack}>
            <Animated.View style={[styles.hpFill, styles.hpPlayer, playerBarStyle]} />
          </View>
        </View>
        <View style={styles.hpBlock}>
          <Text style={styles.hpLabel}>THE `?` GOBLIN · {fight.enemy.hp}</Text>
          <View style={styles.hpTrack}>
            <Animated.View style={[styles.hpFill, styles.hpEnemy, enemyBarStyle]} />
          </View>
        </View>
      </View>

      <Animated.View style={shakeStyle}>
        <FightCanvas
          width={width}
          height={canvasHeight}
          pose={pose}
          enemyPose={fight.enemy.hp <= 0 ? 'ko' : 'idle'}
          burstKey={burstKey}
        />
      </Animated.View>

      {finished ? (
        <View style={styles.resultCard}>
          <Text style={styles.title}>{won ? 'NODE CLEARED' : 'KNOCKED OUT'}</Text>
          <Text style={styles.body}>
            {won
              ? `The concept is yours. ${fight.correctCount} correct, ${fight.wrongCount} wrong, best combo ×${fight.bestCombo}.`
              : 'The concept wins this round. No lockout — rematch or train.'}
          </Text>
          {xpEarned !== null ? (
            <Text style={styles.body}>+{xpEarned} XP banked.</Text>
          ) : null}
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              resetFightTracking();
              setFight(newFight(node.difficulty));
              setQIndex(0);
              setSelected(null);
              setWhy(null);
            }}>
            <Text style={styles.buttonText}>{won ? 'Fight again' : 'Rematch'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Back to roadmap</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.questionCard}>
          <Text style={styles.timer}>⏱ {timeLeft}s · Q{qIndex + 1} · combo ×{fight.combo}</Text>
          <Text style={styles.question}>{question.stem}</Text>
          {question.options.map((opt, i) => {
            const isCorrect = i === question.correctIndex;
            const isSelected = i === selected;
            return (
              <Pressable
                key={i}
                disabled={selected !== null}
                onPress={() => answer(i, QUESTION_SECONDS - timeLeft)}
                style={[
                  styles.option,
                  selected !== null && isCorrect && styles.optionCorrect,
                  isSelected && !isCorrect && styles.optionWrong,
                ]}>
                <Text style={styles.optionText}>
                  {String.fromCharCode(65 + i)}. {opt}
                </Text>
              </Pressable>
            );
          })}
          {why ? <Text style={styles.why}>💡 {why}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.void, padding: spacing.md },
  title: { ...typography.title, color: colors.cream },
  body: { ...typography.body, color: colors.creamDim, marginTop: spacing.sm },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  topBarText: { ...typography.caption, color: colors.creamDim },
  hpRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  hpBlock: { flex: 1 },
  hpLabel: { ...typography.hpLabel, color: colors.cream, marginBottom: 4 },
  hpTrack: { height: 10, backgroundColor: colors.voidCard, borderRadius: 5, overflow: 'hidden' },
  hpFill: { height: '100%', borderRadius: 5 },
  hpPlayer: { backgroundColor: colors.hpPlayer },
  hpEnemy: { backgroundColor: colors.hpEnemy },
  questionCard: {
    backgroundColor: colors.voidCard,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  timer: { ...typography.caption, color: colors.gold, marginBottom: spacing.sm },
  question: { ...typography.body, color: colors.cream, fontWeight: '700', marginBottom: spacing.md },
  option: {
    backgroundColor: colors.void,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.voidSoft,
  },
  optionCorrect: { borderColor: colors.success, backgroundColor: '#0f2a1a' },
  optionWrong: { borderColor: colors.danger, backgroundColor: '#2a0f0f' },
  optionText: { ...typography.body, color: colors.cream },
  why: { ...typography.caption, color: colors.creamDim, marginTop: spacing.sm },
  resultCard: {
    backgroundColor: colors.voidCard,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.crimson,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  secondaryButton: {
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.creamDim,
  },
  buttonText: { ...typography.body, color: colors.cream, fontWeight: '700' },
});
