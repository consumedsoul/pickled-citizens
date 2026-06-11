'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { displayPlayerName } from '@/lib/formatters';
import { GuestModal } from '@/components/sessions/GuestModal';
import {
  listLeagueRosterAction,
  createSessionWithTeamsAction,
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

export type LeagueOption = { id: string; name: string };

// Survives an accidental full-page reload (deployment skew, Clerk handshake,
// etc.) so an in-progress session isn't lost. Cleared on successful create and
// when the tab closes (sessionStorage scope). Bump the suffix on shape changes.
const DRAFT_STORAGE_KEY = 'pc:create-session-draft:v1';

type SessionDraft = {
  selectedLeagueId: string;
  scheduledFor: string;
  playerCount: 6 | 8 | 10 | 12;
  selectedPlayerIds: string[];
  guests: Member[];
};

type CreateSessionFormProps = {
  leagues: LeagueOption[];
  userId: string;
};

export function CreateSessionForm({ leagues, userId }: CreateSessionFormProps) {
  const router = useRouter();

  // Draft persistence bookkeeping. `hydrated` gates the save effect so we don't
  // overwrite the stored draft with empty initial state on first render.
  // `pendingRestore` holds player selections that must wait for the league
  // roster to load (the league-change effect clears selections by design).
  const hydratedRef = useRef(false);
  const pendingRestoreRef = useRef<
    { leagueId: string; selectedPlayerIds: string[]; guests: Member[] } | null
  >(null);

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
        const restore = pendingRestoreRef.current;
        if (restore && restore.leagueId === selectedLeagueId) {
          const validIds = new Set(mapped.map((m) => m.user_id));
          setGuests(restore.guests);
          // Preserve slot positions; drop ids no longer in the roster.
          setSelectedPlayerIds(
            restore.selectedPlayerIds.map((id) => (id && validIds.has(id) ? id : '')),
          );
          pendingRestoreRef.current = null;
        } else {
          setGuests([]);
          setSelectedPlayerIds([]);
        }
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

  // Restore an in-progress draft after an accidental reload. Player selections
  // are deferred to pendingRestore and applied once the roster loads.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Partial<SessionDraft>;
        if (draft && typeof draft === 'object') {
          if (typeof draft.scheduledFor === 'string') setScheduledFor(draft.scheduledFor);
          if (([6, 8, 10, 12] as number[]).includes(draft.playerCount as number)) {
            setPlayerCount(draft.playerCount as 6 | 8 | 10 | 12);
          }
          if (draft.selectedLeagueId) {
            pendingRestoreRef.current = {
              leagueId: draft.selectedLeagueId,
              selectedPlayerIds: Array.isArray(draft.selectedPlayerIds)
                ? draft.selectedPlayerIds
                : [],
              guests: Array.isArray(draft.guests) ? draft.guests : [],
            };
            setSelectedLeagueId(draft.selectedLeagueId);
          }
        }
      }
    } catch {
      // Corrupt or unavailable storage — start with an empty form.
    }
    hydratedRef.current = true;
  }, []);

  // Persist the draft as it changes. Skipped until hydration completes and
  // while a restore is pending, so we never clobber the stored draft with the
  // transient empty state produced during restore.
  useEffect(() => {
    if (!hydratedRef.current || pendingRestoreRef.current) return;
    try {
      const isEmpty =
        !selectedLeagueId && !scheduledFor && !guests.length && !selectedPlayerIds.some(Boolean);
      if (isEmpty) {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }
      const draft: SessionDraft = {
        selectedLeagueId,
        scheduledFor,
        playerCount,
        selectedPlayerIds,
        guests,
      };
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Storage unavailable (private mode, quota) — draft simply won't persist.
    }
  }, [selectedLeagueId, scheduledFor, playerCount, selectedPlayerIds, guests]);

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
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Non-fatal — the draft will be overwritten by the next session anyway.
      }
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

  return (
    <>
      {guestModalOpen && (
        <GuestModal
          firstName={guestFirstName}
          lastName={guestLastName}
          dupr={guestDupr}
          error={guestError}
          onFirstNameChange={setGuestFirstName}
          onLastNameChange={setGuestLastName}
          onDuprChange={setGuestDupr}
          onCancel={closeGuestModal}
          onAdd={handleAddGuest}
        />
      )}

      {error && <p className="text-app-danger text-sm mb-4">{error}</p>}

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
  );
}
