import { eq, inArray } from 'drizzle-orm';
import { getDbAsync } from '../client';
import { chunkedInArray } from '../chunk';
import { profiles, type Profile, type NewProfile } from '../schema';

export async function getProfileById(userId: string): Promise<Profile | null> {
  const db = await getDbAsync();
  const rows = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function getProfilesByIds(userIds: string[]): Promise<Profile[]> {
  if (userIds.length === 0) return [];
  const db = await getDbAsync();
  return chunkedInArray(userIds, (chunk) =>
    db.select().from(profiles).where(inArray(profiles.id, chunk)),
  );
}

export async function listAllProfiles(): Promise<Profile[]> {
  const db = await getDbAsync();
  return db.select().from(profiles);
}

export async function upsertProfile(profile: NewProfile): Promise<void> {
  const db = await getDbAsync();
  const now = new Date().toISOString();
  await db
    .insert(profiles)
    .values({ ...profile, updatedAt: profile.updatedAt ?? now })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        gender: profile.gender,
        duprId: profile.duprId,
        selfReportedDupr: profile.selfReportedDupr,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        updatedAt: now,
      },
    });
}

export async function updateProfile(
  userId: string,
  patch: Partial<Omit<NewProfile, 'id' | 'createdAt'>>,
): Promise<void> {
  const db = await getDbAsync();
  await db
    .update(profiles)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(profiles.id, userId));
}

export async function deleteProfile(userId: string): Promise<void> {
  const db = await getDbAsync();
  await db.delete(profiles).where(eq(profiles.id, userId));
}
