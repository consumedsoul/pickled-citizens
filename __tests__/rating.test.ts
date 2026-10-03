import { describe, it, expect } from 'vitest';
import {
  BASE_RATING,
  K_FACTOR,
  PROVISIONAL_GAMES,
  computeStandings,
  expectedScore,
  marginMultiplier,
  formatDelta,
  formatRating,
  type RatedGame,
} from '../src/lib/rating';

/**
 * The league rating engine. Everyone starts equal; only recorded results move
 * the numbers. These tests pin the behaviour Hun asked for: wins/losses plus
 * who they were against, no DUPR seeding.
 */

let seq = 0;
function game(
  team1: string[],
  team2: string[],
  s1: number,
  s2: number,
  extra: Partial<RatedGame> = {},
): RatedGame {
  seq += 1;
  const split = (ids: string[]) => ({
    userIds: ids.filter((id) => !id.startsWith('guest')),
    guestCount: ids.filter((id) => id.startsWith('guest')).length,
  });
  return {
    matchId: `m${seq}`,
    sessionId: 'S1',
    playedAt: `2026-09-01T00:00:${String(seq).padStart(2, '0')}Z`,
    order: seq,
    team1: split(team1),
    team2: split(team2),
    team1Score: s1,
    team2Score: s2,
    ...extra,
  };
}

const rating = (s: ReturnType<typeof computeStandings>, id: string) =>
  s.players.find((p) => p.userId === id)!;

describe('expectedScore', () => {
  it('is 50/50 for equal sides and favours the higher side', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
    expect(expectedScore(1200, 1000)).toBeCloseTo(0.76, 2);
    expect(expectedScore(1000, 1200) + expectedScore(1200, 1000)).toBeCloseTo(1);
  });
});

describe('marginMultiplier', () => {
  it('is flat for a one-point win and caps at 1.5x', () => {
    expect(marginMultiplier(11, 10)).toBe(1);
    expect(marginMultiplier(11, 9)).toBeGreaterThan(1);
    expect(marginMultiplier(11, 0)).toBe(1.5);
    expect(marginMultiplier(21, 0)).toBe(1.5);
    expect(marginMultiplier(0, 11)).toBe(1.5);
  });
});

