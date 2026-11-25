// TechieMan — Live Level screen (M7 / Live Levels).
// The Live Level Rule (user, 26 Nov 2026): each concept is a LIVE LEVEL —
// the concept runs live in code inside the level, with its test cases and
// complex cases in the same code. The player plays the live scenario
// (observe → diagnose → act → survive); the question bank is the fight
// ammunition, not the whole game.
//
// The screen drives the deterministic runtime (src/engine/levelRuntime.ts):
// it calls session.tick() on a real 500 ms interval (one virtual 100 ms
// tick per interval, so the player can read the feed), and never calls the
// scenario script directly. What you see is what runs — the code view
// renders def.script.toString(), literally the code that runs.
// Question loading, the 15 s timer, and the finishFight recording mirror
// FightScreen exactly (same bank fallback, same loss-records-an-attempt
// rule: a lost level banks wrong tags and streak activity, never XP).

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ALL_QUESTIONS } from '../data/allQuestions';
import type { Question } from '../data/questions';
import { enemyForNode } from '../data/enemies';
import { levelForNode } from '../data/levels';
import {
  createLevelSession,
  type LevelPhase,
  type LevelSession,
  type WorldEventKind,
} from '../engine/levelRuntime';
import { loadQuestionsForNode, questionsForNodeLocal } from '../storage/bank';
import { useGameStore } from '../store/useGameStore';
import { colors, spacing, typography } from '../theme/tokens';
import type { LevelScreenProps } from '../navigation/types';

const QUESTION_SECONDS = 15;
/** One virtual tick (100 ms) every 500 ms of real time — readable pace. */
const TICK_INTERVAL_MS = 500;
/** How long an answered question + its damage stay on screen before the next. */
const ANSWER_HOLD_MS = 1500;
/** The feed keeps the latest N events, newest first. */
const FEED_LIMIT = 30;

const PHASE_LABELS: Record<LevelPhase, string> = {
  observe: 'OBSERVE',
  diagnose: 'DIAGNOSE',
  act: 'ACT',
  survived: 'SURVIVED',
  failed: 'FAILED',
};

const PHASE_COLORS: Record<LevelPhase, string> = {
  observe: colors.creamDim,
  diagnose: colors.gold,
  act: colors.accentReactNative,
  survived: colors.success,
  failed: colors.danger,
};

const EVENT_COLORS: Record<WorldEventKind, string> = {
  info: colors.creamDim,
  attack: colors.danger,
  fix: colors.success,
  crash: colors.danger,
  request: colors.accentReactNative,
  objective: colors.gold,
  question: colors.cream,
};

