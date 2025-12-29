'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  self_reported_dupr: number | null;
};

type League = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

function formatLeagueName(name: string, createdAt: string) {
  const year = new Date(createdAt).getFullYear();
  return `${name} (est. ${year})`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [selfDupr, setSelfDupr] = useState('');

  const [leagues, setLeagues] = useState<League[]>([]);

  const [leaveLeagueId, setLeaveLeagueId] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !userData.user) {
        router.replace('/');
        return;
      }

      const user = userData.user;

      setUserId(user.id);
      setUserEmail(user.email ?? null);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, gender, self_reported_dupr')
        .eq('id', user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        setError(profileError.message);
      } else if (profile) {
        const p = profile as Profile;
        setFirstName(p.first_name ?? '');
        setLastName(p.last_name ?? '');
        setGender(p.gender ?? '');
        setSelfDupr(
          p.self_reported_dupr !== null && p.self_reported_dupr !== undefined
            ? p.self_reported_dupr.toFixed(2)
            : ''
        );
      }

      const { data: memberRows, error: leaguesError } = await supabase
        .from('league_members')
        .select('league:leagues(id, name, owner_id, created_at)')
        .eq('user_id', user.id);

      if (!active) return;

      if (!leaguesError && memberRows) {
        const mapped: League[] = (memberRows as any[])
          .map((row) => row.league)
          .filter(Boolean);
        setLeagues(mapped);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!firstName.trim() || !lastName.trim() || !gender) {
      setError('First name, last name, and gender are required.');
      return;
    }

    if (!selfDupr.trim()) {
      setError('Self-reported DUPR is required.');
      return;
    }

    if (!/^\d{1,2}(\.\d{1,2})?$/.test(selfDupr.trim())) {
      setError('Self-reported DUPR must be a number like 3.75.');
      return;
    }

    setSaving(true);

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setError(userError?.message ?? 'You must be signed in.');
      setSaving(false);
      return;
    }

    const selfDuprNumber = Number(selfDupr.trim());

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: userData.user.id,
      email: userData.user.email?.toLowerCase() ?? null,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      gender,
      self_reported_dupr: selfDuprNumber,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      setError(upsertError.message);
    } else {
      setSuccess('Profile saved.');
    }

    setSaving(false);
  }

  function openLeaveLeagueDialog(leagueId: string) {
    setLeaveLeagueId(leagueId);
    setError(null);
    setSuccess(null);
  }

  async function confirmLeaveLeague() {
    if (!leaveLeagueId) return;
    await handleLeaveLeague(leaveLeagueId);
    setLeaveLeagueId(null);
  }

  function closeLeaveLeagueDialog() {
    setLeaveLeagueId(null);
  }

  async function handleLeaveLeague(leagueId: string) {
    if (!userId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();

    const accessToken = sessionData.session?.access_token;

    if (sessionError || !accessToken) {
      setError(sessionError?.message ?? 'You must be signed in.');
      setSaving(false);
      return;
    }

    const response = await fetch('/api/leagues/leave', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ leagueId }),
    });

    const json = (await response.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null;

    if (!response.ok) {
      setError(json?.error ?? 'Unable to leave league. Please refresh and try again.');
      setSaving(false);
      return;
    }

    setLeagues((prev) => prev.filter((league) => league.id !== leagueId));

    const { data: currentUser } = await supabase.auth.getUser();
    if (currentUser?.user) {
      await supabase.from('admin_events').insert({
        event_type: 'league.member_removed',
        user_id: currentUser.user.id,
        user_email: currentUser.user.email?.toLowerCase() ?? null,
        league_id: leagueId,
        payload: {
          via: 'self_leave',
        },
      });
    }

    setSaving(false);
  }

  async function openDeleteDialog() {
    setDeleteError(null);
    
    // Check if user is admin of any leagues before allowing deletion
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      setDeleteError('Failed to verify user status. Please try again.');
      return;
    }

    const { data: adminMemberships, error: adminError } = await supabase
      .from('league_members')
      .select('league:leagues(id, name)')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin');

    if (adminError) {
      setDeleteError('Failed to check league admin status. Please try again.');
      return;
    }

    // Check if user is the sole admin of any leagues
    const memberships = adminMemberships as unknown as { league: { id: string; name: string } }[] || [];
    const leaguesToCheck = memberships.map(m => m.league.id);
    const soleAdminLeagues: { id: string; name: string }[] = [];

    for (const leagueId of leaguesToCheck) {
      const { data: adminCount, error: countError } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', leagueId)
        .eq('role', 'admin');

      if (!countError && adminCount && adminCount.length === 1) {
        const league = memberships.find(m => m.league.id === leagueId)?.league;
        if (league) {
          soleAdminLeagues.push(league);
        }
      }
    }

    if (soleAdminLeagues.length > 0) {
      const leagueNames = soleAdminLeagues.map(l => l.name).join(', ');
      setDeleteError(
        `Cannot delete account: You are the sole admin of ${soleAdminLeagues.length} league(s): ${leagueNames}. ` +
        `Please promote another member to admin in these leagues before deleting your account.`
      );
      return;
    }

    // If no issues, open the delete confirmation dialog
    setDeleteOpen(true);
    setDeleteConfirm('');
  }

  function closeDeleteDialog() {
    setDeleteOpen(false);
    setDeleteConfirm('');
    setDeleteLoading(false);
    setDeleteError(null);
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'delete') return;

    setDeleteLoading(true);
    setError(null);
    setSuccess(null);

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setError(userError?.message ?? 'You must be signed in.');
      setDeleteLoading(false);
      return;
    }

    const user = userData.user;

    // Best-effort cleanup of user-related data.
    // Depending on your RLS policies, some of these may require
    // additional delete policies to succeed.
    const email = user.email ?? '';

    const operations = [
      supabase.from('league_members').delete().eq('user_id', user.id),
      supabase.from('league_invites').delete().eq('email', email),
      supabase.from('leagues').delete().eq('owner_id', user.id),
      supabase.from('profiles').delete().eq('id', user.id),
    ];

    for (const op of operations) {
      const { error } = await op;
      if (error) {
        // Surface the first error and stop; user can retry after policies are adjusted.
        setError(error.message);
        setDeleteLoading(false);
        return;
      }
    }

    // TODO: Temporarily disabled - need to run admin function migration
    // Delete the actual auth user account
    // const { error: deleteError } = await supabase.rpc('admin_delete_user', {
    //   user_id_to_delete: user.id
    // });

    // if (deleteError) {
    //   setError(`Failed to delete auth account: ${deleteError.message}`);
    //   setDeleteLoading(false);
    //   return;
    // }

    // Sign out after successful deletion
    await supabase.auth.signOut();

    // Redirect to account deleted confirmation page
    window.location.href = '/account-deleted';
  }

  if (loading) {
    return (
      <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5">
        <h1 className="text-base font-medium mb-3">Profile</h1>
        <p className="text-app-muted">Loading your profile…</p>
      </div>
    );
  }

  if (error && !saving && !success && !firstName && !lastName && !gender) {
    return (
      <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5">
        <h1 className="text-base font-medium mb-3">Profile</h1>
        <p className="text-app-muted" style={{ color: '#fca5a5' }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5" style={{ maxWidth: 640 }}>
      <h1 className="text-base font-medium mb-3">Profile</h1>
      {userEmail && (
        <p className="text-app-muted" style={{ marginBottom: '0.5rem' }}>
          Email: {userEmail}
        </p>
      )}
      {error && (
        <p className="text-app-muted" style={{ color: '#fca5a5' }}>
          {error}
        </p>
      )}
      {success && (
        <p className="text-app-muted" style={{ color: '#4ade80' }}>
          {success}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}
      >
        <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ fontSize: '0.8rem' }}>
            First name (required)
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              style={{
                marginTop: '0.35rem',
                width: '100%',
                padding: '0.45rem 0.6rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
                background: '#f9fafb',
                color: '#111827',
              }}
            />
          </label>

          <label style={{ fontSize: '0.8rem' }}>
            Last name (required)
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              style={{
                marginTop: '0.35rem',
                width: '100%',
                padding: '0.45rem 0.6rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
                background: '#f9fafb',
                color: '#111827',
              }}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr' }}>
          <label style={{ fontSize: '0.8rem' }}>
            Gender (required)
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              required
              style={{
                marginTop: '0.35rem',
                width: '100%',
                padding: '0.45rem 0.6rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
                background: '#f9fafb',
                color: '#111827',
              }}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
        </div>

        <label style={{ fontSize: '0.8rem' }}>
          Self-reported DUPR (required, x.xx)
          <input
            type="text"
            value={selfDupr}
            onChange={(e) => setSelfDupr(e.target.value)}
            placeholder="e.g. 3.75"
            style={{
              marginTop: '0.35rem',
              width: '100%',
              padding: '0.45rem 0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid #d1d5db',
              background: '#f9fafb',
              color: '#111827',
            }}
          />
          <p
            className="text-app-muted"
            style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}
          >
            Need help estimating your rating? See{' '}
            <a
              href="https://www.pickleheads.com/guides/pickleball-rating"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#60a5fa', textDecoration: 'underline' }}
            >
              this guide
            </a>
            .
          </p>
        </label>

        <button
          type="submit"
          className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={saving}
          style={{ marginTop: '0.5rem', justifySelf: 'flex-start' }}
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem' }}>
        <h2 className="text-base font-medium mb-3">Leagues you belong to</h2>
        {leagues.length === 0 ? (
          <p className="text-app-muted">You are not in any leagues yet.</p>
        ) : (
          <ul className="list-none pl-0 text-app-muted text-[0.87rem]">
            {leagues.map((league) => {
              const isOwner = league.owner_id === userId;
              return (
                <li
                  key={league.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.25rem 0',
                  }}
                >
                  <span>{formatLeagueName(league.name, league.created_at)}</span>
                  <button
                    type="button"
                    className="rounded-full px-5 py-2 text-sm border border-app-border bg-transparent text-app-muted cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => isOwner 
                      ? router.push(`/leagues/${league.id}`)
                      : openLeaveLeagueDialog(league.id)
                    }
                  >
                    {isOwner ? 'Manage' : 'Leave league'}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div
        style={{
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px solid #1f2937',
        }}
      >
        <h2 className="text-base font-medium mb-3">Password</h2>
        <p className="text-app-muted" style={{ fontSize: '0.85rem' }}>
          Set or change your password. You can still use magic link sign-in if you prefer.
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setSuccess(null);

            if (!password || !passwordConfirm) {
              setError('Password and confirmation are required.');
              return;
            }

            if (password !== passwordConfirm) {
              setError('Passwords do not match.');
              return;
            }

            if (password.length < 8) {
              setError('Password must be at least 8 characters long.');
              return;
            }

            setSaving(true);

            const { error: updateError } = await supabase.auth.updateUser({
              password,
            });

            if (updateError) {
              setError(updateError.message);
            } else {
              setSuccess('Password updated.');
              setPassword('');
              setPasswordConfirm('');
            }

            setSaving(false);
          }}
          style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}
        >
          <label style={{ fontSize: '0.8rem' }}>
            New password (min 8 characters)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                marginTop: '0.35rem',
                width: '100%',
                padding: '0.45rem 0.6rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
                background: '#f9fafb',
                color: '#111827',
              }}
            />
          </label>
          <label style={{ fontSize: '0.8rem' }}>
            Confirm new password
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              style={{
                marginTop: '0.35rem',
                width: '100%',
                padding: '0.45rem 0.6rem',
                borderRadius: '0.5rem',
                border: '1px solid #d1d5db',
                background: '#f9fafb',
                color: '#111827',
              }}
            />
          </label>
          <button
            type="submit"
            className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
            style={{ justifySelf: 'flex-start' }}
          >
            {saving ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      <div
        style={{
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px solid #1f2937',
        }}
      >
        <h2 className="text-base font-medium mb-3">Delete account</h2>
        <p className="text-app-muted">
          This will delete your profile and league data in Pickled Citizens. This
          action cannot be undone.
        </p>
        <button
          type="button"
          className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={openDeleteDialog}
          style={{
            marginTop: '0.75rem',
            background: '#b91c1c',
            borderColor: '#b91c1c',
            color: '#fee2e2',
          }}
        >
          Delete account
        </button>
        
        {deleteError && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              background: '#991b1b',
              border: '1px solid #b91c1c',
              borderRadius: '0.5rem',
              color: '#fee2e2',
              fontSize: '0.875rem',
              lineHeight: '1.4',
            }}
          >
            {deleteError}
          </div>
        )}
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
            className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5"
            style={{
              maxWidth: 420,
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <h2 className="text-base font-medium mb-3">Delete account</h2>
            <p className="text-app-muted">
              This will permanently delete your profile and league data. Type
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
                border: '1px solid #d1d5db',
                background: '#f9fafb',
                color: '#111827',
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
                className="rounded-full px-5 py-2 text-sm border border-app-border bg-transparent text-app-muted cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={closeDeleteDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDeleteAccount}
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

      {leaveLeagueId && (
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
            className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5"
            style={{
              maxWidth: 420,
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <h2 className="text-base font-medium mb-3">Leave league</h2>
            <p className="text-app-muted">
              Are you sure you want to leave{' '}
              {leagues.find((league) => league.id === leaveLeagueId)?.name ?? 'this league'}
              ?
            </p>
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
                className="rounded-full px-5 py-2 text-sm border border-app-border bg-transparent text-app-muted cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={closeLeaveLeagueDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={confirmLeaveLeague}
                disabled={saving}
              >
                {saving ? 'Leaving…' : 'Leave league'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
