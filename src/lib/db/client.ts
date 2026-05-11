import { drizzle } from 'drizzle-orm/d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import * as schema from './schema';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export function getDb(): Database {
  const { env } = getCloudflareContext();
  const d1 = (env as unknown as { DB: D1Database }).DB;
  if (!d1) {
    throw new Error(
      'D1 binding "DB" not found. Add the d1_databases binding to wrangler.toml.',
    );
  }
  return drizzle(d1, { schema });
}

export async function getDbAsync(): Promise<Database> {
  const { env } = await getCloudflareContext({ async: true });
  const d1 = (env as unknown as { DB: D1Database }).DB;
  if (!d1) {
    throw new Error(
      'D1 binding "DB" not found. Add the d1_databases binding to wrangler.toml.',
    );
  }
  return drizzle(d1, { schema });
}

export { schema };
