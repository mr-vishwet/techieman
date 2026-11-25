// TechieMan — weekly leagues (M5, Phase 2 piece).
// Weekly, anonymous-by-default, 30-player leagues, Bronze → Diamond.
//
// How it works (honest version — no fake players, ever):
//   * Every signed-in player writes their own weekly XP to their league's
//     member doc (see sync.ts FirestorePort.setLeagueMember). Firestore is
//     the source of truth for membership; the app never invents opponents.
//   * League assignment into 30-player groups is a pure function here
//     (buildLeagues) so it is testable; in production a scheduled Cloud
//     Function runs it weekly (sketch in FIREBASE_SETUP.md). Until a league
//     doc exists for the week, the UI shows the honest "not placed yet"
//     state — never a fabricated leaderboard.
//   * Ranking / promotion / demotion are pure functions over the member
//     list, so the League screen renders identically from Firestore data
//     and from test fixtures.
//   * Display names are anonymous by default: "Techie #4821" derived from
//     the uid hash. A real name appears only if the player sets one.

export type LeagueTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export const LEAGUE_TIERS: LeagueTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

export const LEAGUE_SIZE = 30;
export const PROMOTE_COUNT = 3;
export const DEMOTE_COUNT = 3;

export interface LeaguePlayer {
  uid: string;
  /** Null = anonymous (the default). Only shown when the player opts in. */
  displayName: string | null;
  weeklyXp: number;
  /** Tier the player finished last week in (placement input; optional when only ranking). */
  prevTier?: LeagueTier;
}

export interface LeagueMember extends LeaguePlayer {
  rank: number;
}

export interface League {
  id: string;
  weekId: string;
  tier: LeagueTier;
  members: LeagueMember[];
}

/** ISO week id, e.g. "2026-W48". Monday = week start. */
export function weekIdFor(nowMs: number): string {
  const d = new Date(nowMs);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  const week = 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + firstDay) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Monday 00:00 UTC, the start of the week containing nowMs. */
export function weekStartMs(nowMs: number): number {
  const d = new Date(nowMs);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.getTime();
}

/** XP earned from fights in the current week (fights carry xpEarned + endedAt). */
export function weeklyXpForFights(
  fights: { xpEarned: number; endedAt: number }[],
  nowMs: number,
): number {
  const start = weekStartMs(nowMs);
  return fights.filter(f => f.endedAt >= start).reduce((sum, f) => sum + f.xpEarned, 0);
}

function hash4(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (Math.imul(h, 31) + input.charCodeAt(i)) | 0;
  return String(Math.abs(h) % 9000 + 1000);
}

/** Anonymous label — the default display name. Deterministic per uid. */
export function anonymousLabel(uid: string): string {
  return `Techie #${hash4(uid)}`;
}

export function displayLabel(player: { uid: string; displayName: string | null }): string {
  return player.displayName ?? anonymousLabel(player.uid);
}

function tierRank(tier: LeagueTier): number {
  return LEAGUE_TIERS.indexOf(tier);
}

/** Rank members by weekly XP desc (ties: uid asc, deterministic). */
export function rankLeague(members: LeaguePlayer[]): LeagueMember[] {
  const sorted = [...members].sort((a, b) => {
    if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
    return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
  });
  return sorted.map((m, i) => ({ ...m, rank: i + 1 }));
}

function nextTierUp(tier: LeagueTier): LeagueTier {
  return LEAGUE_TIERS[Math.min(LEAGUE_TIERS.length - 1, tierRank(tier) + 1)];
}

function nextTierDown(tier: LeagueTier): LeagueTier {
  return LEAGUE_TIERS[Math.max(0, tierRank(tier) - 1)];
}

/**
 * Week-end outcome for every member of one league.
 * Top PROMOTE_COUNT promote (unless already Diamond), bottom DEMOTE_COUNT
 * demote (unless already Bronze). Small leagues (< 7) don't promote/demote
 * — a 3-player week promoting everyone is meaningless.
 */
export function weekResults(league: League): { uid: string; nextTier: LeagueTier; rank: number }[] {
  const ranked = rankLeague(league.members);
  const canMove = ranked.length >= PROMOTE_COUNT + DEMOTE_COUNT + 1;
  return ranked.map(m => {
    let nextTier = league.tier;
    if (canMove && m.rank <= PROMOTE_COUNT) nextTier = nextTierUp(league.tier);
    else if (canMove && m.rank > ranked.length - DEMOTE_COUNT) nextTier = nextTierDown(league.tier);
    return { uid: m.uid, nextTier, rank: m.rank };
  });
}

/**
 * Split all players for a week into 30-player leagues, strongest first.
 * Sort key: previous tier desc, then last week's XP desc. Groups are
 * filled top-down (snake draft is overkill for v1 — contiguous chunks of
 * similarly-ranked players keep leagues competitive); the top chunk is
 * Diamond, the next Platinum, and so on, with all remaining chunks Bronze.
 */
export function buildLeagues(players: LeaguePlayer[], weekId: string): League[] {
  const sorted = [...players].sort((a, b) => {
    const tierDiff = tierRank(b.prevTier ?? 'Bronze') - tierRank(a.prevTier ?? 'Bronze');
    if (tierDiff !== 0) return tierDiff;
    return b.weeklyXp - a.weeklyXp;
  });
  const leagues: League[] = [];
  for (let i = 0; i < sorted.length; i += LEAGUE_SIZE) {
    const chunk = sorted.slice(i, i + LEAGUE_SIZE);
    const groupIndex = leagues.length;
    const tier = LEAGUE_TIERS[Math.max(0, LEAGUE_TIERS.length - 1 - groupIndex)];
    leagues.push({
      id: `${weekId}-${tier.toLowerCase()}-${groupIndex + 1}`,
      weekId,
      tier,
      members: rankLeague(chunk),
    });
  }
  return leagues;
}
