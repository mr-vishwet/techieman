// TechieMan — Arcade Mode screen (wave survival).
// Composes the EXISTING fight experience as-is: the same FightCanvas
// (same props as FightScreen), the same beats (moveForAnswer +
// BEAT_DURATION_MS), the same enemy roster. Arcade owns only the wave
// loop — lives, score, combo, timer curve — in src/engine/arcade.ts.
// It does NOT fork or duplicate the fight UI: the canvas is imported, not
// copied. The question card markup mirrors FightScreen's (ARCADE-SEAM-3:
// if the graphics lane extracts a shared QuestionCard, adopt it).
//
// Pacing (TSC vs Math short): the next creature walks in the moment the
// beat ends — no interstitial, no "next" button, no full VS splash except
// the run start. One caption line per wave event, plain words, bottom pill.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ALL_QUESTIONS } from '../data/allQuestions';
import {
  ARCADE_MAX_LIVES,
  answerArcadeBeat,
  createArcadeRun,
  creaturesDownInWave,
  currentCreature,
  timerSecondsForWave,
  waveClearBonus,
  type ArcadeRunState,
} from '../engine/arcade';
import { BEAT_DURATION_MS, moveForAnswer, type Beat } from '../engine/choreography';
import { FightCanvas } from '../components/FightCanvas';
import { useFpsMeter, type FpsSample } from '../components/FpsMeter';
import {
  loadArcadeBest,
  recordArcadeRun,
  type ArcadeBest,
  type ArcadeRunRecord,
} from '../storage/arcade';
import { useGameStore } from '../store/useGameStore';
import { colors, spacing, typography } from '../theme/tokens';
import type { ArcadeScreenProps } from '../navigation/types';

type Phase = 'intro' | 'running' | 'summary';

