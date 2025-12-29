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
          window.location.href = '/';
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
    <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5 max-w-[420px]">
      <h1 className="text-base font-medium mb-3">Sign in</h1>
      <p className="text-app-muted mb-4">
        Sign in with your password or request a magic link.
      </p>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          className="rounded-full px-2.5 py-1 text-sm border bg-transparent text-app-muted cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setMode('password')}
          style={{
            borderColor: mode === 'password' ? '#14532d' : '#1f2937',
          }}
        >
          Password
        </button>
        <button
          type="button"
          className="rounded-full px-2.5 py-1 text-sm border bg-transparent text-app-muted cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setMode('magic')}
          style={{
            borderColor: mode === 'magic' ? '#14532d' : '#1f2937',
          }}
        >
          Magic link
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <label className="text-[0.8rem]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-app-text"
          />
        </label>

        {mode === 'password' && (
          <label className="text-[0.8rem]">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-app-text"
            />
          </label>
        )}

        <button
          type="submit"
          className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed justify-self-start"
          disabled={status === 'loading'}
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
        <p className="text-app-muted mt-3 text-[0.8rem]">
          <a href="/auth/reset" className="underline">
            Forgot password?
          </a>
        </p>
      )}

      {message && (
        <p className={`mt-3 text-[0.8rem] ${status === 'error' ? 'text-red-300' : 'text-app-muted'}`}>
          {status === 'success' && message.includes('Check your email') ? (
            <span>
              Magic link sent.{' '}
              <span className="bg-yellow-100 text-yellow-800 font-bold px-1.5 py-0.5 rounded">
                Check your email
              </span>{' '}
              to finish signing in.
            </span>
          ) : (
            message
          )}
        </p>
      )}
    </div>
  );
}
