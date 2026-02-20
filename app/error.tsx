'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="max-w-[480px] mx-auto text-center">
      <h2 className="font-display text-2xl font-bold tracking-tight mb-2">Something Went Wrong</h2>
      <p className="text-app-muted text-sm mb-6">
        An unexpected error occurred. Please try again.
      </p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
