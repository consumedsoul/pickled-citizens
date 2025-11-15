"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type League = {
  id: string;
  name: string;
};

type Member = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  self_reported_dupr: number | null;
};

type Pair = [Member, Member];

type SessionSummary = {
  id: string;
  league_id: string | null;
  league_name: string | null;
  created_by: string;
  created_at: string;
  scheduled_for: string | null;
  player_count: number;
};

const PLAYER_COUNTS = [6, 8, 10, 12] as const;
const MAX_GAMES_BY_TOTAL_PLAYERS: Record<number, number> = {
  6: 6,
  8: 6,
  10: 5,
  12: 5,
};

export default function SessionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionResults, setSessionResults] = useState<
    Record<string, { teamGreenWins: number; teamBlueWins: number }>
  >({});

  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  const [scheduledFor, setScheduledFor] = useState("");
  const [playerCount, setPlayerCount] = useState<number>(6);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [orderedPlayers, setOrderedPlayers] = useState<Member[]>([]);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !userData.user) {
        router.replace("/");
        return;
      }

      const user = userData.user;
      setUserId(user.id);
      setUserEmail(user.email ?? null);

      const { data: leaguesData, error: leaguesError } = await supabase
        .from("leagues")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (!active) return;

      if (leaguesError) {
        setError(leaguesError.message);
        setLeagues([]);
        setSessions([]);
        setLoading(false);
        return;
      }

      const list = (leaguesData ?? []) as League[];
      setLeagues(list);
      if (list.length > 0) {
        setSelectedLeagueId((prev) => prev || list[0].id);
      }

      setSessionsLoading(true);

      const { data: ownedSessionRows, error: ownedSessionsError } = await supabase
        .from("game_sessions")
        .select(
          "id, league_id, created_by, created_at, scheduled_for, player_count, league:leagues(name)"
        )
        .eq("created_by", user.id);

      if (!active) return;

      if (ownedSessionsError) {
        setError(ownedSessionsError.message);
        setSessions([]);
        setSessionsLoading(false);
        setLoading(false);
        return;
      }

      const { data: mpRows, error: mpError } = await supabase
        .from("match_players")
        .select("match_id")
        .eq("user_id", user.id);

      if (!active) return;

      if (mpError) {
        setError(mpError.message);
        setSessions([]);
        setSessionsLoading(false);
        setLoading(false);
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

          if (!active) return;

          if (matchesError) {
            setError(matchesError.message);
            setSessions([]);
            setSessionsLoading(false);
            setLoading(false);
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

            if (!active) return;

            if (participantError) {
              setError(participantError.message);
              setSessions([]);
              setSessionsLoading(false);
              setLoading(false);
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

      let resultsBySession: Record<string, { teamGreenWins: number; teamBlueWins: number }> = {};

      const sessionIds = mapped.map((s) => s.id);
      if (sessionIds.length) {
        const { data: matchRows, error: matchResultsError } = await supabase
          .from("matches")
          .select(
            "id, session_id, result:match_results(team1_score, team2_score)"
          )
          .in("session_id", sessionIds);

        if (!active) return;

        if (!matchResultsError && matchRows) {
          const bySession: Record<string, { teamGreenWins: number; teamBlueWins: number }> = {};

          (matchRows as any[]).forEach((row) => {
            const sessionId = (row as any).session_id as string | null;
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

            if (!result) return;
            if (result.team1_score == null || result.team2_score == null) return;

            let entry = bySession[sessionId];
            if (!entry) {
              entry = { teamGreenWins: 0, teamBlueWins: 0 };
              bySession[sessionId] = entry;
            }

            if (result.team1_score > result.team2_score) {
              entry.teamGreenWins += 1;
            } else if (result.team2_score > result.team1_score) {
              entry.teamBlueWins += 1;
            }
          });

          resultsBySession = bySession;
        }
      }

      setSessions(mapped);
      setSessionResults(resultsBySession);

      setSessionsLoading(false);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!selectedLeagueId) {
      setMembers([]);
      setSelectedPlayerIds([]);
      setOrderedPlayers([]);
      return;
    }

    let active = true;

    async function loadMembers() {
      setMembersLoading(true);
      setError(null);

      const { data: memberRows, error: membersError } = await supabase
        .from("league_members")
        .select("user_id, email")
        .eq("league_id", selectedLeagueId)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (membersError) {
        setError(membersError.message);
        setMembers([]);
        setMembersLoading(false);
        return;
      }

      const rows = (memberRows ?? []) as { user_id: string; email: string | null }[];

      if (!rows.length) {
        setMembers([]);
        setSelectedPlayerIds([]);
        setOrderedPlayers([]);
        setMembersLoading(false);
        return;
      }

      const userIds = rows.map((m) => m.user_id);

      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, self_reported_dupr")
        .in("id", userIds);

      if (!active) return;

      if (profilesError) {
        setError(profilesError.message);
        setMembers([]);
        setMembersLoading(false);
        return;
      }

      const membersWithProfiles: Member[] = rows.map((m) => {
        const profile = (profileRows ?? []).find((p) => p.id === m.user_id) as
          | {
              id: string;
              first_name: string | null;
              last_name: string | null;
              email: string | null;
              self_reported_dupr: number | null;
            }
          | undefined;

        let dupr: number | null = null;
        if (profile && profile.self_reported_dupr != null) {
          const n = Number(profile.self_reported_dupr);
          dupr = Number.isNaN(n) ? null : n;
        }

        return {
          user_id: m.user_id,
          first_name: profile?.first_name ?? null,
          last_name: profile?.last_name ?? null,
          email: m.email ?? profile?.email ?? null,
          self_reported_dupr: dupr,
        };
      });

      setMembers(membersWithProfiles);
      setSelectedPlayerIds([]);
      setOrderedPlayers([]);
      setMembersLoading(false);
    }

    loadMembers();

    return () => {
      active = false;
    };
  }, [selectedLeagueId]);

  useEffect(() => {
    if (!members.length) {
      setOrderedPlayers([]);
      return;
    }

    const chosen: Member[] = [];
    const seen = new Set<string>();

    selectedPlayerIds.forEach((id) => {
      if (!id || seen.has(id)) return;
      const member = members.find((m) => m.user_id === id);
      if (member) {
        seen.add(id);
        chosen.push(member);
      }
    });

    chosen.sort((a, b) => {
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

    setOrderedPlayers(chosen);
  }, [selectedPlayerIds, members]);

  function handleLeagueChange(id: string) {
    setSelectedLeagueId(id);
  }

  function handlePlayerCountChange(value: string) {
    const n = Number(value) || 6;
    setPlayerCount(n);
    setSelectedPlayerIds((prev) => prev.slice(0, n));
  }

  function handlePlayerSelect(index: number, userId: string) {
    setSelectedPlayerIds((prev) => {
      const next = [...prev];
      next[index] = userId;
      return next;
    });
  }

  function movePlayer(fromIndex: number, toIndex: number) {
    setOrderedPlayers((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length) return prev;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [m] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, m);
      return next;
    });
  }

  function displayPlayer(member: Member) {
    const fullName = [member.first_name, member.last_name]
      .filter(Boolean)
      .join(" ");
    const email = member.email ?? "";
    const base = fullName && email ? `${fullName} (${email})` : email || fullName || member.user_id;

    if (member.self_reported_dupr != null) {
      const dupr = Number(member.self_reported_dupr);
      if (!Number.isNaN(dupr)) {
        return `${base} ${dupr.toFixed(2)}`;
      }
    }

    return base;
  }

  function displayShortName(member: Member) {
    const fullName = [member.first_name, member.last_name]
      .filter(Boolean)
      .join(" ");
    return fullName || member.email || member.user_id;
  }

  function buildTeams(players: Member[]): { teamA: Member[]; teamB: Member[] } {
    const teamA: Member[] = [];
    const teamB: Member[] = [];

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

  function buildPairs(team: Member[]): Pair[] {
    const pairs: Pair[] = [];
    for (let i = 0; i < team.length; i += 1) {
      for (let j = i + 1; j < team.length; j += 1) {
        pairs.push([team[i], team[j]]);
      }
    }
    return pairs;
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

  async function handleDeleteSession(sessionId: string) {
    if (!userId) return;

    setError(null);
    setDeletingSessionId(sessionId);

    try {
      const { error: deleteError } = await supabase
        .from("game_sessions")
        .delete()
        .eq("id", sessionId)
        .eq("created_by", userId);

      if (deleteError) {
        setError(deleteError.message);
        setDeletingSessionId(null);
        return;
      }

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setSessionResults((prev) => {
        if (!(sessionId in prev)) return prev;
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    } catch (e: any) {
      setError(e?.message ?? "Unable to delete session.");
    } finally {
      setDeletingSessionId(null);
    }
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!selectedLeagueId) {
      setError("Select a league.");
      return;
    }

    if (!userId) {
      setError("You must be signed in to create a session.");
      return;
    }

    if (!scheduledFor) {
      setError("Select a date/time for the session.");
      return;
    }

    if (!PLAYER_COUNTS.includes(playerCount as (typeof PLAYER_COUNTS)[number])) {
      setError("Player count must be 6, 8, 10, or 12.");
      return;
    }

    if (selectedPlayerIds.length < playerCount) {
      setError("Select all player slots.");
      return;
    }

    const nonEmpty = selectedPlayerIds.filter(Boolean);
    if (nonEmpty.length !== playerCount) {
      setError("Select all player slots.");
      return;
    }

    const unique = new Set(nonEmpty);
    if (unique.size !== playerCount) {
      setError("Each player can only be selected once.");
      return;
    }

    if (orderedPlayers.length !== playerCount) {
      setError("Unable to resolve selected players. Try again.");
      return;
    }

    const { teamA, teamB } = buildTeams(orderedPlayers);
    const totalPlayers = teamA.length + teamB.length;
    const pairsA = buildPairs(teamA);
    const pairsB = buildPairs(teamB);
    const baseGames: { pairA: Pair; pairB: Pair }[] = [];
    const limit = Math.min(pairsA.length, pairsB.length);

    for (let i = 0; i < limit; i += 1) {
      baseGames.push({ pairA: pairsA[i], pairB: pairsB[i] });
    }

    const maxGames =
      MAX_GAMES_BY_TOTAL_PLAYERS[totalPlayers] ?? baseGames.length;
    const gamesPlan: { pairA: Pair; pairB: Pair }[] = [];

    if (baseGames.length === 0) {
      setError("Unable to generate matchups for this player selection.");
      return;
    }

    for (let i = 0; i < maxGames; i += 1) {
      const base = baseGames[i % baseGames.length];
      gamesPlan.push({ pairA: base.pairA, pairB: base.pairB });
    }

    setGenerating(true);

    try {
      const scheduledDate = new Date(scheduledFor);
      const scheduledIso = Number.isNaN(scheduledDate.getTime())
        ? null
        : scheduledDate.toISOString();

      const { data: session, error: sessionError } = await supabase
        .from("game_sessions")
        .insert({
          league_id: selectedLeagueId,
          created_by: userId,
          scheduled_for: scheduledIso,
          player_count: playerCount,
        })
        .select("id, league_id, created_at, scheduled_for, player_count")
        .single();

      if (sessionError || !session) {
        setError(sessionError?.message ?? "Unable to create session.");
        setGenerating(false);
        return;
      }

      const matchInserts = gamesPlan.map((_, index) => ({
        session_id: session.id,
        scheduled_order: index + 1,
        status: "scheduled",
      }));

      const { data: matchRows, error: matchesError } = await supabase
        .from("matches")
        .insert(matchInserts)
        .select("id, scheduled_order");

      if (matchesError || !matchRows) {
        setError(
          matchesError?.message ?? "Unable to create matches for session."
        );
        setGenerating(false);
        return;
      }

      const sortedMatches = [...(matchRows as any[])].sort(
        (a, b) => (a.scheduled_order ?? 0) - (b.scheduled_order ?? 0)
      );

      const playerInserts: { match_id: string; user_id: string; team: number }[] = [];

      sortedMatches.forEach((match, index) => {
        const plan = gamesPlan[index];
        if (!plan) return;
        const [a1, a2] = plan.pairA;
        const [b1, b2] = plan.pairB;
        playerInserts.push(
          { match_id: match.id, user_id: a1.user_id, team: 1 },
          { match_id: match.id, user_id: a2.user_id, team: 1 },
          { match_id: match.id, user_id: b1.user_id, team: 2 },
          { match_id: match.id, user_id: b2.user_id, team: 2 }
        );
      });

      if (playerInserts.length) {
        const { error: playersError } = await supabase
          .from("match_players")
          .insert(playerInserts);

        if (playersError) {
          setError(playersError.message);
          setGenerating(false);
          return;
        }
      }

      if (userEmail) {
        await supabase.from("admin_events").insert({
          event_type: "session.created",
          user_id: userId,
          user_email: userEmail.toLowerCase(),
          league_id: selectedLeagueId,
          payload: {
            session_id: session.id,
            player_count: playerCount,
            scheduled_for: scheduledIso,
          },
        });
      }

      setGenerating(false);

      router.push(`/sessions/${session.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Unexpected error creating session.");
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="section">
        <h1 className="section-title">Create session</h1>
        <p className="hero-subtitle">Loading leagues…</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="section">
        <h1 className="section-title">Create session</h1>
        <p className="hero-subtitle">You must be signed in to create sessions.</p>
      </div>
    );
  }

  const nowTime = new Date().getTime();
  const cutoffTime = nowTime - 12 * 60 * 60 * 1000;
  const enriched = sessions.map((session) => {
    const effective = session.scheduled_for ?? session.created_at;
    const time = effective ? new Date(effective).getTime() : Number.NaN;
    return { session, time };
  });

  const upcomingSessions = enriched
    .filter((item) => !Number.isNaN(item.time) && item.time >= cutoffTime)
    .sort((a, b) => a.time - b.time)
    .map((item) => item.session);

  const pastSessions = enriched
    .filter((item) => Number.isNaN(item.time) || item.time < cutoffTime)
    .sort((a, b) => {
      const aNaN = Number.isNaN(a.time);
      const bNaN = Number.isNaN(b.time);
      if (aNaN && bNaN) return 0;
      if (aNaN) return 1;
      if (bNaN) return -1;
      return b.time - a.time;
    })
    .map((item) => item.session);

  return (
    <div className="section">
      <h1 className="section-title">Create session</h1>
      {userEmail && (
        <p className="hero-subtitle" style={{ marginBottom: "0.5rem" }}>
          Signed in as {userEmail}
        </p>
      )}
      {error && (
        <p className="hero-subtitle" style={{ color: "#fca5a5" }}>
          {error}
        </p>
      )}
      {!error && (
        <p className="hero-subtitle">
          {leagues.length
            ? "Create a session for one of your leagues, pick 6 / 8 / 10 / 12 players, and generate balanced teams and matchups."
            : "You do not own any leagues yet. You can still view sessions you play in below."}
        </p>
      )}

      {leagues.length > 0 && (
        <>
          <form
            onSubmit={handleGenerate}
            style={{
              marginTop: "1rem",
              display: "grid",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: "0.5rem",
                gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
              }}
            >
              <label style={{ fontSize: "0.8rem" }}>
                League
                <select
                  value={selectedLeagueId}
                  onChange={(e) => handleLeagueChange(e.target.value)}
                  style={{
                    marginTop: "0.35rem",
                    width: "100%",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #1f2937",
                    background: "#020617",
                    color: "#e5e7eb",
                  }}
                >
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: "0.8rem" }}>
                Date and time
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  style={{
                    marginTop: "0.35rem",
                    width: "100%",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #1f2937",
                    background: "#020617",
                    color: "#e5e7eb",
                  }}
                />
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gap: "0.5rem",
                gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)",
                alignItems: "flex-start",
              }}
            >
              <label style={{ fontSize: "0.8rem" }}>
                Player count
                <select
                  value={playerCount}
                  onChange={(e) => handlePlayerCountChange(e.target.value)}
                  style={{
                    marginTop: "0.35rem",
                    width: "100%",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #1f2937",
                    background: "#020617",
                    color: "#e5e7eb",
                  }}
                >
                  {PLAYER_COUNTS.map((n) => (
                    <option key={n} value={n}>
                      {n} players
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <p className="hero-subtitle" style={{ marginBottom: "0.25rem" }}>
                  Select players
                </p>
                {membersLoading && (
                  <p className="hero-subtitle" style={{ fontSize: "0.8rem" }}>
                    Loading league members…
                  </p>
                )}
                {!membersLoading && !members.length && (
                  <p className="hero-subtitle" style={{ fontSize: "0.8rem" }}>
                    This league has no members yet.
                  </p>
                )}
                {!membersLoading && members.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "0.5rem",
                    }}
                  >
                    {Array.from({ length: playerCount }).map((_, i) => (
                      <select
                        key={i}
                        value={selectedPlayerIds[i] ?? ""}
                        onChange={(e) => handlePlayerSelect(i, e.target.value)}
                        style={{
                          padding: "0.45rem 0.6rem",
                          borderRadius: "0.5rem",
                          border: "1px solid #1f2937",
                          background: "#020617",
                          color: "#e5e7eb",
                        }}
                      >
                        <option value="">Slot {i + 1}</option>
                        {members.map((member) => (
                          <option key={member.user_id} value={member.user_id}>
                            {displayPlayer(member)}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={generating || membersLoading || !members.length}
              style={{ justifySelf: "flex-start", marginTop: "0.5rem" }}
            >
              {generating ? "Creating session..." : "Create session"}
            </button>
          </form>
          <div style={{ marginTop: "1.5rem" }}>
            <h2 className="section-title">Players (snaking order)</h2>
            {!orderedPlayers.length ? (
              <p className="hero-subtitle" style={{ fontSize: "0.85rem" }}>
                After selecting players, they will appear here sorted by DUPR. Use the
                arrows to adjust the order; teams and matchups will be based on this
                list.
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
                  {orderedPlayers.map((member, index) => (
                    <li
                      key={member.user_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        padding: "0.25rem 0",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem" }}>
                        {index + 1}. {displayPlayer(member)}
                      </span>
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => movePlayer(index, index - 1)}
                          disabled={index === 0}
                          style={{ padding: "0.1rem 0.35rem", fontSize: "0.75rem" }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => movePlayer(index, index + 1)}
                          disabled={index === orderedPlayers.length - 1}
                          style={{ padding: "0.1rem 0.35rem", fontSize: "0.75rem" }}
                        >
                          ↓
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <h2 className="section-title">Your sessions</h2>
        {sessionsLoading ? (
          <p className="hero-subtitle" style={{ fontSize: "0.85rem" }}>
            Loading sessions...
          </p>
        ) : sessions.length === 0 ? (
          <p className="hero-subtitle" style={{ fontSize: "0.85rem" }}>
            {leagues.length
              ? "No sessions yet. Create one above to see it here."
              : "No sessions yet. You'll see sessions you play in here."}
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
            {upcomingSessions.length > 0 && (
              <div style={{ marginBottom: pastSessions.length ? "0.75rem" : 0 }}>
                <h3
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    margin: 0,
                    marginBottom: "0.35rem",
                    color: "#e5e7eb",
                  }}
                >
                  Current / upcoming sessions
                </h3>
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
                        <div style={{ fontWeight: 500 }}>
                          {session.league_name || "Unknown league"} -
                          {" "}
                          {session.player_count} players
                        </div>
                        <div
                          style={{ color: "#9ca3af", marginTop: "0.1rem" }}
                        >
                          {formatDateTime(
                            session.scheduled_for ?? session.created_at
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {session.created_by === userId && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleDeleteSession(session.id)}
                            disabled={deletingSessionId === session.id}
                            style={{
                              opacity: deletingSessionId === session.id ? 0.7 : 1,
                            }}
                          >
                            {deletingSessionId === session.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => router.push(`/sessions/${session.id}`)}
                        >
                          View
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pastSessions.length > 0 && (
              <div>
                <h3
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    margin: 0,
                    marginBottom: "0.35rem",
                    color: "#e5e7eb",
                  }}
                >
                  Past sessions
                </h3>
                <ul
                  className="section-list"
                  style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}
                >
                  {pastSessions.map((session) => (
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
                        <div style={{ fontWeight: 500 }}>
                          {session.league_name || "Unknown league"} -
                          {" "}
                          {session.player_count} players
                        </div>
                        <div
                          style={{ color: "#9ca3af", marginTop: "0.1rem" }}
                        >
                          {formatDateTime(
                            session.scheduled_for ?? session.created_at
                          )}
                        </div>
                        {(() => {
                          const summary = sessionResults[session.id];
                          if (!summary) return null;
                          const green = summary.teamGreenWins;
                          const blue = summary.teamBlueWins;
                          if (green === 0 && blue === 0) return null;

                          let label: string;
                          if (green > blue) {
                            label = `Team Green won ${green}-${blue}`;
                          } else if (blue > green) {
                            label = `Team Blue won ${blue}-${green}`;
                          } else {
                            label = `Teams tied ${green}-${blue}`;
                          }

                          return (
                            <div
                              style={{
                                color: "#bbf7d0",
                                marginTop: "0.1rem",
                                fontSize: "0.8rem",
                              }}
                            >
                              {label}
                            </div>
                          );
                        })()}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {session.created_by === userId && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleDeleteSession(session.id)}
                            disabled={deletingSessionId === session.id}
                            style={{
                              opacity: deletingSessionId === session.id ? 0.7 : 1,
                            }}
                          >
                            {deletingSessionId === session.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => router.push(`/sessions/${session.id}`)}
                        >
                          View
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
