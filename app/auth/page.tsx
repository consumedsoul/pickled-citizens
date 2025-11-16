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
    <div className="section" style={{ maxWidth: 420 }}>
      <h1 className="section-title">Sign up</h1>
      <p className="hero-subtitle" style={{ marginBottom: '1rem' }}>
        Create your Pickled Citizens account with a password. You can also send yourself a
        magic link instead if you prefer passwordless sign-in.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ fontSize: '0.8rem' }}>
            First name (required)
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
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
          <label style={{ fontSize: '0.8rem' }}>
            Last name (required)
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
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
        </div>

        <label style={{ fontSize: '0.8rem' }}>
          Gender (required)
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            required
            style={{
              marginTop: '0.35rem',
              width: '100%',
              padding: '0.45rem 0.6rem',
              borderRadius: '0.5rem',
              border: '1px solid #1f2937',
              background: '#020617',
              color: '#e5e7eb',
            }}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>

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

        <label style={{ fontSize: '0.8rem' }}>
          Password (min 8 characters)
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
              border: '1px solid #1f2937',
              background: '#020617',
              color: '#e5e7eb',
            }}
          />
        </label>

        <label style={{ fontSize: '0.8rem' }}>
          Confirm password
          <input
            type="password"
            required
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
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

        <label style={{ fontSize: '0.8rem' }}>
          Self-reported DUPR (required, x.xx)
          <input
            type="text"
            value={selfDupr}
            onChange={(e) => setSelfDupr(e.target.value)}
            placeholder="e.g. 3.75"
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
          <p
            className="hero-subtitle"
            style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}
          >
            Need help estimating your rating? See{' '}
            <a
              href="https://www.pickleheads.com/guides/pickleball-rating"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#60a5fa', textDecoration: 'underline' }}
            >
              this guide
            </a>
            .
          </p>
        </label>

        <button
          type="submit"
          className="btn-primary"
          disabled={status === 'loading'}
          style={{ justifySelf: 'flex-start' }}
        >
          {status === 'loading' ? 'Creating account…' : 'Create account'}
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
      <p
        className="hero-subtitle"
        style={{ marginTop: '1rem', fontSize: '0.8rem' }}
      >
        Already have an account?{' '}
        <a href="/auth/signin" style={{ textDecoration: 'underline' }}>
          Sign in with email only
        </a>
        .
      </p>
      <p
        className="hero-subtitle"
        style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
      >
        Prefer passwordless sign-up? You can use the{' '}
        <a href="/auth/signin" style={{ textDecoration: 'underline' }}>
          magic link sign-in
        </a>{' '}
        page instead.
      </p>
    </div>
  );
}
