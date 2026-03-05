'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface AuthUserState {
  loading: boolean;
  email: string | null;
}

export function useAuthUser(): AuthUserState {
  const [state, setState] = useState<AuthUserState>({ loading: true, email: null });

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      setState({ loading: false, email: data.user?.email ?? null });
    }

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setState({ loading: false, email: session?.user?.email ?? null });
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
