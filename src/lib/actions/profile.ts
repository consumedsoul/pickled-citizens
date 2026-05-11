'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/db/auth-helpers';
import {
  getProfileById,
  updateProfile,
  upsertProfile,
} from '@/lib/db/queries/profiles';
import { logAdminEvent } from '@/lib/db/queries/admin';
import type { Profile } from '@/lib/db/schema';

export type ProfileFields = {
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  selfReportedDupr?: number | null;
  duprId?: string | null;
  displayName?: string | null;
};

export async function getMyProfile(): Promise<Profile | null> {
  const userId = await requireUserId();
  return getProfileById(userId);
}

export async function updateMyProfile(input: ProfileFields): Promise<{ ok: true }> {
  const userId = await requireUserId();
  const patch = sanitize(input);
  await updateProfile(userId, patch);
  revalidatePath('/profile');
  return { ok: true };
}

/**
 * Used by /auth/complete to populate the domain fields (gender, DUPR)
 * that Clerk doesn't capture during signup. The base profile row is created
 * by the Clerk webhook on user.created.
 */
export async function completeMyProfile(input: ProfileFields & {
  email?: string;
}): Promise<{ ok: true; isNew: boolean }> {
  const userId = await requireUserId();
  const existing = await getProfileById(userId);
  const isNew = !existing;
  await upsertProfile({
    id: userId,
    email: input.email?.toLowerCase() ?? existing?.email ?? null,
    firstName: input.firstName ?? existing?.firstName ?? null,
    lastName: input.lastName ?? existing?.lastName ?? null,
    gender: input.gender ?? existing?.gender ?? null,
    selfReportedDupr:
      input.selfReportedDupr ?? existing?.selfReportedDupr ?? null,
    duprId: input.duprId ?? existing?.duprId ?? null,
    displayName: input.displayName ?? existing?.displayName ?? null,
  });
  if (isNew) {
    await logAdminEvent({
      eventType: 'user.signup',
      userId,
      userEmail: input.email?.toLowerCase() ?? null,
      payload: { source: 'auth_complete' },
    });
  }
  revalidatePath('/profile');
  return { ok: true, isNew };
}

function sanitize(input: ProfileFields): ProfileFields {
  const out: ProfileFields = {};
  if (input.firstName !== undefined) out.firstName = input.firstName?.trim() || null;
  if (input.lastName !== undefined) out.lastName = input.lastName?.trim() || null;
  if (input.gender !== undefined) out.gender = input.gender || null;
  if (input.selfReportedDupr !== undefined) {
    if (input.selfReportedDupr === null) {
      out.selfReportedDupr = null;
    } else {
      const n = Number(input.selfReportedDupr);
      if (!Number.isFinite(n) || n < 1.0 || n > 8.5) {
        throw new Error('DUPR must be between 1.0 and 8.5');
      }
      out.selfReportedDupr = n;
    }
  }
  if (input.duprId !== undefined) out.duprId = input.duprId?.trim() || null;
  if (input.displayName !== undefined) out.displayName = input.displayName?.trim() || null;
  return out;
}
