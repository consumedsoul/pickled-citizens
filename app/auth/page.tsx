'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email || !firstName.trim() || !lastName.trim() || !gender) {
      setStatus('error');
      setMessage('Email, first name, last name, and gender are required.');
      return;
    }

    setStatus('loading');
    setMessage(null);

    try {
      const params = new URLSearchParams({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
      });

      const redirectTo = `${window.location.origin}/auth/complete?${params.toString()}`;
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
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  }

  return (
    <div className="section" style={{ maxWidth: 420 }}>
      <h1 className="section-title">Sign up</h1>
      <p className="hero-subtitle" style={{ marginBottom: '1rem' }}>
        Enter your details and we&apos;ll send you a magic link via Supabase Auth to finish
        creating your account.
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
    </div>
  );
}
