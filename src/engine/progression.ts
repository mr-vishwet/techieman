// TechieMan — progression engine (M4). Pure functions, no React, no native
// modules: XP/levels, streaks, daily quests, spaced-repetition rematches.
// Everything date-based works on YYYY-MM-DD day strings (local time) so the
// logic is testable without a clock. Plan §2.2.

export const XP_PER_LEVEL = 100;

/** Level from total XP. Level 1 at 0–99 XP, level 2 at 100–199, … */
export function levelForXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

/** XP still needed to reach the next level. */
export function xpToNextLevel(xp: number): number {
  return XP_PER_LEVEL - (Math.max(0, xp) % XP_PER_LEVEL);
}

export interface StreakInput {
  lastPlayedDay: string | null; // YYYY-MM-DD of the last fight day, or null
  streak: number;
  freezes: number; // streak freezes available (1 earned per week, max 1 held)
}

export interface StreakResult {
  streak: number;
  freezes: number;
  freezeUsed: boolean;
  broke: boolean;
}

/** Day difference between two YYYY-MM-DD strings (UTC-safe). */
export function dayDiff(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Apply a fight on `today` to the streak.
 * Same day → unchanged. Next day → +1. One missed day + a freeze → freeze
 * spent, streak kept. More than that → streak resets to 1 (today counts).
 */
export function updateStreak(input: StreakInput, today: string): StreakResult {
  const { lastPlayedDay, streak, freezes } = input;
  if (!lastPlayedDay) return { streak: 1, freezes, freezeUsed: false, broke: false };
  const diff = dayDiff(lastPlayedDay, today);
  if (diff <= 0) return { streak, freezes, freezeUsed: false, broke: false };
  if (diff === 1) return { streak: streak + 1, freezes, freezeUsed: false, broke: false };
  if (diff === 2 && freezes > 0) {
    return { streak: streak + 1, freezes: freezes - 1, freezeUsed: true, broke: false };
  }
  return { streak: 1, freezes, freezeUsed: false, broke: true };
}

/** Spaced-repetition rematch intervals (plan §2.2): 1d → 3d → 7d, then 7d. */
export const REMATCH_INTERVALS_DAYS = [1, 3, 7] as const;

export function nextRematchAtMs(lastPlayedAtMs: number, rematchWins: number): number {
  const days = REMATCH_INTERVALS_DAYS[Math.min(rematchWins, REMATCH_INTERVALS_DAYS.length - 1)];
  return lastPlayedAtMs + days * 86_400_000;
}

export type QuestType = 'win-fights' | 'clear-rematch' | 'fast-answers';

export interface Quest {
  id: string;
  type: QuestType;
  title: string;
  target: number;
  progress: number;
  rewardGems: number;
  expiresAt: string; // YYYY-MM-DD — the quest day
  done: boolean;
}

/**
 * The 3 daily quests, deterministic per day so every player gets the same set.
 * (No RNG: the set is the product, not a lottery.)
 */
export function generateDailyQuests(day: string): Quest[] {
  return [
    { id: `q-${day}-win`, type: 'win-fights', title: 'Win 2 fights', target: 2, progress: 0, rewardGems: 10, expiresAt: day, done: false },
    { id: `q-${day}-rematch`, type: 'clear-rematch', title: 'Clear 1 weak-area rematch', target: 1, progress: 0, rewardGems: 15, expiresAt: day, done: false },
    { id: `q-${day}-fast`, type: 'fast-answers', title: 'Answer 5 questions in under 8s', target: 5, progress: 0, rewardGems: 10, expiresAt: day, done: false },
  ];
}

/**
 * Apply one finished fight to today's quests.
 * win-fights: +1 per win. clear-rematch: +1 per rematch win. fast-answers:
 * +fastAnswers (correct answers given in under 8s). A quest that reaches
 * its target completes and pays its gem reward exactly once.
 */
export interface FightQuestInput {
  won: boolean;
  isRematch: boolean;
  fastAnswers: number;
}

export interface QuestUpdate {
  quests: Quest[];
  gemsEarned: number;
}

export function applyFightToQuests(quests: Quest[], input: FightQuestInput): QuestUpdate {
  let gemsEarned = 0;
  const next = quests.map(q => {
    let progress = q.progress;
    if (q.type === 'win-fights' && input.won) progress += 1;
    if (q.type === 'clear-rematch' && input.won && input.isRematch) progress += 1;
    if (q.type === 'fast-answers') progress += input.fastAnswers;
    progress = Math.min(progress, q.target);
    const done = progress >= q.target;
    if (done && !q.done) gemsEarned += q.rewardGems;
    return { ...q, progress, done };
  });
  return { quests: next, gemsEarned };
}

/**
 * A streak freeze is earned every 7th consecutive day (max 1 held).
 * Call after updateStreak: if the streak just crossed a multiple of 7,
 * the player banks a freeze for a future missed day.
 */
export function maybeEarnFreeze(prevStreak: number, newStreak: number, freezes: number): number {
  if (newStreak > prevStreak && newStreak % 7 === 0 && freezes < 1) return freezes + 1;
  return freezes;
}

export interface ProgressRow {
  nodeId: string;
  state: 'locked' | 'open' | 'cleared' | 'mastered';
  bestCombo: number;
  lastPlayedAt: number | null;
  nextRematchAt: number | null;
  /** sub-concept tags from wrong answers, e.g. ['useState', 'keys'] */
  wrongTags: string[];
  rematchWins: number;
}

/**
 * Pick the highest-value rematch: the due node whose wrong-tags overlap most
 * with recent mistakes. Ties → the one due longest. Returns null when nothing
 * is due (no wrong tags, or nextRematchAt in the future).
 */
export function pickRematch(rows: ProgressRow[], nowMs: number): ProgressRow | null {
  const due = rows.filter(
    r => r.wrongTags.length > 0 && r.nextRematchAt !== null && r.nextRematchAt <= nowMs,
  );
  if (due.length === 0) return null;
  due.sort((a, b) => {
    if (b.wrongTags.length !== a.wrongTags.length) return b.wrongTags.length - a.wrongTags.length;
    return (a.nextRematchAt ?? 0) - (b.nextRematchAt ?? 0);
  });
  return due[0];
}

/**
 * After a fight on a node, compute the new progress row.
 * cleared = won once. mastered = cleared AND a rematch won ≥24h after clearing.
 * A lost fight never un-clears a node; it adds wrong tags and schedules a rematch.
 */
export function applyFightToProgress(
  row: ProgressRow,
  won: boolean,
  bestCombo: number,
  wrongTags: string[],
  nowMs: number,
  isRematch: boolean,
): ProgressRow {
  const tags = Array.from(new Set([...row.wrongTags, ...wrongTags]));
  if (!won) {
    return {
      ...row,
      bestCombo: Math.max(row.bestCombo, bestCombo),
      lastPlayedAt: nowMs,
      nextRematchAt: nextRematchAtMs(nowMs, row.rematchWins),
      wrongTags: tags,
    };
  }
  const wasClearedAtLeastADayAgo =
    row.state === 'cleared' && row.lastPlayedAt !== null && nowMs - row.lastPlayedAt >= 86_400_000;
  const mastered = row.state === 'mastered' || (isRematch && wasClearedAtLeastADayAgo);
  return {
    ...row,
    state: mastered ? 'mastered' : 'cleared',
    bestCombo: Math.max(row.bestCombo, bestCombo),
    lastPlayedAt: nowMs,
    nextRematchAt: mastered ? null : nextRematchAtMs(nowMs, row.rematchWins + (isRematch ? 1 : 0)),
    wrongTags: mastered ? [] : tags,
    rematchWins: row.rematchWins + (isRematch ? 1 : 0),
  };
}
