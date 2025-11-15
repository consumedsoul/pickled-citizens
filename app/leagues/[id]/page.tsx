'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

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
      const emailLower = user.email?.toLowerCase() ?? '';
      const isSuperAdmin = emailLower === 'hun@ghkim.com';

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
      const canManage = owner || isSuperAdmin;
      setIsOwner(canManage);
      setRenameInput(leagueData.name);

      const { data: memberRows, error: membersError } = await supabase
        .from('league_members')
        .select('user_id, email')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: true });

      if (!active) return;

      if (membersError) {
        setError(membersError.message);
        setLoading(false);
        return;
      }

      const rows = (memberRows ?? []) as { user_id: string; email: string | null }[];
      const isMember = rows.some((m) => m.user_id === user.id);

      if (!owner && !isMember && !isSuperAdmin) {
        setError('You are not a member of this league.');
        setLoading(false);
        return;
      }

      if (!rows.length) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const userIds = rows.map((m) => m.user_id);

      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, self_reported_dupr')
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
          email: m.email ?? profile?.email ?? null,
          first_name: profile?.first_name ?? null,
          last_name: profile?.last_name ?? null,
          self_reported_dupr:
            profile && profile.self_reported_dupr != null
              ? Number(profile.self_reported_dupr)
              : null,
        };
      });

      membersWithNames.sort((a, b) => {
        const an = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim().toLowerCase();
        const bn = `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim().toLowerCase();

        if (an && bn) {
          const cmp = an.localeCompare(bn);
          if (cmp !== 0) return cmp;
        } else if (an) {
          return -1;
        } else if (bn) {
          return 1;
        }

        const ae = (a.email ?? '').toLowerCase();
        const be = (b.email ?? '').toLowerCase();
        return ae.localeCompare(be);
      });
      setMembers(membersWithNames);

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
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
      id: userId,
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
      .insert({ league_id: leagueId, user_id: userId, email: profileEmail ?? email })
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
          } else if (an) {
            return -1;
          } else if (bn) {
            return 1;
          }

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
    setDeleteOpen(true);
    setDeleteConfirm('');
    setError(null);
  }

  function closeDeleteDialog() {
    setDeleteOpen(false);
    setDeleteConfirm('');
    setDeleteLoading(false);
  }

  async function handleDeleteLeague() {
    if (!leagueId || !league) return;
    if (deleteConfirm !== 'delete') return;

    setDeleteLoading(true);
    setError(null);

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

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

  if (loading) {
    return (
      <div className="section">
        <h1 className="section-title">League</h1>
        <p className="hero-subtitle">Loading league members…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="section">
        <h1 className="section-title">League</h1>
        <p className="hero-subtitle" style={{ color: '#fca5a5' }}>
          {error}
        </p>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="section">
        <h1 className="section-title">League</h1>
        <p className="hero-subtitle">League not found.</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h1 className="section-title">{league.name} roster</h1>
      {isOwner && (
        <>
          <form
            onSubmit={handleRename}
            style={{
              marginTop: '0.75rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <input
              type="text"
              placeholder="League name"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              style={{
                flex: '1 1 220px',
                padding: '0.45rem 0.6rem',
                borderRadius: '0.5rem',
                border: '1px solid #1f2937',
                background: '#020617',
                color: '#e5e7eb',
              }}
            />
            <button
              type="submit"
              className="btn-secondary"
              disabled={
                renaming ||
                !renameInput.trim() ||
                renameInput.trim() === league.name.trim()
              }
            >
              {renaming ? 'Renaming…' : 'Rename league'}
            </button>
          </form>
          <p className="hero-subtitle">
            Add or remove authenticated players from this league by email. Players must
            have already signed up and saved their profile so their email is stored.
          </p>

          <form
            onSubmit={handleAddMember}
            style={{
              marginTop: '1rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <input
              type="email"
              placeholder="Player email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              style={{
                flex: '1 1 220px',
                padding: '0.45rem 0.6rem',
                borderRadius: '0.5rem',
                border: '1px solid #1f2937',
                background: '#020617',
                color: '#e5e7eb',
              }}
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !emailInput.trim()}
            >
              {saving ? 'Saving…' : 'Add player'}
            </button>
          </form>
        </>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <h2 className="section-title">Members</h2>
        {members.length === 0 ? (
          <p className="hero-subtitle">No members yet.</p>
        ) : (
          <ul className="section-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
            {members.map((member) => (
              <li
                key={member.user_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.25rem 0',
                }}
              >
                <span>
                  {(() => {
                    const fullName = [member.first_name, member.last_name]
                      .filter(Boolean)
                      .join(' ');
                    const email = member.email ?? '';
                    const base =
                      fullName && email
                        ? `${fullName} (${email})`
                        : email || fullName || member.user_id;

                    if (member.self_reported_dupr != null) {
                      const dupr = Number(member.self_reported_dupr);
                      if (!Number.isNaN(dupr)) {
                        return `${base} ${dupr.toFixed(2)}`;
                      }
                    }

                    return base;
                  })()}
                </span>
                {isOwner && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleRemoveMember(member)}
                    style={{
                      borderColor: '#b91c1c',
                      color: '#fecaca',
                    }}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {isOwner && (
        <>
          <div
            style={{
              marginTop: '2rem',
              paddingTop: '1rem',
              borderTop: '1px solid #1f2937',
            }}
          >
            <h2 className="section-title">Delete league</h2>
            <p className="hero-subtitle">
              This will permanently delete this league and its data. This action cannot be
              undone.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={openDeleteDialog}
              style={{
                marginTop: '0.75rem',
                background: '#b91c1c',
                borderColor: '#b91c1c',
                color: '#fee2e2',
              }}
            >
              Delete league
            </button>
          </div>

          {deleteOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15,23,42,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 40,
              }}
            >
              <div
                className="section"
                style={{
                  maxWidth: 420,
                  width: '90%',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                }}
              >
                <h2 className="section-title">Delete league</h2>
                <p className="hero-subtitle">
                  This will permanently delete this league and its data. Type
                  <span style={{ fontWeight: 600 }}> delete </span>
                  to confirm.
                </p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="Type delete to confirm"
                  style={{
                    marginTop: '0.75rem',
                    width: '100%',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #1f2937',
                    background: '#020617',
                    color: '#e5e7eb',
                  }}
                />
                <div
                  style={{
                    marginTop: '1rem',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.5rem',
                  }}
                >
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeDeleteDialog}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleDeleteLeague}
                    disabled={deleteLoading || deleteConfirm !== 'delete'}
                    style={{
                      background: '#b91c1c',
                      borderColor: '#b91c1c',
                      color: '#fee2e2',
                    }}
                  >
                    {deleteLoading ? 'Deleting…' : 'Confirm delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
