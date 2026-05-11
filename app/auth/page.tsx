import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';

export default function AuthPage() {
  return (
    <div className="max-w-[460px]">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Sign Up</h1>
      <p className="text-app-muted text-sm mb-6">
        Create your Pickled Citizens account. After signing up, you&apos;ll be asked
        to share your gender and self-reported DUPR for team balancing.
      </p>
      <SignUp
        signInUrl="/auth/signin"
        forceRedirectUrl="/auth/complete"
        signInForceRedirectUrl="/"
      />
      <p className="text-app-muted mt-6 text-sm">
        Already have an account?{' '}
        <Link href="/auth/signin" className="text-app-text underline">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}
