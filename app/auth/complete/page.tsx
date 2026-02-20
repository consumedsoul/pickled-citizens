import { Suspense } from 'react';
import AuthCompleteClient from './AuthCompleteClient';

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Completing Sign-in</h1>
          <p className="text-app-muted text-sm">Finishing your sign-in...</p>
        </div>
      }
    >
      <AuthCompleteClient />
    </Suspense>
  );
}
