import { describe, it, expect } from "vitest";
import {
  Player,
  GamePlan,
  buildTeams,
  buildPairs,
  generateMatchups,
  sortPlayersByDupr,
  getCourtsPerRound,
  groupIntoRounds,
  MAX_GAMES_BY_TOTAL_PLAYERS,
} from "../src/lib/teamGeneration";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayers(count: number, duprs?: (number | null)[]): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    user_id: `player-${i + 1}`,
    first_name: `Player`,
    last_name: `${i + 1}`,
    email: `player${i + 1}@test.com`,
    self_reported_dupr: duprs ? duprs[i] : 4.0 - i * 0.25,
  }));
}

function allPlayerIdsInGame(game: GamePlan): string[] {
  return [
    game.pairA[0].user_id,
    game.pairA[1].user_id,
    game.pairB[0].user_id,
    game.pairB[1].user_id,
  ];
}

function uniquePlayerIds(games: GamePlan[]): Set<string> {
  const ids = new Set<string>();
  games.forEach((game) => {
    allPlayerIdsInGame(game).forEach((id) => ids.add(id));
  });
  return ids;
}

// ---------------------------------------------------------------------------
// buildTeams — snaking algorithm
// ---------------------------------------------------------------------------

describe("buildTeams (snaking algorithm)", () => {
  it("distributes 8 players into two teams of 4 using snaking", () => {
    const players = makePlayers(8);
    const { teamA, teamB } = buildTeams(players);

    expect(teamA).toHaveLength(4);
    expect(teamB).toHaveLength(4);

    // Verify all players accounted for
    const allIds = [...teamA, ...teamB].map((p) => p.user_id);
    expect(new Set(allIds).size).toBe(8);
  });

  it("applies snaking pattern correctly for 8 players", () => {
    // Players ordered 1-8 by rank (1 = best)
    const players = makePlayers(8);
    const { teamA, teamB } = buildTeams(players);

    // Pair 0 (even): p1 -> A, p2 -> B
    expect(teamA[0].user_id).toBe("player-1");
    expect(teamB[0].user_id).toBe("player-2");

    // Pair 1 (odd): p3 -> B, p4 -> A
    expect(teamB[1].user_id).toBe("player-3");
    expect(teamA[1].user_id).toBe("player-4");

    // Pair 2 (even): p5 -> A, p6 -> B
    expect(teamA[2].user_id).toBe("player-5");
    expect(teamB[2].user_id).toBe("player-6");

    // Pair 3 (odd): p7 -> B, p8 -> A
    expect(teamB[3].user_id).toBe("player-7");
    expect(teamA[3].user_id).toBe("player-8");
  });

  it("distributes 6 players into two teams of 3", () => {
    const players = makePlayers(6);
    const { teamA, teamB } = buildTeams(players);

    expect(teamA).toHaveLength(3);
    expect(teamB).toHaveLength(3);
  });

  it("distributes 10 players into two teams of 5", () => {
    const players = makePlayers(10);
    const { teamA, teamB } = buildTeams(players);

    expect(teamA).toHaveLength(5);
    expect(teamB).toHaveLength(5);
  });

  it("distributes 12 players into two teams of 6", () => {
    const players = makePlayers(12);
    const { teamA, teamB } = buildTeams(players);

    expect(teamA).toHaveLength(6);
    expect(teamB).toHaveLength(6);
  });

  it("balances DUPR across teams (average DUPR difference is small)", () => {
    // Realistic DUPR spread: 4.5, 4.2, 4.0, 3.8, 3.5, 3.2, 3.0, 2.8
    const duprs = [4.5, 4.2, 4.0, 3.8, 3.5, 3.2, 3.0, 2.8];
    const players = makePlayers(8, duprs);
    const sorted = sortPlayersByDupr(players);
    const { teamA, teamB } = buildTeams(sorted);

    const avgA =
      teamA.reduce((sum, p) => sum + (p.self_reported_dupr ?? 0), 0) /
      teamA.length;
    const avgB =
      teamB.reduce((sum, p) => sum + (p.self_reported_dupr ?? 0), 0) /
      teamB.length;

    // The snaking algorithm should keep teams within 0.5 DUPR of each other
    expect(Math.abs(avgA - avgB)).toBeLessThan(0.5);
  });
});

// ---------------------------------------------------------------------------
// buildPairs
// ---------------------------------------------------------------------------

