"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { Database } from "@/types/database";

interface HomeAuthState {
  loading: boolean;
  email: string | null;
  userId: string | null;
}

type SessionSummary = {
  id: string;
  league_id: string | null;
  league_name: string | null;
  created_by: string;
  created_at: string;
  scheduled_for: string | null;
  player_count: number;
};

type LifetimeStats = {
  individualWins: number;
  individualLosses: number;
  teamWins: number;
  teamLosses: number;
  teamTies: number;
};

type League = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  memberCount?: number;
};

type MatchPlayerRow = Database['public']['Tables']['match_players']['Row'];
type MatchRow = Database['public']['Tables']['matches']['Row'];
type SessionWithLeague = {
  id: string;
  league_id: string | null;
  created_by: string;
  created_at: string;
  scheduled_for: string | null;
  location: string | null;
  player_count: 6 | 8 | 10 | 12;
  league: { name: string }[] | { name: string } | null;
};

function formatLeagueName(name: string, createdAt: string) {
  const year = new Date(createdAt).getFullYear();
  return `${name} (est. ${year})`;
}

export default function HomePage() {
  const router = useRouter();
  const loadedUserIdRef = useRef<string | null>(null);
  const [auth, setAuth] = useState<HomeAuthState>({ loading: true, email: null, userId: null });
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(false);
  const [leaguesError, setLeaguesError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats>({
    individualWins: 0,
    individualLosses: 0,
    teamWins: 0,
    teamLosses: 0,
    teamTies: 0,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      const user = data.user;
      setAuth({ loading: false, email: user?.email ?? null, userId: user?.id ?? null });

      if (user) {
        loadUserLeagues(user.id);
        loadUserSessions(user.id);
        loadLifetimeStats(user.id);
      }
    }

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      const user = session?.user;
      const newUserId = user?.id ?? null;

      setAuth({ loading: false, email: user?.email ?? null, userId: newUserId });

      if (auth.userId !== newUserId && !(auth.userId === null && newUserId !== null && loadedUserIdRef.current === newUserId)) {
        if (user) {
          loadUserLeagues(user.id);
          loadUserSessions(user.id);
          loadLifetimeStats(user.id);
        } else {
          setLeagues([]);
          setSessions([]);
          setLifetimeStats({ individualWins: 0, individualLosses: 0, teamWins: 0, teamLosses: 0, teamTies: 0 });
          loadedUserIdRef.current = null;
        }
      } else if (!user && auth.userId !== null) {
        setLeagues([]);
        setSessions([]);
        setLifetimeStats({ individualWins: 0, individualLosses: 0, teamWins: 0, teamLosses: 0, teamTies: 0 });
        loadedUserIdRef.current = null;
      }
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function loadUserLeagues(userId: string) {
    if (loadedUserIdRef.current === userId) return;
    setLeaguesLoading(true);
    setLeaguesError(null);

    try {
      const { data: membershipData, error: membershipError } = await supabase
        .from("league_members")
        .select("league_id, role")
        .eq("user_id", userId);

      if (membershipError || !membershipData) {
        setLeaguesLoading(false);
        return;
      }

      type LeagueMembership = Database['public']['Tables']['league_members']['Row'];
      const memberships = (membershipData as LeagueMembership[]) || [];
      const leagueIds = memberships.map(m => m.league_id);

      const { data: leaguesData, error: leaguesError } = await supabase
        .from("leagues")
        .select("id, name, owner_id, created_at")
        .in("id", leagueIds);

      if (leaguesError || !leaguesData) {
        setLeaguesLoading(false);
        return;
      }

      const { data: memberCountsData, error: countsError } = await supabase
        .from("league_members")
        .select("league_id")
        .in("league_id", leagueIds);

      if (countsError) {
        setLeaguesLoading(false);
        return;
      }

      const memberCounts = new Map<string, number>();
      (memberCountsData as LeagueMembership[]).forEach((row) => {
        const leagueId = row.league_id;
        memberCounts.set(leagueId, (memberCounts.get(leagueId) ?? 0) + 1);
      });

      type LeagueRow = Database['public']['Tables']['leagues']['Row'];
      const leaguesList = (leaguesData as LeagueRow[]) || [];
      const allLeagues: League[] = leaguesList.map((league) => ({
        id: league.id,
        name: league.name,
        created_at: league.created_at,
        owner_id: league.owner_id,
        memberCount: memberCounts.get(league.id) ?? 0,
      }));

      const adminLeagues = allLeagues.filter(league =>
        memberships.some(m => m.league_id === league.id && m.role === 'admin')
      );
      const memberLeagues = allLeagues.filter(league =>
        memberships.some(m => m.league_id === league.id && m.role === 'player')
      );

      adminLeagues.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      memberLeagues.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

      setLeagues([...adminLeagues, ...memberLeagues]);
      loadedUserIdRef.current = userId;
      setLeaguesLoading(false);
    } catch {
      setLeaguesError('Failed to load leagues. Please refresh the page.');
      setLeagues([]);
      setLeaguesLoading(false);
    }
  }

  async function loadUserSessions(userId: string) {
    if (loadedUserIdRef.current === userId) return;
    setSessionsLoading(true);
    setSessionsError(null);

    try {
      const { data: ownedSessionRows, error: ownedSessionsError } = await supabase
        .from("game_sessions")
        .select(
          "id, league_id, created_by, created_at, scheduled_for, location, player_count, league:leagues(name)"
        )
        .eq("created_by", userId);

      if (ownedSessionsError) {
        setSessionsLoading(false);
        return;
      }

      const { data: mpRows, error: mpError } = await supabase
        .from("match_players")
        .select("match_id")
        .eq("user_id", userId);

      if (mpError) {
        setSessionsLoading(false);
        return;
      }

      let participantSessionRows: SessionWithLeague[] = [];

      if (mpRows && mpRows.length) {
        const matchIds = Array.from(
          new Set((mpRows as MatchPlayerRow[]).map((row) => row.match_id))
        );

        if (matchIds.length) {
          const { data: matchRows, error: matchesError } = await supabase
            .from("matches")
            .select("id, session_id")
            .in("id", matchIds);

          if (matchesError) {
            setSessionsLoading(false);
            return;
          }

          const sessionIds = Array.from(
            new Set(
              (matchRows as MatchRow[] ?? [])
                .map((m) => m.session_id)
                .filter((id: string | null) => !!id)
            )
          );

          if (sessionIds.length) {
            const { data: participantRows, error: participantError } =
              await supabase
                .from("game_sessions")
                .select(
                  "id, league_id, created_by, created_at, scheduled_for, location, player_count, league:leagues(name)"
                )
                .in("id", sessionIds);

            if (participantError) {
              setSessionsLoading(false);
              return;
            }

            participantSessionRows = participantRows ?? [];
          }
        }
      }

      const allRows = [...(ownedSessionRows ?? []), ...participantSessionRows];
      const byId = new Map<string, SessionWithLeague>();
      allRows.forEach((row) => {
        if (!row || !row.id) return;
        byId.set(row.id, row);
      });

      const mapped: SessionSummary[] = Array.from(byId.values()).map((row) => {
        const leagueRel = row.league;
        const leagueName =
          Array.isArray(leagueRel) && leagueRel.length > 0
            ? leagueRel[0]?.name ?? null
            : leagueRel && !Array.isArray(leagueRel)
              ? leagueRel.name ?? null
              : null;

        return {
          id: row.id,
          league_id: row.league_id ?? null,
          league_name: leagueName,
          created_by: row.created_by,
          created_at: row.created_at,
          scheduled_for: row.scheduled_for ?? null,
          player_count: row.player_count,
        };
      });

      mapped.sort((a, b) => {
        const aTime = a.scheduled_for ?? a.created_at;
        const bTime = b.scheduled_for ?? b.created_at;
        if (!aTime && !bTime) return 0;
        if (!aTime) return 1;
        if (!bTime) return -1;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setSessions(mapped);
      loadedUserIdRef.current = userId;
      setSessionsLoading(false);
    } catch {
      setSessionsError('Failed to load sessions. Please refresh the page.');
      setSessions([]);
      setSessionsLoading(false);
    }
  }

  async function loadLifetimeStats(userId: string) {
    const { data: mpRows, error: mpError } = await supabase
      .from("match_players")
      .select("match_id, team, matches!inner(session_id)")
      .eq("user_id", userId);

    if (mpError || !mpRows || !mpRows.length) return;

    type MatchPlayerWithMatch = {
      match_id: string;
      team: 1 | 2;
      matches: { session_id: string }[];
    };
    const matchIds = Array.from(
      new Set((mpRows as MatchPlayerWithMatch[]).map((row) => row.match_id))
    );

    const sessionIds = Array.from(
      new Set((mpRows as MatchPlayerWithMatch[]).map((row) => {
        const m = row.matches;
        return Array.isArray(m) ? m[0]?.session_id : (m as { session_id: string })?.session_id;
      }).filter(Boolean) as string[])
    );

    const { data: allMatchRows, error: allMatchError } = await supabase
      .from("matches")
      .select("id, session_id, result:match_results(team1_score, team2_score)")
      .in("session_id", sessionIds);

    const { data: matchRows, error: matchError } = await supabase
      .from("matches")
      .select("id, session_id, result:match_results(team1_score, team2_score)")
      .in("id", matchIds);

    if (matchError || !matchRows || allMatchError || !allMatchRows) return;

    const userTeamMap = new Map<string, number>();
    (mpRows as MatchPlayerWithMatch[]).forEach((row) => {
      userTeamMap.set(row.match_id, row.team);
    });

    const sessionTeamMap = new Map<string, number>();
    (mpRows as MatchPlayerWithMatch[]).forEach((row) => {
      const m = row.matches;
      const sessionId = Array.isArray(m) ? m[0]?.session_id : (m as { session_id: string })?.session_id;
      if (sessionId) sessionTeamMap.set(sessionId, row.team);
    });

    let individualWins = 0;
    let individualLosses = 0;

    const sessionScores = new Map<string, { team1Score: number; team2Score: number; userTeam: number }>();

    type MatchWithResult = MatchRow & {
      result: { team1_score: number | null; team2_score: number | null }[] |
              { team1_score: number | null; team2_score: number | null } |
              null;
    };

    (matchRows as MatchWithResult[]).forEach((row) => {
      const sessionId = row.session_id;
      if (!sessionId) return;

      const rawResult = row.result;
      let result: { team1_score: number | null; team2_score: number | null } | null = null;
      if (rawResult) {
        if (Array.isArray(rawResult)) {
          result = rawResult[0] ?? null;
        } else {
          result = rawResult;
        }
      }

      if (!result || result.team1_score == null || result.team2_score == null) return;

      const userTeam = userTeamMap.get(row.id);
      if (!userTeam) return;

      if (userTeam === 1) {
        if (result.team1_score > result.team2_score) individualWins++;
        else if (result.team2_score > result.team1_score) individualLosses++;
      } else if (userTeam === 2) {
        if (result.team2_score > result.team1_score) individualWins++;
        else if (result.team1_score > result.team2_score) individualLosses++;
      }
    });

    (allMatchRows as MatchWithResult[]).forEach((row) => {
      const sessionId = row.session_id;
      if (!sessionId) return;

      const rawResult = row.result;
      let result: { team1_score: number | null; team2_score: number | null } | null = null;
      if (rawResult) {
        if (Array.isArray(rawResult)) {
          result = rawResult[0] ?? null;
        } else {
          result = rawResult;
        }
      }

      if (!result || result.team1_score == null || result.team2_score == null) return;

      const userTeam = sessionTeamMap.get(sessionId);
      if (!userTeam) return;

      if (!sessionScores.has(sessionId)) {
        sessionScores.set(sessionId, { team1Score: 0, team2Score: 0, userTeam });
      }

      const sessionScore = sessionScores.get(sessionId)!;
      sessionScore.team1Score += result.team1_score;
      sessionScore.team2Score += result.team2_score;
    });

    let teamWins = 0;
    let teamLosses = 0;
    let teamTies = 0;

    sessionScores.forEach((scores) => {
      if (scores.team1Score > scores.team2Score) {
        if (scores.userTeam === 1) teamWins++;
        else teamLosses++;
      } else if (scores.team2Score > scores.team1Score) {
        if (scores.userTeam === 2) teamWins++;
        else teamLosses++;
      } else {
        teamTies++;
      }
    });

    setLifetimeStats({ individualWins, individualLosses, teamWins, teamLosses, teamTies });
  }

  function formatDateTime(value: string | null) {
    if (!value) return "Not scheduled";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "Not scheduled";
    return d.toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const upcomingSessions = useMemo(() => {
    const nowTime = new Date().getTime();
    const cutoffTime = nowTime - 12 * 60 * 60 * 1000;
    const enriched = sessions.map((session) => {
      const effective = session.scheduled_for ?? session.created_at;
      const time = effective ? new Date(effective).getTime() : Number.NaN;
      return { session, time };
    });

    return enriched
      .filter((item) => !Number.isNaN(item.time) && item.time >= cutoffTime)
      .sort((a, b) => a.time - b.time)
      .map((item) => item.session);
  }, [sessions]);

  const showCtas = !auth.loading && !auth.email;
  const showPersonalizedContent = !auth.loading && auth.userId;

  return (
    <section>
      {/* Hero */}
      <div className="pb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-3">
          Pickled Citizens
        </h1>
        <p className="text-sm text-app-muted max-w-lg leading-relaxed">
          A lightweight web app for setting up team battle matchups for your
          league&apos;s pickleball sessions.
        </p>
        {showCtas && (
          <div className="flex flex-wrap gap-3 mt-5">
            <a href="/auth" className="no-underline">
              <Button variant="primary" arrow>Get Started</Button>
            </a>
            <a href="/auth/signin" className="no-underline">
              <Button variant="secondary">Sign In</Button>
            </a>
          </div>
        )}
      </div>

      {showPersonalizedContent && (
        <>
          {/* Your Leagues */}
          <div className="border-t border-app-border pt-8 pb-8">
            <SectionLabel>Your Leagues</SectionLabel>
            <div className="mt-4">
              {leaguesError ? (
                <p className="text-app-danger text-sm">{leaguesError}</p>
              ) : leaguesLoading ? (
                <p className="text-app-muted text-sm">Loading leagues...</p>
              ) : leagues.length === 0 ? (
                <p className="text-app-muted text-sm">
                  You are not a member of any leagues yet. Visit the{" "}
                  <a href="/leagues">leagues page</a> to create or join one.
                </p>
              ) : (
                <div className="divide-y divide-app-border">
                  {leagues.map((league) => (
                    <div
                      key={league.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-app-text">
                          {formatLeagueName(league.name, league.created_at)}
                        </div>
                        {typeof league.memberCount === "number" && (
                          <div className="text-xs text-app-muted mt-0.5">
                            {league.memberCount} {league.memberCount === 1 ? "member" : "members"}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="sm"
                        arrow
                        onClick={() => router.push(`/leagues/${league.id}`)}
                      >
                        {league.owner_id === auth.userId ? "Manage" : "View"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Sessions */}
          <div className="border-t border-app-border pt-8 pb-8">
            <SectionLabel>Upcoming Sessions</SectionLabel>
            <div className="mt-4">
              {sessionsError ? (
                <p className="text-app-danger text-sm">{sessionsError}</p>
              ) : sessionsLoading ? (
                <p className="text-app-muted text-sm">Loading sessions...</p>
              ) : upcomingSessions.length === 0 ? (
                <p className="text-app-muted text-sm">No upcoming sessions.</p>
              ) : (
                <div className="divide-y divide-app-border">
                  {upcomingSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-app-text">
                          {session.league_name || "Unknown league"} &middot; {session.player_count} players
                        </div>
                        <div className="text-xs text-app-muted mt-0.5">
                          {formatDateTime(session.scheduled_for ?? session.created_at)}
                        </div>
                      </div>
                      <Button
                        variant="sm"
                        arrow
                        onClick={() => router.push(`/sessions/${session.id}`)}
                      >
                        {session.created_by === auth.userId ? "Manage" : "View"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <a href="/sessions" className="text-sm text-app-muted hover:text-app-text transition-colors">
                  View all sessions &rarr;
                </a>
              </div>
            </div>
          </div>

          {/* Your Stats */}
          <div className="border-t border-app-border pt-8 pb-8">
            <SectionLabel>Your Stats</SectionLabel>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mt-4">
              <div className="border border-app-border p-5">
                <div className="section-label mb-2">Individual Record</div>
                <div className="font-display text-3xl font-bold tracking-tight">
                  {lifetimeStats.individualWins}-{lifetimeStats.individualLosses}
                </div>
                <div className="text-xs text-app-muted mt-1">
                  {lifetimeStats.individualWins + lifetimeStats.individualLosses} games played
                </div>
              </div>
              <div className="border border-app-border p-5">
                <div className="section-label mb-2">Team Record</div>
                <div className="font-display text-3xl font-bold tracking-tight">
                  {lifetimeStats.teamWins}-{lifetimeStats.teamLosses}-{lifetimeStats.teamTies}
                </div>
                <div className="text-xs text-app-muted mt-1">
                  {lifetimeStats.teamWins + lifetimeStats.teamLosses + lifetimeStats.teamTies} sessions
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Release Info */}
      <div className="border-t border-app-border pt-8 pb-8">
        <SectionLabel>v1.0.0 Release</SectionLabel>
        <div className="mt-4">
          <p className="text-sm font-medium text-app-text mb-2">Release highlights</p>
          <ul className="pl-4 text-sm text-app-muted leading-relaxed space-y-1">
            <li>Email signup using magic link or password, plus player name and self-assessed DUPR rating</li>
            <li>Create and manage leagues, with a central view of all member details</li>
            <li>Schedule sessions for 6, 8, 10, or 12 players and auto-generate balanced doubles matchups</li>
            <li>Record results and track both team and individual win-loss records over time</li>
          </ul>
          <p className="text-sm font-medium text-app-text mb-2 mt-6">Coming soon</p>
          <ul className="pl-4 text-sm text-app-muted leading-relaxed space-y-1">
            <li>Email notifications for players and league admins</li>
            <li>League email invitation flow</li>
            <li>Session-specific invitation flow</li>
          </ul>
        </div>
      </div>

      {/* Support */}
      <div className="border-t border-app-border pt-8 pb-4 text-center">
        <a
          href="https://www.buymeacoffee.com/hunkim"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
            alt="Buy Me A Coffee"
            className="h-[38px] w-[135px] inline-block"
          />
        </a>
      </div>
    </section>
  );
}
