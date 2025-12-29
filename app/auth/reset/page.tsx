'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
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
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const redirectTo = `${baseUrl}/auth/reset/complete`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        setStatus('error');
        setMessage(error.message);
      } else {
        setStatus('success');
        setMessage('Password reset link sent. Check your email.');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5 max-w-[420px]">
      <h1 className="text-base font-medium mb-3">Reset password</h1>
      <p className="text-app-muted mb-4">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>

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

        <button
          type="submit"
          className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed justify-self-start"
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Sending link…' : 'Send reset link'}
        </button>
      </form>

      {message && (
        <p className={`mt-3 text-[0.8rem] ${status === 'error' ? 'text-red-300' : 'text-app-muted'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