describe("buildPairs", () => {
  it("generates correct number of pairs from a team of 3", () => {
    const team = makePlayers(3);
    const pairs = buildPairs(team);
    // C(3,2) = 3
    expect(pairs).toHaveLength(3);
  });

  it("generates correct number of pairs from a team of 4", () => {
    const team = makePlayers(4);
    const pairs = buildPairs(team);
    // C(4,2) = 6
    expect(pairs).toHaveLength(6);
  });

  it("each pair has exactly 2 players", () => {
    const team = makePlayers(5);
    const pairs = buildPairs(team);
    pairs.forEach((pair) => {
      expect(pair).toHaveLength(2);
      expect(pair[0].user_id).not.toBe(pair[1].user_id);
    });
  });
});

// ---------------------------------------------------------------------------
// sortPlayersByDupr
// ---------------------------------------------------------------------------

describe("sortPlayersByDupr", () => {
  it("sorts players in descending DUPR order", () => {
    const players = makePlayers(4, [2.5, 4.0, 3.0, 3.5]);
    const sorted = sortPlayersByDupr(players);

    expect(sorted[0].self_reported_dupr).toBe(4.0);
    expect(sorted[1].self_reported_dupr).toBe(3.5);
    expect(sorted[2].self_reported_dupr).toBe(3.0);
    expect(sorted[3].self_reported_dupr).toBe(2.5);
  });

  it("places null DUPR players at the end", () => {
    const players = makePlayers(4, [null, 4.0, null, 3.0]);
    const sorted = sortPlayersByDupr(players);

    expect(sorted[0].self_reported_dupr).toBe(4.0);
    expect(sorted[1].self_reported_dupr).toBe(3.0);
    expect(sorted[2].self_reported_dupr).toBeNull();
    expect(sorted[3].self_reported_dupr).toBeNull();
  });

  it("does not mutate the original array", () => {
    const players = makePlayers(3, [1.0, 3.0, 2.0]);
    const original = [...players];
    sortPlayersByDupr(players);

    expect(players[0].user_id).toBe(original[0].user_id);
    expect(players[1].user_id).toBe(original[1].user_id);
    expect(players[2].user_id).toBe(original[2].user_id);
  });
});

// ---------------------------------------------------------------------------
// generateMatchups — 8 players
// ---------------------------------------------------------------------------

