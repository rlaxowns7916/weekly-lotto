import { describe, expect, it } from 'vitest';

import {
  formatDateDot,
  formatDateKorean,
  isToday,
  isWithinMinutes,
  parseSaleDate,
} from './date.js';

describe('shared/utils/date', () => {
  it('parses sale date string to ISO KST format', () => {
    expect(parseSaleDate('2026/01/24 (토) 18:20:39')).toBe('2026-01-24T18:20:39+09:00');
  });

  it('returns null for invalid sale date string', () => {
    expect(parseSaleDate('invalid-date')).toBeNull();
  });

  it('checks whether sale date is within configured minutes', () => {
    const now = Date.now();
    const recent = new Date(now - 2 * 60 * 1000).toISOString();
    const old = new Date(now - 20 * 60 * 1000).toISOString();

    expect(isWithinMinutes(recent, 5)).toBe(true);
    expect(isWithinMinutes(old, 5)).toBe(false);
  });

  it('formats date and checks today flag', () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    expect(formatDateDot(new Date('2026-01-24T00:00:00+09:00'))).toBe('2026.01.24');
    expect(isToday(today)).toBe(true);
    expect(isToday(yesterday)).toBe(false);
  });

  it('returns placeholder for undefined korean format input', () => {
    expect(formatDateKorean(undefined)).toBe('-');
  });

  // 회귀 방지: timeZone을 생략하면 UTC로 도는 CI 러너에서
  // 18:14 KST 발행 티켓이 메일에 '오전 09:14'로 표시됐다.
  it('formats in KST even when the process runs in UTC (CI runner)', () => {
    const originalTz = process.env.TZ;
    process.env.TZ = 'UTC';

    try {
      const formatted = formatDateKorean('2026-07-17T18:14:00+09:00');

      expect(formatted).toContain('오후 06:14');
      expect(formatted).not.toContain('09:14');
    } finally {
      process.env.TZ = originalTz;
    }
  });
});
