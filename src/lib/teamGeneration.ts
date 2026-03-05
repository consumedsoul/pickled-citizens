/**
 * Team Generation Algorithm
 *
 * Pure logic for generating balanced teams and matchups for pickleball sessions.
 * Extracted from app/sessions/page.tsx for testability.
 *
 * The snaking algorithm distributes players (sorted by DUPR rating descending)
 * alternately between two teams to balance overall skill.
 *
 * Supported player counts: 6, 8, 10, 12
 */

export type Player = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  self_reported_dupr: number | null;
};

export type Pair = [Player, Player];

export type GamePlan = {
  pairA: Pair;
  pairB: Pair;
};

export const PLAYER_COUNTS = [6, 8, 10, 12] as const;

export const MAX_GAMES_BY_TOTAL_PLAYERS: Record<number, number> = {
  6: 6,
  8: 6,
  10: 5,
  12: 5,
};

/**
 * Sort players by DUPR descending, then alphabetically by name.
 * Players with null DUPR are placed at the end.
 */
export function sortPlayersByDupr(players: Player[]): Player[] {
  const sorted = [...players];
  sorted.sort((a, b) => {
    const da = a.self_reported_dupr;
    const db = b.self_reported_dupr;
    if (da == null && db == null) return 0;
    if (da == null) return 1;
    if (db == null) return -1;
    if (db !== da) return db - da;
    const an = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim();
    const bn = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim();
    return an.localeCompare(bn);
  });
  return sorted;
}

/**
 * Snaking algorithm: distributes sorted players into two teams.
 *
 * Given players ordered [1, 2, 3, 4, 5, 6, 7, 8] by skill:
 *   Pair 0 (even): player 1 -> teamA, player 2 -> teamB
 *   Pair 1 (odd):  player 3 -> teamB, player 4 -> teamA
 *   Pair 2 (even): player 5 -> teamA, player 6 -> teamB
 *   Pair 3 (odd):  player 7 -> teamB, player 8 -> teamA
 *
 * This creates balanced teams by snaking through the ranked list.
 */
export function buildTeams(players: Player[]): { teamA: Player[]; teamB: Player[] } {
  const teamA: Player[] = [];
  const teamB: Player[] = [];

  for (let i = 0; i + 1 < players.length; i += 2) {
    const p1 = players[i];
    const p2 = players[i + 1];
    const pairIndex = i / 2;
    if (pairIndex % 2 === 0) {
      teamA.push(p1);
      teamB.push(p2);
    } else {
      teamB.push(p1);
      teamA.push(p2);
    }
  }

  return { teamA, teamB };
}

/**
 * Generate all possible pairs from a team.
 */
export function buildPairs(team: Player[]): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 0; i < team.length; i += 1) {
    for (let j = i + 1; j < team.length; j += 1) {
      pairs.push([team[i], team[j]]);
    }
  }
  return pairs;
}

/**
 * Generate the full matchup plan for a session.
 *
 * - 8 players: 6 rounds, 2 courts per round = 12 games total
 * - 10 players: 5 rounds, 2 courts per round = 10 games total
 * - 12 players: 5 rounds, 3 courts per round = 15 games total
 * - 6 players: uses generic pairing fallback = 6 games total
 *
 * Players should already be sorted in the desired order (typically by DUPR descending).
 */
