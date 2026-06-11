'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser, useClerk, UserProfile } from '@clerk/nextjs';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Modal } from '@/components/ui/Modal';
import { formatLeagueName } from '@/lib/formatters';
import { GENDER_OPTIONS } from '@/lib/constants';
import { getMyProfile, updateMyProfile } from '@/lib/actions/profile';
import { listMyLeagues, leaveLeagueAction } from '@/lib/actions/leagues';
import { deleteMyAccount } from '@/lib/actions/account';

type LeagueRow = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string | null;
  role: 'player' | 'admin' | string;
};

export default function ProfilePage() {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const { signOut } = useClerk();

  // Depend on stable primitives, not the Clerk user object: it gets a new
  // reference on every ~60s token refresh, which would re-run the load effect
  // and visibly reload the page.
  const userId = user?.id ?? null;
  const userFirstName = user?.firstName ?? '';
  const userLastName = user?.lastName ?? '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [selfDupr, setSelfDupr] = useState('');

  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [leaveLeagueId, setLeaveLeagueId] = useState<string | null>(null);

  const [showAccountSettings, setShowAccountSettings] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      router.replace('/auth/signin');
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [profile, leagueRows] = await Promise.all([getMyProfile(), listMyLeagues()]);
        if (!active) return;
        if (profile) {
          setFirstName(profile.firstName ?? userFirstName);
          setLastName(profile.lastName ?? userLastName);
          setGender(profile.gender ?? '');
          setSelfDupr(
            profile.selfReportedDupr != null ? profile.selfReportedDupr.toFixed(2) : '',
          );
        } else {
          setFirstName(userFirstName);
          setLastName(userLastName);
        }
        setLeagues(leagueRows as LeagueRow[]);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load profile.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isLoaded, userId, userFirstName, userLastName, router]);

  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!firstName.trim() || !lastName.trim() || !gender) {
      setError('First name, last name, and gender are required.');
      return;
    }
    if (!selfDupr.trim() || !/^\d{1,2}(\.\d{1,2})?$/.test(selfDupr.trim())) {
      setError('Self-reported DUPR must be a number like 3.75.');
      return;
    }
    const selfDuprParsed = Number(selfDupr.trim());
    if (selfDuprParsed < 1.0 || selfDuprParsed > 8.5) {
      setError('DUPR must be between 1.0 and 8.5.');
      return;
    }

    setSaving(true);
    try {
      await updateMyProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        selfReportedDupr: selfDuprParsed,
      });
      // Sync first/last name to Clerk so they show up everywhere.
      await user?.update({ firstName: firstName.trim(), lastName: lastName.trim() });
      setSuccess('Profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmLeaveLeague() {
    if (!leaveLeagueId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await leaveLeagueAction({ leagueId: leaveLeagueId });
      setLeagues((prev) => prev.filter((l) => l.id !== leaveLeagueId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to leave league.');
    } finally {
      setSaving(false);
      setLeaveLeagueId(null);
    }
  }

  async function openDeleteDialog() {
    setDeleteError(null);
    try {
      // Server-side check is authoritative; we rely on deleteMyAccount throwing.
      setDeleteOpen(true);
      setDeleteConfirm('');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to open delete dialog.');
    }
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
    try {
      await deleteMyAccount();
      await signOut();
      window.location.href = '/account-deleted';
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account.');
      setDeleteLoading(false);
    }
  }

  if (loading || !isLoaded) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Profile</h1>
        <p className="text-app-muted text-sm">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[640px]">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Profile</h1>
      {userEmail && <p className="text-app-muted text-sm mb-6">{userEmail}</p>}
      {error && <p className="text-app-danger text-sm mb-4">{error}</p>}
      {success && <p className="text-app-success text-sm mb-4">{success}</p>}

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
          {GENDER_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </option>
          ))}
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
              const isOwner = league.ownerId === userId;
              return (
                <div
                  key={league.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <span className="text-sm">
                    {formatLeagueName(league.name, league.createdAt ?? '')}
                  </span>
                  <Button
                    variant="sm"
                    onClick={() =>
                      isOwner
                        ? router.push(`/leagues/${league.id}`)
                        : setLeaveLeagueId(league.id)
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

      {/* Account: email + password managed by Clerk */}
      <div className="border-t border-app-border mt-8 pt-8">
        <SectionLabel>Account</SectionLabel>
        <p className="text-app-muted text-sm mt-3 mb-4">
          Manage your email address, password, and connected accounts.
        </p>
        <Button variant="secondary" onClick={() => setShowAccountSettings((v) => !v)}>
          {showAccountSettings ? 'Hide Account Settings' : 'Open Account Settings'}
        </Button>
        {showAccountSettings && (
          <div className="mt-6">
            <UserProfile routing="hash" />
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="border-t border-app-border mt-8 pt-8">
        <SectionLabel>Danger Zone</SectionLabel>
        <p className="text-app-muted text-sm mt-3">
          This will delete your profile and league data in Pickled Citizens. This action
          cannot be undone.
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

      {leaveLeagueId && (
        <Modal
          title="Leave League"
          onClose={() => setLeaveLeagueId(null)}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setLeaveLeagueId(null)}>
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
            {leagues.find((league) => league.id === leaveLeagueId)?.name ?? 'this league'}?
          </p>
        </Modal>
      )}

      {/* Hidden link kept for routing reference */}
      <Link href="/" className="hidden" />
    </div>
  );
}
