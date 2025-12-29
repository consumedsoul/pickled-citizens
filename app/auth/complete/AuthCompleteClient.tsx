'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Status = 'loading' | 'success' | 'error';

export default function AuthCompleteClient() {
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

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      const isNewUser = !existingProfile;

      const firstName = searchParams.get('firstName') ?? '';
      const lastName = searchParams.get('lastName') ?? '';
      const gender = searchParams.get('gender') ?? '';
      const selfDuprParam = searchParams.get('selfDupr') ?? '';

      const payload: any = {
        id: user.id,
        email: user.email,
        updated_at: new Date().toISOString(),
      };
      if (firstName) payload.first_name = firstName;
      if (lastName) payload.last_name = lastName;
      if (gender) payload.gender = gender;
      if (selfDuprParam) {
        const n = Number(selfDuprParam);
        if (!Number.isNaN(n)) {
          payload.self_reported_dupr = n;
        }
      }

      const { error: upsertError } = await supabase.from('profiles').upsert(payload);

      if (!active) return;

      if (upsertError) {
        setStatus('error');
        setMessage(upsertError.message);
        return;
      }

      if (isNewUser) {
        await supabase.from('admin_events').insert({
          event_type: 'user.signup',
          user_id: user.id,
          user_email: user.email?.toLowerCase() ?? null,
          payload,
        });
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
    <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5 max-w-[420px]">
      <h1 className="text-base font-medium mb-3">Completing sign-in</h1>
      <p className="text-app-muted">{text}</p>
    </div>
  );
}