export function ArcadeScreen({ navigation }: ArcadeScreenProps) {
  const { width } = useWindowDimensions();
  const canvasHeight = 260;

  const [phase, setPhase] = useState<Phase>('intro');
  const [run, setRun] = useState<ArcadeRunState | null>(null);
  const [best, setBest] = useState<ArcadeBest | null>(() => loadArcadeBest());
  const [summary, setSummary] = useState<ArcadeRunRecord | null>(null);
  const [xpBanked, setXpBanked] = useState<number | null>(null);

  const [selected, setSelected] = useState<number | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [beat, setBeat] = useState<Beat | null>(null);
  const [beatKey, setBeatKey] = useState(0);
  const [playerPose, setPlayerPose] = useState<'idle' | 'hurt' | 'ko' | 'win'>('idle');
  const [enemyPose, setEnemyPose] = useState<'idle' | 'hurt' | 'ko'>('idle');
  const [damageEvent, setDamageEvent] = useState<{
    key: number;
    value: number;
    kind: 'dealt' | 'taken';
  } | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [introKey, setIntroKey] = useState(0);
  const [showIntro, setShowIntro] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [fps, setFps] = useState<FpsSample | null>(null);

  const startedAtRef = useRef(0);
  const recordedRef = useRef(false);
  const runRef = useRef<ArcadeRunState | null>(null);
  runRef.current = run;
  const splashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timers must never fire after unmount (a beat ending mid-navigation).
  useEffect(() => {
    return () => {
      if (splashTimerRef.current) clearTimeout(splashTimerRef.current);
      if (beatTimerRef.current) clearTimeout(beatTimerRef.current);
    };
  }, []);

  const finishArcadeRun = useGameStore(s => s.finishArcadeRun);
  const onFpsSample = useCallback((s: FpsSample) => setFps(s), []);
  useFpsMeter(onFpsSample);

  const creature = run ? currentCreature(run) : undefined;
  const timerSeconds = run ? timerSecondsForWave(run.wave) : 15;
  // One beat id per creature-question: changes on a new creature AND on a
  // fresh question after a wrong answer (the creature survives, new question).
  const beatId = creature ? `${run?.wave}-${run?.creatureIndex}-${creature.question.id}` : 'none';

  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  function shake() {
    shakeX.value = withTiming(7, { duration: 60 }, () => {
      shakeX.value = withTiming(-7, { duration: 60 }, () => {
        shakeX.value = withTiming(0, { duration: 90 });
      });
    });
  }

  function startRun() {
    const seed = Date.now();
    const fresh = createArcadeRun(seed, ALL_QUESTIONS, seed);
    setRun(fresh);
    setSummary(null);
    setXpBanked(null);
    setSelected(null);
    setWhy(null);
    setBeat(null);
    setDamageEvent(null);
    setPlayerPose('idle');
    setEnemyPose('idle');
    setCaption(`WAVE 1 — three creatures, fifteen seconds each`);
    setShowIntro(true);
    setIntroKey(k => k + 1);
    startedAtRef.current = Date.now();
    recordedRef.current = false;
    setPhase('running');
    if (splashTimerRef.current) clearTimeout(splashTimerRef.current);
    splashTimerRef.current = setTimeout(() => setShowIntro(false), 1200);
  }

  // Timer resets on every new beat; ticks only while the player can answer
  // (not during the intro splash, not mid-beat, not after an answer).
  useEffect(() => {
    setTimeLeft(timerSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatId]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (phase !== 'running' || selected !== null || showIntro || beat !== null) return;
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
  }, [phase, beatId, selected, showIntro, beat]);

  // Timeout counts as a wrong answer.
  useEffect(() => {
    if (phase === 'running' && timeLeft === 0 && selected === null && creature) {
      answer(-1, timerSeconds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  function finalizeRun(finalRun: ArcadeRunState) {
    if (recordedRef.current) return;
    recordedRef.current = true;
    const endedAt = Date.now();
    const record = recordArcadeRun({
      score: finalRun.score,
      wave: finalRun.wave,
      kills: finalRun.kills,
      bestCombo: finalRun.bestCombo,
      correct: finalRun.correct,
      wrong: finalRun.wrong,
      durationMs: endedAt - startedAtRef.current,
      endedAt,
    });
    if (record.xpEarned > 0) finishArcadeRun(record.xpEarned);
    setXpBanked(record.xpEarned);
    setSummary(record);
    setBest(loadArcadeBest());
    setPlayerPose('ko');
    setPhase('summary');
  }

  function answer(optionIndex: number, secondsUsed: number) {
    const current = runRef.current;
    const currentCreatureNow = current ? currentCreature(current) : undefined;
    if (phase !== 'running' || selected !== null || !current || !currentCreatureNow) return;
    const question = currentCreatureNow.question;
    const correct = optionIndex === question.correctIndex;
    setSelected(optionIndex);
    setWhy(question.explanation);
    const res = answerArcadeBeat(current, correct, secondsUsed, ALL_QUESTIONS);
    setRun(res.state);
    const kind = moveForAnswer(correct, secondsUsed, current.combo, currentCreatureNow.isBoss);
    const key = beatKey + 1;
    setBeatKey(key);
    setBeat({ kind, key });
    setDamageEvent({
      key,
      value: correct ? res.scoreGained : 1,
      kind: correct ? 'dealt' : 'taken',
    });
    if (correct) {
      setEnemyPose('hurt');
      setBurstKey(k => k + 1);
    } else {
      setPlayerPose('hurt');
      shake();
    }
    if (res.waveCleared) {
      setCaption(
        `WAVE ${current.wave} CLEARED · +${waveClearBonus(current.wave)}${res.lifeRestored ? ' · +1 LIFE' : ''} · faster now`,
      );
    } else if (!correct) {
      setCaption(null);
    }
    if (beatTimerRef.current) clearTimeout(beatTimerRef.current);
    beatTimerRef.current = setTimeout(() => {
      setBeat(null);
      if (res.runOver) {
        setEnemyPose('idle');
        finalizeRun(res.state);
        return;
      }
      setEnemyPose('idle');
      setPlayerPose('idle');
      setSelected(null);
      setWhy(null);
      if (res.creatureDown) {
        // Next creature walks in the moment the beat ends (pacing rule).
        setIntroKey(k => k + 1);
        if (!res.waveCleared) setCaption(null);
      }
    }, BEAT_DURATION_MS[kind]);
  }

  // --- Intro phase: the rules, the best, the start button. ---
  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🕹️ Arcade Mode</Text>
        <Text style={styles.body}>
          Endless waves. The language itself attacks, one creature at a time.
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How it works</Text>
          <Text style={styles.body}>• One correct answer kills a creature.</Text>
          <Text style={styles.body}>• Wrong answer or timeout: −1 life, and the creature survives.</Text>
          <Text style={styles.body}>• 3 lives. Clearing wave 5, 10, 15… gives one back.</Text>
          <Text style={styles.body}>• The timer shrinks every wave: 15 s → 8 s.</Text>
          <Text style={styles.body}>• Every 5th wave ends with a boss — double score.</Text>
          <Text style={styles.body}>• Fast answers + combos multiply your score.</Text>
          <Text style={styles.body}>• XP only when you beat your best (max 25/run).</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {best ? `BEST ${best.score.toLocaleString()} · WAVE ${best.wave}` : 'No runs yet'}
          </Text>
          <Text style={styles.body}>
            {best
              ? 'That is the score to beat. One run, quick session.'
              : 'First run sets the score to beat.'}
          </Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={startRun}>
          <Text style={styles.buttonText}>Start run</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back home</Text>
        </Pressable>
      </View>
    );
  }

  // --- Summary phase: the run is over, show the score. ---
  if (phase === 'summary' && summary) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>RUN OVER</Text>
        {summary.newBest ? <Text style={styles.newBest}>★ NEW BEST ★</Text> : null}
        <View style={styles.card}>
          <Text style={styles.scoreBig}>{summary.score.toLocaleString()}</Text>
          <Text style={styles.body}>
            Wave {summary.wave} · {summary.kills} creatures down · best combo ×{summary.bestCombo}
          </Text>
          <Text style={styles.body}>
            {summary.correct} correct · {summary.wrong} wrong ·{' '}
            {Math.round(summary.durationMs / 1000)}s
          </Text>
          <Text style={styles.body}>
            {xpBanked !== null && xpBanked > 0
              ? `+${xpBanked} XP banked — new best.`
              : 'No XP this run — XP only comes from beating your best.'}
          </Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={startRun}>
          <Text style={styles.buttonText}>Run again</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back home</Text>
        </Pressable>
      </View>
    );
  }

  if (!run || !creature) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Arcade Mode</Text>
        <Text style={styles.body}>Loading the first wave…</Text>
      </View>
    );
  }

  const question = creature.question;
  const down = creaturesDownInWave(run);
  const total = run.creatures.length;
  const hearts = '♥'.repeat(run.lives) + '♡'.repeat(Math.max(0, ARCADE_MAX_LIVES - run.lives));

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.topBarText}>WAVE {run.wave}</Text>
        <Text style={styles.topBarText}>
          {fps ? `${fps.fps} fps · p95 ${fps.p95FrameMs}ms` : 'measuring fps…'}
        </Text>
      </View>

      <View style={styles.counterPill}>
        <Text style={styles.counterText}>
          ✓ {run.correct} ✕ {run.wrong} · SCORE {run.score.toLocaleString()}
        </Text>
        <Text style={styles.counterText}>{hearts}</Text>
      </View>
      {run.combo >= 2 ? <Text style={styles.combo}>🔥 COMBO ×{run.combo}</Text> : null}

      <View style={styles.waveRow}>
        <Text style={styles.waveLabel}>
          WAVE {run.wave} · {down}/{total} DOWN
        </Text>
        <View style={styles.waveTrack}>
          <View
            style={[
              styles.waveFill,
              { width: `${(down / total) * 100}%`, backgroundColor: creature.enemy.accent },
            ]}
          />
        </View>
      </View>

      <View style={styles.stageWrap}>
        <Animated.View style={shakeStyle}>
          <FightCanvas
            width={width}
            height={canvasHeight}
            enemy={creature.enemy}
            beat={beat}
            playerPose={playerPose}
            enemyPose={enemyPose}
            damageEvent={damageEvent}
            burstKey={burstKey}
            introKey={introKey}
          />
        </Animated.View>
        {showIntro ? (
          <Pressable style={styles.vsSplash} onPress={() => setShowIntro(false)}>
            <Text style={styles.vsYou}>YOU</Text>
            <Text style={styles.vsText}>VS</Text>
            <Text style={[styles.vsEnemy, { color: creature.enemy.accent }]}>
              {creature.enemy.name.toUpperCase()}
            </Text>
            <Text style={styles.vsLang}>
              {creature.enemy.language} — the language attacks in waves
            </Text>
            <Text style={styles.vsTagline}>{creature.enemy.tagline}</Text>
            <Text style={styles.vsSkip}>tap to skip</Text>
          </Pressable>
        ) : null}
      </View>

      {caption ? (
        <View style={styles.captionPill}>
          <Text style={styles.captionText}>{caption}</Text>
        </View>
      ) : null}

      <View style={styles.questionCard}>
        <Text style={styles.timer}>
          ⏱ {timeLeft}s · combo ×{run.combo}
          {creature.isBoss ? ' · BOSS — double score' : ''}
        </Text>
        <Text style={styles.question}>{question.stem}</Text>
        {question.options.map((opt, i) => {
          const isCorrect = i === question.correctIndex;
          const isSelected = i === selected;
          return (
            <Pressable
              key={i}
              disabled={selected !== null}
              onPress={() => answer(i, timerSeconds - timeLeft)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.void, padding: spacing.md },
  title: { ...typography.title, color: colors.cream },
  body: { ...typography.body, color: colors.creamDim, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.voidCard,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.voidSoft,
  },
  cardTitle: { ...typography.chapterTitle, color: colors.cream },
  scoreBig: { ...typography.title, color: colors.gold, fontSize: 44 },
  newBest: { ...typography.title, color: colors.gold, marginTop: spacing.sm },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  topBarText: { ...typography.caption, color: colors.creamDim },
  counterPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.voidCard,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.voidSoft,
  },
  counterText: { ...typography.body, color: colors.cream, fontWeight: '700' },
  combo: { ...typography.body, color: colors.gold, fontWeight: '700', marginTop: spacing.sm },
  waveRow: { marginTop: spacing.sm },
  waveLabel: { ...typography.hpLabel, color: colors.cream, marginBottom: 4 },
  waveTrack: { height: 10, backgroundColor: colors.voidCard, borderRadius: 5, overflow: 'hidden' },
  waveFill: { height: '100%', borderRadius: 5 },
  stageWrap: { position: 'relative', marginTop: spacing.sm },
  vsSplash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20, 5, 9, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    padding: spacing.md,
  },
  vsYou: { ...typography.title, color: colors.crimson },
  vsText: { ...typography.caption, color: colors.creamDim, marginVertical: 4 },
  vsEnemy: { ...typography.title, textAlign: 'center' },
  vsLang: { ...typography.caption, color: colors.cream, marginTop: 8, textAlign: 'center' },
  vsTagline: { ...typography.caption, color: colors.gold, marginTop: 4, textAlign: 'center' },
  vsSkip: { ...typography.caption, color: colors.creamDim, marginTop: 16 },
  captionPill: {
    backgroundColor: colors.voidCard,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.voidSoft,
  },
  captionText: { ...typography.caption, color: colors.cream },
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
