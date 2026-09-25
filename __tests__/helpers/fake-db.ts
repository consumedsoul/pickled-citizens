import { vi } from 'vitest';

export type Row = Record<string, unknown>;

/**
 * Minimal stand-in for the Drizzle query builder. `select()` pops the next
 * queued result set, so a test declares results in the order the code under
 * test asks for them. The chain is thenable at every step because callers await
 * it after `.where()` in some paths and after `.limit(1)` in others.
 *
 * The query modules depend on nothing but `getDbAsync`, so stubbing that is
 * enough to drive them without a database. vi.mock is hoisted per file, so each
 * test file registers the stub itself:
 *
 *   vi.mock('@/lib/db/client', async () => (await import('./helpers/fake-db')).dbMock);
 */
export function makeDb(selectResults: Row[][]) {
  let cursor = 0;
  const deleteCalls: number[] = [];

  const chainFor = (rows: Row[]) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.from = self;
    chain.innerJoin = self;
    chain.where = self;
    chain.limit = self;
    chain.orderBy = self;
    chain.offset = self;
    chain.then = (resolve: (v: Row[]) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject);
    return chain;
  };

  const batches: unknown[][] = [];
  const updates: number[] = [];

  const db = {
    select: () => chainFor(selectResults[cursor++] ?? []),
    insert: () => ({ values: (v: unknown) => ({ insert: v }) }),
    update: () => ({
      set: () => ({
        where: () => {
          updates.push(1);
          return Promise.resolve(undefined);
        },
      }),
    }),
    batch: (ops: unknown[]) => {
      batches.push(ops);
      return Promise.resolve([]);
    },
    delete: () => ({
      where: () => {
        deleteCalls.push(1);
        return Promise.resolve(undefined);
      },
    }),
  };

  return { db, deleteCalls, batches, updates, selectsUsed: () => cursor };
}

/** The stubbed `@/lib/db/client` module. `useDb` points its `getDbAsync` at a fresh harness. */
export const dbMock = { getDbAsync: vi.fn() };

export function useDb(selectResults: Row[][]) {
  const harness = makeDb(selectResults);
  dbMock.getDbAsync.mockResolvedValue(harness.db);
  return harness;
}
