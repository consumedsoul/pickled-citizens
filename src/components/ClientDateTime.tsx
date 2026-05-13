'use client';

import { useEffect, useState } from 'react';
import { formatDateTime } from '@/lib/formatters';

type Props = {
  value: string | null | undefined;
  placeholder?: string;
};

// Renders a locale/timezone-formatted date only after hydration to avoid
// server/client mismatches (worker runs UTC; browser runs the viewer's tz).
export function ClientDateTime({ value, placeholder = '—' }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return <>{placeholder}</>;
  return <>{formatDateTime(value)}</>;
}
