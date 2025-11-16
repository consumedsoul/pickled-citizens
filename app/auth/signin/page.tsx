'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Mode = 'password' | 'magic';

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email) {
      setStatus('error');
      setMessage('Email is required.');
      return;
    }

    setStatus('loading');
    setMessage(null);

    try {
      if (mode === 'password') {
        if (!password) {
          setStatus('error');
          setMessage('Password is required.');
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setStatus('error');
          setMessage(error.message);
        } else {
          setStatus('success');
          setMessage('Signed in. Redirecting…');
          window.location.href = '/sessions';
        }
      } else {
        const baseUrl =
          process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
        const redirectTo = `${baseUrl}/auth/complete`;

        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: redirectTo,
          },
        });

        if (error) {
          setStatus('error');
          setMessage(error.message);
        } else {
          setStatus('success');
          setMessage('Magic link sent. Check your email to finish signing in.');
        }
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  }

  return (
    <div className="section" style={{ maxWidth: 420 }}>
      <h1 className="section-title">Sign in</h1>
      <p className="hero-subtitle" style={{ marginBottom: '1rem' }}>
        Sign in with your password or request a magic link.
      </p>

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setMode('password')}
          style={{
            padding: '0.25rem 0.6rem',
            borderColor: mode === 'password' ? '#22c55e' : '#1f2937',
          }}
        >
          Password
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setMode('magic')}
          style={{
            padding: '0.25rem 0.6rem',
            borderColor: mode === 'magic' ? '#22c55e' : '#1f2937',
          }}
        >
          Magic link
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
        <label style={{ fontSize: '0.8rem' }}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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

        {mode === 'password' && (
          <label style={{ fontSize: '0.8rem' }}>
            Password
            <input
              type="password"
              required
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
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={status === 'loading'}
          style={{ justifySelf: 'flex-start' }}
        >
          {status === 'loading'
            ? mode === 'password'
              ? 'Signing in…'
              : 'Sending link…'
            : mode === 'password'
            ? 'Sign in'
            : 'Send magic link'}
        </button>
      </form>

      {mode === 'password' && (
        <p
          className="hero-subtitle"
          style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}
        >
          <a href="/auth/reset" style={{ textDecoration: 'underline' }}>
            Forgot password?
          </a>
        </p>
      )}

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
