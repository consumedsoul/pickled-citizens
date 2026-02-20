'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
          setMessage('Signed in. Redirecting...');
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
    <div className="max-w-[420px]">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Sign In</h1>
      <p className="text-app-muted text-sm mb-6">
        Sign in with your password or request a magic link.
      </p>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          className={`px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-button font-medium border transition-colors cursor-pointer ${
            mode === 'password'
              ? 'border-app-text bg-app-text text-white'
              : 'border-app-border bg-transparent text-app-muted hover:text-app-text'
          }`}
          onClick={() => setMode('password')}
        >
          Password
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-button font-medium border transition-colors cursor-pointer ${
            mode === 'magic'
              ? 'border-app-text bg-app-text text-white'
              : 'border-app-border bg-transparent text-app-muted hover:text-app-text'
          }`}
          onClick={() => setMode('magic')}
        >
          Magic Link
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {mode === 'password' && (
          <Input
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        <div>
          <Button type="submit" disabled={status === 'loading'}>
            {status === 'loading'
              ? mode === 'password'
                ? 'Signing In...'
                : 'Sending Link...'
              : mode === 'password'
              ? 'Sign In'
              : 'Send Magic Link'}
          </Button>
        </div>
      </form>

      {mode === 'password' && (
        <p className="text-app-muted mt-4 text-sm">
          <a href="/auth/reset" className="text-app-text underline">
            Forgot password?
          </a>
        </p>
      )}

      {message && (
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-app-danger' : 'text-app-muted'}`}>
          {status === 'success' && message.includes('Check your email') ? (
            <span>
              Magic link sent.{' '}
              <span className="font-mono text-xs uppercase tracking-label font-semibold border border-app-text px-2 py-0.5">
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
