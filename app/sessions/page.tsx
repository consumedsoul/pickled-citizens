'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { displayPlayerName } from '@/lib/formatters';
import { ClientDateTime } from '@/components/ClientDateTime';
import {
  getSessionsListData,
  listLeagueRosterAction,
  createSessionWithTeamsAction,
  type SessionListItem,
} from '@/lib/actions/sessions';
import {
  PLAYER_COUNTS,
  generateMatchups,
  sortPlayersByDupr,
  type Player,
} from '@/lib/teamGeneration';

type Member = Player & {
  is_guest?: boolean;
};

type LeagueOption = { id: string; name: string };

export default function SessionsPage() {
  const router = useRouter();
  const { isLoaded, user } = useUser();

  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<LeagueOption[]>([]);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionResults, setSessionResults] = useState<
    Record<string, { teamGreenWins: number; teamBlueWins: number }>
  >({});

  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [guests, setGuests] = useState<Member[]>([]);

  const [scheduledFor, setScheduledFor] = useState('');
  const [playerCount, setPlayerCount] = useState<6 | 8 | 10 | 12>(6);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [orderedPlayers, setOrderedPlayers] = useState<Member[]>([]);

  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestDupr, setGuestDupr] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id ?? null;
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
  const memberSlotCount = Math.max(0, playerCount - guests.length);

  const sortedLeaguesForSelect = useMemo(() => {
    if (!leagues.length) return [];
    const copy = [...leagues];
    copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  }, [leagues]);

  const sortedMembersForSelect = useMemo(() => {
    if (!members.length) return [];
    const copy = [...members];
    copy.sort((a, b) => {
      const an = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email || a.user_id;
      const bn = `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim() || b.email || b.user_id;
      return an.localeCompare(bn);
    });
    return copy;
  }, [members]);

  const getAvailablePlayersForSlot = useMemo(() => {
    return (slotIndex: number) => {
      const selectedIds = selectedPlayerIds.filter((id, index) => id && index !== slotIndex);
      return sortedMembersForSelect.filter((m) => !selectedIds.includes(m.user_id));
    };
  }, [sortedMembersForSelect, selectedPlayerIds]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace('/auth/signin');
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setSessionsLoading(true);
      setError(null);
      try {
        const data = await getSessionsListData();
        if (!active) return;
        setLeagues(data.ownedLeagues.map((l) => ({ id: l.id, name: l.name })));
        const sorted = [...data.sessions].sort((a, b) => {
          const aTime = a.scheduledFor ?? a.createdAt;
          const bTime = b.scheduledFor ?? b.createdAt;
          if (!aTime && !bTime) return 0;
          if (!aTime) return 1;
          if (!bTime) return -1;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
        setSessions(sorted);
        setSessionResults(data.results);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load sessions.');
      } finally {
        if (active) {
          setLoading(false);
          setSessionsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [isLoaded, user, router]);

  useEffect(() => {
    if (!selectedLeagueId) {
      setMembers([]);
      setGuests([]);
      setSelectedPlayerIds([]);
      setOrderedPlayers([]);
      return;
    }
    let active = true;
    (async () => {
      setMembersLoading(true);
      setError(null);
      try {
        const roster = await listLeagueRosterAction(selectedLeagueId);
        if (!active) return;
        const mapped: Member[] = roster.map((m) => ({
          user_id: m.userId,
          first_name: m.firstName,
          last_name: m.lastName,
          email: m.email,
          self_reported_dupr: m.selfReportedDupr,
        }));
        setMembers(mapped);
        setGuests([]);
        setSelectedPlayerIds([]);
        setOrderedPlayers([]);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load members.');
        setMembers([]);
      } finally {
        if (active) setMembersLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedLeagueId]);

  useEffect(() => {
    if (!members.length && !guests.length) {
      setOrderedPlayers([]);
      return;
    }
    const chosen: Member[] = [];
    const seen = new Set<string>();
    selectedPlayerIds.forEach((id) => {
      if (!id || seen.has(id)) return;
      const m = members.find((mm) => mm.user_id === id);
      if (m) {
        seen.add(id);
        chosen.push(m);
      }
    });
    guests.forEach((g) => {
      if (seen.has(g.user_id)) return;
      seen.add(g.user_id);
      chosen.push(g);
    });
    setOrderedPlayers(sortPlayersByDupr(chosen));
  }, [selectedPlayerIds, members, guests]);

  function handleLeagueChange(id: string) {
    setSelectedLeagueId(id);
  }

  function handlePlayerCountChange(value: string) {
    const n = (Number(value) || 6) as 6 | 8 | 10 | 12;
    setPlayerCount(n);
    setSelectedPlayerIds((prev) => prev.slice(0, Math.max(0, n - guests.length)));
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

  function handlePlayerSelect(index: number, userIdValue: string) {
    setSelectedPlayerIds((prev) => {
      const next = [...prev];
      next[index] = userIdValue;
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

  function displayPlayerWithDupr(member: Member) {
    const base = displayPlayerName(member) === 'Deleted player' ? member.user_id : displayPlayerName(member);
    const suffix = member.is_guest ? ' (guest)' : '';
    if (member.self_reported_dupr != null) {
      const dupr = Number(member.self_reported_dupr);
      if (!Number.isNaN(dupr)) return `${base} (${dupr.toFixed(2)})${suffix}`;
    }
    return `${base}${suffix}`;
  }

  function openGuestModal() {
    setGuestFirstName('');
    setGuestLastName('');
    setGuestDupr('');
    setGuestError(null);
    setGuestModalOpen(true);
  }

  function closeGuestModal() {
    setGuestModalOpen(false);
    setGuestError(null);
  }

  function handleAddGuest() {
    const first = guestFirstName.trim();
    const last = guestLastName.trim();
    const duprRaw = guestDupr.trim();
    if (!first) {
      setGuestError('First name is required.');
      return;
    }
    const duprNum = Number(duprRaw);
    if (!duprRaw || Number.isNaN(duprNum)) {
      setGuestError('DUPR is required.');
      return;
    }
    if (duprNum < 1.0 || duprNum > 8.5) {
      setGuestError('DUPR must be between 1.0 and 8.5.');
      return;
    }
    if (guests.length >= playerCount) {
      setGuestError('Guest count exceeds the player count for this session.');
      return;
    }
    const newGuest: Member = {
      user_id: `guest:${crypto.randomUUID()}`,
      first_name: first,
      last_name: last || null,
      email: null,
      self_reported_dupr: duprNum,
      is_guest: true,
    };
    setGuests((prev) => [...prev, newGuest]);
    setSelectedPlayerIds((prev) =>
      prev.slice(0, Math.max(0, playerCount - (guests.length + 1))),
    );
    closeGuestModal();
  }

  function handleRemoveGuest(guestId: string) {
    setGuests((prev) => prev.filter((g) => g.user_id !== guestId));
  }

  async function handleGenerate(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!selectedLeagueId) {
      setError('Select a league.');
      return;
    }
    if (!members.length && !guests.length) {
      setError('This league has no members yet. Add a guest to create a session.');
      return;
    }
    if (!userId) {
      setError('You must be signed in to create a session.');
      return;
    }
    if (!scheduledFor) {
      setError('Select a date/time for the session.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!PLAYER_COUNTS.includes(playerCount as (typeof PLAYER_COUNTS)[number])) {
      setError('Player count must be 6, 8, 10, or 12.');
      return;
    }
    const requiredMemberSlots = Math.max(0, playerCount - guests.length);
    const nonEmpty = selectedPlayerIds.filter(Boolean);
    if (nonEmpty.length !== requiredMemberSlots) {
      setError('Select all player slots.');
      return;
    }
    const unique = new Set(nonEmpty);
    if (unique.size !== nonEmpty.length) {
      setError('Each player can only be selected once.');
      return;
    }
    if (orderedPlayers.length !== playerCount) {
      setError('Unable to resolve selected players. Try again.');
      return;
    }

    const gamesPlan = generateMatchups(orderedPlayers);
    if (gamesPlan.length === 0) {
      setError('Unable to generate matchups for this player selection.');
      return;
    }

    setGenerating(true);
    try {
      const scheduledDate = new Date(scheduledFor);
      const scheduledIso = Number.isNaN(scheduledDate.getTime()) ? null : scheduledDate.toISOString();

      const guestsInPlay = guests.filter((g) =>
        orderedPlayers.some((p) => p.user_id === g.user_id),
      );

      const guestPayload = guestsInPlay.map((g) => ({
        syntheticId: g.user_id,
        displayName: `${g.first_name ?? ''}${g.last_name ? ` ${g.last_name}` : ''}`.trim(),
        dupr: g.self_reported_dupr as number,
      }));

      const matchesPayload = gamesPlan.map((plan, idx) => {
        const [a1, a2] = plan.pairA;
        const [b1, b2] = plan.pairB;
        return {
          scheduledOrder: idx + 1,
          players: [
            playerPayload(a1, 1, 0),
            playerPayload(a2, 1, 1),
            playerPayload(b1, 2, 0),
            playerPayload(b2, 2, 1),
          ],
        };
      });

      const { sessionId } = await createSessionWithTeamsAction({
        leagueId: selectedLeagueId,
        scheduledFor: scheduledIso,
        playerCount,
        guests: guestPayload,
        matches: matchesPayload,
      });
      router.push(`/sessions/${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error creating session.');
      setGenerating(false);
    }
  }

  function playerPayload(p: Member, team: 1 | 2, position: 0 | 1) {
    if (p.is_guest) {
      return { syntheticId: p.user_id, team, position };
    }
    return { userId: p.user_id, team, position };
  }

  if (loading || !isLoaded) {
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
    const effective = session.scheduledFor ?? session.createdAt;
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
      {guestModalOpen && (
        <Modal
          title="Add guest player"
          onClose={closeGuestModal}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={closeGuestModal}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={handleAddGuest}>
                Add guest
              </Button>
            </>
          }
        >
          <p className="text-app-muted mb-4">
            Guests join this session only. They are not added to the league and do not appear in
            lifetime stats.
          </p>
          <div className="grid gap-4">
            <Input
              label="First name"
              value={guestFirstName}
              onChange={(e) => setGuestFirstName(e.target.value)}
              autoFocus
            />
            <Input
              label="Last name (optional)"
              value={guestLastName}
              onChange={(e) => setGuestLastName(e.target.value)}
            />
            <Input
              label="DUPR (1.0–8.5)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="1.0"
              max="8.5"
              value={guestDupr}
              onChange={(e) => setGuestDupr(e.target.value)}
            />
            {guestError && <p className="text-app-danger text-sm">{guestError}</p>}
          </div>
        </Modal>
      )}
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Sessions</h1>
      {userEmail && (
        <p className="text-app-muted text-sm mb-4">Signed in as {userEmail}</p>
      )}
      {error && <p className="text-app-danger text-sm mb-4">{error}</p>}
      {!error && (
        <p className="text-app-muted text-sm mb-6">
          {leagues.length
            ? 'Create a session for one of your leagues, pick 6 / 8 / 10 / 12 players, and generate balanced teams and matchups.'
            : 'You do not own any leagues yet. You can still view sessions you play in below.'}
        </p>
      )}

      {leagues.length > 0 && (
        <>
          <form onSubmit={handleGenerate} className="grid gap-4">
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
                  <p className="text-app-muted text-sm">Loading league members...</p>
                )}
                {!membersLoading && !members.length && !guests.length && (
                  <p className="text-app-muted text-sm">
                    {selectedLeagueId
                      ? 'This league has no members yet. Add a guest to get started.'
                      : 'Please select a league in the drop-down above.'}
                  </p>
                )}
                {!membersLoading && members.length > 0 && memberSlotCount > 0 && (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
                    {Array.from({ length: memberSlotCount }).map((_, i) => (
                      <Select
                        key={i}
                        value={selectedPlayerIds[i] ?? ''}
                        onChange={(e) => handlePlayerSelect(i, e.target.value)}
                      >
                        <option value="">Select Player {i + 1}</option>
                        {getAvailablePlayersForSlot(i).map((member) => (
                          <option key={member.user_id} value={member.user_id}>
                            {displayPlayerWithDupr(member)}
                          </option>
                        ))}
                      </Select>
                    ))}
                  </div>
                )}
                {!membersLoading && members.length > 0 && memberSlotCount === 0 && (
                  <p className="text-app-muted text-sm">
                    All {playerCount} slots filled by guests.
                  </p>
                )}
                {selectedLeagueId && !membersLoading && (
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={openGuestModal}
                      disabled={generating}
                    >
                      + Add guest
                    </Button>
                    {guests.length > 0 && (
                      <div className="mt-3 divide-y divide-app-border border-t border-b border-app-border">
                        {guests.map((g) => (
                          <div
                            key={g.user_id}
                            className="flex items-center justify-between gap-2 py-2"
                          >
                            <span className="text-sm text-app-text">
                              {displayPlayerWithDupr(g)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleRemoveGuest(g.user_id)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2">
              <Button type="submit" variant="primary" disabled={generating || membersLoading}>
                {generating ? 'Creating session...' : 'Create session'}
              </Button>
            </div>
          </form>

          <div className="mt-10 border-t border-app-border pt-8">
            <SectionLabel>PLAYERS (SNAKING ORDER)</SectionLabel>
            {!orderedPlayers.length ? (
              <p className="text-app-muted text-sm mt-3">
                After selecting players, they will appear here sorted by DUPR. Use the arrows
                to adjust the order; teams and matchups will be based on this list.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-app-border border-t border-b border-app-border">
                {orderedPlayers.map((member, index) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-2 py-2.5"
                  >
                    <span className="text-sm text-app-text">
                      {index + 1}. {displayPlayerWithDupr(member)}
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
          <p className="text-app-muted text-sm">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-app-muted text-sm">
            {leagues.length
              ? 'No sessions yet. Create one above to see it here.'
              : "No sessions yet. You'll see sessions you play in here."}
          </p>
        ) : (
          <>
            {upcomingSessions.length > 0 && (
              <div className={pastSessions.length ? 'mb-10' : ''}>
                <SectionLabel>CURRENT / UPCOMING</SectionLabel>
                <div className="mt-3 divide-y divide-app-border border-t border-b border-app-border">
                  {upcomingSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <div className="text-sm font-medium text-app-text">
                          {session.leagueName || 'Unknown league'} &mdash; {session.playerCount}{' '}
                          players
                        </div>
                        <div className="text-app-muted text-sm mt-0.5">
                          <ClientDateTime value={session.scheduledFor ?? session.createdAt} />
                        </div>
                      </div>
                      <Link
                        href={`/sessions/${session.id}`}
                        prefetch={false}
                        className="no-underline"
                      >
                        <Button variant="sm" arrow>
                          {session.createdBy === userId ? 'Manage' : 'View'}
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
                          {session.leagueName || 'Unknown league'} &mdash; {session.playerCount}{' '}
                          players
                        </div>
                        <div className="text-app-muted text-sm mt-0.5">
                          <ClientDateTime value={session.scheduledFor ?? session.createdAt} />
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
                            colorClass = 'text-team-green';
                          } else if (blue > green) {
                            label = `Team Blue won ${blue}-${green}`;
                            colorClass = 'text-team-blue';
                          } else {
                            label = `Teams tied ${green}-${blue}`;
                            colorClass = 'text-app-muted';
                          }
                          return (
                            <span
                              className={`font-mono text-[0.65rem] uppercase tracking-button mt-1 inline-block ${colorClass}`}
                            >
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
                          {session.createdBy === userId ? 'Manage' : 'View'}
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
