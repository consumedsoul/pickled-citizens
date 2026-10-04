/**
 * League standings
 *
 * Pure logic — no database, no I/O — replayed over a league's full match
 * history whenever the board is shown. Nothing is stored, so deleting a
 * session or clearing a WIN corrects the board on the next load.
 *
 * Two things come out of it:
 *
 *   - Win percentage per member. Players reach the ranked board after
 *     RANKED_MIN_GAMES; the rest are listed separately.
 *
 *   - Rivals. The matchup generator pairs each player with a counterpart on
 *     the other team, so in a normal session you face the same opponent in
 *     every game you play. That opponent is your rival for the week. A rival
 *     record is the head-to-head across every session where the two of you
 *     were counterparts, and the closest records (nearest .500) are the most
 *     useful when forming teams, so they are listed first.
 *
 * An earlier Elo-style rating was retired on 2026-10-03 (see _delete/) because
 * sessions are skill-tiered and the pools never play each other, which left
 * the rating unable to compare tiers.
 */

/** Games needed to appear on the ranked board — about three sessions. */
export const RANKED_MIN_GAMES = 15;
/** How many rivals to show under each player. */
export const RIVALS_SHOWN = 3;

export type Side = {
  /** Clerk user IDs of league members on this side. */
  userIds: string[];
  /** Guests on this side; they are never ranked and never a rival. */
  guestCount: number;
};

export type SessionGame = {
  matchId: string;
  sessionId: string;
  /** Sortable key: session time, then completion. */
  playedAt: string;
  /** Tie-break within a session. */
  order: number;
  team1: Side;
  team2: Side;
  team1Score: number;
  team2Score: number;
};

export type RivalRecord = {
  userId: string;
  wins: number;
  losses: number;
  games: number;
};

export type PlayerStanding = {
  userId: string;
  games: number;
  wins: number;
  losses: number;
  /** 0..1 */
  winPct: number;
  /** Record in the league's most recent session; both 0 if they sat out. */
  lastWins: number;
  lastLosses: number;
  /** Closest head-to-heads first; at most RIVALS_SHOWN. */
  rivals: RivalRecord[];
  /** games >= RANKED_MIN_GAMES */
  ranked: boolean;
};

export type Standings = {
  /** Everyone who has played a scored game, best win percentage first. */
  players: PlayerStanding[];
  recentSessionId: string | null;
  gamesCounted: number;
};

/** Chronological order: time, then session, then recorded order, then match id. */
export function compareGames(a: SessionGame, b: SessionGame): number {
  if (a.playedAt !== b.playedAt) return a.playedAt < b.playedAt ? -1 : 1;
  if (a.sessionId !== b.sessionId) return a.sessionId < b.sessionId ? -1 : 1;
  if (a.order !== b.order) return a.order - b.order;
  return a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0;
}

type Tally = { games: number; wins: number; losses: number };
const tally = (): Tally => ({ games: 0, wins: 0, losses: 0 });

/** How far a record is from .500: 0 for 5-5, 1 for 5-0. */
export function rivalCloseness(r: { wins: number; losses: number; games: number }): number {
  if (r.games === 0) return 1;
  return Math.abs(r.wins - r.losses) / r.games;
}

export function compareRivals(a: RivalRecord, b: RivalRecord): number {
  const ca = rivalCloseness(a);
  const cb = rivalCloseness(b);
  if (ca !== cb) return ca - cb;
  if (b.games !== a.games) return b.games - a.games;
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
}

/** Best win percentage first; more wins, then more games, break ties. */
export function compareStandings(a: PlayerStanding, b: PlayerStanding): number {
  if (b.winPct !== a.winPct) return b.winPct - a.winPct;
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.games !== a.games) return b.games - a.games;
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
}

/**
 * Replay every scored game. Games with an empty side are skipped; a drawn
 * score counts as played but is neither a win nor a loss.
 */