export function generateMatchups(orderedPlayers: Player[]): GamePlan[] {
  const playerCount = orderedPlayers.length;
  if (!(PLAYER_COUNTS as readonly number[]).includes(playerCount)) {
    return [];
  }
  const { teamA, teamB } = buildTeams(orderedPlayers);

  let gamesPlan: GamePlan[] = [];

  if (playerCount === 8 && teamA.length === 4 && teamB.length === 4) {
    const [a1, a2, a3, a4] = teamA;
    const [b1, b2, b3, b4] = teamB;

    gamesPlan = [
      // Round 1
      { pairA: [a1, a2], pairB: [b1, b2] },
      { pairA: [a3, a4], pairB: [b3, b4] },
      // Round 2
      { pairA: [a1, a3], pairB: [b1, b3] },
      { pairA: [a2, a4], pairB: [b2, b4] },
      // Round 3
      { pairA: [a1, a4], pairB: [b1, b4] },
      { pairA: [a2, a3], pairB: [b2, b3] },
      // Round 4 (repeat Round 1)
      { pairA: [a1, a2], pairB: [b1, b2] },
      { pairA: [a3, a4], pairB: [b3, b4] },
      // Round 5 (repeat Round 2)
      { pairA: [a1, a3], pairB: [b1, b3] },
      { pairA: [a2, a4], pairB: [b2, b4] },
      // Round 6 (repeat Round 3)
      { pairA: [a1, a4], pairB: [b1, b4] },
      { pairA: [a2, a3], pairB: [b2, b3] },
    ];
  } else if (playerCount === 10 && teamA.length === 5 && teamB.length === 5) {
    const [a1, a2, a3, a4, a5] = teamA;
    const [b1, b2, b3, b4, b5] = teamB;

    gamesPlan = [
      // Round 1
      { pairA: [a1, a2], pairB: [b1, b2] },
      { pairA: [a3, a4], pairB: [b3, b4] },
      // Round 2
      { pairA: [a2, a3], pairB: [b2, b3] },
      { pairA: [a4, a5], pairB: [b4, b5] },
      // Round 3
      { pairA: [a1, a4], pairB: [b1, b4] },
      { pairA: [a3, a5], pairB: [b3, b5] },
      // Round 4
      { pairA: [a1, a3], pairB: [b1, b3] },
      { pairA: [a2, a5], pairB: [b2, b5] },
      // Round 5
      { pairA: [a1, a5], pairB: [b1, b5] },
      { pairA: [a2, a4], pairB: [b2, b4] },
    ];
  } else if (playerCount === 12 && teamA.length === 6 && teamB.length === 6) {
    const [a1, a2, a3, a4, a5, a6] = teamA;
    const [b1, b2, b3, b4, b5, b6] = teamB;

    gamesPlan = [
      // Round 1
      { pairA: [a1, a2], pairB: [b1, b2] },
      { pairA: [a3, a4], pairB: [b3, b4] },
      { pairA: [a5, a6], pairB: [b5, b6] },
      // Round 2
      { pairA: [a1, a3], pairB: [b1, b3] },
      { pairA: [a2, a5], pairB: [b2, b5] },
      { pairA: [a4, a6], pairB: [b4, b6] },
      // Round 3
      { pairA: [a1, a4], pairB: [b1, b4] },
      { pairA: [a2, a6], pairB: [b2, b6] },
      { pairA: [a3, a5], pairB: [b3, b5] },
      // Round 4
      { pairA: [a1, a5], pairB: [b1, b5] },
      { pairA: [a2, a4], pairB: [b2, b4] },
      { pairA: [a3, a6], pairB: [b3, b6] },
      // Round 5
      { pairA: [a1, a6], pairB: [b1, b6] },
      { pairA: [a2, a3], pairB: [b2, b3] },
      { pairA: [a4, a5], pairB: [b4, b5] },
    ];
  } else {
    // Generic fallback (used for 6 players)
    const pairsA = buildPairs(teamA);
    const pairsB = buildPairs(teamB);
    const baseGames: GamePlan[] = [];
    const limit = Math.min(pairsA.length, pairsB.length);

    for (let i = 0; i < limit; i += 1) {
      baseGames.push({ pairA: pairsA[i], pairB: pairsB[i] });
    }

    if (baseGames.length === 0) {
      return [];
    }

    const totalPlayers = teamA.length + teamB.length;
    const maxGames =
      MAX_GAMES_BY_TOTAL_PLAYERS[totalPlayers] ?? baseGames.length;

    for (let i = 0; i < maxGames; i += 1) {
      const base = baseGames[i % baseGames.length];
      gamesPlan.push({ pairA: base.pairA, pairB: base.pairB });
    }
  }

  return gamesPlan;
}

/**
 * Get the number of courts per round for a given player count.
 */
export function getCourtsPerRound(playerCount: number): number {
  if (playerCount >= 12) return 3;
  if (playerCount >= 8) return 2;
  return 1;
}

/**
 * Group games into rounds based on the number of courts.
 */
export function groupIntoRounds(games: GamePlan[], courtsPerRound: number): GamePlan[][] {
  const rounds: GamePlan[][] = [];
  games.forEach((game, index) => {
    const roundIndex = Math.floor(index / courtsPerRound);
    if (!rounds[roundIndex]) rounds[roundIndex] = [];
    rounds[roundIndex].push(game);
  });
  return rounds;
}
