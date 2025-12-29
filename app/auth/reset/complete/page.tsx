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
    <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5 max-w-[420px]">
      <h1 className="text-base font-medium mb-3">Set a new password</h1>
      <p className="text-app-muted mb-4">
        Choose a new password for your Pickled Citizens account.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <label className="text-[0.8rem]">
          New password (min 8 characters)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-app-text"
          />
        </label>
        <label className="text-[0.8rem]">
          Confirm new password
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-app-text"
          />
        </label>
        <button
          type="submit"
          className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed justify-self-start"
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Saving…' : 'Save new password'}
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
