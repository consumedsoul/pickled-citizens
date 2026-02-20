'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function AccountDeletedPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="max-w-[500px] mx-auto text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-4">Account Deleted</h1>

      <p className="text-app-muted text-sm mb-6">
        Your account has been successfully deleted. All your profile data, league memberships, and associated information has been permanently removed.
      </p>

      <div className="border border-app-border p-4 mb-6">
        <p className="text-sm">
          You can sign up again at any time with the same or a different email address to create a fresh account.
        </p>
      </div>

      <p className="text-app-muted text-xs mb-8">
        You will be redirected to the home page automatically in 5 seconds...
      </p>

      <Button onClick={() => router.push('/')} arrow>
        Go to Home
      </Button>
    </div>
  );
}
