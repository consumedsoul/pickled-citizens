'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ADMIN_EMAIL } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Modal } from '@/components/ui/Modal';

type League = {
  id: string;
  name: string;
  owner_id: string;
};

type Member = {
  user_id: string;
  email: string | null;
  first_name?: string | null;
  last_name?: string | null;
  self_reported_dupr?: number | null;
  role: 'player' | 'admin';
};

export default function LeagueMembersPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params?.id as string | undefined;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const [isOwner, setIsOwner] = useState(false);

  const [emailInput, setEmailInput] = useState('');
  const [renameInput, setRenameInput] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteLeagueError, setDeleteLeagueError] = useState<string | null>(null);

  const [roleUpdating, setRoleUpdating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!leagueId) return;
      setLoading(true);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !userData.user) {
        router.replace('/');
        return;
      }

      const user = userData.user;
      setCurrentUserId(user.id);
      const emailLower = user.email?.toLowerCase() ?? '';
      const isSuperAdmin = emailLower === ADMIN_EMAIL;

      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('id, name, owner_id')
        .eq('id', leagueId)
        .maybeSingle();

      if (!active) return;

      if (leagueError || !leagueData) {
        setError(leagueError?.message ?? 'League not found.');
        setLoading(false);
        return;
      }

      setLeague(leagueData as League);
      const owner = leagueData.owner_id === user.id;
      const initialCanManage = owner || isSuperAdmin;
      setIsOwner(initialCanManage);
      setRenameInput(leagueData.name);

      const { data: memberRows, error: membersError } = await supabase
        .from('league_members')
        .select('user_id, email, role')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: true });

      if (!active) return;

      if (membersError) {
        setError(membersError.message);
        setLoading(false);
        return;
      }

      const rows = (memberRows ?? []) as {
        user_id: string;
        email: string | null;
        role: 'player' | 'admin';
      }[];

      const isMember = rows.some((m) => m.user_id === user.id);
      const isAdmin = rows.some((m) => m.user_id === user.id && m.role === 'admin');

      if (!owner && !isMember && !isSuperAdmin) {
        setError('You are not a member of this league.');
        setLoading(false);
        return;
      }

      const finalCanManage = isAdmin || owner || isSuperAdmin;
      setIsOwner(finalCanManage);

      if (!rows.length) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const userIds = rows.map((m) => m.user_id);
      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, self_reported_dupr')
        .in('id', userIds);

      if (!active) return;

      if (profilesError) {
        setError(profilesError.message);
        setLoading(false);
        return;
      }

      const membersWithNames: Member[] = rows.map((m) => {
        const profile = (profileRows ?? []).find((p) => p.id === m.user_id);
        return {
          user_id: m.user_id,
          email: m.email ?? null,
          first_name: profile?.first_name ?? null,
          last_name: profile?.last_name ?? null,
          self_reported_dupr:
            profile && profile.self_reported_dupr != null
              ? Number(profile.self_reported_dupr)
              : null,
          role: m.role,
        };
      });

      membersWithNames.sort((a, b) => {
        const an = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim().toLowerCase();
        const bn = `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim().toLowerCase();
        if (an && bn) {
          const cmp = an.localeCompare(bn);
          if (cmp !== 0) return cmp;
        } else if (an) return -1;
        else if (bn) return 1;
        const ae = (a.email ?? '').toLowerCase();
        const be = (b.email ?? '').toLowerCase();
        return ae.localeCompare(be);
      });
      setMembers(membersWithNames);
      setLoading(false);
    }

    load();
    return () => { active = false; };
  }, [leagueId, router]);

  async function handleRename(event: FormEvent) {
    event.preventDefault();
    if (!leagueId || !league) return;
    const trimmedName = renameInput.trim();
    if (!trimmedName || trimmedName === league.name) return;

    setRenaming(true);
    setError(null);

    const { data: existingLeagues, error: existingError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('owner_id', league.owner_id);

    if (existingError) {
      setError(existingError.message);
      setRenaming(false);
      return;
    }

    const duplicate = (existingLeagues ?? []).some(
      (existing) =>
        existing.id !== league.id &&
        existing.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      setError('You already have a league with that name.');
      setRenaming(false);
      return;
    }

    const { data: updatedLeague, error } = await supabase
      .from('leagues')
      .update({ name: trimmedName })
      .eq('id', leagueId)
      .select('id, name, owner_id')
      .maybeSingle();

    if (error || !updatedLeague) {
      setError(error?.message ?? 'Unable to rename league.');
      setRenaming(false);
      return;
    }

    setLeague(updatedLeague as League);
    setRenameInput(updatedLeague.name);
    setRenaming(false);
  }

  async function handleAddMember(event: FormEvent) {
    event.preventDefault();
    if (!leagueId) return;
    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    setSaving(true);
    setError(null);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, self_reported_dupr')
      .eq('email', email)
      .maybeSingle();

    if (profileError || !profile) {
      setError(
        profileError?.message ??
          'No player found with that email. Ask them to sign up and save their profile first.'
      );
      setSaving(false);
      return;
    }

    const {
      id: foundUserId,
      email: profileEmail,
      first_name,
      last_name,
      self_reported_dupr,
    } = profile as {
      id: string;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      self_reported_dupr: number | null;
    };

    const { data: insertData, error: insertError } = await supabase
      .from('league_members')
      .insert({ league_id: leagueId, user_id: foundUserId, email: profileEmail ?? email })
      .select('user_id, email')
      .single();

    if (insertError) {
      setError(insertError.message);
    } else if (insertData) {
      const memberToAdd: Member = {
        user_id: insertData.user_id,
        email: insertData.email,
        first_name,
        last_name,
        self_reported_dupr:
          self_reported_dupr != null ? Number(self_reported_dupr) : null,
        role: 'player',
      };

      setMembers((prev) => {
        const exists = prev.some((m) => m.user_id === memberToAdd.user_id);
        if (exists) return prev;
        const next = [...prev, memberToAdd];
        next.sort((a, b) => {
          const an = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim().toLowerCase();
          const bn = `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim().toLowerCase();
          if (an && bn) {
            const cmp = an.localeCompare(bn);
            if (cmp !== 0) return cmp;
          } else if (an) return -1;
          else if (bn) return 1;
          const ae = (a.email ?? '').toLowerCase();
          const be = (b.email ?? '').toLowerCase();
          return ae.localeCompare(be);
        });
        return next;
      });
      setEmailInput('');

      const { data: currentUser } = await supabase.auth.getUser();
      if (currentUser?.user) {
        await supabase.from('admin_events').insert({
          event_type: 'league.member_added',
          user_id: currentUser.user.id,
          user_email: currentUser.user.email?.toLowerCase() ?? null,
          league_id: leagueId,
          payload: {
            league_name: league?.name ?? null,
            member_user_id: insertData.user_id,
            member_email: insertData.email,
          },
        });
      }
    }

    setSaving(false);
  }

  function openDeleteDialog() {
    const admins = members.filter(member => member.role === 'admin');
    const isCurrentUserAdmin = admins.some(admin => admin.user_id === currentUserId);

    if (isCurrentUserAdmin && admins.length === 1 && members.length > 1) {
      setDeleteLeagueError('You are the sole admin of this league. Please promote another member to admin before deleting the league.');
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

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setError(userError?.message ?? 'You must be signed in.');
      setDeleteLoading(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from('leagues')
      .delete()
      .eq('id', leagueId);

    if (deleteError) {
      setError(deleteError.message);
      setDeleteLoading(false);
      return;
    }

    await supabase.from('admin_events').insert({
      event_type: 'league.deleted',
      user_id: userData.user.id,
      user_email: userData.user.email?.toLowerCase() ?? null,
      league_id: leagueId,
      payload: { league_name: league.name },
    });

    closeDeleteDialog();
    router.replace('/leagues');
  }

  async function handleRemoveMember(member: Member) {
    if (!leagueId) return;

    const confirmed = window.confirm(`Are you sure you want to remove ${member.first_name || member.email || member.user_id} from the league?`);
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from('league_members')
      .delete()
      .eq('league_id', leagueId)
      .eq('user_id', member.user_id);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));

    const { data: currentUser } = await supabase.auth.getUser();
    if (currentUser?.user) {
      await supabase.from('admin_events').insert({
        event_type: 'league.member_removed',
        user_id: currentUser.user.id,
        user_email: currentUser.user.email?.toLowerCase() ?? null,
        league_id: leagueId,
        payload: {
          league_name: league?.name ?? null,
          member_user_id: member.user_id,
          member_email: member.email,
        },
      });
    }

    setSaving(false);
  }

  async function handlePromoteToAdmin(member: Member) {
    if (!leagueId) return;

    const confirmed = window.confirm(`Are you sure you want to make ${member.first_name || member.email || member.user_id} an admin?`);
    if (!confirmed) return;

    setRoleUpdating(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('league_members')
      .update({ role: 'admin' })
      .eq('league_id', leagueId)
      .eq('user_id', member.user_id);

    if (updateError) {
      setError(updateError.message);
      setRoleUpdating(false);
      return;
    }

    setMembers(prev => prev.map(m =>
      m.user_id === member.user_id ? { ...m, role: 'admin' } : m
    ));

    const { data: currentUser } = await supabase.auth.getUser();
    if (currentUser?.user) {
      await supabase.from('admin_events').insert({
        event_type: 'league.member_promoted',
        user_id: currentUser.user.id,
        user_email: currentUser.user.email?.toLowerCase() ?? null,
        league_id: leagueId,
        payload: {
          league_name: league?.name ?? null,
          promoted_user_id: member.user_id,
          promoted_email: member.email,
        },
      });
    }

    setRoleUpdating(false);
  }

  async function handleDemoteToMember(member: Member) {
    if (!leagueId) return;

    const adminCount = members.filter(m => m.role === 'admin').length;
    if (adminCount <= 1) {
      setError('Cannot demote the last admin. Please promote another member first.');
      return;
    }

    setRoleUpdating(true);
    setError(null);

    const { error: updateError } = await supabase
      .from('league_members')
      .update({ role: 'player' })
      .eq('league_id', leagueId)
      .eq('user_id', member.user_id);

    if (updateError) {
      setError(updateError.message);
      setRoleUpdating(false);
      return;
    }

    setMembers(prev => prev.map(m =>
      m.user_id === member.user_id ? { ...m, role: 'player' } : m
    ));

    const { data: currentUser } = await supabase.auth.getUser();
    if (currentUser?.user) {
      await supabase.from('admin_events').insert({
        event_type: 'league.member_demoted',
        user_id: currentUser.user.id,
        user_email: currentUser.user.email?.toLowerCase() ?? null,
        league_id: leagueId,
        payload: {
          league_name: league?.name ?? null,
          demoted_user_id: member.user_id,
          demoted_email: member.email,
        },
      });
    }

    setRoleUpdating(false);
  }

  function formatMemberName(member: Member) {
    const fullName = [member.first_name, member.last_name].filter(Boolean).join(' ');
    const base = fullName || member.user_id;
    if (member.self_reported_dupr != null) {
      const dupr = Number(member.self_reported_dupr);
      if (!Number.isNaN(dupr)) return `${base} (${dupr.toFixed(2)})`;
    }
    return base;
  }

  if (loading) {
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

  const admins = members.filter(member => member.role === 'admin');
  const regularMembers = members.filter(member => member.role === 'player');

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">{league.name}</h1>

      {error && <p className="text-app-danger text-sm mt-2">{error}</p>}

      {isOwner && (
        <>
          {/* Rename */}
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
                disabled={renaming || !renameInput.trim() || renameInput.trim() === league.name.trim()}
              >
                {renaming ? 'Renaming...' : 'Rename'}
              </Button>
            </form>
          </div>

          {/* Add Player */}
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
              <Button
                type="submit"
                variant="primary"
                disabled={saving || !emailInput.trim()}
              >
                {saving ? 'Saving...' : 'Add Player'}
              </Button>
            </form>
          </div>
        </>
      )}

      {/* League Admins */}
      <div className="border-t border-app-border mt-6 pt-6">
        <SectionLabel>League Admins ({admins.length})</SectionLabel>
        <div className="mt-4">
          {admins.length === 0 ? (
            <p className="text-app-muted text-sm">No league admins found.</p>
          ) : (
            <div className="divide-y divide-app-border">
              {admins.map((admin) => (
                <div key={admin.user_id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium text-app-text">
                      {formatMemberName(admin)}
                    </div>
                    <span className="inline-block font-mono text-[0.6rem] uppercase tracking-button px-1.5 py-0.5 border border-app-text text-app-text mt-1">
                      Admin
                    </span>
                  </div>
                  {isOwner && admin.user_id !== currentUserId && (
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

      {/* Members */}
      <div className="border-t border-app-border mt-6 pt-6">
        <SectionLabel>Members ({regularMembers.length})</SectionLabel>
        <div className="mt-4">
          {regularMembers.length === 0 ? (
            <p className="text-app-muted text-sm">No members yet.</p>
          ) : (
            <div className="divide-y divide-app-border">
              {regularMembers.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between gap-3 py-3">
                  <div className="text-sm font-medium text-app-text">
                    {formatMemberName(member)}
                  </div>
                  {isOwner && (
                    <div className="flex gap-2">
                      <Button
                        variant="sm"
                        onClick={() => handlePromoteToAdmin(member)}
                        disabled={roleUpdating}
                      >
                        Make Admin
                      </Button>
                      <Button
                        variant="sm"
                        className="border-app-danger text-app-danger hover:bg-red-50"
                        onClick={() => handleRemoveMember(member)}
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

      {/* Danger Zone */}
      {isOwner && (
        <div className="border-t border-app-border mt-8 pt-6">
          <SectionLabel>Danger Zone</SectionLabel>
          <p className="text-sm text-app-muted mt-3">
            This will permanently delete this league and its data. This action cannot be undone.
          </p>
          <Button
            variant="danger"
            onClick={openDeleteDialog}
            className="mt-3"
          >
            Delete League
          </Button>

          {deleteLeagueError && (
            <div className="mt-3 p-3 border border-app-danger text-app-danger text-sm">
              {deleteLeagueError}
            </div>
          )}
        </div>
      )}

      {/* Delete Modal */}
      {deleteOpen && (
        <Modal
          title="Delete League"
          onClose={closeDeleteDialog}
          footer={
            <>
              <Button variant="secondary" onClick={closeDeleteDialog}>Cancel</Button>
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
    </div>
  );
}
