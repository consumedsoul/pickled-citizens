'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ResetPasswordCompletePage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage('Password updated. Redirecting to sign-in...');
      setTimeout(() => {
        router.replace('/auth/signin');
      }, 1000);
    }
  }

  return (
    <div className="max-w-[420px]">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Set New Password</h1>
      <p className="text-app-muted text-sm mb-6">
        Choose a new password for your Pickled Citizens account.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <Input
          label="New password (min 8 characters)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm new password"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
        />
        <div>
          <Button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Saving...' : 'Save New Password'}
          </Button>
        </div>
      </form>

      {message && (
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-app-danger' : 'text-app-muted'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
