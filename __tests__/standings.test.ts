import { describe, it, expect } from 'vitest';
import {
  RANKED_MIN_GAMES,
  RIVALS_SHOWN,
  computeStandings,
  rankedPlayers,
  unrankedPlayers,
  rivalCloseness,
  formatWinPct,
  type SessionGame,
} from '../src/lib/standings';

/**
 * The league board: win percentage with a games floor, plus "rivals" — the
 * opponent you faced in every game of a session, with the head-to-head across
 * such sessions, closest to .500 first.
 */

let seq = 0;
function game(
  team1: string[],
  team2: string[],
  winner: 1 | 2 | 0,
  sessionId = 'S1',
  playedAt?: string,
): SessionGame {
  seq += 1;
  const split = (ids: string[]) => ({
    userIds: ids.filter((id) => !id.startsWith('guest')),
    guestCount: ids.filter((id) => id.startsWith('guest')).length,
  });
  return {
    matchId: `m${seq}`,
    sessionId,
    playedAt: playedAt ?? `${sessionId}|${String(seq).padStart(3, '0')}`,
    order: seq,
    team1: split(team1),
    team2: split(team2),
    team1Score: winner === 1 ? 1 : 0,
    team2Score: winner === 2 ? 1 : 0,
  };
}

const row = (s: ReturnType<typeof computeStandings>, id: string) =>
  s.players.find((p) => p.userId === id)!;

/**
 * A 4-player session in the generator's shape: `a` is always across from
 * `c`, and `b` always across from `d`, with partners rotating.
 */
function counterpartSession(sessionId: string, aWins: number[]): SessionGame[] {
  return aWins.map((w, i) =>
    i % 2 === 0
      ? game(['a', 'b'], ['c', 'd'], w ? 1 : 2, sessionId)
      : game(['a', 'd'], ['c', 'b'], w ? 1 : 2, sessionId),
  );
}

describe('computeStandings', () => {
  it('tallies wins, losses and win percentage per member and sorts best first', () => {
    const s = computeStandings([
      game(['a', 'b'], ['c', 'd'], 1),
      game(['a', 'c'], ['b', 'd'], 1),
      game(['a', 'd'], ['b', 'c'], 2),
    ]);
    expect(s.gamesCounted).toBe(3);
    expect(row(s, 'a')).toMatchObject({ games: 3, wins: 2, losses: 1 });
    expect(row(s, 'a').winPct).toBeCloseTo(2 / 3);
    expect(row(s, 'd')).toMatchObject({ games: 3, wins: 0, losses: 3 });
    expect(s.players.map((p) => p.userId)).toEqual(['a', 'b', 'c', 'd']);
    const pcts = s.players.map((p) => p.winPct);
    expect(pcts).toEqual([...pcts].sort((x, y) => y - x));
  });

  it('skips a game with an empty side and treats a draw as played but not won', () => {
    const s = computeStandings([
      game([], ['c', 'd'], 2),
      game(['a', 'b'], ['c', 'd'], 0),
    ]);
    expect(s.gamesCounted).toBe(1);
    expect(row(s, 'a')).toMatchObject({ games: 1, wins: 0, losses: 0, winPct: 0 });
  });

  it('never lists guests', () => {
    const s = computeStandings([game(['a', 'guest1'], ['c', 'd'], 1)]);
    expect(s.players.map((p) => p.userId).sort()).toEqual(['a', 'c', 'd']);
  });

  it('reports the record in the most recent session only', () => {
    const s = computeStandings([
      game(['a', 'b'], ['c', 'd'], 1, 'S1', '2026-09-01|1'),
      game(['a', 'b'], ['c', 'e'], 2, 'S2', '2026-09-08|1'),
      game(['a', 'e'], ['c', 'b'], 1, 'S2', '2026-09-08|2'),
    ]);
    expect(s.recentSessionId).toBe('S2');
    expect(row(s, 'a')).toMatchObject({ lastWins: 1, lastLosses: 1 });
    expect(row(s, 'd')).toMatchObject({ lastWins: 0, lastLosses: 0 }); // sat out S2
  });

  it('flags ranked at the games floor', () => {
    const games: SessionGame[] = [];
    for (let i = 0; i < RANKED_MIN_GAMES; i += 1) games.push(game(['a', 'b'], ['c', 'd'], 1));
    games.push(game(['e', 'b'], ['c', 'd'], 1));
    const s = computeStandings(games);
    expect(row(s, 'a').ranked).toBe(true);
    expect(row(s, 'e').ranked).toBe(false);
  });
});

