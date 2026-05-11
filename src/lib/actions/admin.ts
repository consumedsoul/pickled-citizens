'use server';

import { requireAdmin } from '@/lib/db/auth-helpers';
import { listAdminEvents } from '@/lib/db/queries/admin';
import { listAllProfiles } from '@/lib/db/queries/profiles';

export async function listAdminEventsAction(input: { limit?: number; offset?: number } = {}) {
  await requireAdmin();
  return listAdminEvents(input);
}

export async function listAllProfilesAction() {
  await requireAdmin();
  return listAllProfiles();
}