function formatGaugeValue(v: number | string | boolean): string {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

export function LevelScreen({ route, navigation }: LevelScreenProps) {
  const { nodeId } = route.params;
  const def = levelForNode(nodeId);
  const enemy = enemyForNode(nodeId);

  // The session is mutable by design (the runtime mutates it in place);
  // `version` is the re-render trigger — bump it after every tick/answer.
  const [session, setSession] = useState<LevelSession | null>(() =>
    def ? createLevelSession(def, 1) : null,
  );
  const [, setVersion] = useState(0);
  const bump = () => setVersion(v => v + 1);

  const [paused, setPaused] = useState(false);
  const [xpEarned, setXpEarned] = useState<number | null>(null);
  const recordedRef = useRef(false);
  const finishFight = useGameStore(s => s.finishFight);

  // Questions: same loading as FightScreen — seeded SQLite bank, TS arrays
  // as fallback. null = still loading.
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
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [damage, setDamage] = useState<{
    key: number;
    dealt: number;
    taken: number;
    correct: boolean;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const outcome = session?.outcome() ?? 'ongoing';
  const finished = outcome !== 'ongoing';
  const question = questions[qIndex];

  // Auto-tick: drive the virtual clock on a real interval. Stops when the
  // level is survived/failed, and while paused. Never calls the script.
  useEffect(() => {
    if (!session || paused || finished) return;
    const id = setInterval(() => {
      session.tick();
      bump();
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [session, paused, finished]);

  // 15 s question timer, mirroring FightScreen.
  useEffect(() => {
    if (finished || selected !== null || questions.length === 0) return;
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
  }, [qIndex, finished, selected, questions.length]);

  // Timeout counts as a wrong answer, mirroring FightScreen.
  useEffect(() => {
    if (timeLeft === 0 && selected === null && !finished && question) {
      answer(-1, QUESTION_SECONDS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // Terminal: record once into the progression shell, exactly like
  // FightScreen — a loss records the attempt (0 XP, wrong tags banked).
  useEffect(() => {
    if (!session || outcome === 'ongoing' || recordedRef.current) return;
    recordedRef.current = true;
    const summary = finishFight(nodeId, {
      won: outcome === 'win',
      correctCount: session.correctCount,
      wrongCount: session.wrongCount,
      bestCombo: session.fight.bestCombo,
      totalQuestions: session.correctCount + session.wrongCount,
      flawless: session.wrongCount === 0,
      isBoss: false,
      wrongTags: [],
      fastAnswers: session.fastAnswers,
      durationMs: session.world.nowMs,
      startedAt: session.startedAt,
    });
    setXpEarned(summary.xpEarned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, session]);

  function answer(optionIndex: number, secondsUsed: number) {
    if (!session || selected !== null || finished || !question) return;
    const correct = optionIndex === question.correctIndex;
    setSelected(optionIndex);
    const result = session.answerQuestion(correct, secondsUsed);
    setDamage({
      key: Date.now(),
      dealt: result.damageDealt,
      taken: result.damageTaken,
      correct,
    });
    setWhy(question.explanation);
    bump();
    advanceRef.current = setTimeout(() => {
      setSelected(null);
      setWhy(null);
      setDamage(null);
      if (questions.length > 0) setQIndex(i => (i + 1) % questions.length);
    }, ANSWER_HOLD_MS);
  }

  function retry() {
    if (!def) return;
    if (advanceRef.current) clearTimeout(advanceRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    recordedRef.current = false;
    setXpEarned(null);
    setQIndex(0);
    setSelected(null);
    setWhy(null);
    setDamage(null);
    setPaused(false);
    setTimeLeft(QUESTION_SECONDS);
    setSession(createLevelSession(def, 1));
    bump();
  }

  if (!def || !session) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No live level yet</Text>
        <Text style={styles.body}>
          Node {nodeId} has no live level — it is still in production. No
          placeholder level is shown; the scenario has to run for real first.
        </Text>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back to roadmap</Text>
        </Pressable>
      </View>
    );
  }

  const objectives = session.objectives();
  const allPassed = objectives.every(o => o.passed);
  const hpFloorNote =
    session.fight.enemy.hp <= 1 && !allPassed && outcome === 'ongoing';
  const feed = [...session.world.events].reverse().slice(0, FEED_LIMIT);
  const appliedFixes = def.fixActions.filter(f =>
    session.appliedFixIds.includes(f.id),
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header: title, node, villain, phase */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{def.title}</Text>
          <Text style={styles.nodeId}>
            {def.nodeId} · Difficulty {def.difficulty}/5
          </Text>
          <Text style={[styles.villain, { color: def.villainAccent }]}>
            {def.villainName}
          </Text>
          {enemy ? (
            <Text style={styles.body}>
              {enemy.language} — {enemy.tagline}
            </Text>
          ) : null}
        </View>
        <View style={[styles.phaseBadge, { borderColor: PHASE_COLORS[session.phase] }]}>
          <Text style={[styles.phaseText, { color: PHASE_COLORS[session.phase] }]}>
            {PHASE_LABELS[session.phase]}
          </Text>
        </View>
      </View>
      <Text style={styles.body}>{def.intro}</Text>
      <Text style={styles.caption}>
        Virtual clock: tick {session.world.tick} · {session.world.nowMs} ms · seed{' '}
        {session.world.seed}
      </Text>

      {/* HP bars */}
      <View style={styles.hpRow}>
        <View style={styles.hpBlock}>
          <Text style={styles.hpLabel}>YOU · {session.fight.player.hp}</Text>
          <View style={styles.hpTrack}>
            <View
              style={[
                styles.hpFill,
                styles.hpPlayer,
                { width: `${(session.fight.player.hp / session.fight.player.maxHp) * 100}%` },
              ]}
            />
          </View>
        </View>
        <View style={styles.hpBlock}>
          <Text style={styles.hpLabel}>
            {def.villainName.toUpperCase()} · {session.fight.enemy.hp}
          </Text>
          <View style={styles.hpTrack}>
            <View
              style={[
                styles.hpFill,
                { backgroundColor: def.villainAccent },
                { width: `${(session.fight.enemy.hp / session.fight.enemy.maxHp) * 100}%` },
              ]}
            />
          </View>
        </View>
      </View>
      <Text style={styles.caption}>
        Combo ×{session.fight.combo} · best ×{session.fight.bestCombo} ·{' '}
        {session.correctCount} correct · {session.wrongCount} wrong
      </Text>
      {hpFloorNote ? (
        <Text style={styles.floorNote}>
          {def.villainName} clings to life at 1 HP — the villain feeds on the
          live bug. No killing blow until every objective is green.
        </Text>
      ) : null}

      {/* Tick controls */}
      <View style={styles.tickRow}>
        <Pressable
          style={[styles.tickButton, paused && styles.tickButtonActive]}
          onPress={() => setPaused(p => !p)}
          disabled={finished}>
          <Text style={styles.buttonText}>{paused ? '▶ Resume' : '⏸ Pause'}</Text>
        </Pressable>
        <Pressable
          style={styles.tickButton}
          disabled={!paused || finished}
          onPress={() => {
            session.tick();
            bump();
          }}>
          <Text style={[styles.buttonText, (!paused || finished) && styles.buttonTextDim]}>
            Step +100 ms
          </Text>
        </Pressable>
        <Text style={styles.caption}>
          {finished ? 'Clock stopped' : paused ? 'Paused' : 'Live · 1 tick / 500 ms'}
        </Text>
      </View>

      {/* Code view — this IS the code that runs */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>THE CODE THAT RUNS — live scenario</Text>
        <Text style={styles.caption}>
          This function executes every tick. What you see is what runs.
        </Text>
        <ScrollView horizontal style={styles.codeScroll}>
          <Text style={styles.code}>{def.script.toString()}</Text>
        </ScrollView>
      </View>

      {/* Applied fix source */}
      {appliedFixes.map(fix => (
        <View key={fix.id} style={styles.card}>
          <Text style={styles.cardTitle}>APPLIED FIX — {fix.label}</Text>
          <Text style={styles.body}>{fix.appliedNote}</Text>
          <ScrollView horizontal style={styles.codeScroll}>
            <Text style={styles.code}>{fix.apply.toString()}</Text>
          </ScrollView>
        </View>
      ))}

      {/* Live state readout — generic over the runtime's state + gauges */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>LIVE STATE</Text>
        <Text style={styles.gaugeRow}>
          Rendered rows: {session.state.renderedRows} / {session.state.totalRows}
        </Text>
        <Text style={styles.gaugeRow}>
          Frame cost: {session.state.frameCostMs} ms/frame (deterministic model,
          not a device measurement)
        </Text>
        <Text style={styles.gaugeRow}>
          Server: received {session.state.serverReceived} · processed{' '}
          {session.state.serverProcessed}
        </Text>
        {session.state.crashed ? (
          <Text style={[styles.gaugeRow, styles.crashText]}>
            CRASHED — {session.state.crashMessage}
          </Text>
        ) : (
          <Text style={[styles.gaugeRow, styles.okText]}>Rendering clean — no crash</Text>
        )}
        {Object.entries(session.state.gauges).map(([key, value]) => (
          <Text key={key} style={styles.gaugeRow}>
            {key}: {formatGaugeValue(value)}
          </Text>
        ))}
      </View>

      {/* Objectives */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>OBJECTIVES</Text>
        {objectives.map(o => (
          <View key={o.id} style={styles.objectiveRow}>
            <Text style={[styles.objectiveMark, o.passed && styles.objectivePassed]}>
              {o.passed ? '✓' : '○'}
            </Text>
            <View style={styles.objectiveText}>
              <Text style={[styles.body, o.passed && styles.objectivePassed]}>
                {o.label}
              </Text>
              {!o.passed ? <Text style={styles.caption}>{o.hint}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      {/* Fix actions — no "correct" badge before the player tries one */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>FIX ACTIONS</Text>
        <Text style={styles.caption}>
          Apply a fix and watch the live scenario prove it — or fail.
        </Text>
        {def.fixActions.map(fix => {
          const applied = session.appliedFixIds.includes(fix.id);
          return (
            <Pressable
              key={fix.id}
              disabled={applied || finished}
              onPress={() => {
                session.applyFix(fix.id);
                bump();
              }}
              style={[styles.actionButton, applied && styles.actionButtonApplied]}>
              <Text style={styles.buttonText}>
                {applied ? `✓ ${fix.label}` : fix.label}
              </Text>
              {applied ? <Text style={styles.caption}>{fix.appliedNote}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {/* Complex cases — latch after one trigger */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>COMPLEX CASES</Text>
        {def.complexCases.map(c => {
          const triggered = session.triggeredCaseIds.includes(c.id);
          return (
            <Pressable
              key={c.id}
              disabled={triggered || finished}
              onPress={() => {
                session.triggerCase(c.id);
                bump();
              }}
              style={[styles.actionButton, triggered && styles.actionButtonApplied]}>
              <Text style={styles.buttonText}>
                {triggered ? `✓ ${c.label}` : c.label}
              </Text>
              <Text style={styles.caption}>{c.description}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Question panel — the ammunition, same bank + timer as FightScreen */}
      {finished ? (
        <View style={styles.card}>
          <Text style={styles.title}>
            {outcome === 'win' ? 'LEVEL SURVIVED' : 'KNOCKED OUT'}
          </Text>
          <Text style={styles.body}>
            {outcome === 'win'
              ? `Every objective green, villain down. ${session.correctCount} correct, ${session.wrongCount} wrong, best combo ×${session.fight.bestCombo}.`
              : 'The concept wins this round. The live bug is still feeding it — retry and fix the scenario.'}
          </Text>
          {xpEarned !== null ? (
            <Text style={styles.body}>+{xpEarned} XP banked.</Text>
          ) : null}
          {outcome === 'lose' ? (
            <Pressable style={styles.primaryButton} onPress={retry}>
              <Text style={styles.buttonText}>Retry level</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Roadmap')}>
            <Text style={styles.buttonText}>Back to Roadmap</Text>
          </Pressable>
        </View>
      ) : bankQuestions === null ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>QUESTIONS — AMMUNITION</Text>
          <Text style={styles.body}>Loading questions from the bank…</Text>
        </View>
      ) : questions.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>QUESTIONS — AMMUNITION</Text>
          <Text style={styles.body}>
            The question bank for this node is being authored — 0 questions
            yet. No placeholder questions are shown. You can still play the
            level: watch the scenario, apply fixes, trigger complex cases.
          </Text>
        </View>
      ) : question ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>QUESTIONS — AMMUNITION</Text>
          <Text style={styles.timer}>
            ⏱ {timeLeft}s · Q{qIndex + 1} of {questions.length} · combo ×
            {session.fight.combo}
          </Text>
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
          {damage ? (
            <Text
              style={[
                styles.damageText,
                damage.correct ? styles.damageDealt : styles.damageTaken,
              ]}>
              {damage.correct
                ? `+${damage.dealt} damage to ${def.villainName}`
                : `-${damage.taken} HP — ${def.villainName} strikes back and the live failure escalates`}
            </Text>
          ) : null}
          {why ? <Text style={styles.why}>💡 {why}</Text> : null}
        </View>
      ) : null}

      {/* Villain attack feed — latest 30 events, newest first */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>LIVE FEED — what the scenario is doing</Text>
        {feed.length === 0 ? (
          <Text style={styles.body}>Nothing yet — the clock is ticking.</Text>
        ) : (
          feed.map((ev, i) => (
            <Text
              key={`${ev.tick}-${ev.atMs}-${i}`}
              style={[styles.feedLine, { color: EVENT_COLORS[ev.kind] }]}>
              t{ev.tick} · {ev.atMs}ms · [{ev.kind.toUpperCase()}] {ev.message}
            </Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.void },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  headerRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  headerText: { flex: 1 },
  title: { ...typography.title, color: colors.cream },
  nodeId: { ...typography.caption, color: colors.creamDim, marginTop: spacing.xs },
  villain: { ...typography.chapterTitle, marginTop: spacing.sm },
  body: { ...typography.body, color: colors.creamDim, marginTop: spacing.sm },
  caption: { ...typography.caption, color: colors.creamDim, marginTop: spacing.xs },
  phaseBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  phaseText: { ...typography.hpLabel },
  hpRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  hpBlock: { flex: 1 },
  hpLabel: { ...typography.hpLabel, color: colors.cream, marginBottom: 4 },
  hpTrack: { height: 10, backgroundColor: colors.voidCard, borderRadius: 5, overflow: 'hidden' },
  hpFill: { height: '100%', borderRadius: 5 },
  hpPlayer: { backgroundColor: colors.hpPlayer },
  floorNote: { ...typography.body, color: colors.gold, marginTop: spacing.sm },
  tickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tickButton: {
    backgroundColor: colors.voidCard,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.voidSoft,
  },
  tickButtonActive: { borderColor: colors.crimson },
  card: {
    backgroundColor: colors.voidCard,
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.voidSoft,
  },
  cardTitle: { ...typography.hpLabel, color: colors.cream, letterSpacing: 1 },
  codeScroll: { marginTop: spacing.sm, maxHeight: 320 },
  code: { fontFamily: 'monospace', fontSize: 12, color: colors.cream, lineHeight: 17 },
  gaugeRow: { ...typography.body, color: colors.cream, marginTop: spacing.xs },
  crashText: { color: colors.danger, fontWeight: '700' },
  okText: { color: colors.success },
  objectiveRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  objectiveMark: { fontSize: 18, color: colors.creamDim },
  objectivePassed: { color: colors.success },
  objectiveText: { flex: 1 },
  actionButton: {
    backgroundColor: colors.void,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.voidSoft,
  },
  actionButtonApplied: { borderColor: colors.success, opacity: 0.8 },
  timer: { ...typography.caption, color: colors.gold, marginTop: spacing.sm },
  question: {
    ...typography.body,
    color: colors.cream,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
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
  damageText: { ...typography.body, fontWeight: '700', marginTop: spacing.sm },
  damageDealt: { color: colors.success },
  damageTaken: { color: colors.danger },
  why: { ...typography.caption, color: colors.creamDim, marginTop: spacing.sm },
  feedLine: { ...typography.caption, marginTop: spacing.xs, lineHeight: 18 },
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
  buttonTextDim: { color: colors.creamDim },
});
