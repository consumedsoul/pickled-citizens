'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function Navigation() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check initial auth state
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  function getLinkStyle(href: string) {
    const isActive = 
      (href === '/' && pathname === '/') ||
      (href !== '/' && pathname.startsWith(href));
    
    return {
      color: isActive ? '#263FA9' : 'inherit',
      fontWeight: isActive ? 'bold' : 'normal',
      textDecoration: 'none',
      padding: '0.25rem 0.5rem',
      borderRadius: '0.25rem',
      transition: 'all 0.2s ease'
    };
  }

  return (
    <nav className="app-nav">
      <Link href="/" style={getLinkStyle('/')}>
        Home
      </Link>
      <Link href="/leagues" style={getLinkStyle('/leagues')}>
        Leagues
      </Link>
      <Link href="/sessions" style={getLinkStyle('/sessions')}>
        Sessions
      </Link>
      {isAuthenticated && (
        <Link href="/profile" style={getLinkStyle('/profile')}>
          Profile
        </Link>
      )}
    </nav>
  );
}
