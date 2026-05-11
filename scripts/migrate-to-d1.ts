/**
 * One-shot migration: Supabase (Auth + Postgres) -> Clerk + Cloudflare D1.
 *
 * Reads everything via service-role + direct Postgres, imports users to Clerk
 * (preserving bcrypt password hashes), and emits a SQL file you apply to D1
 * with `wrangler d1 execute pickled-citizens --remote --file=...`.
 *
 * Required env (set in .env.local at the repo root):
 *   SUPABASE_URL                 - https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    - service role key (sb_secret_...)
 *   SUPABASE_DB_URL              - direct Postgres URL (postgres://postgres:[pwd]@db.<project>.supabase.co:5432/postgres)
 *   CLERK_SECRET_KEY             - sk_live_... or sk_test_... (Clerk Backend API)
 *
 * Output: scripts/migration-out/data.sql + scripts/migration-out/user-mapping.json
 *
 * Run:
 *   npx tsx scripts/migrate-to-d1.ts
 *   wrangler d1 execute pickled-citizens --remote --file=scripts/migration-out/data.sql
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const OUT_DIR = path.join(__dirname, 'migration-out');
const DATA_SQL = path.join(OUT_DIR, 'data.sql');
const MAPPING_JSON = path.join(OUT_DIR, 'user-mapping.json');

type SupabaseUser = {
  id: string;
  email: string | null;
  encrypted_password: string | null;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function sqlString(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

function buildInsert(table: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return `-- (no rows for ${table})\n`;
  const cols = Object.keys(rows[0]);
  const lines = rows.map(
    (r) => `  (${cols.map((c) => sqlString(r[c])).join(', ')})`,
  );
  return `INSERT INTO ${table} (${cols.join(', ')}) VALUES\n${lines.join(',\n')};\n`;
}

async function importUserToClerk(
  clerkSecret: string,
  user: SupabaseUser,
): Promise<string> {
  const body: Record<string, unknown> = {
    external_id: user.id,
    skip_password_checks: true,
    skip_password_requirement: true,
  };
  if (user.email) {
    body.email_address = [user.email];
  }
  if (user.encrypted_password) {
    body.password_digest = user.encrypted_password;
    body.password_hasher = 'bcrypt';
  }

  const res = await fetch('https://api.clerk.com/v1/users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${clerkSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clerk import failed for ${user.email ?? user.id}: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function main() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const clerkSecret = requireEnv('CLERK_SECRET_KEY');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('--- Step 1: Read Supabase auth users via Admin API ---');
  const supabaseUsers: SupabaseUser[] = [];
  let page = 1;
  const PER_PAGE = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    for (const u of data.users) {
      supabaseUsers.push({
        id: u.id,
        email: u.email ?? null,
        encrypted_password: null, // Not exposed by admin API; users will reset on first login
      });
    }
    if (data.users.length < PER_PAGE) break;
    page += 1;
  }
  console.log(`  Found ${supabaseUsers.length} users (importing without passwords)`);

  console.log('--- Step 2: Import users to Clerk ---');
  const mapping: Record<string, string> = {};
  for (const u of supabaseUsers) {
    try {
      const clerkId = await importUserToClerk(clerkSecret, u);
      mapping[u.id] = clerkId;
      console.log(`  ${u.email ?? u.id} -> ${clerkId}`);
    } catch (err) {
      console.error(`  FAILED ${u.email ?? u.id}:`, (err as Error).message);
    }
  }
  fs.writeFileSync(MAPPING_JSON, JSON.stringify(mapping, null, 2));
  console.log(`  Wrote mapping to ${MAPPING_JSON}`);

  const mapId = (id: string | null | undefined): string | null => {
    if (!id) return null;
    return mapping[id] ?? null;
  };

  console.log('--- Step 3: Read app tables from Supabase ---');
  const tables = [
    'profiles',
    'leagues',
    'league_members',
    'league_invites',
    'game_sessions',
    'matches',
    'session_guests',
    'match_players',
    'match_results',
    'admin_events',
  ] as const;

  const fetched: Record<string, Record<string, unknown>[]> = {};
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*');
    if (error) throw new Error(`Failed to fetch ${t}: ${error.message}`);
    fetched[t] = data ?? [];
    console.log(`  ${t}: ${fetched[t].length} rows`);
  }

  console.log('--- Step 4: Transform user IDs and JSONB ---');

  const transformed = {
    profiles: fetched.profiles
      .map((r) => ({
        id: mapId(r.id as string),
        created_at: r.created_at,
        updated_at: r.updated_at,
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        gender: r.gender,
        dupr_id: r.dupr_id,
        self_reported_dupr: r.self_reported_dupr,
        display_name: r.display_name,
        avatar_url: r.avatar_url,
      }))
      .filter((r) => r.id !== null),

    leagues: fetched.leagues
      .map((r) => ({
        id: r.id,
        created_at: r.created_at,
        name: r.name,
        owner_id: mapId(r.owner_id as string),
      }))
      .filter((r) => r.owner_id !== null),

    league_members: fetched.league_members
      .map((r) => ({
        league_id: r.league_id,
        user_id: mapId(r.user_id as string),
        role: r.role,
        email: r.email,
        created_at: r.created_at,
      }))
      .filter((r) => r.user_id !== null),

    league_invites: fetched.league_invites
      .map((r) => ({
        id: r.id,
        league_id: r.league_id,
        email: r.email,
        invited_by: mapId(r.invited_by as string),
        status: r.status,
        created_at: r.created_at,
        accepted_at: r.accepted_at,
      }))
      .filter((r) => r.invited_by !== null),

    game_sessions: fetched.game_sessions
      .map((r) => ({
        id: r.id,
        league_id: r.league_id,
        created_by: mapId(r.created_by as string),
        created_at: r.created_at,
        scheduled_for: r.scheduled_for,
        location: r.location,
        player_count: r.player_count,
      }))
      .filter((r) => r.created_by !== null),

    matches: fetched.matches.map((r) => ({
      id: r.id,
      session_id: r.session_id,
      court_number: r.court_number,
      scheduled_order: r.scheduled_order,
      status: r.status,
      created_at: r.created_at,
    })),

    session_guests: fetched.session_guests.map((r) => ({
      id: r.id,
      session_id: r.session_id,
      display_name: r.display_name,
      dupr: r.dupr,
      created_at: r.created_at,
    })),

    match_players: fetched.match_players.map((r) => ({
      id: r.id,
      match_id: r.match_id,
      user_id: r.user_id ? mapId(r.user_id as string) : null,
      guest_id: r.guest_id,
      team: r.team,
      position: r.position,
    })),

    match_results: fetched.match_results.map((r) => ({
      match_id: r.match_id,
      team1_score: r.team1_score,
      team2_score: r.team2_score,
      completed_at: r.completed_at,
    })),

    admin_events: fetched.admin_events.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      event_type: r.event_type,
      user_id: r.user_id ? mapId(r.user_id as string) : null,
      user_email: r.user_email,
      league_id: r.league_id,
      payload: r.payload === null || r.payload === undefined ? null : JSON.stringify(r.payload),
    })),
  };

  console.log('--- Step 5: Emit SQL ---');
  const out: string[] = [
    '-- Migration data: Supabase -> D1',
    `-- Generated ${new Date().toISOString()}`,
    'PRAGMA foreign_keys = OFF;',
    'BEGIN TRANSACTION;',
    '',
  ];
  // Insert order respects FKs
  out.push(buildInsert('profiles', transformed.profiles));
  out.push(buildInsert('leagues', transformed.leagues));
  out.push(buildInsert('league_members', transformed.league_members));
  out.push(buildInsert('league_invites', transformed.league_invites));
  out.push(buildInsert('game_sessions', transformed.game_sessions));
  out.push(buildInsert('matches', transformed.matches));
  out.push(buildInsert('session_guests', transformed.session_guests));
  // match_players FK to session_guests must come after session_guests
  out.push(buildInsert('match_players', transformed.match_players));
  out.push(buildInsert('match_results', transformed.match_results));
  out.push(buildInsert('admin_events', transformed.admin_events));
  out.push('', 'COMMIT;', 'PRAGMA foreign_keys = ON;', '');

  fs.writeFileSync(DATA_SQL, out.join('\n'));
  console.log(`  Wrote ${DATA_SQL}`);

  console.log('\n--- Done ---');
  console.log(`Apply with:`);
  console.log(`  wrangler d1 execute pickled-citizens --remote --file=${DATA_SQL}`);
  console.log(`Or for local dev:`);
  console.log(`  wrangler d1 execute pickled-citizens --local  --file=${DATA_SQL}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
