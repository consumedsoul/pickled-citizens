'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Status = 'loading' | 'success' | 'error';

export default function AuthCompletePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function run() {
      setStatus('loading');
      setMessage(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!active) return;

      if (userError || !userData.user) {
        setStatus('error');
        setMessage('Sign-in not complete. Try using the magic link again.');
        return;
      }

      const user = userData.user;
      const firstName = searchParams.get('firstName') ?? '';
      const lastName = searchParams.get('lastName') ?? '';
      const gender = searchParams.get('gender') ?? '';

      const payload: any = {
        id: user.id,
        email: user.email,
        updated_at: new Date().toISOString(),
      };
      if (firstName) payload.first_name = firstName;
      if (lastName) payload.last_name = lastName;
      if (gender) payload.gender = gender;

      const { error: upsertError } = await supabase.from('profiles').upsert(payload);

      if (!active) return;

      if (upsertError) {
        setStatus('error');
        setMessage(upsertError.message);
        return;
      }

      setStatus('success');
      setMessage('Signed in. Redirecting to your profile…');

      setTimeout(() => {
        router.replace('/profile');
      }, 800);
    }

    run();

    return () => {
      active = false;
    };
  }, [router, searchParams]);

  let text = 'Finishing your sign-in…';
  if (status === 'success') {
    text = message ?? 'Signed in. Redirecting…';
  } else if (status === 'error') {
    text = message ?? 'There was a problem completing sign-in.';
  }

  return (
    <div className="section" style={{ maxWidth: 420 }}>
      <h1 className="section-title">Completing sign-in</h1>
      <p className="hero-subtitle">{text}</p>
    </div>
  );
}
