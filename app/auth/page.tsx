'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [selfDupr, setSelfDupr] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email || !firstName.trim() || !lastName.trim() || !gender) {
      setStatus('error');
      setMessage('Email, first name, last name, and gender are required.');
      return;
    }

    if (!selfDupr.trim()) {
      setStatus('error');
      setMessage('Self-reported DUPR is required.');
      return;
    }

    if (!/^\d{1,2}(\.\d{1,2})?$/.test(selfDupr.trim())) {
      setStatus('error');
      setMessage('Self-reported DUPR must be a number like 3.75.');
      return;
    }

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
    setMessage(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();

      const { data: existingProfile, error: existingError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existingError) {
        setStatus('error');
        setMessage(existingError.message);
        return;
      }

      if (existingProfile) {
        setStatus('error');
        setMessage('An account already exists with this email. Please sign in with email only.');
        return;
      }

      const params = new URLSearchParams({
        email: normalizedEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        selfDupr: selfDupr.trim(),
      });

      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const redirectTo = `${baseUrl}/auth/complete?${params.toString()}`;

      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setStatus('error');
        setMessage(error.message);
      } else {
        setStatus('success');
        setMessage('Check your email to confirm your account and finish signing up.');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  }

  return (
    <div className="max-w-[420px]">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Sign Up</h1>
      <p className="text-app-muted text-sm mb-6">
        Create your Pickled Citizens account with a password. You can also send yourself a
        magic link instead if you prefer passwordless sign-in.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-4 grid-cols-2">
          <Input
            label="First name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label="Last name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <Select
          label="Gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          required
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </Select>

        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          label="Password (min 8 characters)"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Input
          label="Confirm password"
          type="password"
          required
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
        />

        <div>
          <Input
            label="Self-reported DUPR"
            type="text"
            value={selfDupr}
            onChange={(e) => setSelfDupr(e.target.value)}
            placeholder="e.g. 3.75"
          />
          <p className="text-app-muted text-xs mt-1.5">
            Need help estimating your rating? See{' '}
            <a
              href="https://www.pickleheads.com/guides/pickleball-rating"
              target="_blank"
              rel="noreferrer"
              className="text-app-text underline"
            >
              this guide
            </a>
            .
          </p>
        </div>

        <div>
          <Button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Creating Account...' : 'Create Account'}
          </Button>
        </div>
      </form>

      {message && (
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-app-danger' : 'text-app-muted'}`}>
          {status === 'success' && message.includes('Check your email') ? (
            <span>
              <span className="font-mono text-xs uppercase tracking-label font-semibold border border-app-text px-2 py-0.5">
                Check your email
              </span>{' '}
              to confirm your account and finish signing up.
            </span>
          ) : (
            message
          )}
        </p>
      )}
      <p className="text-app-muted mt-6 text-sm">
        Already have an account?{' '}
        <a href="/auth/signin" className="text-app-text underline">
          Sign in with email only
        </a>
        .
      </p>
      <p className="text-app-muted mt-2 text-sm">
        Prefer passwordless sign-up? You can use the{' '}
        <a href="/auth/signin" className="text-app-text underline">
          magic link sign-in
        </a>{' '}
        page instead.
      </p>
    </div>
  );
}