describe("generateMatchups — 8 players", () => {
  const players = makePlayers(8);
  const games = generateMatchups(players);

  it("produces exactly 12 games (6 rounds x 2 courts)", () => {
    expect(games).toHaveLength(12);
  });

  it("each game has exactly 4 unique players (2 per team)", () => {
    games.forEach((game) => {
      const ids = allPlayerIdsInGame(game);
      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(4);
    });
  });

  it("all 8 players appear across all games", () => {
    const ids = uniquePlayerIds(games);
    expect(ids.size).toBe(8);
  });

  it("groups into 6 rounds with 2 games per round", () => {
    const courts = getCourtsPerRound(8);
    expect(courts).toBe(2);

    const rounds = groupIntoRounds(games, courts);
    expect(rounds).toHaveLength(6);
    rounds.forEach((round) => {
      expect(round).toHaveLength(2);
    });
  });

  it("every player appears in every round (no player sits out)", () => {
    const courts = getCourtsPerRound(8);
    const rounds = groupIntoRounds(games, courts);

    rounds.forEach((round, roundIndex) => {
      const playerIdsInRound = new Set<string>();
      round.forEach((game) => {
        allPlayerIdsInGame(game).forEach((id) => playerIdsInRound.add(id));
      });
      expect(playerIdsInRound.size).toBe(
        8,
        `Round ${roundIndex + 1} should have all 8 players but found ${playerIdsInRound.size}`
      );
    });
  });

  it("no player appears on two courts in the same round", () => {
    const courts = getCourtsPerRound(8);
    const rounds = groupIntoRounds(games, courts);

    rounds.forEach((round, roundIndex) => {
      const allIds: string[] = [];
      round.forEach((game) => {
        allIds.push(...allPlayerIdsInGame(game));
      });
      expect(allIds.length).toBe(
        new Set(allIds).size,
        `Round ${roundIndex + 1} has a player appearing on multiple courts`
      );
    });
  });

  it("pairA players are always from teamA and pairB from teamB", () => {
    const { teamA, teamB } = buildTeams(players);
    const teamAIds = new Set(teamA.map((p) => p.user_id));
    const teamBIds = new Set(teamB.map((p) => p.user_id));

    games.forEach((game, i) => {
      expect(teamAIds.has(game.pairA[0].user_id)).toBe(true);
      expect(teamAIds.has(game.pairA[1].user_id)).toBe(true);
      expect(teamBIds.has(game.pairB[0].user_id)).toBe(true);
      expect(teamBIds.has(game.pairB[1].user_id)).toBe(true);
    });
  });

  it("rounds 4-6 repeat the matchups from rounds 1-3", () => {
    const courts = getCourtsPerRound(8);
    const rounds = groupIntoRounds(games, courts);

    for (let r = 0; r < 3; r++) {
      const round1 = rounds[r];
      const round2 = rounds[r + 3];

      for (let c = 0; c < 2; c++) {
        const ids1 = allPlayerIdsInGame(round1[c]).sort();
        const ids2 = allPlayerIdsInGame(round2[c]).sort();
        expect(ids1).toEqual(ids2);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// generateMatchups — 6 players
// ---------------------------------------------------------------------------

describe("generateMatchups — 6 players", () => {
  const players = makePlayers(6);
  const games = generateMatchups(players);

  it("produces exactly 6 games", () => {
    expect(games).toHaveLength(6);
  });

  it("each game has exactly 4 unique players", () => {
    games.forEach((game) => {
      const ids = allPlayerIdsInGame(game);
      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(4);
    });
  });

  it("all 6 players appear across all games", () => {
    const ids = uniquePlayerIds(games);
    expect(ids.size).toBe(6);
  });

  it("groups into 6 rounds with 1 game per round", () => {
    const courts = getCourtsPerRound(6);
    expect(courts).toBe(1);

    const rounds = groupIntoRounds(games, courts);
    expect(rounds).toHaveLength(6);
    rounds.forEach((round) => {
      expect(round).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// generateMatchups — 10 players
// ---------------------------------------------------------------------------

describe("generateMatchups — 10 players", () => {
  const players = makePlayers(10);
  const games = generateMatchups(players);

  it("produces exactly 10 games (5 rounds x 2 courts)", () => {
    expect(games).toHaveLength(10);
  });

  it("each game has exactly 4 unique players", () => {
    games.forEach((game) => {
      const ids = allPlayerIdsInGame(game);
      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(4);
    });
  });

  it("all 10 players appear across all games", () => {
    const ids = uniquePlayerIds(games);
    expect(ids.size).toBe(10);
  });

  it("groups into 5 rounds with 2 games per round", () => {
    const courts = getCourtsPerRound(10);
    expect(courts).toBe(2);

    const rounds = groupIntoRounds(games, courts);
    expect(rounds).toHaveLength(5);
    rounds.forEach((round) => {
      expect(round).toHaveLength(2);
    });
  });

  it("no player appears on two courts in the same round", () => {
    const courts = getCourtsPerRound(10);
    const rounds = groupIntoRounds(games, courts);

    rounds.forEach((round, roundIndex) => {
      const allIds: string[] = [];
      round.forEach((game) => {
        allIds.push(...allPlayerIdsInGame(game));
      });
      // 10 players, 2 courts = 8 playing per round, 2 sitting out
      expect(new Set(allIds).size).toBe(allIds.length);
    });
  });

  it("pairA players are always from teamA and pairB from teamB", () => {
    const { teamA, teamB } = buildTeams(players);
    const teamAIds = new Set(teamA.map((p) => p.user_id));
    const teamBIds = new Set(teamB.map((p) => p.user_id));

    games.forEach((game) => {
      expect(teamAIds.has(game.pairA[0].user_id)).toBe(true);
      expect(teamAIds.has(game.pairA[1].user_id)).toBe(true);
      expect(teamBIds.has(game.pairB[0].user_id)).toBe(true);
      expect(teamBIds.has(game.pairB[1].user_id)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// generateMatchups — 12 players
// ---------------------------------------------------------------------------

describe("generateMatchups — 12 players", () => {
  const players = makePlayers(12);
  const games = generateMatchups(players);

  it("produces exactly 15 games (5 rounds x 3 courts)", () => {
    expect(games).toHaveLength(15);
  });

  it("each game has exactly 4 unique players", () => {
    games.forEach((game) => {
      const ids = allPlayerIdsInGame(game);
      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(4);
    });
  });

  it("all 12 players appear across all games", () => {
    const ids = uniquePlayerIds(games);
    expect(ids.size).toBe(12);
  });

  it("groups into 5 rounds with 3 games per round", () => {
    const courts = getCourtsPerRound(12);
    expect(courts).toBe(3);

    const rounds = groupIntoRounds(games, courts);
    expect(rounds).toHaveLength(5);
    rounds.forEach((round) => {
      expect(round).toHaveLength(3);
    });
  });

  it("every player appears in every round (no player sits out)", () => {
    const courts = getCourtsPerRound(12);
    const rounds = groupIntoRounds(games, courts);

    rounds.forEach((round, roundIndex) => {
      const playerIdsInRound = new Set<string>();
      round.forEach((game) => {
        allPlayerIdsInGame(game).forEach((id) => playerIdsInRound.add(id));
      });
      expect(playerIdsInRound.size).toBe(
        12,
        `Round ${roundIndex + 1} should have all 12 players but found ${playerIdsInRound.size}`
      );
    });
  });

  it("no player appears on two courts in the same round", () => {
    const courts = getCourtsPerRound(12);
    const rounds = groupIntoRounds(games, courts);

    rounds.forEach((round, roundIndex) => {
      const allIds: string[] = [];
      round.forEach((game) => {
        allIds.push(...allPlayerIdsInGame(game));
      });
      expect(allIds.length).toBe(
        new Set(allIds).size,
        `Round ${roundIndex + 1} has a player appearing on multiple courts`
      );
    });
  });

  it("pairA players are always from teamA and pairB from teamB", () => {
    const { teamA, teamB } = buildTeams(players);
    const teamAIds = new Set(teamA.map((p) => p.user_id));
    const teamBIds = new Set(teamB.map((p) => p.user_id));

    games.forEach((game) => {
      expect(teamAIds.has(game.pairA[0].user_id)).toBe(true);
      expect(teamAIds.has(game.pairA[1].user_id)).toBe(true);
      expect(teamBIds.has(game.pairB[0].user_id)).toBe(true);
      expect(teamBIds.has(game.pairB[1].user_id)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// DUPR balancing — end-to-end with realistic ratings
// ---------------------------------------------------------------------------

describe("DUPR balancing across player counts", () => {
  const testCases = [
    { count: 6, duprs: [4.5, 4.0, 3.5, 3.0, 2.5, 2.0] },
    { count: 8, duprs: [4.5, 4.2, 4.0, 3.8, 3.5, 3.2, 3.0, 2.8] },
    {
      count: 10,
      duprs: [4.8, 4.5, 4.2, 3.9, 3.6, 3.3, 3.0, 2.7, 2.4, 2.1],
    },
    {
      count: 12,
      duprs: [5.0, 4.7, 4.4, 4.1, 3.8, 3.5, 3.2, 2.9, 2.6, 2.3, 2.0, 1.7],
    },
  ];

  testCases.forEach(({ count, duprs }) => {
    it(`${count} players: team DUPR averages are within 0.5 of each other`, () => {
      const players = makePlayers(count, duprs);
      const sorted = sortPlayersByDupr(players);
      const { teamA, teamB } = buildTeams(sorted);

      const avgA =
        teamA.reduce((s, p) => s + (p.self_reported_dupr ?? 0), 0) /
        teamA.length;
      const avgB =
        teamB.reduce((s, p) => s + (p.self_reported_dupr ?? 0), 0) /
        teamB.length;

      expect(Math.abs(avgA - avgB)).toBeLessThan(0.5);
    });
  });
});

// ---------------------------------------------------------------------------
// getCourtsPerRound
// ---------------------------------------------------------------------------

describe("getCourtsPerRound", () => {
  it("returns 1 for 6 players", () => {
    expect(getCourtsPerRound(6)).toBe(1);
  });

  it("returns 2 for 8 players", () => {
    expect(getCourtsPerRound(8)).toBe(2);
  });

  it("returns 2 for 10 players", () => {
    expect(getCourtsPerRound(10)).toBe(2);
  });

  it("returns 3 for 12 players", () => {
    expect(getCourtsPerRound(12)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// MAX_GAMES_BY_TOTAL_PLAYERS constant
// ---------------------------------------------------------------------------

describe("MAX_GAMES_BY_TOTAL_PLAYERS", () => {
  it("6 players -> 6 max games", () => {
    expect(MAX_GAMES_BY_TOTAL_PLAYERS[6]).toBe(6);
  });

  it("8 players -> 6 max games", () => {
    expect(MAX_GAMES_BY_TOTAL_PLAYERS[8]).toBe(6);
  });

  it("10 players -> 5 max games", () => {
    expect(MAX_GAMES_BY_TOTAL_PLAYERS[10]).toBe(5);
  });

  it("12 players -> 5 max games", () => {
    expect(MAX_GAMES_BY_TOTAL_PLAYERS[12]).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Edge case: empty or minimal input
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("returns empty games for 0 players", () => {
    const games = generateMatchups([]);
    expect(games).toHaveLength(0);
  });

  it("returns empty games for 2 players (too few for doubles)", () => {
    const players = makePlayers(2);
    const games = generateMatchups(players);
    // 2 players => 1 per team, buildPairs returns 0 pairs => empty
    expect(games).toHaveLength(0);
  });

  it("handles players with all null DUPRs", () => {
    const players = makePlayers(8, Array(8).fill(null));
    const sorted = sortPlayersByDupr(players);
    const { teamA, teamB } = buildTeams(sorted);
    const games = generateMatchups(sorted);

    expect(teamA).toHaveLength(4);
    expect(teamB).toHaveLength(4);
    expect(games).toHaveLength(12);
  });
});
