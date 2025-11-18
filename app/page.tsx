"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { supabase } from "@/lib/supabaseClient";

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
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
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
      
      // Only reload data if the user actually changed (login/logout)
      // Also prevent false positives when auth.userId is null but newUserId is valid (component re-mount)
      if (auth.userId !== newUserId && !(auth.userId === null && newUserId !== null && loadedUserIdRef.current === newUserId)) {
                setAuth({ loading: false, email: user?.email ?? null, userId: newUserId });

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
      } else {
        console.log("⚠️ onAuthStateChange: User unchanged or component re-mount, skipping reload");
      }
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function loadUserLeagues(userId: string) {
    if (loadedUserIdRef.current === userId) {
      return;
    }
        setLeaguesLoading(true);

    try {
      // Get all leagues where user is a member with their role
      const { data: membershipData, error: membershipError } = await supabase
        .from("league_members")
        .select("league_id, role")
        .eq("user_id", userId);
      
      if (membershipError || !membershipData) {
                setLeaguesLoading(false);
        return;
      }

      const memberships = (membershipData as any[]) || [];
      
      // Get all league IDs to fetch league details and member counts
      const leagueIds = memberships.map(m => m.league_id);
      
      // Get league details
      const { data: leaguesData, error: leaguesError } = await supabase
        .from("leagues")
        .select("id, name, owner_id, created_at")
        .in("id", leagueIds);

      if (leaguesError || !leaguesData) {
        setLeaguesLoading(false);
        return;
      }

      // Get member counts for all leagues
      const { data: memberCountsData, error: countsError } = await supabase
        .from("league_members")
        .select("league_id")
        .in("league_id", leagueIds);

      if (countsError) {
        setLeaguesLoading(false);
        return;
      }

      const memberCounts = new Map<string, number>();
      (memberCountsData as any[]).forEach((row: any) => {
        const leagueId = row.league_id as string;
        memberCounts.set(leagueId, (memberCounts.get(leagueId) ?? 0) + 1);
      });

      // Process leagues and separate by role
      const leagues = (leaguesData as any[]) || [];
      const allLeagues: League[] = leagues.map((league: any) => ({
        id: league.id,
        name: league.name,
        created_at: league.created_at,
        owner_id: league.owner_id,
        memberCount: memberCounts.get(league.id) ?? 0,
      }));

      // Separate into admin and regular member leagues
      const adminLeagues = allLeagues.filter(league => 
        memberships.some(m => m.league_id === league.id && m.role === 'admin')
      );
      const memberLeagues = allLeagues.filter(league => 
        memberships.some(m => m.league_id === league.id && m.role === 'player')
      );

      // Sort each group alphabetically by name (case-insensitive)
      adminLeagues.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      memberLeagues.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

      // Combine: admin leagues first, then member leagues
      const sortedLeagues = [...adminLeagues, ...memberLeagues];

      setLeagues(sortedLeagues);
      loadedUserIdRef.current = userId;
      setLeaguesLoading(false);
    } catch (error) {
      console.error('Failed to load user leagues:', error);
      if (error instanceof Error && error.message === 'API timeout after 3 seconds') {
        console.log('🏆 loadUserLeagues: Connection issue - showing empty state');
      }
      setLeagues([]);
      setLeaguesLoading(false);
    }
  }

  async function loadUserSessions(userId: string) {
    if (loadedUserIdRef.current === userId) {
      return;
    }
        setSessionsLoading(true);

    try {
      const { data: ownedSessionRows, error: ownedSessionsError } = await supabase
        .from("game_sessions")
        .select(
          "id, league_id, created_by, created_at, scheduled_for, player_count, league:leagues(name)"
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

    let participantSessionRows: any[] = [];

    if (mpRows && mpRows.length) {
      const matchIds = Array.from(
        new Set((mpRows as any[]).map((row) => row.match_id))
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
            (matchRows ?? [])
              .map((m: any) => m.session_id)
              .filter((id: string | null) => !!id)
          )
        );

        if (sessionIds.length) {
          const { data: participantRows, error: participantError } =
            await supabase
              .from("game_sessions")
              .select(
                "id, league_id, created_by, created_at, scheduled_for, player_count, league:leagues(name)"
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
    const byId = new Map<string, any>();
    allRows.forEach((row) => {
      if (!row || !row.id) return;
      byId.set(row.id, row);
    });

    const mapped: SessionSummary[] = Array.from(byId.values()).map((row: any) => {
      const leagueRel: any = row.league;
      const leagueName =
        Array.isArray(leagueRel) && leagueRel.length > 0
          ? leagueRel[0]?.name ?? null
          : leagueRel?.name ?? null;

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
    } catch (error) {
      console.error('Failed to load user sessions:', error);
      if (error instanceof Error && error.message === 'API timeout after 3 seconds') {
        console.log('📅 loadUserSessions: Connection issue - showing empty state');
      }
      setSessions([]);
      setSessionsLoading(false);
    }
  }

  async function loadLifetimeStats(userId: string) {
    // Get all matches where user participated (for individual stats)
    const { data: mpRows, error: mpError } = await supabase
      .from("match_players")
      .select("match_id, team, matches!inner(session_id)")
      .eq("user_id", userId);

    if (mpError || !mpRows || !mpRows.length) {
      return;
    }

    const matchIds = Array.from(
      new Set((mpRows as any[]).map((row) => row.match_id))
    );

    // Get all session IDs where user participated
    const sessionIds = Array.from(
      new Set((mpRows as any[]).map((row) => row.matches.session_id))
    );

    // Get ALL matches in those sessions (for complete team scores)
    const { data: allMatchRows, error: allMatchError } = await supabase
      .from("matches")
      .select(
        "id, session_id, result:match_results(team1_score, team2_score)"
      )
      .in("session_id", sessionIds);

    // Get user's matches (for individual stats)
    const { data: matchRows, error: matchError } = await supabase
      .from("matches")
      .select(
        "id, session_id, result:match_results(team1_score, team2_score)"
      )
      .in("id", matchIds);

    if (matchError || !matchRows || allMatchError || !allMatchRows) {
      return;
    }

    // Build a map of match_id -> user's team
    const userTeamMap = new Map<string, number>();
    (mpRows as any[]).forEach((row) => {
      userTeamMap.set(row.match_id, row.team);
    });

    // Build a map of session_id -> user's team (user is always on the same team in a session)
    const sessionTeamMap = new Map<string, number>();
    (mpRows as any[]).forEach((row) => {
      sessionTeamMap.set(row.matches.session_id, row.team);
    });

    let individualWins = 0;
    let individualLosses = 0;

    // Aggregate match scores by session for team stats
    const sessionScores = new Map<string, { team1Score: number; team2Score: number; userTeam: number }>();

    // Process user's matches for individual stats
    (matchRows as any[]).forEach((row) => {
      const sessionId = row.session_id as string | null;
      if (!sessionId) return;

      const rawResult = (row as any).result as
        | { team1_score: number | null; team2_score: number | null }[]
        | { team1_score: number | null; team2_score: number | null }
        | null
        | undefined;

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

      
      // Individual stats (personal win/loss record)
      if (userTeam === 1) {
        if (result.team1_score > result.team2_score) {
          individualWins++;
        } else if (result.team2_score > result.team1_score) {
          individualLosses++;
        }
      } else if (userTeam === 2) {
        if (result.team2_score > result.team1_score) {
          individualWins++;
        } else if (result.team1_score > result.team2_score) {
          individualLosses++;
        }
      }
    });

    // Process ALL matches in sessions for complete team scores
    (allMatchRows as any[]).forEach((row) => {
      const sessionId = row.session_id as string | null;
      if (!sessionId) return;

      const rawResult = (row as any).result as
        | { team1_score: number | null; team2_score: number | null }[]
        | { team1_score: number | null; team2_score: number | null }
        | null
        | undefined;

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

      
      // Aggregate scores for team stats (includes all team members' matches)
      if (!sessionScores.has(sessionId)) {
        sessionScores.set(sessionId, { team1Score: 0, team2Score: 0, userTeam });
      }
      
      const sessionScore = sessionScores.get(sessionId)!;
      sessionScore.team1Score += result.team1_score;
      sessionScore.team2Score += result.team2_score;
    });

    // Calculate team stats from aggregated session scores
    let teamWins = 0;
    let teamLosses = 0;
    let teamTies = 0;

    sessionScores.forEach((scores, sessionId) => {
      if (scores.team1Score > scores.team2Score) {
        if (scores.userTeam === 1) {
          teamWins++;
        } else {
          teamLosses++;
        }
      } else if (scores.team2Score > scores.team1Score) {
        if (scores.userTeam === 2) {
          teamWins++;
        } else {
          teamLosses++;
        }
      } else {
        // It's a tie
        teamTies++;
      }
    });

    setLifetimeStats({
      individualWins,
      individualLosses,
      teamWins,
      teamLosses,
      teamTies,
    });
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
    <section className="hero">
      <div>
        <p className="hero-subtitle" style={{ maxWidth: "none" }}>
          <strong>PICKLED CITIZENS</strong> is a lightweight web app for setting up team
          battle matchups for your league's pickleball sessions.
        </p>
        {showCtas && (
          <div className="hero-actions">
            <a href="/auth" className="btn-primary">
              Get started (sign up)
            </a>
            <a href="/auth/signin" className="btn-secondary">
              Sign in
            </a>
          </div>
        )}
      </div>

      {showPersonalizedContent && (
        <>
          <div className="section">
            <h2 className="section-title">Your Leagues</h2>
            {leaguesLoading ? (
              <p className="hero-subtitle" style={{ fontSize: "0.85rem" }}>
                Loading leagues...
              </p>
            ) : leagues.length === 0 ? (
              <p className="hero-subtitle" style={{ fontSize: "0.85rem" }}>
                You are not a member of any leagues yet. Visit the{" "}
                <a href="/leagues" style={{ textDecoration: "underline" }}>
                  leagues page
                </a>{" "}
                to create or join one.
              </p>
            ) : (
              <div
                style={{
                  marginTop: "0.75rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #1f2937",
                  padding: "0.5rem 0.6rem",
                }}
              >
                <ul
                  className="section-list"
                  style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}
                >
                  {leagues.map((league) => (
                    <li
                      key={league.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        padding: "0.4rem 0",
                      }}
                    >
                      <div style={{ fontSize: "0.85rem" }}>
                        <div style={{ fontWeight: 600, color: "#1f2937" }}>
                          🏆 {formatLeagueName(league.name, league.created_at)}
                        </div>
                        {typeof league.memberCount === "number" && (
                          <div style={{ color: "#9ca3af", marginTop: "0.1rem" }}>
                            {league.memberCount} {league.memberCount === 1 ? "member" : "members"}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => router.push(`/leagues/${league.id}`)}
                        >
                          {league.owner_id === auth.userId ? "Manage" : "View"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="section">
            <h2 className="section-title">Your Upcoming Sessions</h2>
            {sessionsLoading ? (
              <p className="hero-subtitle" style={{ fontSize: "0.85rem" }}>
                Loading sessions...
              </p>
            ) : upcomingSessions.length === 0 ? (
              <p className="hero-subtitle" style={{ fontSize: "0.85rem" }}>
                No upcoming sessions.
              </p>
            ) : (
              <div
                style={{
                  marginTop: "0.75rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #1f2937",
                  padding: "0.5rem 0.6rem",
                }}
              >
                <ul
                  className="section-list"
                  style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}
                >
                  {upcomingSessions.map((session) => (
                    <li
                      key={session.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        padding: "0.4rem 0",
                      }}
                    >
                      <div style={{ fontSize: "0.85rem" }}>
                        <div style={{ fontWeight: 600, color: "#1f2937" }}>
                          🗓️ {session.league_name || "Unknown league"} - {session.player_count} players
                        </div>
                        <div style={{ color: "#9ca3af", marginTop: "0.1rem" }}>
                          {formatDateTime(session.scheduled_for ?? session.created_at)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => router.push(`/sessions/${session.id}`)}
                        >
                          {session.created_by === auth.userId ? "Manage" : "View"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
              <a 
                href="/sessions" 
                style={{ 
                  fontSize: "0.85rem", 
                  textDecoration: "underline",
                  color: "inherit"
                }}
              >
                View past sessions
              </a>
            </div>
          </div>

          <div className="section">
            <h2 className="section-title">Your Stats</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "1rem",
                marginTop: "0.75rem",
              }}
            >
              <div
                style={{
                  borderRadius: "0.75rem",
                  border: "1px solid #1f2937",
                  padding: "1rem",
                }}
              >
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1f2937", marginBottom: "0.25rem" }}>
                  👤 Individual Record
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>
                  {lifetimeStats.individualWins}-{lifetimeStats.individualLosses}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                  {lifetimeStats.individualWins + lifetimeStats.individualLosses} games played
                </div>
              </div>
              <div
                style={{
                  borderRadius: "0.75rem",
                  border: "1px solid #1f2937",
                  padding: "1rem",
                }}
              >
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#1f2937", marginBottom: "0.25rem" }}>
                  👥 Team Record
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>
                  {lifetimeStats.teamWins}-{lifetimeStats.teamLosses}-{lifetimeStats.teamTies}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                  {lifetimeStats.teamWins + lifetimeStats.teamLosses + lifetimeStats.teamTies} sessions
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="section">
        <h2 className="section-title">v1.0.0 Release</h2>
        <p>
          <strong>Release highlights</strong>
        </p>
        <ul className="section-list">
          <li>
            Email signup using magic link or password, plus player name and self-assessed DUPR rating
          </li>
          <li>
            Create and manage leagues, with a central view of all member details
          </li>
          <li>
            Schedule sessions for 6, 8, 10, or 12 players and auto-generate balanced doubles matchups
          </li>
          <li>
            Record results and track both team and individual win-loss records over time
          </li>
        </ul>
        <p style={{ marginTop: '1.5rem' }}>
          <strong>Coming soon</strong>
        </p>
        <ul className="section-list">
          <li>
            Email notifications for players and league admins
          </li>
          <li>
            League email invitation flow
          </li>
          <li>
            Session-specific invitation flow
          </li>
        </ul>
      </div>

      <div style={{ textAlign: 'center', marginTop: '2rem', paddingBottom: '1rem' }}>
        <a
          href="https://www.buymeacoffee.com/hunkim"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
            alt="Buy Me A Coffee"
            style={{ height: '38px', width: '135px' }}
          />
        </a>
      </div>
    </section>
  );
}
