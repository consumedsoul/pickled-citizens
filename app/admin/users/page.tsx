'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ADMIN_EMAIL } from '@/lib/constants';
import { Button } from '@/components/ui/Button';

type League = {
  id: string;
  name: string;
};

type AdminUser = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  self_reported_dupr: number | null;
  updated_at: string | null;
  leagues: League[];
};

type EditState = {
  id: string;
  first_name: string;
  last_name: string;
  self_reported_dupr: string;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;

      if (authError || !authData.user) {
        router.replace('/');
        return;
      }

      const email = authData.user.email?.toLowerCase() ?? null;
      setUserEmail(email);

      if (email !== ADMIN_EMAIL) {
        setError('You are not authorized to view this page.');
        setLoading(false);
        return;
      }

      const { data: profileRows, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, self_reported_dupr, updated_at');

      if (!active) return;

      if (profilesError) {
        setError(profilesError.message);
        setLoading(false);
        return;
      }

      const { data: membershipRows, error: membershipsError } = await supabase
        .from('league_members')
        .select('user_id, league:leagues(id, name)');

      if (!active) return;

      if (membershipsError) {
        setError(membershipsError.message);
        setLoading(false);
        return;
      }

      const leagueMap = new Map<string, League[]>();
      type MembershipRow = {
        user_id: string;
        league: { id: string; name: string }[] | { id: string; name: string } | null;
      };
      (membershipRows as MembershipRow[] ?? []).forEach((row) => {
        const userId: string = row.user_id;
        const leagueRel = row.league;
        const league: League | null = Array.isArray(leagueRel)
          ? leagueRel[0] ?? null
          : leagueRel ?? null;
        if (!league) return;
        const list = leagueMap.get(userId) ?? [];
        list.push({ id: league.id, name: league.name });
        leagueMap.set(userId, list);
      });

      type ProfileRow = {
        id: string;
        email: string | null;
        first_name: string | null;
        last_name: string | null;
        self_reported_dupr: number | null;
        updated_at: string | null;
      };
      const mapped: AdminUser[] = (profileRows ?? []).map((p: ProfileRow) => {
        let dupr: number | null = null;
        if (p.self_reported_dupr != null) {
          const n = Number(p.self_reported_dupr);
          dupr = Number.isNaN(n) ? null : n;
        }

        return {
          id: p.id,
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
          self_reported_dupr: dupr,
          updated_at: p.updated_at ?? null,
          leagues: leagueMap.get(p.id) ?? [],
        };
      });

      mapped.sort((a, b) => {
        const an = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim().toLowerCase();
        const bn = `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim().toLowerCase();
        if (an && bn) return an.localeCompare(bn);
        if (an) return -1;
        if (bn) return 1;
        const ae = (a.email ?? '').toLowerCase();
        const be = (b.email ?? '').toLowerCase();
        return ae.localeCompare(be);
      });

      setUsers(mapped);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  function startEdit(user: AdminUser) {
    setEditing({
      id: user.id,
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      self_reported_dupr:
        user.self_reported_dupr != null ? user.self_reported_dupr.toFixed(2) : '',
    });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;

    const first = editing.first_name.trim();
    const last = editing.last_name.trim();
    const duprStr = editing.self_reported_dupr.trim();

    let dupr: number | null = null;
    if (duprStr) {
      const n = Number(duprStr);
      if (Number.isNaN(n)) {
        setError('Self-reported DUPR must be a number.');
        return;
      }
      dupr = n;
    }

    setSaving(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setError('You must be signed in.');
      setSaving(false);
      return;
    }

    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        userId: editing.id,
        first_name: first || null,
        last_name: last || null,
        self_reported_dupr: dupr,
      }),
    });

    const json = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

    if (!response.ok) {
      setError(json?.error ?? 'Failed to update user profile.');
      setSaving(false);
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === editing.id
          ? {
              ...u,
              first_name: first || null,
              last_name: last || null,
              self_reported_dupr: dupr,
              updated_at: new Date().toISOString(),
            }
          : u
      )
    );

    setSaving(false);
    setEditing(null);
  }

  async function handleDelete(user: AdminUser) {
    if (!user.id) return;
    const confirmed = window.confirm(
      `Delete profile for ${user.email ?? 'this user'}? This removes their leagues, invites, and membership data.`
    );
    if (!confirmed) return;

    setDeletingId(user.id);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setError('You must be signed in.');
      setDeletingId(null);
      return;
    }

    const response = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ userId: user.id }),
    });

    const json = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

    if (!response.ok) {
      setError(json?.error ?? 'Failed to delete user.');
      setDeletingId(null);
      return;
    }

    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    setDeletingId(null);
  }

  function formatDate(value: string | null) {
    if (!value) return '\u2014';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '\u2014';
    return d.toLocaleString();
  }

  function displayName(user: AdminUser) {
    const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    return full || '\u2014';
  }

  if (loading) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Users</h1>
        <p className="text-app-muted text-sm">Loading users...</p>
      </div>
    );
  }

  if (error && !users.length) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Users</h1>
        <p className="text-app-danger text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Users</h1>
      {userEmail && (
        <p className="text-app-muted text-sm mb-1">{userEmail}</p>
      )}
      <p className="text-app-muted text-sm mb-6">
        View and manage all user profiles. Only your admin account can access this page.
      </p>

      {error && (
        <p className="text-app-danger text-sm mb-4">{error}</p>
      )}

      {users.length === 0 ? (
        <p className="text-app-muted text-sm">No profiles found.</p>
      ) : (
        <div className="divide-y divide-app-border">
          {users.map((user) => {
            const isEditing = editing?.id === user.id;
            const leaguesLabel =
              user.leagues.length === 0
                ? 'None'
                : user.leagues.map((l) => l.name).join(', ');

            return (
              <div
                key={user.id}
                className="py-4 flex justify-between items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{displayName(user)}</div>
                  <div className="text-xs text-app-muted mt-0.5">
                    {user.email ?? 'No email'}
                  </div>
                  <div className="text-xs text-app-muted mt-0.5">
                    DUPR: {user.self_reported_dupr != null ? user.self_reported_dupr.toFixed(2) : '\u2014'}
                  </div>
                  <div className="text-xs text-app-muted mt-0.5">
                    Leagues: {leaguesLabel}
                  </div>
                  <div className="text-xs text-app-muted mt-0.5">
                    Last login: {formatDate(user.updated_at)}
                  </div>
                </div>

                <div className="flex-shrink-0" style={{ minWidth: 220 }}>
                  {isEditing ? (
                    <form onSubmit={handleEditSubmit} className="grid gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="First name"
                        value={editing.first_name}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev ? { ...prev, first_name: e.target.value } : prev
                          )
                        }
                        className="w-full px-2 py-1.5 border border-app-border bg-transparent text-app-text text-xs focus:outline-none focus:border-app-text transition-colors"
                      />
                      <input
                        type="text"
                        placeholder="Last name"
                        value={editing.last_name}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev ? { ...prev, last_name: e.target.value } : prev
                          )
                        }
                        className="w-full px-2 py-1.5 border border-app-border bg-transparent text-app-text text-xs focus:outline-none focus:border-app-text transition-colors"
                      />
                      <input
                        type="text"
                        placeholder="DUPR (x.xx)"
                        value={editing.self_reported_dupr}
                        onChange={(e) =>
                          setEditing((prev) =>
                            prev ? { ...prev, self_reported_dupr: e.target.value } : prev
                          )
                        }
                        className="w-full px-2 py-1.5 border border-app-border bg-transparent text-app-text text-xs focus:outline-none focus:border-app-text transition-colors"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="sm" onClick={cancelEdit} disabled={saving}>
                          Cancel
                        </Button>
                        <Button variant="sm" type="submit" disabled={saving}>
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-2 items-end">
                      <Button variant="sm" onClick={() => startEdit(user)}>
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="text-[0.65rem] px-3 py-1.5"
                        onClick={() => handleDelete(user)}
                        disabled={deletingId === user.id}
                      >
                        {deletingId === user.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
