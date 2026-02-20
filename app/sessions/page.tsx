"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { SectionLabel } from "@/components/ui/SectionLabel";

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

  const sortedLeaguesForSelect = useMemo(() => {
    if (!leagues.length) return [] as League[];
    const copy = [...leagues];
    copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [leagues]);

  const sortedMembersForSelect = useMemo(() => {
    if (!members.length) return [] as Member[];
    const copy = [...members];
    copy.sort((a, b) => {
      const an = `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() || a.email || a.user_id;
      const bn = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() || b.email || b.user_id;
      return an.localeCompare(bn);
    });
    return copy;
  }, [members]);

  const getAvailablePlayersForSlot = useMemo(() => {
    return (slotIndex: number) => {
      const selectedIds = selectedPlayerIds.filter((id, index) =>
        id && index !== slotIndex
      );
      return sortedMembersForSelect.filter(member =>
        !selectedIds.includes(member.user_id)
      );
    };
  }, [sortedMembersForSelect, selectedPlayerIds]);

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

      type SessionQueryRow = {
        id: string;
        league_id: string | null;
        created_by: string;
        created_at: string;
        scheduled_for: string | null;
        player_count: number;
        league: { name: string }[] | { name: string } | null;
      };
      let participantSessionRows: SessionQueryRow[] = [];

      if (mpRows && mpRows.length) {
        const matchIds = Array.from(
          new Set(mpRows.map((row) => row.match_id))
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
                .map((m) => m.session_id)
                .filter((id): id is string => !!id)
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
      const byId = new Map<string, SessionQueryRow>();
      allRows.forEach((row) => {
        if (!row || !row.id) return;
        byId.set(row.id, row as SessionQueryRow);
      });

      const mapped: SessionSummary[] = Array.from(byId.values()).map((row) => {
        const leagueRel = row.league;
        const leagueName =
          Array.isArray(leagueRel) && leagueRel.length > 0
            ? leagueRel[0]?.name ?? null
            : !Array.isArray(leagueRel) && leagueRel
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

          type MatchWithResult = {
            id: string;
            session_id: string | null;
            result:
              | { team1_score: number | null; team2_score: number | null }[]
              | { team1_score: number | null; team2_score: number | null }
              | null;
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

  function handleScheduledForChange(value: string) {
    if (!value) {
      setScheduledFor(value);
      return;
    }

    const date = new Date(value);
    const minutes = date.getMinutes();

    if (minutes !== 0 && minutes !== 30) {
      const roundedMinutes = minutes < 15 ? 0 : minutes < 45 ? 30 : 0;
      const hourAdjustment = minutes >= 45 ? 1 : 0;

      date.setMinutes(roundedMinutes);
      date.setHours(date.getHours() + hourAdjustment);
      date.setSeconds(0);
      date.setMilliseconds(0);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');

      setScheduledFor(`${year}-${month}-${day}T${hours}:${mins}`);
    } else {
      setScheduledFor(value);
    }
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
    const base = fullName || member.user_id;

    if (member.self_reported_dupr != null) {
      const dupr = Number(member.self_reported_dupr);
      if (!Number.isNaN(dupr)) {
        return `${base} (${dupr.toFixed(2)})`;
      }
    }

    return base;
  }

  function displayPlayerForDropdown(member: Member) {
    const fullName = [member.first_name, member.last_name]
      .filter(Boolean)
      .join(" ");
    const base = fullName || member.user_id;

    if (member.self_reported_dupr != null) {
      const dupr = Number(member.self_reported_dupr);
      if (!Number.isNaN(dupr)) {
        return `${base} (${dupr.toFixed(2)})`;
      }
    }

    return base;
  }

  function displayShortName(member: Member) {
    const fullName = [member.first_name, member.last_name]
      .filter(Boolean)
      .join(" ");
    return fullName || member.user_id;
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

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!selectedLeagueId) {
      setError("Select a league.");
      return;
    }


    if (!members.length) {
      setError("This league has no members yet.");
      return;
    }

    if (!userId) {
      setError("You must be signed in to create a session.");
      return;
    }

    if (!scheduledFor) {
      setError("Select a date/time for the session.");
      window.scrollTo({ top: 0, behavior: "smooth" });
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

    let gamesPlan: { pairA: Pair; pairB: Pair }[] = [];

    // Special-case 8 players (4 per team) so each round has two disjoint doubles
    // matches and no player appears on two courts in the same round.
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
        // Round 4 (repeat Round 1 matchups)
        { pairA: [a1, a2], pairB: [b1, b2] },
        { pairA: [a3, a4], pairB: [b3, b4] },
        // Round 5 (repeat Round 2 matchups)
        { pairA: [a1, a3], pairB: [b1, b3] },
        { pairA: [a2, a4], pairB: [b2, b4] },
        // Round 6 (repeat Round 3 matchups)
        { pairA: [a1, a4], pairB: [b1, b4] },
        { pairA: [a2, a3], pairB: [b2, b3] },
      ];
    } else if (playerCount === 10 && teamA.length === 5 && teamB.length === 5) {
      // Special-case 10 players (5 per team): 5 rounds, 2 courts per round.
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
      // Special-case 12 players (6 per team): 5 rounds, 3 courts per round.
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
      const pairsA = buildPairs(teamA);
      const pairsB = buildPairs(teamB);
      const baseGames: { pairA: Pair; pairB: Pair }[] = [];
      const limit = Math.min(pairsA.length, pairsB.length);

      for (let i = 0; i < limit; i += 1) {
        baseGames.push({ pairA: pairsA[i], pairB: pairsB[i] });
      }

      if (baseGames.length === 0) {
        setError("Unable to generate matchups for this player selection.");
        return;
      }

      const maxGames =
        MAX_GAMES_BY_TOTAL_PLAYERS[totalPlayers] ?? baseGames.length;

      for (let i = 0; i < maxGames; i += 1) {
        const base = baseGames[i % baseGames.length];
        gamesPlan.push({ pairA: base.pairA, pairB: base.pairB });
      }
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

      const sortedMatches = [...matchRows].sort(
        (a, b) => (a.scheduled_order ?? 0) - (b.scheduled_order ?? 0)
      );

      const playerInserts: { match_id: string; user_id: string; team: number; position: number }[] = [];

      sortedMatches.forEach((match, index) => {
        const plan = gamesPlan[index];
        if (!plan) return;
        const [a1, a2] = plan.pairA;
        const [b1, b2] = plan.pairB;
        playerInserts.push(
          { match_id: match.id, user_id: a1.user_id, team: 1, position: 0 },
          { match_id: match.id, user_id: a2.user_id, team: 1, position: 1 },
          { match_id: match.id, user_id: b1.user_id, team: 2, position: 0 },
          { match_id: match.id, user_id: b2.user_id, team: 2, position: 1 }
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error creating session.");
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-8">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Sessions</h1>
        <p className="text-app-muted text-sm">Loading your sessions...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="mt-8">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Sessions</h1>
        <p className="text-app-muted text-sm">You must be signed in to create sessions.</p>
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
    <div className="mt-8">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Sessions</h1>
      {userEmail && (
        <p className="text-app-muted text-sm mb-4">
          Signed in as {userEmail}
        </p>
      )}
      {error && (
        <p className="text-app-danger text-sm mb-4">
          {error}
        </p>
      )}
      {!error && (
        <p className="text-app-muted text-sm mb-6">
          {leagues.length
            ? "Create a session for one of your leagues, pick 6 / 8 / 10 / 12 players, and generate balanced teams and matchups."
            : "You do not own any leagues yet. You can still view sessions you play in below."}
        </p>
      )}

      {leagues.length > 0 && (
        <>
          <form
            onSubmit={handleGenerate}
            className="grid gap-4"
          >
            <div className="grid gap-4 grid-cols-2">
              <Select
                label="League"
                value={selectedLeagueId}
                onChange={(e) => handleLeagueChange(e.target.value)}
              >
                <option value="">Select League</option>
                {sortedLeaguesForSelect.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              </Select>

              <Input
                label="Date and time (Required)"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => handleScheduledForChange(e.target.value)}
              />
            </div>

            <div className="grid gap-4 grid-cols-[1fr_2fr] items-start">
              <Select
                label="Player count"
                value={playerCount}
                onChange={(e) => handlePlayerCountChange(e.target.value)}
              >
                {PLAYER_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n} players
                  </option>
                ))}
              </Select>

              <div>
                <span className="form-label">Select players</span>
                {membersLoading && (
                  <p className="text-app-muted text-sm">
                    Loading league members...
                  </p>
                )}
                {!membersLoading && !members.length && (
                  <p className="text-app-muted text-sm">
                    {selectedLeagueId ? "This league has no members yet." : "Please select a league in the drop-down above."}
                  </p>
                )}
                {!membersLoading && members.length > 0 && (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
                    {Array.from({ length: playerCount }).map((_, i) => (
                      <Select
                        key={i}
                        value={selectedPlayerIds[i] ?? ""}
                        onChange={(e) => handlePlayerSelect(i, e.target.value)}
                      >
                        <option value="">Select Player {i + 1}</option>
                        {getAvailablePlayersForSlot(i).map((member) => (
                          <option key={member.user_id} value={member.user_id}>
                            {displayPlayerForDropdown(member)}
                          </option>
                        ))}
                      </Select>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2">
              <Button type="submit" variant="primary" disabled={generating || membersLoading}>
                {generating ? "Creating session..." : "Create session"}
              </Button>
            </div>
          </form>

          <div className="mt-10 border-t border-app-border pt-8">
            <SectionLabel>PLAYERS (SNAKING ORDER)</SectionLabel>
            {!orderedPlayers.length ? (
              <p className="text-app-muted text-sm mt-3">
                After selecting players, they will appear here sorted by DUPR. Use the
                arrows to adjust the order; teams and matchups will be based on this
                list.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-app-border border-t border-b border-app-border">
                {orderedPlayers.map((member, index) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <span className="text-sm text-app-text">
                      {index + 1}. {displayPlayer(member)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => movePlayer(index, index - 1)}
                        disabled={index === 0}
                      >
                        Up
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => movePlayer(index, index + 1)}
                        disabled={index === orderedPlayers.length - 1}
                      >
                        Down
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="mt-10 border-t border-app-border pt-8">
        {sessionsLoading ? (
          <p className="text-app-muted text-sm">
            Loading sessions...
          </p>
        ) : sessions.length === 0 ? (
          <p className="text-app-muted text-sm">
            {leagues.length
              ? "No sessions yet. Create one above to see it here."
              : "No sessions yet. You'll see sessions you play in here."}
          </p>
        ) : (
          <>
            {upcomingSessions.length > 0 && (
              <div className={pastSessions.length ? "mb-10" : ""}>
                <SectionLabel>CURRENT / UPCOMING</SectionLabel>
                <div className="mt-3 divide-y divide-app-border border-t border-b border-app-border">
                  {upcomingSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-app-text">
                          {session.league_name || "Unknown league"} &mdash;{" "}
                          {session.player_count} players
                        </div>
                        <div className="text-app-muted text-sm mt-0.5">
                          {formatDateTime(
                            session.scheduled_for ?? session.created_at
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/sessions/${session.id}`}
                        prefetch={false}
                        className="no-underline"
                      >
                        <Button variant="sm" arrow>
                          {session.created_by === userId ? "Manage" : "View"}
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pastSessions.length > 0 && (
              <div>
                <SectionLabel>PAST SESSIONS</SectionLabel>
                <div className="mt-3 divide-y divide-app-border border-t border-b border-app-border">
                  {pastSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-app-text">
                          {session.league_name || "Unknown league"} &mdash;{" "}
                          {session.player_count} players
                        </div>
                        <div className="text-app-muted text-sm mt-0.5">
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
                          let colorClass: string;
                          if (green > blue) {
                            label = `Team Green won ${green}-${blue}`;
                            colorClass = "text-team-green";
                          } else if (blue > green) {
                            label = `Team Blue won ${blue}-${green}`;
                            colorClass = "text-team-blue";
                          } else {
                            label = `Teams tied ${green}-${blue}`;
                            colorClass = "text-app-muted";
                          }

                          return (
                            <span className={`font-mono text-[0.65rem] uppercase tracking-button mt-1 inline-block ${colorClass}`}>
                              {label}
                            </span>
                          );
                        })()}
                      </div>
                      <Link
                        href={`/sessions/${session.id}`}
                        prefetch={false}
                        className="no-underline"
                      >
                        <Button variant="sm" arrow>
                          {session.created_by === userId ? "Manage" : "View"}
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
