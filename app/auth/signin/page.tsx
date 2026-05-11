import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="max-w-[460px]">
      <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Sign In</h1>
      <p className="text-app-muted text-sm mb-6">
        Sign in with your password or have a magic link sent to your email.
      </p>
      <SignIn
        signUpUrl="/auth"
        forceRedirectUrl="/"
        signUpForceRedirectUrl="/auth/complete"
      />
      <p className="text-app-muted mt-6 text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/auth" className="text-app-text underline">
          Sign up
        </Link>
        .
      </p>
    </div>
  );
}
