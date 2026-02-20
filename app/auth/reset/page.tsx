'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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
    <div className="max-w-[420px]">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Reset Password</h1>
      <p className="text-app-muted text-sm mb-6">
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <Button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Sending Link...' : 'Send Reset Link'}
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
