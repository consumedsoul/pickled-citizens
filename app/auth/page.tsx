'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

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
    <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5 max-w-[420px]">
      <h1 className="text-base font-medium mb-3">Sign up</h1>
      <p className="text-app-muted mb-4">
        Create your Pickled Citizens account with a password. You can also send yourself a
        magic link instead if you prefer passwordless sign-in.
      </p>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <div className="grid gap-2 grid-cols-2">
          <label className="text-[0.8rem]">
            First name (required)
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-app-text"
            />
          </label>
          <label className="text-[0.8rem]">
            Last name (required)
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-app-text"
            />
          </label>
        </div>

        <label className="text-[0.8rem]">
          Gender (required)
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            required
            className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-app-text"
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>

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

        <label className="text-[0.8rem]">
          Password (min 8 characters)
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-app-text"
          />
        </label>

        <label className="text-[0.8rem]">
          Confirm password
          <input
            type="password"
            required
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-app-text"
          />
        </label>

        <label className="text-[0.8rem]">
          Self-reported DUPR (required, x.xx)
          <input
            type="text"
            value={selfDupr}
            onChange={(e) => setSelfDupr(e.target.value)}
            placeholder="e.g. 3.75"
            className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-gray-50 text-app-text"
          />
          <p className="text-app-muted text-xs mt-1.5">
            Need help estimating your rating? See{' '}
            <a
              href="https://www.pickleheads.com/guides/pickleball-rating"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 underline"
            >
              this guide
            </a>
            .
          </p>
        </label>

        <button
          type="submit"
          className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed justify-self-start"
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      {message && (
        <p className={`mt-3 text-[0.8rem] ${status === 'error' ? 'text-red-300' : 'text-app-muted'}`}>
          {status === 'success' && message.includes('Check your email') ? (
            <span>
              <span className="bg-yellow-100 text-yellow-800 font-bold px-1.5 py-0.5 rounded">
                Check your email
              </span>{' '}
              to confirm your account and finish signing up.
            </span>
          ) : (
            message
          )}
        </p>
      )}
      <p className="text-app-muted mt-4 text-[0.8rem]">
        Already have an account?{' '}
        <a href="/auth/signin" className="underline">
          Sign in with email only
        </a>
        .
      </p>
      <p className="text-app-muted mt-2 text-[0.8rem]">
        Prefer passwordless sign-up? You can use the{' '}
        <a href="/auth/signin" className="underline">
          magic link sign-in
        </a>{' '}
        page instead.
      </p>
    </div>
  );
}