export function computeStandings(games: SessionGame[]): Standings {
  const ordered = [...games].sort(compareGames);

  const totals = new Map<string, Tally>();
  const bySession = new Map<string, Map<string, Tally>>();
  // userId -> sessionId -> per-game { opponents, won, lost }
  const perSessionGames = new Map<
    string,
    Map<string, Array<{ opponents: Set<string>; won: boolean; lost: boolean }>>
  >();

  let counted = 0;
  let lastSessionId: string | null = null;

  for (const g of ordered) {
    const n1 = g.team1.userIds.length + g.team1.guestCount;
    const n2 = g.team2.userIds.length + g.team2.guestCount;
    if (n1 === 0 || n2 === 0) continue;

    const team1Won = g.team1Score > g.team2Score;
    const team2Won = g.team2Score > g.team1Score;
    const sessionTallies = bySession.get(g.sessionId) ?? new Map<string, Tally>();
    bySession.set(g.sessionId, sessionTallies);

    const record = (side: Side, opponents: Side, won: boolean, lost: boolean) => {
      for (const id of side.userIds) {
        const t = totals.get(id) ?? tally();
        totals.set(id, t);
        const s = sessionTallies.get(id) ?? tally();
        sessionTallies.set(id, s);
        for (const x of [t, s]) {
          x.games += 1;
          if (won) x.wins += 1;
          if (lost) x.losses += 1;
        }
        const mine = perSessionGames.get(id) ?? new Map();
        perSessionGames.set(id, mine);
        const list = mine.get(g.sessionId) ?? [];
        mine.set(g.sessionId, list);
        list.push({ opponents: new Set(opponents.userIds), won, lost });
      }
    };
    record(g.team1, g.team2, team1Won, team2Won);
    record(g.team2, g.team1, team2Won, team1Won);

    counted += 1;
    lastSessionId = g.sessionId;
  }

  // Rivals: for each player and session, the opponents present in every one
  // of that player's games that session. Usually exactly one.
  const rivalTallies = new Map<string, Map<string, Tally>>();
  for (const [userId, sessions] of perSessionGames) {
    for (const list of sessions.values()) {
      if (list.length === 0) continue;
      let common: Set<string> | null = null;
      for (const game of list) {
        const prev: Set<string> | null = common;
        const next: Set<string> = prev
          ? new Set(Array.from(prev).filter((id: string) => game.opponents.has(id)))
          : new Set(game.opponents);
        common = next;
        if (next.size === 0) break;
      }
      if (!common || common.size === 0) continue;
      const mine = rivalTallies.get(userId) ?? new Map<string, Tally>();
      rivalTallies.set(userId, mine);
      for (const rivalId of common) {
        const t = mine.get(rivalId) ?? tally();
        mine.set(rivalId, t);
        for (const game of list) {
          t.games += 1;
          if (game.won) t.wins += 1;
          if (game.lost) t.losses += 1;
        }
      }
    }
  }

  const recent = lastSessionId ? bySession.get(lastSessionId) : undefined;
  const players: PlayerStanding[] = Array.from(totals.entries()).map(([userId, t]) => {
    const last = recent?.get(userId);
    const rivals = Array.from(rivalTallies.get(userId)?.entries() ?? [])
      .map<RivalRecord>(([rivalId, r]) => ({ userId: rivalId, ...r }))
      .sort(compareRivals)
      .slice(0, RIVALS_SHOWN);
    return {
      userId,
      games: t.games,
      wins: t.wins,
      losses: t.losses,
      winPct: t.games > 0 ? t.wins / t.games : 0,
      lastWins: last?.wins ?? 0,
      lastLosses: last?.losses ?? 0,
      rivals,
      ranked: t.games >= RANKED_MIN_GAMES,
    };
  });
  players.sort(compareStandings);

  return { players, recentSessionId: lastSessionId, gamesCounted: counted };
}

/** Ranked board: enough games, best win percentage first. */
export function rankedPlayers<T extends PlayerStanding>(players: T[]): T[] {
  return players.filter((p) => p.ranked);
}

/**
 * The list under the board: not enough games yet, most games first so the
 * closest to qualifying are on top, ties by first name. The caller supplies
 * the name because the engine only knows user IDs.
 */
export function unrankedPlayers<T extends PlayerStanding>(
  players: T[],
  firstNameOf: (p: T) => string | null | undefined,
): T[] {
  return players
    .filter((p) => !p.ranked)
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      const an = (firstNameOf(a) ?? '').trim().toLowerCase();
      const bn = (firstNameOf(b) ?? '').trim().toLowerCase();
      if (an !== bn) return an.localeCompare(bn);
      return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
    });
}

export function formatWinPct(winPct: number): string {
  return `${Math.round(winPct * 100)}%`;
}
