'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordCompletePage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  // Ensure the user is loaded via the recovery link
  useEffect(() => {
    let active = true;

    async function checkUser() {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;

      if (error || !data.user) {
        setStatus('error');
        setMessage('Password reset link is invalid or has expired.');
      }
    }

    checkUser();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('idle');
    setMessage(null);

    if (!password || !passwordConfirm) {
      setStatus('error');
      setMessage('Password and confirmation are required.');
      return;
    }

    if (password !== passwordConfirm) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setStatus('error');
      setMessage('Password must be at least 8 characters long.');
      return;
    }

    setStatus('loading');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('success');
      setMessage('Password updated. Redirecting to sign-in…');
      setTimeout(() => {
        router.replace('/auth/signin');
      }, 1000);
    }
  }

  return (
    <div className="section" style={{ maxWidth: 420 }}>
      <h1 className="section-title">Set a new password</h1>
      <p className="hero-subtitle" style={{ marginBottom: '1rem' }}>
        Choose a new password for your Pickled Citizens account.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
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
              border: '1px solid #1f2937',
              background: '#020617',
              color: '#e5e7eb',
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
              border: '1px solid #1f2937',
              background: '#020617',
              color: '#e5e7eb',
            }}
          />
        </label>
        <button
          type="submit"
          className="btn-primary"
          disabled={status === 'loading'}
          style={{ justifySelf: 'flex-start' }}
        >
          {status === 'loading' ? 'Saving…' : 'Save new password'}
        </button>
      </form>

      {message && (
        <p
          style={{
            marginTop: '0.75rem',
            fontSize: '0.8rem',
            color: status === 'error' ? '#fca5a5' : '#9ca3af',
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