describe('computeStandings', () => {
  it('starts everyone at the base rating and moves points from losers to winners', () => {
    const s = computeStandings([game(['a', 'b'], ['c', 'd'], 11, 10)]);
    expect(s.gamesCounted).toBe(1);
    expect(rating(s, 'a').rating).toBeCloseTo(BASE_RATING + K_FACTOR / 2);
    expect(rating(s, 'b').rating).toBeCloseTo(BASE_RATING + K_FACTOR / 2);
    expect(rating(s, 'c').rating).toBeCloseTo(BASE_RATING - K_FACTOR / 2);
    expect(rating(s, 'a')).toMatchObject({ games: 1, wins: 1, losses: 0, pointsFor: 11, pointsAgainst: 10 });
    expect(rating(s, 'd')).toMatchObject({ games: 1, wins: 0, losses: 1 });
    // Zero-sum: the total never changes.
    const total = s.players.reduce((n, p) => n + p.rating, 0);
    expect(total).toBeCloseTo(BASE_RATING * 4);
  });

  it('pays more for beating a stronger pair than a weaker one', () => {
    // Build up a and b first, then have two fresh pairs beat them vs beat an equal pair.
    const build = [
      game(['a', 'b'], ['x', 'y'], 11, 0),
      game(['a', 'b'], ['x', 'y'], 11, 0),
      game(['a', 'b'], ['x', 'y'], 11, 0),
    ];
    const upset = computeStandings([...build, game(['p', 'q'], ['a', 'b'], 11, 9)]);
    const routine = computeStandings([...build, game(['p', 'q'], ['r', 't'], 11, 9)]);
    expect(rating(upset, 'p').rating).toBeGreaterThan(rating(routine, 'p').rating);
    // ...and losing to a weaker pair costs more than losing to a stronger one.
    const badLoss = computeStandings([...build, game(['a', 'b'], ['p', 'q'], 9, 11)]);
    const okLoss = computeStandings([...build, game(['x', 'y'], ['p', 'q'], 9, 11)]);
    const xBefore = rating(computeStandings(build), 'x').rating;
    const aBefore = rating(computeStandings(build), 'a').rating;
    expect(aBefore - rating(badLoss, 'a').rating).toBeGreaterThan(
      xBefore - rating(okLoss, 'x').rating,
    );
  });

  it('a blowout moves more than a squeaker, but no more than 1.5x', () => {
    const close = computeStandings([game(['a', 'b'], ['c', 'd'], 11, 10)]);
    const blowout = computeStandings([game(['a', 'b'], ['c', 'd'], 11, 0)]);
    const closeGain = rating(close, 'a').rating - BASE_RATING;
    const blowoutGain = rating(blowout, 'a').rating - BASE_RATING;
    expect(blowoutGain).toBeCloseTo(closeGain * 1.5);
  });

  it('counts guests as a fixed base-rated opponent and never ranks them', () => {
    const s = computeStandings([game(['a', 'guest1'], ['c', 'd'], 11, 5)]);
    expect(s.players.map((p) => p.userId).sort()).toEqual(['a', 'c', 'd']);
    // a's side was (a + 1000)/2 vs (c + d)/2 — all 1000 — so a gains a full half-K * margin.
    expect(rating(s, 'a').rating).toBeGreaterThan(BASE_RATING);
    expect(rating(s, 'c').rating).toBeLessThan(BASE_RATING);
    // A side made only of guests still produces a valid game for the members opposite.
    const onlyGuests = computeStandings([game(['guest1', 'guest2'], ['c', 'd'], 11, 5)]);
    expect(onlyGuests.gamesCounted).toBe(1);
    expect(onlyGuests.players.map((p) => p.userId).sort()).toEqual(['c', 'd']);
  });

  it('a drawn score counts as played but moves nothing', () => {
    const s = computeStandings([game(['a', 'b'], ['c', 'd'], 10, 10)]);
    expect(rating(s, 'a').rating).toBeCloseTo(BASE_RATING);
    expect(rating(s, 'a')).toMatchObject({ games: 1, wins: 0, losses: 0 });
  });

  it('skips a game with an empty side', () => {
    const s = computeStandings([game([], ['c', 'd'], 11, 5)]);
    expect(s.gamesCounted).toBe(0);
    expect(s.players).toEqual([]);
  });

  it('replays in chronological order regardless of input order', () => {
    const g1 = game(['a', 'b'], ['c', 'd'], 11, 0, { playedAt: '2026-09-01|x', sessionId: 'S1' });
    const g2 = game(['a', 'c'], ['b', 'd'], 11, 0, { playedAt: '2026-09-08|x', sessionId: 'S2' });
    const forward = computeStandings([g1, g2]);
    const backward = computeStandings([g2, g1]);
    expect(forward.players).toEqual(backward.players);
    expect(forward.recentSessionId).toBe('S2');
  });

  it('reports the rating change over the most recent session only', () => {
    const week1 = [
      game(['a', 'b'], ['c', 'd'], 11, 0, { playedAt: '2026-09-01|1', sessionId: 'S1' }),
    ];
    const week2 = [
      game(['a', 'c'], ['b', 'e'], 11, 0, { playedAt: '2026-09-08|1', sessionId: 'S2' }),
    ];
    const s = computeStandings([...week1, ...week2]);
    expect(s.recentSessionId).toBe('S2');
    // d only played in week 1: no movement this week.
    expect(rating(s, 'd').recentDelta).toBe(0);
    expect(rating(s, 'a').recentDelta).toBeGreaterThan(0);
    expect(rating(s, 'b').recentDelta).toBeLessThan(0);
    // The week-2 deltas are exactly the week-2 rating change.
    const before = computeStandings(week1);
    expect(rating(before, 'a').rating + rating(s, 'a').recentDelta).toBeCloseTo(
      rating(s, 'a').rating,
    );
  });

  it('sorts best first and flags provisional players', () => {
    const games: RatedGame[] = [];
    for (let i = 0; i < PROVISIONAL_GAMES; i += 1) {
      games.push(game(['a', 'b'], ['c', 'd'], 11, 5));
    }
    games.push(game(['e', 'c'], ['d', 'b'], 11, 9));
    const s = computeStandings(games);
    expect(s.players[0].userId).toBe('a');
    const ratings = s.players.map((p) => p.rating);
    expect(ratings).toEqual([...ratings].sort((x, y) => y - x));
    expect(rating(s, 'a').provisional).toBe(false);
    expect(rating(s, 'e').provisional).toBe(true);
  });
});

describe('formatters', () => {
  it('round for display', () => {
    expect(formatRating(1016.4)).toBe('1016');
    expect(formatDelta(0.3)).toBe('–');
    expect(formatDelta(7.6)).toBe('+8');
    expect(formatDelta(-3.2)).toBe('-3');
  });
});
