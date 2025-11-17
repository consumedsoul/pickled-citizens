'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

interface AuthState {
  loading: boolean;
  email: string | null;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
}

export function AuthStatus() {
  const [state, setState] = useState<AuthState>({ 
    loading: true, 
    email: null, 
    userId: null,
    firstName: null,
    lastName: null
  });

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!isMounted) return;
      
      const user = data.user;
      if (!user) {
        setState({ loading: false, email: null, userId: null, firstName: null, lastName: null });
        return;
      }

      // First set basic auth state without waiting for profile
      setState({ 
        loading: false, 
        email: user.email ?? null, 
        userId: user.id,
        firstName: null,
        lastName: null
      });

      // Then load user profile asynchronously
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .maybeSingle();

        if (!isMounted) return;
        
        setState(prev => ({ 
          ...prev,
          firstName: profile?.first_name ?? null,
          lastName: profile?.last_name ?? null
        }));
      } catch (error) {
        console.error('Failed to load user profile:', error);
        // Don't fail - just keep initials as null
      }
    }

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      
      const user = session?.user;
      if (!user) {
        setState({ loading: false, email: null, userId: null, firstName: null, lastName: null });
        return;
      }

      // First set basic auth state without waiting for profile
      setState({ 
        loading: false, 
        email: user.email ?? null, 
        userId: user.id,
        firstName: null,
        lastName: null
      });

      // Then load user profile asynchronously
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .maybeSingle();

        if (!isMounted) return;
        
        setState(prev => ({ 
          ...prev,
          firstName: profile?.first_name ?? null,
          lastName: profile?.last_name ?? null
        }));
      } catch (error) {
        console.error('Failed to load user profile:', error);
        // Don't fail - just keep initials as null
      }
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setState({ loading: false, email: null, userId: null, firstName: null, lastName: null });
  }

  function getUserInitials() {
    if (state.firstName && state.lastName) {
      return `${state.firstName[0]}${state.lastName[0]}`.toUpperCase();
    }
    if (state.firstName) {
      return state.firstName[0].toUpperCase();
    }
    if (state.email) {
      return state.email[0].toUpperCase();
    }
    return 'U';
  }

  if (state.loading) {
    return null;
  }

  if (!state.email) {
    return (
      <div style={{ fontSize: '0.8rem' }}>
        <Link 
          href="/auth/signin" 
          className="btn-secondary"
          style={{ paddingInline: '0.75rem', textDecoration: 'none' }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
      <Link 
        href="/profile"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#263FA9',
          color: 'white',
          fontWeight: 'bold',
          textDecoration: 'none',
          fontSize: '0.9rem',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#1E2E80';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#263FA9';
        }}
        title="View Profile"
      >
        {getUserInitials()}
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        className="btn-secondary"
        style={{ paddingInline: '0.75rem' }}
      >
        Sign out
      </button>
    </div>
  );
}
