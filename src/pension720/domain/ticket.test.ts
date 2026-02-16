import { describe, expect, it } from 'vitest';

import { formatPensionNumber, isValidGroup } from './ticket.js';

describe('pension720/domain/ticket', () => {
  it('returns false for invalid group numbers', () => {
    expect(isValidGroup(0)).toBe(false);
    expect(isValidGroup(6)).toBe(false);
  });

  it('formats values as six-digit number strings', () => {
    expect(formatPensionNumber(123)).toBe('000123');
    expect(formatPensionNumber('45')).toBe('000045');
  });
});
