'use client';

import { useUser } from '@clerk/nextjs';

export interface AuthUserState {
  loading: boolean;
  email: string | null;
  userId: string | null;
}

export function useAuthUser(): AuthUserState {
  const { isLoaded, user } = useUser();
  return {
    loading: !isLoaded,
    email: user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null,
    userId: user?.id ?? null,
  };
}
