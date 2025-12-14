import { Suspense } from 'react';
import AuthCompleteClient from './AuthCompleteClient';

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="section" style={{ maxWidth: 420 }}>
          <h1 className="section-title">Completing sign-in</h1>
          <p className="hero-subtitle">Finishing your sign-in…</p>
        </div>
      }
    >
      <AuthCompleteClient />
    </Suspense>
  );
}
