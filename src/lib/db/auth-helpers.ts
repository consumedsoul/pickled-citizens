import { auth, currentUser } from '@clerk/nextjs/server';
import { ADMIN_EMAIL } from '@/lib/constants';

export class AuthorizationError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new AuthorizationError(401, 'Authentication required');
  }
  return userId;
}

export async function getOptionalUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const userId = await requireUserId();
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '';
  if (email !== ADMIN_EMAIL) {
    throw new AuthorizationError(403, 'Admin access required');
  }
  return { userId, email };
}

export async function getCurrentEmail(): Promise<string | null> {
  const user = await currentUser();
  return user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
}
