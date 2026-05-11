'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';

export function Navigation() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  function isActivePath(href: string) {
    return (href === '/' && pathname === '/') ||
      (href !== '/' && pathname.startsWith(href));
  }

  function getLinkClassName(href: string) {
    return `no-underline text-sm font-medium transition-colors ${
      isActivePath(href)
        ? 'text-app-text underline underline-offset-4 decoration-1'
        : 'text-app-muted hover:text-app-text'
    }`;
  }

  return (
    <nav className="flex gap-5 md:w-auto w-full md:justify-start justify-center flex-wrap md:gap-y-0 gap-y-1">
      <Link href="/" className={getLinkClassName('/')} aria-current={isActivePath('/') ? 'page' : undefined}>
        Home
      </Link>
      <Link href="/leagues" className={getLinkClassName('/leagues')} aria-current={isActivePath('/leagues') ? 'page' : undefined}>
        Leagues
      </Link>
      <Link href="/sessions" className={getLinkClassName('/sessions')} aria-current={isActivePath('/sessions') ? 'page' : undefined}>
        Sessions
      </Link>
      {isSignedIn && (
        <Link href="/profile" className={getLinkClassName('/profile')} aria-current={isActivePath('/profile') ? 'page' : undefined}>
          Profile
        </Link>
      )}
    </nav>
  );
}
