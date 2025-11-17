'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navigation() {
  const pathname = usePathname();

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
    </nav>
  );
}
