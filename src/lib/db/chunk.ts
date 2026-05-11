// D1 enforces SQLite's SQLITE_MAX_VARIABLE_NUMBER = 100 per statement.
// Wrap any `inArray(col, ids)` query whose `ids` can grow past this.
const D1_MAX_PARAMS = 90;

export async function chunkedInArray<Id, Row>(
  ids: readonly Id[],
  runner: (chunk: Id[]) => Promise<Row[]>,
  chunkSize: number = D1_MAX_PARAMS,
): Promise<Row[]> {
  if (ids.length === 0) return [];
  if (ids.length <= chunkSize) return runner(ids as Id[]);
  const out: Row[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const rows = await runner(chunk);
    out.push(...rows);
  }
  return out;
}
