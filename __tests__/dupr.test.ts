import { describe, it, expect } from 'vitest';
import { formatDupr, normalizeDuprUrl, parseDuprInput, isDuprInRange } from '@/lib/dupr';

describe('formatDupr', () => {
  it('always shows three decimals like dupr.com', () => {
    expect(formatDupr(3)).toBe('3.000');
    expect(formatDupr(3.5)).toBe('3.500');
    expect(formatDupr(3.754)).toBe('3.754');
  });
});

describe('parseDuprInput', () => {
  it('accepts up to three decimals and rejects everything else', () => {
    expect(parseDuprInput('3')).toBe(3);
    expect(parseDuprInput(' 3.75 ')).toBe(3.75);
    expect(parseDuprInput('3.754')).toBe(3.754);
    expect(parseDuprInput('3.7545')).toBeNull();
    expect(parseDuprInput('abc')).toBeNull();
    expect(parseDuprInput('')).toBeNull();
  });

  it('range check is separate so the message can name the bounds', () => {
    expect(isDuprInRange(0.999)).toBe(false);
    expect(isDuprInRange(1)).toBe(true);
    expect(isDuprInRange(8.5)).toBe(true);
    expect(isDuprInRange(8.501)).toBe(false);
  });
});

describe('normalizeDuprUrl', () => {
  it('treats blank as no link', () => {
    expect(normalizeDuprUrl('')).toBeNull();
    expect(normalizeDuprUrl('   ')).toBeNull();
    expect(normalizeDuprUrl(null)).toBeNull();
    expect(normalizeDuprUrl(undefined)).toBeNull();
  });

  it('keeps a dupr.com player page and forces https', () => {
    expect(normalizeDuprUrl('https://dashboard.dupr.com/dashboard/player/7667170290')).toBe(
      'https://dashboard.dupr.com/dashboard/player/7667170290',
    );
    expect(normalizeDuprUrl(' http://dashboard.dupr.com/dashboard/player/1 ')).toBe(
      'https://dashboard.dupr.com/dashboard/player/1',
    );
    expect(normalizeDuprUrl('https://dupr.com/player/1')).toBe('https://dupr.com/player/1');
  });

  it('rejects anything that is not a dupr.com address', () => {
    expect(() => normalizeDuprUrl('not a url')).toThrow(/dupr\.com/);
    expect(() => normalizeDuprUrl('https://example.com/dupr.com')).toThrow(/dupr\.com/);
    expect(() => normalizeDuprUrl('https://evil-dupr.com/x')).toThrow(/dupr\.com/);
    expect(() => normalizeDuprUrl('javascript:alert(1)')).toThrow(/dupr\.com/);
    expect(() => normalizeDuprUrl('7667170290')).toThrow(/dupr\.com/);
  });
});

describe('effectiveDupr', () => {
  it('prefers the synced official rating and falls back to self-reported', async () => {
    const { effectiveDupr } = await import('@/lib/dupr');
    expect(effectiveDupr({ duprRating: 3.512, selfReportedDupr: 3.0 })).toBe(3.512);
    expect(effectiveDupr({ duprRating: null, selfReportedDupr: 3.0 })).toBe(3);
    expect(effectiveDupr({ selfReportedDupr: 3.0 })).toBe(3);
    expect(effectiveDupr({ duprRating: null, selfReportedDupr: null })).toBeNull();
  });
});
