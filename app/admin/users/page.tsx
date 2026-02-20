'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ADMIN_EMAIL } from '@/lib/constants';

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
        // Supabase join may return array or object
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

    // Use the admin API route which bypasses RLS via service role
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

    // Use the admin API route which calls admin_delete_user() RPC for transactional safety
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
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  }

  function displayName(user: AdminUser) {
    const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    return full || '—';
  }

  if (loading) {
    return (
      <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5">
        <h1 className="text-base font-medium mb-3">Admin users</h1>
        <p className="text-app-muted">Loading users…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5">
        <h1 className="text-base font-medium mb-3">Admin users</h1>
        <p className="text-app-muted" style={{ color: '#fca5a5' }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5">
      <h1 className="text-base font-medium mb-3">Admin users</h1>
      {userEmail && (
        <p className="text-app-muted" style={{ marginBottom: '0.5rem' }}>
          Signed in as {userEmail}
        </p>
      )}
      <p className="text-app-muted">
        View and manage all user profiles. Only your admin account can access this page.
      </p>

      {users.length === 0 ? (
        <p className="text-app-muted" style={{ marginTop: '1rem' }}>
          No profiles found.
        </p>
      ) : (
        <div
          style={{
            marginTop: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid #1f2937',
            padding: '0.5rem 0.6rem',
          }}
        >
          <ul
            className="list-none pl-0 text-app-muted text-[0.87rem]"
            style={{ listStyle: 'none', paddingLeft: 0, margin: 0 }}
          >
            {users.map((user) => {
              const isEditing = editing?.id === user.id;
              const leaguesLabel =
                user.leagues.length === 0
                  ? 'None'
                  : user.leagues.map((l) => l.name).join(', ');

              return (
                <li
                  key={user.id}
                  style={{
                    padding: '0.5rem 0',
                    borderBottom: '1px solid #1f2937',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ flex: '1 1 auto' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                        {displayName(user)}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: '#9ca3af',
                          marginTop: '0.15rem',
                        }}
                      >
                        {user.email ?? 'No email'}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: '#9ca3af',
                          marginTop: '0.15rem',
                        }}
                      >
                        Self-reported DUPR:{' '}
                        {user.self_reported_dupr != null
                          ? user.self_reported_dupr.toFixed(2)
                          : '—'}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: '#9ca3af',
                          marginTop: '0.15rem',
                        }}
                      >
                        Leagues: {leaguesLabel}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: '#9ca3af',
                          marginTop: '0.15rem',
                        }}
                      >
                        Last login (approx): {formatDate(user.updated_at)}
                      </div>
                    </div>

                    <div style={{ flex: '0 0 auto', minWidth: 220 }}>
                      {isEditing ? (
                        <form
                          onSubmit={handleEditSubmit}
                          style={{ display: 'grid', gap: '0.35rem', fontSize: '0.8rem' }}
                        >
                          <input
                            type="text"
                            placeholder="First name"
                            value={editing.first_name}
                            onChange={(e) =>
                              setEditing((prev) =>
                                prev
                                  ? { ...prev, first_name: e.target.value }
                                  : prev
                              )
                            }
                            style={{
                              width: '100%',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '0.5rem',
                              border: '1px solid #d1d5db',
                              background: '#f9fafb',
                              color: '#111827',
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Last name"
                            value={editing.last_name}
                            onChange={(e) =>
                              setEditing((prev) =>
                                prev
                                  ? { ...prev, last_name: e.target.value }
                                  : prev
                              )
                            }
                            style={{
                              width: '100%',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '0.5rem',
                              border: '1px solid #d1d5db',
                              background: '#f9fafb',
                              color: '#111827',
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Self-reported DUPR (x.xx)"
                            value={editing.self_reported_dupr}
                            onChange={(e) =>
                              setEditing((prev) =>
                                prev
                                  ? { ...prev, self_reported_dupr: e.target.value }
                                  : prev
                              )
                            }
                            style={{
                              width: '100%',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '0.5rem',
                              border: '1px solid #d1d5db',
                              background: '#f9fafb',
                              color: '#111827',
                            }}
                          />
                          <div
                            className="user-actions"
                            style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}
                          >
                            <button
                              type="button"
                              className="rounded-full px-5 py-2 text-sm border border-app-border bg-transparent text-app-muted cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={cancelEdit}
                              disabled={saving}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={saving}
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div
                          className="user-actions"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                            alignItems: 'flex-end',
                          }}
                        >
                          <button
                            type="button"
                            className="rounded-full px-5 py-2 text-sm border border-app-border bg-transparent text-app-muted cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => startEdit(user)}
                          >
                            Edit profile
                          </button>
                          <button
                            type="button"
                            className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => handleDelete(user)}
                            disabled={deletingId === user.id}
                            style={{
                              background: '#b91c1c',
                              borderColor: '#b91c1c',
                              color: '#fee2e2',
                            }}
                          >
                            {deletingId === user.id ? 'Deleting…' : 'Delete profile'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
