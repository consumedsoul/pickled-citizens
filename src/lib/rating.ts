/**
 * League rating (Elo for doubles)
 *
 * Pure logic — no database, no I/O — so it can be unit-tested and rerun from
 * scratch over a league's full match history whenever the standings are shown.
 * There is no stored rating and no batch job: the board is always derived from
 * the recorded results, so correcting a score corrects the board.
 *
 * Rules, in plain terms:
 *   - Everyone starts at the same number (BASE_RATING). Nothing about a player
 *     is assumed in advance — self-reported DUPR is deliberately not used.
 *   - A team's strength is the average of its two players' ratings.
 *   - Before a game the two strengths give an expected win chance. After it,
 *     points move from the losers to the winners in proportion to how
 *     surprising the result was: beating a stronger team pays a lot, beating a
 *     weaker one pays a little, and losing to a weaker one costs a lot.
 *   - A bigger winning margin moves a bit more (capped at 1.5x), so 11-2 is
 *     worth more than 11-9 without one blowout swinging the board.
 *   - Guests take part in the math at BASE_RATING but are never rated or
 *     ranked: session_guests rows are one-off and cannot be followed across
 *     sessions.
 */

export const BASE_RATING = 1000;
/** Points at stake per game before the margin multiplier. */
export const K_FACTOR = 32;
/** Winning margin beyond which the multiplier stops growing. */
export const MARGIN_CAP = 11;
/** Players with fewer games than this are shown as provisional. */
export const PROVISIONAL_GAMES = 5;

export type RatedSide = {
  /** Clerk user IDs of league members on this side. */
  userIds: string[];
  /** Number of guest players on this side (fixed at BASE_RATING). */
  guestCount: number;
};

export type RatedGame = {
  matchId: string;
  sessionId: string;
  /** ISO timestamp the game is ordered by (session time, then completion). */
  playedAt: string;
  /** Tie-break within a session when timestamps collide. */
  order: number;
  team1: RatedSide;
  team2: RatedSide;
  team1Score: number;
  team2Score: number;
};

export type PlayerStanding = {
  userId: string;
  rating: number;
  games: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Rating change over the league's most recent session; 0 if they sat out. */
  recentDelta: number;
  provisional: boolean;
};

export type Standings = {
  /** Rated players, best first. Players with zero games are not listed. */
  players: PlayerStanding[];
  /** Session the `recentDelta` column refers to, or null when nothing is recorded. */
  recentSessionId: string | null;
  gamesCounted: number;
};

/** Win probability of a side rated `a` against a side rated `b`. */
export function expectedScore(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** 1.0 for a one-point win, rising linearly to 1.5 at MARGIN_CAP points. */
export function marginMultiplier(team1Score: number, team2Score: number): number {
  const margin = Math.abs(team1Score - team2Score);
  if (margin <= 1) return 1;
  return 1 + (Math.min(margin, MARGIN_CAP) - 1) / ((MARGIN_CAP - 1) * 2);
}

function sideStrength(side: RatedSide, ratings: Map<string, number>): number {
  const n = side.userIds.length + side.guestCount;
  if (n === 0) return BASE_RATING;
  let total = side.guestCount * BASE_RATING;
  for (const id of side.userIds) total += ratings.get(id) ?? BASE_RATING;
  return total / n;
}

/** Chronological order: time, then session, then recorded order, then match id. */
export function compareGames(a: RatedGame, b: RatedGame): number {
  if (a.playedAt !== b.playedAt) return a.playedAt < b.playedAt ? -1 : 1;
  if (a.sessionId !== b.sessionId) return a.sessionId < b.sessionId ? -1 : 1;
  if (a.order !== b.order) return a.order - b.order;
  return a.matchId < b.matchId ? -1 : a.matchId > b.matchId ? 1 : 0;
}

/**
 * Replay every game in order and return the standings. Games with a side that
 * has no players at all are skipped; drawn games move no points but count as
 * played.
 */
export function computeStandings(games: RatedGame[]): Standings {
  const ordered = [...games].sort(compareGames);
  const ratings = new Map<string, number>();
  const stats = new Map<string, PlayerStanding>();
  const deltaBySession = new Map<string, Map<string, number>>();

  const ensure = (userId: string): PlayerStanding => {
    let s = stats.get(userId);
    if (!s) {
      s = {
        userId,
        rating: BASE_RATING,
        games: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        recentDelta: 0,
        provisional: true,
      };
      stats.set(userId, s);
      ratings.set(userId, BASE_RATING);
    }
    return s;
  };

  let counted = 0;
  let lastSessionId: string | null = null;

  for (const g of ordered) {
    const n1 = g.team1.userIds.length + g.team1.guestCount;
    const n2 = g.team2.userIds.length + g.team2.guestCount;
    if (n1 === 0 || n2 === 0) continue;

    const r1 = sideStrength(g.team1, ratings);
    const r2 = sideStrength(g.team2, ratings);
    const e1 = expectedScore(r1, r2);
    const s1 = g.team1Score > g.team2Score ? 1 : g.team1Score < g.team2Score ? 0 : 0.5;
    const delta1 = K_FACTOR * marginMultiplier(g.team1Score, g.team2Score) * (s1 - e1);

    const sessionDeltas = deltaBySession.get(g.sessionId) ?? new Map<string, number>();
    deltaBySession.set(g.sessionId, sessionDeltas);

    const apply = (side: RatedSide, delta: number, won: boolean, lost: boolean, pf: number, pa: number) => {
      for (const id of side.userIds) {
        const s = ensure(id);
        s.rating += delta;
        ratings.set(id, s.rating);
        s.games += 1;
        if (won) s.wins += 1;
        if (lost) s.losses += 1;
        s.pointsFor += pf;
        s.pointsAgainst += pa;
        sessionDeltas.set(id, (sessionDeltas.get(id) ?? 0) + delta);
      }
    };

    apply(g.team1, delta1, s1 === 1, s1 === 0, g.team1Score, g.team2Score);
    apply(g.team2, -delta1, s1 === 0, s1 === 1, g.team2Score, g.team1Score);

    counted += 1;
    lastSessionId = g.sessionId;
  }

  const recent = lastSessionId ? deltaBySession.get(lastSessionId) : undefined;
  const players = Array.from(stats.values()).map((s) => ({
    ...s,
    recentDelta: recent?.get(s.userId) ?? 0,
    provisional: s.games < PROVISIONAL_GAMES,
  }));
  players.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });

  return { players, recentSessionId: lastSessionId, gamesCounted: counted };
}

/** Whole-number rating for display; the raw value keeps its decimals. */
export function formatRating(rating: number): string {
  return String(Math.round(rating));
}

export function formatDelta(delta: number): string {
  const n = Math.round(delta);
  if (n === 0) return '–';
  return n > 0 ? `+${n}` : String(n);
}
