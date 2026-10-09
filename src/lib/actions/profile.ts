'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId, getCurrentEmail } from '@/lib/db/auth-helpers';
import {
  getProfileById,
  updateProfile,
  upsertProfile,
} from '@/lib/db/queries/profiles';
import { logAdminEvent } from '@/lib/db/queries/admin';
import type { Profile } from '@/lib/db/schema';
import { normalizeDuprUrl, isDuprInRange, DUPR_RANGE_ERROR } from '@/lib/dupr';

export type ProfileFields = {
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  selfReportedDupr?: number | null;
  duprId?: string | null;
  duprUrl?: string | null;
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
 *
 * The email is read from Clerk, never from the request: "add player by
 * email" resolves `profiles.email`, so a caller-supplied address would let a
 * signed-in user claim someone else's invitations. The other fields go
 * through the same `sanitize()` as `updateMyProfile`, so an out-of-range DUPR
 * is refused here too. The `email` key is still accepted for older clients
 * but ignored.
 */
export async function completeMyProfile(input: ProfileFields & {
  email?: string;
}): Promise<{ ok: true; isNew: boolean }> {
  const userId = await requireUserId();
  const clean = sanitize(input);
  const [existing, clerkEmail] = await Promise.all([getProfileById(userId), getCurrentEmail()]);
  const isNew = !existing;
  const email = clerkEmail ?? existing?.email ?? null;
  await upsertProfile({
    id: userId,
    email,
    firstName: clean.firstName ?? existing?.firstName ?? null,
    lastName: clean.lastName ?? existing?.lastName ?? null,
    gender: clean.gender ?? existing?.gender ?? null,
    selfReportedDupr: clean.selfReportedDupr ?? existing?.selfReportedDupr ?? null,
    duprId: clean.duprId ?? existing?.duprId ?? null,
    duprUrl: clean.duprUrl !== undefined ? clean.duprUrl : existing?.duprUrl ?? null,
    displayName: clean.displayName ?? existing?.displayName ?? null,
  });
  if (isNew) {
    await logAdminEvent({
      eventType: 'user.signup',
      userId,
      userEmail: email,
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
      if (!Number.isFinite(n) || !isDuprInRange(n)) {
        throw new Error(DUPR_RANGE_ERROR);
      }
      out.selfReportedDupr = n;
    }
  }
  if (input.duprId !== undefined) out.duprId = input.duprId?.trim() || null;
  if (input.duprUrl !== undefined) out.duprUrl = normalizeDuprUrl(input.duprUrl);
  if (input.displayName !== undefined) out.displayName = input.displayName?.trim() || null;
  return out;
}
