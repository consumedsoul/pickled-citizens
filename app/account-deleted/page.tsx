'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountDeletedPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home after 5 seconds
    const timer = setTimeout(() => {
      router.push('/');
    }, 5000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="mt-5 rounded-xl border border-app-border/90 bg-app-bg-alt p-5 max-w-[500px] text-center">
      <h1 className="text-base font-medium mb-3">Account Deleted</h1>
      
      <div className="text-5xl mb-4 text-green-500">
        ✅
      </div>
      
      <p className="text-app-muted mb-6">
        Your account has been successfully deleted. All your profile data, league memberships, and associated information has been permanently removed.
      </p>
      
      <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-6">
        <p className="m-0 text-sm text-green-800">
          <strong>What's next?</strong><br/>
          You can sign up again at any time with the same or a different email address to create a fresh account.
        </p>
      </div>
      
      <p className="text-app-muted text-[0.8rem] text-app-light-gray">
        You will be redirected to the home page automatically in 5 seconds...
      </p>
      
      <div className="mt-8">
        <a href="/" className="rounded-full px-5 py-2 text-sm border border-transparent cursor-pointer no-underline bg-app-accent text-white hover:bg-app-accent/90 transition-colors inline-block">
          Go to Home Page Now
        </a>
      </div>
    </div>
  );
}
