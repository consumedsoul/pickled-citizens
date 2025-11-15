'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email) return;

    setStatus('loading');
    setMessage(null);

    try {
      const redirectTo = `${window.location.origin}`;
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
    } catch (err) {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  }

  return (
    <div className="section" style={{ maxWidth: 420 }}>
      <h1 className="section-title">Sign in</h1>
      <p className="hero-subtitle" style={{ marginBottom: '1rem' }}>
        Enter your email and we&apos;ll send you a magic link via Supabase Auth.
      </p>

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
          {status === 'loading' ? 'Sending link…' : 'Send magic link'}
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
