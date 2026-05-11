'use server';

import { requireAdmin } from '@/lib/db/auth-helpers';
import { listAdminEvents } from '@/lib/db/queries/admin';
import { listAllProfiles } from '@/lib/db/queries/profiles';
import { getDbAsync } from '@/lib/db/client';
import { leagueMembers, leagues } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

export async function listAdminEventsAction(input: { limit?: number; offset?: number } = {}) {
  await requireAdmin();
  return listAdminEvents(input);
}

export async function listAllProfilesAction() {
  await requireAdmin();
  return listAllProfiles();
}

export type AdminUserView = {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  selfReportedDupr: number | null;
  updatedAt: string | null;
  leagues: Array<{ id: string; name: string }>;
};

/** Returns all profiles with their league memberships, sorted by name. */
export async function listAdminUsersAction(): Promise<AdminUserView[]> {
  await requireAdmin();
  const profiles = await listAllProfiles();
  const db = await getDbAsync();
  const memberships =
    profiles.length === 0
      ? []
      : await db
          .select({ userId: leagueMembers.userId, leagueId: leagueMembers.leagueId })
          .from(leagueMembers)
          .where(inArray(leagueMembers.userId, profiles.map((p) => p.id)));
  const leagueIds = Array.from(new Set(memberships.map((m) => m.leagueId)));
  const leagueRows =
    leagueIds.length === 0
      ? []
      : await db
          .select({ id: leagues.id, name: leagues.name })
          .from(leagues)
          .where(inArray(leagues.id, leagueIds));
  const leagueMap = new Map(leagueRows.map((l) => [l.id, l]));

  const userLeagues = new Map<string, Array<{ id: string; name: string }>>();
  for (const m of memberships) {
    const league = leagueMap.get(m.leagueId);
    if (!league) continue;
    const list = userLeagues.get(m.userId) ?? [];
    list.push({ id: league.id, name: league.name });
    userLeagues.set(m.userId, list);
  }

  const view: AdminUserView[] = profiles.map((p) => ({
    id: p.id,
    email: p.email,
    firstName: p.firstName,
    lastName: p.lastName,
    selfReportedDupr: p.selfReportedDupr,
    updatedAt: p.updatedAt,
    leagues: userLeagues.get(p.id) ?? [],
  }));

  view.sort((a, b) => {
    const an = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim().toLowerCase();
    const bn = `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim().toLowerCase();
    if (an && bn) return an.localeCompare(bn);
    if (an) return -1;
    if (bn) return 1;
    return (a.email ?? '').toLowerCase().localeCompare((b.email ?? '').toLowerCase());
  });

  return view;
}
