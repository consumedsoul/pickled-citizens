'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export function Navigation() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  function getLinkClassName(href: string) {
    const isActive = 
      (href === '/' && pathname === '/') ||
      (href !== '/' && pathname.startsWith(href));
    
    return `px-2 py-1 rounded no-underline transition-all duration-200 ${
      isActive ? 'text-app-link font-bold' : ''
    }`;
  }

  return (
    <nav className="flex gap-4 text-sm md:w-auto w-full md:justify-start justify-center flex-wrap md:gap-y-0 gap-y-1">
      <Link href="/" className={getLinkClassName('/')}>
        Home
      </Link>
      <Link href="/leagues" className={getLinkClassName('/leagues')}>
        Leagues
      </Link>
      <Link href="/sessions" className={getLinkClassName('/sessions')}>
        Sessions
      </Link>
      {isAuthenticated && (
        <Link href="/profile" className={getLinkClassName('/profile')}>
          Profile
        </Link>
      )}
    </nav>
  );
}
