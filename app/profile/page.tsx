'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Modal } from '@/components/ui/Modal';

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

  const [newEmail, setNewEmail] = useState('');

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
        type LeagueJoinRow = {
          league: League[] | League | null;
        };
        const mapped: League[] = (memberRows as unknown as LeagueJoinRow[])
          .map((row) => {
            const rel = row.league;
            return Array.isArray(rel) ? rel[0] ?? null : rel;
          })
          .filter((l): l is League => l !== null);
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

    setDeleteOpen(true);
    setDeleteConfirm('');
  }

  function closeDeleteDialog() {
    setDeleteOpen(false);
    setDeleteConfirm('');
    setDeleteLoading(false);
    setDeleteError(null);
  }

  async function handleEmailUpdate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newEmail.trim()) {
      setError('New email is required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (newEmail.trim().toLowerCase() === userEmail?.toLowerCase()) {
      setError('New email must be different from your current email.');
      return;
    }

    setSaving(true);

    const { error: updateError } = await supabase.auth.updateUser({
      email: newEmail.trim().toLowerCase(),
    });

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess('Confirmation email sent to your new address. Please check your inbox and confirm to complete the change.');
      setNewEmail('');
    }

    setSaving(false);
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

    const { error: deleteError } = await supabase.rpc('delete_user_cascade', {
      target_user_id: user.id,
    });

    if (deleteError) {
      setError(`Failed to delete account: ${deleteError.message}`);
      setDeleteLoading(false);
      return;
    }

    await supabase.auth.signOut();

    window.location.href = '/account-deleted';
  }

  if (loading) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Profile</h1>
        <p className="text-app-muted text-sm">Loading your profile...</p>
      </div>
    );
  }

  if (error && !saving && !success && !firstName && !lastName && !gender) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Profile</h1>
        <p className="text-app-danger text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Profile</h1>
      {userEmail && (
        <p className="text-app-muted text-sm mb-6">{userEmail}</p>
      )}
      {error && (
        <p className="text-app-danger text-sm mb-4">{error}</p>
      )}
      {success && (
        <p className="text-app-success text-sm mb-4">{success}</p>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-4 grid-cols-2">
          <Input
            label="First name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label="Last name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <Select
          label="Gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          required
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </Select>

        <div>
          <Input
            label="Self-reported DUPR"
            type="text"
            value={selfDupr}
            onChange={(e) => setSelfDupr(e.target.value)}
            placeholder="e.g. 3.75"
          />
          <p className="text-app-muted text-xs mt-1.5">
            Need help estimating your rating? See{' '}
            <a
              href="https://www.pickleheads.com/guides/pickleball-rating"
              target="_blank"
              rel="noreferrer"
              className="text-app-text underline"
            >
              this guide
            </a>
            .
          </p>
        </div>

        <div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </form>

      {/* Leagues */}
      <div className="border-t border-app-border mt-8 pt-8">
        <SectionLabel>Your Leagues</SectionLabel>
        {leagues.length === 0 ? (
          <p className="text-app-muted text-sm mt-3">You are not in any leagues yet.</p>
        ) : (
          <div className="divide-y divide-app-border mt-3">
            {leagues.map((league) => {
              const isOwner = league.owner_id === userId;
              return (
                <div
                  key={league.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <span className="text-sm">{formatLeagueName(league.name, league.created_at)}</span>
                  <Button
                    variant="sm"
                    onClick={() => isOwner
                      ? router.push(`/leagues/${league.id}`)
                      : openLeaveLeagueDialog(league.id)
                    }
                  >
                    {isOwner ? 'Manage' : 'Leave'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Change Email */}
      <div className="border-t border-app-border mt-8 pt-8">
        <SectionLabel>Change Email</SectionLabel>
        <p className="text-app-muted text-sm mt-3 mb-4">
          Update your email address. You will receive a confirmation email at your new address.
        </p>
        <form onSubmit={handleEmailUpdate} className="grid gap-4">
          <Input
            label="New email address"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Enter new email"
          />
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Updating...' : 'Update Email'}
            </Button>
          </div>
        </form>
      </div>

      {/* Password */}
      <div className="border-t border-app-border mt-8 pt-8">
        <SectionLabel>Password</SectionLabel>
        <p className="text-app-muted text-sm mt-3 mb-4">
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
          className="grid gap-4"
        >
          <Input
            label="New password (min 8 characters)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Confirm new password"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
          <div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="border-t border-app-border mt-8 pt-8">
        <SectionLabel>Danger Zone</SectionLabel>
        <p className="text-app-muted text-sm mt-3">
          This will delete your profile and league data in Pickled Citizens. This
          action cannot be undone.
        </p>
        <div className="mt-4">
          <Button variant="danger" onClick={openDeleteDialog}>
            Delete Account
          </Button>
        </div>

        {deleteError && (
          <div className="mt-4 p-3 border border-app-danger text-app-danger text-sm leading-relaxed">
            {deleteError}
          </div>
        )}
      </div>

      {/* Delete Account Modal */}
      {deleteOpen && (
        <Modal
          title="Delete Account"
          onClose={closeDeleteDialog}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={closeDeleteDialog}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirm !== 'delete'}
              >
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          }
        >
          <p className="text-app-muted text-sm">
            This will permanently delete your profile and league data. Type
            <span className="font-semibold"> delete </span>
            to confirm.
          </p>
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Type delete to confirm"
            className="mt-4 w-full px-3 py-2.5 border border-app-border bg-transparent text-app-text text-sm font-sans placeholder:text-app-muted focus:outline-none focus:border-app-text transition-colors"
          />
        </Modal>
      )}

      {/* Leave League Modal */}
      {leaveLeagueId && (
        <Modal
          title="Leave League"
          onClose={closeLeaveLeagueDialog}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={closeLeaveLeagueDialog}>
                Cancel
              </Button>
              <Button onClick={confirmLeaveLeague} disabled={saving}>
                {saving ? 'Leaving...' : 'Leave League'}
              </Button>
            </div>
          }
        >
          <p className="text-app-muted text-sm">
            Are you sure you want to leave{' '}
            {leagues.find((league) => league.id === leaveLeagueId)?.name ?? 'this league'}
            ?
          </p>
        </Modal>
      )}
    </div>
  );
}
