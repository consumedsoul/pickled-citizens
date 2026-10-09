import { describe, it, expect } from 'vitest';
import {
  normalizeDbTimestamp,
  parseDbTimestamp,
  sortableTimestamp,
  formatDateTime,
} from '@/lib/formatters';

/**
 * Two timestamp shapes reach the browser: ISO instants the app writes, and
 * SQLite's `datetime('now')` text (no "T", no "Z") from column defaults and
 * the weekly DUPR sync. The latter must read as UTC, not local time.
 */
describe('db timestamps', () => {
  it('rewrites SQLite text as ISO UTC and leaves everything else alone', () => {
    expect(normalizeDbTimestamp('2026-10-03 19:00:00')).toBe('2026-10-03T19:00:00Z');
    expect(normalizeDbTimestamp('2026-10-03T19:00:00.000Z')).toBe('2026-10-03T19:00:00.000Z');
    expect(normalizeDbTimestamp('2026-10-03T19:00')).toBe('2026-10-03T19:00');
  });

  it('parses SQLite text as the UTC instant it is', () => {
    expect(parseDbTimestamp('2026-10-03 19:00:00')?.toISOString()).toBe('2026-10-03T19:00:00.000Z');
    expect(parseDbTimestamp('2026-10-03T19:00:00.000Z')?.toISOString()).toBe(
      '2026-10-03T19:00:00.000Z',
    );
    expect(parseDbTimestamp(null)).toBeNull();
    expect(parseDbTimestamp('')).toBeNull();
    expect(parseDbTimestamp('not a date')).toBeNull();
  });

  it('reduces every shape to one minute-precision key for string ordering', () => {
    expect(sortableTimestamp('2026-10-03T19:00')).toBe('2026-10-03T19:00');
    expect(sortableTimestamp('2026-10-03T19:00:00.000Z')).toBe('2026-10-03T19:00');
    expect(sortableTimestamp('2026-10-03 19:00:00')).toBe('2026-10-03T19:00');
    expect(sortableTimestamp(null)).toBe('');
    expect(sortableTimestamp(undefined)).toBe('');
  });

  it('formatDateTime accepts SQLite text too', () => {
    expect(formatDateTime('2026-10-03 19:00:00')).not.toBe('Not scheduled');
    expect(formatDateTime('garbage')).toBe('Not scheduled');
    expect(formatDateTime(null)).toBe('Not scheduled');
  });
});
