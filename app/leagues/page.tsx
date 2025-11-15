'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type League = {
  id: string;
  name: string;
  created_at: string;
};

const MAX_LEAGUES = 3;

export default function LeaguesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const reachedLimit = leagues.length >= MAX_LEAGUES;

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !userData.user) {
        router.replace('/');
        return;
      }

      const user = userData.user;

      setUserId(user.id);

      const { data, error } = await supabase
        .from('leagues')
        .select('id, name, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (!active) return;

      if (error) {
        setError(error.message);
      } else {
        setLeagues(data ?? []);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!userId || !trimmedName || reachedLimit) return;

    setCreating(true);
    setError(null);

    const { data: existingLeagues, error: existingError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('owner_id', userId);

    if (existingError) {
      setError(existingError.message);
      setCreating(false);
      return;
    }

    const duplicate = (existingLeagues ?? []).some(
      (league) => league.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      setError('A league with that name already exists.');
      setCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from('leagues')
      .insert({ name: trimmedName, owner_id: userId })
      .select('id, name, created_at')
      .single();

    if (error) {
      const message = error.message.includes('limit_3_leagues_per_owner')
        ? 'You have reached the maximum of 3 leagues.'
        : error.message;
      setError(message);
    } else if (data) {
      setLeagues((prev) => [data, ...prev]);
      setName('');

      const {
        data: userData,
        error: userError,
      } = await supabase.auth.getUser();

      if (!userError && userData.user) {
        const ownerEmail = userData.user.email?.toLowerCase() ?? null;
        await supabase.from('league_members').upsert({
          league_id: data.id,
          user_id: userData.user.id,
          email: ownerEmail,
        });
      }
    }

    setCreating(false);
  }

  function openDeleteDialog(id: string) {
    setDeletingId(id);
    setConfirmText('');
    setError(null);
  }

  function closeDeleteDialog() {
    setDeletingId(null);
    setConfirmText('');
    setDeleting(false);
  }

  async function handleDelete() {
    if (!deletingId) return;
    if (confirmText !== 'delete') return;

    setDeleting(true);
    setError(null);

    const { error } = await supabase.from('leagues').delete().eq('id', deletingId);

    if (error) {
      setError(error.message);
      setDeleting(false);
      return;
    }

    setLeagues((prev) => prev.filter((league) => league.id !== deletingId));
    closeDeleteDialog();
  }

  if (loading) {
    return (
      <div className="section">
        <h1 className="section-title">Leagues</h1>
        <p className="hero-subtitle">Loading your leagues5</p>
      </div>
    );
  }

  return (
    <div className="section">
      <h1 className="section-title">Leagues</h1>
      {error && (
        <p className="hero-subtitle" style={{ color: '#fca5a5' }}>
          {error}
        </p>
      )}
      {!error && (
        <>
          <p className="hero-subtitle">
            Create a league you run. You can own up to {MAX_LEAGUES} leagues. Invites and
            roster management will come next.
          </p>
          {reachedLimit && (
            <p
              className="hero-subtitle"
              style={{ marginTop: '0.5rem', color: '#fbbf24' }}
            >
              You have reached the limit of {MAX_LEAGUES} leagues. Delete one to create
              another.
            </p>
          )}
        </>
      )}

      <form
        onSubmit={handleCreate}
        style={{
          marginTop: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <input
          type="text"
          placeholder="League name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={reachedLimit}
          style={{
            flex: '1 1 200px',
            padding: '0.45rem 0.6rem',
            borderRadius: '0.5rem',
            border: '1px solid #1f2937',
            background: '#020617',
            color: '#e5e7eb',
            opacity: reachedLimit ? 0.6 : 1,
          }}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={creating || !name.trim() || reachedLimit}
        >
          {creating ? 'Creating…' : 'Create league'}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem' }}>
        <h2 className="section-title">Your leagues ({MAX_LEAGUES} max)</h2>
        {leagues.length === 0 ? (
          <p className="hero-subtitle">You don't have any leagues yet.</p>
        ) : (
          <ul className="section-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
            {leagues.map((league) => (
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
                <span>{league.name}</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <a
                    href={`/leagues/${league.id}`}
                    className="btn-secondary"
                    style={{ textDecoration: 'none' }}
                  >
                    Manage
                  </a>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => openDeleteDialog(league.id)}
                    style={{
                      borderColor: '#b91c1c',
                      color: '#fecaca',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {deletingId && (
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
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
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
                onClick={handleDelete}
                disabled={deleting || confirmText !== 'delete'}
                style={{
                  background: '#b91c1c',
                  borderColor: '#b91c1c',
                  color: '#fee2e2',
                }}
              >
                {deleting ? 'Deleting…' : 'Confirm delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

