'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { completeMyProfile, getMyProfile } from '@/lib/actions/profile';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { GENDER_OPTIONS } from '@/lib/constants';

type Status = 'loading' | 'needs-fields' | 'saving' | 'success' | 'error';

export default function AuthCompleteClient() {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [gender, setGender] = useState('');
  const [selfDupr, setSelfDupr] = useState('');

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setStatus('error');
      setMessage('Sign-in not complete. Please try again.');
      return;
    }
    let active = true;
    (async () => {
      try {
        const profile = await getMyProfile();
        if (!active) return;
        if (profile?.gender && profile.selfReportedDupr != null) {
          // Already complete — go straight to profile
          router.replace('/profile');
          return;
        }
        if (profile?.gender) setGender(profile.gender);
        if (profile?.selfReportedDupr != null) setSelfDupr(String(profile.selfReportedDupr));
        setStatus('needs-fields');
      } catch (err) {
        if (!active) return;
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Could not load profile.');
      }
    })();
    return () => {
      active = false;
    };
  }, [isLoaded, user, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!gender) {
      setStatus('needs-fields');
      setMessage('Gender is required.');
      return;
    }
    if (!selfDupr.trim() || !/^\d{1,2}(\.\d{1,2})?$/.test(selfDupr.trim())) {
      setStatus('needs-fields');
      setMessage('DUPR must look like 3.75.');
      return;
    }
    const dupr = Number(selfDupr.trim());
    if (dupr < 1.0 || dupr > 8.5) {
      setStatus('needs-fields');
      setMessage('DUPR must be between 1.0 and 8.5.');
      return;
    }
    setStatus('saving');
    setMessage(null);
    try {
      await completeMyProfile({
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        email: user?.primaryEmailAddress?.emailAddress ?? undefined,
        gender,
        selfReportedDupr: dupr,
      });
      setStatus('success');
      setMessage('Profile complete. Redirecting...');
      setTimeout(() => router.replace('/profile'), 600);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to save profile.');
    }
  }

  if (status === 'loading') {
    return (
      <div className="max-w-[420px]">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">
          Finishing Sign-in
        </h1>
        <p className="text-sm text-app-muted">Loading your profile...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-[420px]">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">
          Sign-in Issue
        </h1>
        <p className="text-sm text-app-danger">{message ?? 'Something went wrong.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[420px]">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">
        Complete Your Profile
      </h1>
      <p className="text-app-muted text-sm mb-6">
        We need a couple more details to balance teams fairly.
      </p>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <Select
          label="Gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          required
        >
          <option value="">Select gender</option>
          {GENDER_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </option>
          ))}
        </Select>

        <div>
          <Input
            label="Self-reported DUPR"
            type="text"
            value={selfDupr}
            onChange={(e) => setSelfDupr(e.target.value)}
            placeholder="e.g. 3.75"
          />
          <p className="text-app-muted text-xs mt-1.5">
            Need help estimating?{' '}
            <a
              href="https://www.pickleheads.com/guides/pickleball-rating"
              target="_blank"
              rel="noreferrer"
              className="text-app-text underline"
            >
              See this guide
            </a>
            .
          </p>
        </div>

        <Button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving...' : 'Save and Continue'}
        </Button>

        {message && (
          <p
            className={`mt-2 text-sm ${
              status === 'success' ? 'text-app-muted' : 'text-app-danger'
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
