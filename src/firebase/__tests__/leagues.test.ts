// Tests for the M5 weekly leagues (leagues.ts) — pure functions only.
// Week numbers are ISO weeks (Monday start) and were cross-checked against
// GNU `date +%V` before asserting: 2026-11-25 is a Wednesday in ISO week 48,
// 2026-01-01 is a Thursday in ISO week 01, 2026-12-31 is a Thursday in week 53.
import {
  DEMOTE_COUNT,
  LEAGUE_SIZE,
  PROMOTE_COUNT,
  anonymousLabel,
  buildLeagues,
  displayLabel,
  rankLeague,
  weekIdFor,
  weekResults,
  weekStartMs,
  weeklyXpForFights,
  type League,
  type LeaguePlayer,
} from '../leagues';

const DAY = 86_400_000;
// Noon UTC — safely inside one local day on either side of the dateline.
const WED = Date.UTC(2026, 10, 25, 12, 0, 0); // Wed 2026-11-25
const MON = Date.UTC(2026, 10, 23, 12, 0, 0); // Mon 2026-11-23
const SUN = Date.UTC(2026, 10, 29, 12, 0, 0); // Sun 2026-11-29

function player(uid: string, weeklyXp: number, prevTier?: LeaguePlayer['prevTier']): LeaguePlayer {
  return { uid, displayName: null, weeklyXp, ...(prevTier ? { prevTier } : {}) };
}

function leagueOf(members: LeaguePlayer[], tier: League['tier'] = 'Gold', weekId = '2026-W48'): League {
  return { id: `${weekId}-${tier.toLowerCase()}-1`, weekId, tier, members: rankLeague(members) };
}

