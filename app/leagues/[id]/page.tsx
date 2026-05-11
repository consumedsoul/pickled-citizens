'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { ADMIN_EMAIL } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Modal } from '@/components/ui/Modal';
import {
  getLeagueDetail,
  renameLeagueAction,
  deleteLeagueAction,
  setMemberRoleAction,
  removeMemberAction,
  addMemberByEmailAction,
} from '@/lib/actions/leagues';

type Member = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  selfReportedDupr: number | null;
  role: 'player' | 'admin' | string;
};

type LeagueRow = {
  id: string;
  name: string;
  ownerId: string;
};

export default function LeagueMembersPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const leagueId = params?.id as string | undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [league, setLeague] = useState<LeagueRow | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [canManage, setCanManage] = useState(false);

  const [emailInput, setEmailInput] = useState('');
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteLeagueError, setDeleteLeagueError] = useState<string | null>(null);

  const [roleUpdating, setRoleUpdating] = useState(false);
  const currentUserId = user?.id ?? null;
  const userEmailLower = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  const isSuperAdmin = userEmailLower === ADMIN_EMAIL;

  const [removeMemberTarget, setRemoveMemberTarget] = useState<Member | null>(null);
  const [promoteMemberTarget, setPromoteMemberTarget] = useState<Member | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    if (!isLoaded) return;
    if (!user) {
      router.replace('/auth/signin');
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const detail = await getLeagueDetail(leagueId);
        if (!active) return;
        setLeague({
          id: detail.league.id,
          name: detail.league.name,
          ownerId: detail.league.ownerId,
        });
        setRenameInput(detail.league.name);
        setCanManage(detail.isAdmin || detail.isOwner || isSuperAdmin);

        const membersWithProfiles: Member[] = detail.members.map((m) => {
          const profile = detail.profiles.find((p) => p.id === m.userId);
          return {
            userId: m.userId,
            email: m.email ?? profile?.email ?? null,
            firstName: profile?.firstName ?? null,
            lastName: profile?.lastName ?? null,
            selfReportedDupr:
              profile?.selfReportedDupr != null ? Number(profile.selfReportedDupr) : null,
            role: m.role,
          };
        });
        membersWithProfiles.sort(memberSort);
        setMembers(membersWithProfiles);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load league.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [leagueId, isLoaded, user, router, isSuperAdmin]);

  function memberSort(a: Member, b: Member) {
    const an = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim().toLowerCase();
    const bn = `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim().toLowerCase();
    if (an && bn) {
      const cmp = an.localeCompare(bn);
      if (cmp !== 0) return cmp;
    } else if (an) return -1;
    else if (bn) return 1;
    return (a.email ?? '').toLowerCase().localeCompare((b.email ?? '').toLowerCase());
  }

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    if (!leagueId || !league) return;
    const trimmedName = renameInput.trim();
    if (!trimmedName || trimmedName === league.name) return;

    setRenaming(true);
    setError(null);
    try {
      await renameLeagueAction({ leagueId, name: trimmedName });
      setLeague({ ...league, name: trimmedName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to rename league.');
    } finally {
      setRenaming(false);
    }
  }

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    if (!leagueId) return;
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    setSaving(true);
    setError(null);
    try {
      const { member } = await addMemberByEmailAction({ leagueId, email });
      setMembers((prev) => {
        if (prev.some((m) => m.userId === member.userId)) return prev;
        const next = [...prev, member];
        next.sort(memberSort);
        return next;
      });
      setEmailInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add member.');
    } finally {
      setSaving(false);
    }
  }

  function openDeleteDialog() {
    const admins = members.filter((m) => m.role === 'admin');
    const isCurrentUserAdmin = admins.some((a) => a.userId === currentUserId);
    if (isCurrentUserAdmin && admins.length === 1 && members.length > 1) {
      setDeleteLeagueError(
        'You are the sole admin of this league. Please promote another member to admin before deleting the league.',
      );
      return;
    }
    setDeleteOpen(true);
    setDeleteConfirm('');
    setDeleteLeagueError(null);
  }

  function closeDeleteDialog() {
    setDeleteOpen(false);
    setDeleteConfirm('');
    setDeleteLoading(false);
    setDeleteLeagueError(null);
  }

  async function handleDeleteLeague() {
    if (!leagueId || !league) return;
    if (deleteConfirm !== 'delete') return;
    setDeleteLoading(true);
    setError(null);
    try {
      await deleteLeagueAction({ leagueId });
      closeDeleteDialog();
      router.replace('/leagues');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete league.');
      setDeleteLoading(false);
    }
  }

  async function confirmRemoveMember() {
    const member = removeMemberTarget;
    if (!member || !leagueId) return;
    setRemoveMemberTarget(null);
    setSaving(true);
    setError(null);
    try {
      await removeMemberAction({ leagueId, userId: member.userId });
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove member.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmPromoteToAdmin() {
    const member = promoteMemberTarget;
    if (!member || !leagueId) return;
    setPromoteMemberTarget(null);
    setRoleUpdating(true);
    setError(null);
    try {
      await setMemberRoleAction({ leagueId, userId: member.userId, role: 'admin' });
      setMembers((prev) =>
        prev.map((m) => (m.userId === member.userId ? { ...m, role: 'admin' } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to promote member.');
    } finally {
      setRoleUpdating(false);
    }
  }

  async function handleDemoteToMember(member: Member) {
    if (!leagueId) return;
    const adminCount = members.filter((m) => m.role === 'admin').length;
    if (adminCount <= 1) {
      setError('Cannot demote the last admin. Please promote another member first.');
      return;
    }
    setRoleUpdating(true);
    setError(null);
    try {
      await setMemberRoleAction({ leagueId, userId: member.userId, role: 'player' });
      setMembers((prev) =>
        prev.map((m) => (m.userId === member.userId ? { ...m, role: 'player' } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to demote member.');
    } finally {
      setRoleUpdating(false);
    }
  }

  function formatMemberName(member: Member) {
    const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ');
    const base = fullName || member.userId;
    if (member.selfReportedDupr != null) {
      const dupr = Number(member.selfReportedDupr);
      if (!Number.isNaN(dupr)) return `${base} (${dupr.toFixed(2)})`;
    }
    return base;
  }

  if (loading || !isLoaded) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">League</h1>
        <p className="text-app-muted text-sm">Loading league members...</p>
      </div>
    );
  }

  if (error && !league) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">League</h1>
        <p className="text-app-danger text-sm">{error}</p>
      </div>
    );
  }

  if (!league) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">League</h1>
        <p className="text-app-muted text-sm">League not found.</p>
      </div>
    );
  }

  const admins = members.filter((m) => m.role === 'admin');
  const regularMembers = members.filter((m) => m.role === 'player');

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">{league.name}</h1>

      {error && <p className="text-app-danger text-sm mt-2">{error}</p>}

      {canManage && (
        <>
          <div className="border-t border-app-border mt-6 pt-6">
            <SectionLabel>Rename League</SectionLabel>
            <form onSubmit={handleRename} className="mt-3 flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="League name"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                className="flex-1 min-w-[220px] px-3 py-2.5 border border-app-border bg-transparent text-app-text text-sm placeholder:text-app-light-gray focus:outline-none focus:border-app-text transition-colors"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={
                  renaming || !renameInput.trim() || renameInput.trim() === league.name.trim()
                }
              >
                {renaming ? 'Renaming...' : 'Rename'}
              </Button>
            </form>
          </div>

          <div className="border-t border-app-border mt-6 pt-6">
            <SectionLabel>Add Player</SectionLabel>
            <p className="text-sm text-app-muted mt-2">
              Add authenticated players by email. They must have signed up and saved their profile.
            </p>
            <form onSubmit={handleAddMember} className="mt-3 flex flex-wrap gap-2">
              <input
                type="email"
                placeholder="Player email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="flex-1 min-w-[220px] px-3 py-2.5 border border-app-border bg-transparent text-app-text text-sm placeholder:text-app-light-gray focus:outline-none focus:border-app-text transition-colors"
              />
              <Button type="submit" variant="primary" disabled={saving || !emailInput.trim()}>
                {saving ? 'Saving...' : 'Add Player'}
              </Button>
            </form>
          </div>
        </>
      )}

      <div className="border-t border-app-border mt-6 pt-6">
        <SectionLabel>League Admins ({admins.length})</SectionLabel>
        <div className="mt-4">
          {admins.length === 0 ? (
            <p className="text-app-muted text-sm">No league admins found.</p>
          ) : (
            <div className="divide-y divide-app-border">
              {admins.map((admin) => (
                <div
                  key={admin.userId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-app-text">
                      {formatMemberName(admin)}
                    </div>
                    <span className="inline-block font-mono text-[0.6rem] uppercase tracking-button px-1.5 py-0.5 border border-app-text text-app-text mt-1">
                      Admin
                    </span>
                  </div>
                  {canManage && admin.userId !== currentUserId && (
                    <Button
                      variant="sm"
                      onClick={() => handleDemoteToMember(admin)}
                      disabled={roleUpdating || admins.length <= 1}
                    >
                      Make Member
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-app-border mt-6 pt-6">
        <SectionLabel>Members ({regularMembers.length})</SectionLabel>
        <div className="mt-4">
          {regularMembers.length === 0 ? (
            <p className="text-app-muted text-sm">No members yet.</p>
          ) : (
            <div className="divide-y divide-app-border">
              {regularMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="text-sm font-medium text-app-text">
                    {formatMemberName(member)}
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <Button
                        variant="sm"
                        onClick={() => setPromoteMemberTarget(member)}
                        disabled={roleUpdating}
                      >
                        Make Admin
                      </Button>
                      <Button
                        variant="sm"
                        className="border-app-danger text-app-danger hover:bg-red-50"
                        onClick={() => setRemoveMemberTarget(member)}
                        disabled={saving}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {canManage && (
        <div className="border-t border-app-border mt-8 pt-6">
          <SectionLabel>Danger Zone</SectionLabel>
          <p className="text-sm text-app-muted mt-3">
            This will permanently delete this league and its data. This action cannot be undone.
          </p>
          <Button variant="danger" onClick={openDeleteDialog} className="mt-3">
            Delete League
          </Button>
          {deleteLeagueError && (
            <div className="mt-3 p-3 border border-app-danger text-app-danger text-sm">
              {deleteLeagueError}
            </div>
          )}
        </div>
      )}

      {deleteOpen && (
        <Modal
          title="Delete League"
          onClose={closeDeleteDialog}
          footer={
            <>
              <Button variant="secondary" onClick={closeDeleteDialog}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteLeague}
                disabled={deleteLoading || deleteConfirm !== 'delete'}
              >
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </>
          }
        >
          <p className="mb-4">
            This will permanently delete this league and its data. Type{' '}
            <span className="font-semibold">delete</span> to confirm.
          </p>
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Type delete to confirm"
            className="w-full px-3 py-2.5 border border-app-border bg-transparent text-app-text text-sm placeholder:text-app-light-gray focus:outline-none focus:border-app-text transition-colors"
          />
        </Modal>
      )}

      {removeMemberTarget && (
        <Modal
          title="Remove Member"
          onClose={() => setRemoveMemberTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setRemoveMemberTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmRemoveMember} disabled={saving}>
                Remove
              </Button>
            </>
          }
        >
          <p>
            Remove{' '}
            <span className="font-semibold">
              {removeMemberTarget.firstName ||
                removeMemberTarget.email ||
                removeMemberTarget.userId}
            </span>{' '}
            from the league?
          </p>
        </Modal>
      )}

      {promoteMemberTarget && (
        <Modal
          title="Promote to Admin"
          onClose={() => setPromoteMemberTarget(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPromoteMemberTarget(null)}>
                Cancel
              </Button>
              <Button onClick={confirmPromoteToAdmin} disabled={roleUpdating}>
                Promote
              </Button>
            </>
          }
        >
          <p>
            Make{' '}
            <span className="font-semibold">
              {promoteMemberTarget.firstName ||
                promoteMemberTarget.email ||
                promoteMemberTarget.userId}
            </span>{' '}
            an admin?
          </p>
        </Modal>
      )}
    </div>
  );
}
