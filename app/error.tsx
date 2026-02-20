'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for debugging — this is a genuine error case
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5 max-w-[480px] mx-auto text-center">
      <h2 className="text-base font-medium mb-3">Something went wrong</h2>
      <p className="text-app-muted text-[0.87rem] mb-4">
        An unexpected error occurred. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer bg-app-accent text-white hover:bg-app-accent/90 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
