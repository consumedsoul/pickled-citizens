import { Suspense } from 'react';
import AuthCompleteClient from './AuthCompleteClient';

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5 max-w-[420px]">
          <h1 className="text-base font-medium mb-3">Completing sign-in</h1>
          <p className="text-app-muted">Finishing your sign-in…</p>
        </div>
      }
    >
      <AuthCompleteClient />
    </Suspense>
  );
}