describe('weekIdFor', () => {
  it("2026-11-25 (Wednesday) → '2026-W48'", () => {
    expect(weekIdFor(WED)).toBe('2026-W48');
  });

  it('Monday and Sunday of the same week share the id', () => {
    expect(weekIdFor(MON)).toBe('2026-W48');
    expect(weekIdFor(SUN)).toBe('2026-W48');
  });

  it('the previous Sunday belongs to the previous week', () => {
    expect(weekIdFor(Date.UTC(2026, 10, 22, 12, 0, 0))).toBe('2026-W47');
  });

  it("2026-01-01 (Thursday) → '2026-W01'", () => {
    expect(weekIdFor(Date.UTC(2026, 0, 1, 12, 0, 0))).toBe('2026-W01');
  });

  it('2025-12-29 (Monday) is ISO week 01 of 2026', () => {
    expect(weekIdFor(Date.UTC(2025, 11, 29, 12, 0, 0))).toBe('2026-W01');
  });

  it("2026-12-31 (Thursday) → '2026-W53'", () => {
    expect(weekIdFor(Date.UTC(2026, 11, 31, 12, 0, 0))).toBe('2026-W53');
  });

  it('week ids are zero-padded (W01, not W1)', () => {
    expect(weekIdFor(Date.UTC(2026, 0, 1, 12, 0, 0))).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe('weekStartMs', () => {
  it('Wednesday → Monday 00:00 UTC of the same week', () => {
    expect(weekStartMs(WED)).toBe(Date.UTC(2026, 10, 23, 0, 0, 0));
  });

  it('Monday noon → Monday 00:00 UTC', () => {
    expect(weekStartMs(MON)).toBe(Date.UTC(2026, 10, 23, 0, 0, 0));
  });

  it('Sunday → the Monday six days earlier', () => {
    expect(weekStartMs(SUN)).toBe(Date.UTC(2026, 10, 23, 0, 0, 0));
  });
});

describe('weeklyXpForFights', () => {
  it('only fights ended at/after Monday 00:00 UTC count', () => {
    const fights = [
      { xpEarned: 50, endedAt: Date.UTC(2026, 10, 22, 23, 59, 59) }, // Sun, last week
      { xpEarned: 30, endedAt: Date.UTC(2026, 10, 23, 0, 0, 0) }, // Mon 00:00 sharp — counts
      { xpEarned: 70, endedAt: WED }, // Wed
    ];
    expect(weeklyXpForFights(fights, WED)).toBe(100);
  });

  it('empty fights → 0', () => {
    expect(weeklyXpForFights([], WED)).toBe(0);
  });
});

describe('anonymousLabel / displayLabel', () => {
  it('is deterministic per uid', () => {
    expect(anonymousLabel('uid-abc')).toBe(anonymousLabel('uid-abc'));
  });

  it("matches /^Techie #\\d{4}$/", () => {
    expect(anonymousLabel('uid-abc')).toMatch(/^Techie #\d{4}$/);
    expect(anonymousLabel('')).toMatch(/^Techie #\d{4}$/);
  });

  it('different uids get different labels', () => {
    expect(anonymousLabel('alice')).not.toBe(anonymousLabel('bob'));
  });

  it('displayLabel prefers a set display name, else the anonymous label', () => {
    expect(displayLabel({ uid: 'u1', displayName: 'Vishwet' })).toBe('Vishwet');
    expect(displayLabel({ uid: 'u1', displayName: null })).toBe(anonymousLabel('u1'));
  });
});

describe('rankLeague', () => {
  it('orders by weekly XP desc with 1-based ranks', () => {
    const ranked = rankLeague([player('c', 50), player('a', 200), player('b', 100)]);
    expect(ranked.map(m => m.uid)).toEqual(['a', 'b', 'c']);
    expect(ranked.map(m => m.rank)).toEqual([1, 2, 3]);
  });

  it('ties break by uid ascending, deterministically', () => {
    const ranked = rankLeague([player('zz', 100), player('aa', 100), player('mm', 100)]);
    expect(ranked.map(m => m.uid)).toEqual(['aa', 'mm', 'zz']);
    expect(ranked.map(m => m.rank)).toEqual([1, 2, 3]);
  });

  it('does not mutate the input array', () => {
    const members = [player('c', 50), player('a', 200)];
    rankLeague(members);
    expect(members.map(m => m.uid)).toEqual(['c', 'a']);
  });
});

describe('weekResults', () => {
  it('top 3 promote, bottom 3 demote, middle stays (10-player Gold league)', () => {
    const members = Array.from({ length: 10 }, (_, i) => player(`u${i}`, 100 - i * 10));
    const results = weekResults(leagueOf(members, 'Gold'));
    expect(results).toHaveLength(10);
    const byUid = new Map(results.map(r => [r.uid, r]));
    expect(byUid.get('u0')).toEqual({ uid: 'u0', nextTier: 'Platinum', rank: 1 });
    expect(byUid.get('u1')?.nextTier).toBe('Platinum');
    expect(byUid.get('u2')?.nextTier).toBe('Platinum');
    expect(byUid.get('u3')?.nextTier).toBe('Gold');
    expect(byUid.get('u6')?.nextTier).toBe('Gold');
    expect(byUid.get('u7')?.nextTier).toBe('Silver');
    expect(byUid.get('u8')?.nextTier).toBe('Silver');
    expect(byUid.get('u9')).toEqual({ uid: 'u9', nextTier: 'Silver', rank: 10 });
    expect(PROMOTE_COUNT).toBe(3);
    expect(DEMOTE_COUNT).toBe(3);
  });

  it('Diamond top stays Diamond; Bronze bottom stays Bronze', () => {
    const members = Array.from({ length: 10 }, (_, i) => player(`u${i}`, 100 - i * 10));
    const diamond = weekResults(leagueOf(members, 'Diamond'));
    expect(diamond.filter(r => r.rank <= 3).every(r => r.nextTier === 'Diamond')).toBe(true);
    expect(diamond.filter(r => r.rank > 7).every(r => r.nextTier === 'Platinum')).toBe(true);

    const bronze = weekResults(leagueOf(members, 'Bronze'));
    expect(bronze.filter(r => r.rank <= 3).every(r => r.nextTier === 'Silver')).toBe(true);
    expect(bronze.filter(r => r.rank > 7).every(r => r.nextTier === 'Bronze')).toBe(true);
  });

  it('a league of 5 does not promote or demote anyone', () => {
    const members = Array.from({ length: 5 }, (_, i) => player(`u${i}`, 100 - i * 10));
    const results = weekResults(leagueOf(members, 'Gold'));
    expect(results.every(r => r.nextTier === 'Gold')).toBe(true);
  });

  it('a league of exactly 7 (promote + demote + 1) still moves', () => {
    const members = Array.from({ length: 7 }, (_, i) => player(`u${i}`, 100 - i * 10));
    const results = weekResults(leagueOf(members, 'Silver'));
    expect(results.find(r => r.rank === 1)?.nextTier).toBe('Gold');
    expect(results.find(r => r.rank === 4)?.nextTier).toBe('Silver');
    expect(results.find(r => r.rank === 7)?.nextTier).toBe('Bronze');
  });
});

describe('buildLeagues', () => {
  it('65 players → 3 leagues of 30/30/5 with tiers Diamond/Platinum/Gold', () => {
    const players = Array.from({ length: 65 }, (_, i) => player(`u${i}`, 650 - i * 10));
    const leagues = buildLeagues(players, '2026-W48');
    expect(leagues).toHaveLength(3);
    expect(leagues.map(l => l.members.length)).toEqual([30, 30, 5]);
    expect(leagues.map(l => l.tier)).toEqual(['Diamond', 'Platinum', 'Gold']);
    expect(leagues[0].id).toBe('2026-W48-diamond-1');
    expect(leagues[1].id).toBe('2026-W48-platinum-2');
    expect(leagues[2].id).toBe('2026-W48-gold-3');
    expect(leagues.every(l => l.weekId === '2026-W48')).toBe(true);
    expect(LEAGUE_SIZE).toBe(30);
  });

  it('chunk 0 is the strongest: highest XP first', () => {
    const players = Array.from({ length: 65 }, (_, i) => player(`u${i}`, 650 - i * 10));
    const leagues = buildLeagues(players, '2026-W48');
    expect(leagues[0].members[0].uid).toBe('u0');
    expect(leagues[0].members[0].weeklyXp).toBe(650);
    expect(leagues[0].members[29].weeklyXp).toBe(360);
    expect(leagues[1].members[0].weeklyXp).toBe(350);
    expect(leagues[2].members[4].weeklyXp).toBe(10);
  });

  it('previous tier outranks last-week XP in the placement sort', () => {
    // 30 Diamond-prevTier players with tiny XP + 1 Bronze player with huge
    // XP: the Bronze player must land in the SECOND league (chunk 1) even
    // though its XP dwarfs every Diamond player's. Note members inside a
    // league are re-ranked by XP (rankLeague), so the placement sort is
    // only visible across chunk boundaries.
    const players = [
      ...Array.from({ length: 30 }, (_, i) => player(`diamond-${i}`, 10 + i, 'Diamond')),
      player('bronze-rich', 9999, 'Bronze'),
    ];
    const leagues = buildLeagues(players, '2026-W48');
    expect(leagues).toHaveLength(2);
    expect(leagues[0].tier).toBe('Diamond');
    expect(leagues[0].members).toHaveLength(30);
    expect(leagues[0].members.every(m => m.uid.startsWith('diamond-'))).toBe(true);
    expect(leagues[1].tier).toBe('Platinum');
    expect(leagues[1].members.map(m => m.uid)).toEqual(['bronze-rich']);
  });

  it('members inside each league are ranked by weekly XP desc', () => {
    const players = Array.from({ length: 35 }, (_, i) => player(`u${i}`, 350 - i * 10));
    const leagues = buildLeagues(players, '2026-W48');
    for (const league of leagues) {
      const xps = league.members.map(m => m.weeklyXp);
      expect(xps).toEqual([...xps].sort((a, b) => b - a));
      expect(league.members[0].rank).toBe(1);
    }
  });

  it('30 players → exactly one Diamond league; 0 players → no leagues', () => {
    const thirty = Array.from({ length: 30 }, (_, i) => player(`u${i}`, 300 - i * 10));
    const one = buildLeagues(thirty, '2026-W48');
    expect(one).toHaveLength(1);
    expect(one[0].tier).toBe('Diamond');
    expect(one[0].members).toHaveLength(30);
    expect(buildLeagues([], '2026-W48')).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const players = [player('b', 10), player('a', 100)];
    buildLeagues(players, '2026-W48');
    expect(players.map(p => p.uid)).toEqual(['b', 'a']);
  });
});
