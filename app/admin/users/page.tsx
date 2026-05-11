'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Modal } from '@/components/ui/Modal';
import { listAdminUsersAction, type AdminUserView } from '@/lib/actions/admin';

type EditState = {
  id: string;
  first_name: string;
  last_name: string;
  self_reported_dupr: string;
};

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUserView | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createFirstName, setCreateFirstName] = useState('');
  const [createLastName, setCreateLastName] = useState('');
  const [createDupr, setCreateDupr] = useState('');
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listAdminUsersAction();
      setUsers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function startEdit(user: AdminUserView) {
    setEditing({
      id: user.id,
      first_name: user.firstName ?? '',
      last_name: user.lastName ?? '',
      self_reported_dupr:
        user.selfReportedDupr != null ? user.selfReportedDupr.toFixed(2) : '',
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
      if (Number.isNaN(n) || n < 1.0 || n > 8.5) {
        setError('DUPR must be between 1.0 and 8.5.');
        return;
      }
      dupr = n;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editing.id,
          first_name: first || null,
          last_name: last || null,
          self_reported_dupr: dupr,
        }),
      });
      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok) throw new Error(json?.error ?? 'Failed to update user profile.');
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editing.id
            ? {
                ...u,
                firstName: first || null,
                lastName: last || null,
                selfReportedDupr: dupr,
                updatedAt: new Date().toISOString(),
              }
            : u,
        ),
      );
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const user = pendingDeleteUser;
    if (!user) return;
    setPendingDeleteUser(null);
    setDeletingId(user.id);
    setError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, userEmail: user.email }),
      });
      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok) throw new Error(json?.error ?? 'Failed to delete user.');
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreateUser(event: FormEvent) {
    event.preventDefault();
    const email = createEmail.trim().toLowerCase();
    if (!email) {
      setError('Email is required.');
      return;
    }
    let dupr: number | null = null;
    if (createDupr.trim()) {
      const n = Number(createDupr.trim());
      if (Number.isNaN(n) || n < 1.0 || n > 8.5) {
        setError('DUPR must be between 1.0 and 8.5.');
        return;
      }
      dupr = n;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          first_name: createFirstName.trim() || undefined,
          last_name: createLastName.trim() || undefined,
          self_reported_dupr: dupr,
        }),
      });
      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok) throw new Error(json?.error ?? 'Failed to create user.');
      setCreateEmail('');
      setCreateFirstName('');
      setCreateLastName('');
      setCreateDupr('');
      setShowCreateForm(false);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setCreating(false);
    }
  }

  function formatDate(value: string | null) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  }

  function displayName(user: AdminUserView) {
    const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return full || '—';
  }

  if (loading) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Users</h1>
        <p className="text-app-muted text-sm">Loading users...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Admin Users</h1>
      <p className="text-app-muted text-sm mb-6">
        View and manage all user profiles. Only your admin account can access this page.
      </p>

      <div className="border-t border-app-border pt-6 mb-6">
        {!showCreateForm ? (
          <Button variant="primary" onClick={() => setShowCreateForm(true)}>
            Create User
          </Button>
        ) : (
          <div>
            <SectionLabel>Create User</SectionLabel>
            <form onSubmit={handleCreateUser} className="mt-3 grid gap-3 max-w-sm">
              <input
                type="email"
                placeholder="Email (required)"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-app-border bg-transparent text-app-text text-sm focus:outline-none focus:border-app-text transition-colors"
              />
              <input
                type="text"
                placeholder="First name"
                value={createFirstName}
                onChange={(e) => setCreateFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-app-border bg-transparent text-app-text text-sm focus:outline-none focus:border-app-text transition-colors"
              />
              <input
                type="text"
                placeholder="Last name"
                value={createLastName}
                onChange={(e) => setCreateLastName(e.target.value)}
                className="w-full px-3 py-2 border border-app-border bg-transparent text-app-text text-sm focus:outline-none focus:border-app-text transition-colors"
              />
              <input
                type="text"
                placeholder="DUPR (1.0 - 8.5)"
                value={createDupr}
                onChange={(e) => setCreateDupr(e.target.value)}
                className="w-full px-3 py-2 border border-app-border bg-transparent text-app-text text-sm focus:outline-none focus:border-app-text transition-colors"
              />
              <div className="flex gap-2">
                <Button variant="primary" type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCreateForm(false);
                    setError(null);
                  }}
                  disabled={creating}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      {error && <p className="text-app-danger text-sm mb-4">{error}</p>}

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
                    DUPR:{' '}
                    {user.selfReportedDupr != null
                      ? user.selfReportedDupr.toFixed(2)
                      : '—'}
                  </div>
                  <div className="text-xs text-app-muted mt-0.5">
                    Leagues: {leaguesLabel}
                  </div>
                  <div className="text-xs text-app-muted mt-0.5">
                    Last login: {formatDate(user.updatedAt)}
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
                            prev ? { ...prev, first_name: e.target.value } : prev,
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
                            prev ? { ...prev, last_name: e.target.value } : prev,
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
                            prev
                              ? { ...prev, self_reported_dupr: e.target.value }
                              : prev,
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
                        onClick={() => setPendingDeleteUser(user)}
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

      {pendingDeleteUser && (
        <Modal
          title="Delete User"
          onClose={() => setPendingDeleteUser(null)}
          footer={
            <>
              <Button variant="sm" onClick={() => setPendingDeleteUser(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="text-[0.65rem] px-3 py-1.5"
                onClick={confirmDelete}
              >
                Delete
              </Button>
            </>
          }
        >
          <p>
            Delete profile for <strong>{pendingDeleteUser.email ?? 'this user'}</strong>?
          </p>
          <p className="mt-2 text-app-muted">
            This removes their leagues, invites, and membership data. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