describe('rivals', () => {
  it('a rival is the opponent faced in every game of a session; partners are not rivals', () => {
    const s = computeStandings(counterpartSession('S1', [1, 0, 1, 0, 1]));
    expect(row(s, 'a').rivals).toEqual([{ userId: 'c', wins: 3, losses: 2, games: 5 }]);
    expect(row(s, 'c').rivals).toEqual([{ userId: 'a', wins: 2, losses: 3, games: 5 }]);
    // b was a's partner in some games and opponent in others: not across the net every game.
    expect(row(s, 'a').rivals.some((r) => r.userId === 'b')).toBe(false);
    // b was on the winning side every game, so b vs d is 5-0.
    expect(row(s, 'b').rivals).toEqual([{ userId: 'd', wins: 5, losses: 0, games: 5 }]);
  });

  it('does not count an opponent who missed even one of your games that session', () => {
    const s = computeStandings([
      game(['a', 'b'], ['c', 'd'], 1),
      game(['a', 'd'], ['c', 'b'], 1),
      game(['a', 'b'], ['e', 'd'], 1), // c sits this one out
    ]);
    expect(row(s, 'a').rivals).toEqual([]);
  });

  it('accumulates the head-to-head across sessions where you were counterparts', () => {
    const s = computeStandings([
      ...counterpartSession('S1', [1, 1, 1, 0]),
      ...counterpartSession('S2', [0, 0, 1, 1]),
      // S3: a and c on the same side — no counterpart games between them.
      game(['a', 'c'], ['b', 'd'], 1, 'S3'),
      game(['a', 'c'], ['b', 'd'], 1, 'S3'),
    ]);
    expect(row(s, 'a').rivals.find((r) => r.userId === 'c')).toEqual({
      userId: 'c',
      wins: 5,
      losses: 3,
      games: 8,
    });
  });

  it('orders rivals closest to .500 first, more games breaking ties, and caps the list', () => {
    const games: SessionGame[] = [
      // vs c: 2-2 (even)
      game(['a', 'x'], ['c', 'y'], 1, 'S1'),
      game(['a', 'y'], ['c', 'x'], 2, 'S1'),
      game(['a', 'x'], ['c', 'y'], 1, 'S1'),
      game(['a', 'y'], ['c', 'x'], 2, 'S1'),
      // vs d: 3-0 (lopsided)
      game(['a', 'x'], ['d', 'y'], 1, 'S2'),
      game(['a', 'y'], ['d', 'x'], 1, 'S2'),
      game(['a', 'x'], ['d', 'y'], 1, 'S2'),
      // vs e: 2-1 (close, 3 games)
      game(['a', 'x'], ['e', 'y'], 1, 'S3'),
      game(['a', 'y'], ['e', 'x'], 2, 'S3'),
      game(['a', 'x'], ['e', 'y'], 1, 'S3'),
      // vs f: 3-2 (same closeness as e but more games)
      game(['a', 'x'], ['f', 'y'], 1, 'S4'),
      game(['a', 'y'], ['f', 'x'], 2, 'S4'),
      game(['a', 'x'], ['f', 'y'], 1, 'S4'),
      game(['a', 'y'], ['f', 'x'], 2, 'S4'),
      game(['a', 'x'], ['f', 'y'], 1, 'S4'),
    ];
    const s = computeStandings(games);
    const rivals = row(s, 'a').rivals;
    expect(rivals).toHaveLength(RIVALS_SHOWN);
    expect(rivals.map((r) => r.userId)).toEqual(['c', 'f', 'e']);
    expect(rivalCloseness({ wins: 2, losses: 2, games: 4 })).toBe(0);
    expect(rivalCloseness({ wins: 3, losses: 0, games: 3 })).toBe(1);
  });

  it('ignores guests when finding a counterpart', () => {
    const s = computeStandings([
      game(['a', 'b'], ['guest1', 'd'], 1),
      game(['a', 'd'], ['guest1', 'b'], 1),
    ]);
    expect(row(s, 'a').rivals).toEqual([]);
  });
});

describe('ranked / unranked split', () => {
  const standing = (userId: string, games: number, winPct: number, firstName: string | null) => ({
    userId,
    games,
    wins: Math.round(games * winPct),
    losses: games - Math.round(games * winPct),
    winPct,
    lastWins: 0,
    lastLosses: 0,
    rivals: [],
    ranked: games >= RANKED_MIN_GAMES,
    firstName,
  });

  it('keeps only players at the floor on the ranked board, in the engine order', () => {
    const players = [
      standing('a', RANKED_MIN_GAMES, 0.6, 'Ann'),
      standing('b', RANKED_MIN_GAMES - 1, 1, 'Bob'), // undefeated but one short
      standing('c', RANKED_MIN_GAMES + 20, 0.4, 'Cy'),
    ];
    expect(rankedPlayers(players).map((p) => p.userId)).toEqual(['a', 'c']);
  });

  it('lists the unranked by games played, then first name, case-insensitively', () => {
    const players = [
      standing('z', 4, 0.5, 'zoe'),
      standing('r', RANKED_MIN_GAMES, 0.5, 'Ranked'),
      standing('b', 4, 0.5, 'Bob'),
      standing('n', 8, 0.5, null),
      standing('a', 4, 0.5, 'ann'),
    ];
    expect(unrankedPlayers(players, (p) => p.firstName).map((p) => p.userId)).toEqual([
      'n',
      'a',
      'b',
      'z',
    ]);
  });
});

describe('formatWinPct', () => {
  it('rounds to a whole percent', () => {
    expect(formatWinPct(2 / 3)).toBe('67%');
    expect(formatWinPct(0)).toBe('0%');
  });
});
