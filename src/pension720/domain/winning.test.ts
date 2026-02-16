import { describe, expect, it } from 'vitest';

import {
  checkPensionWinning,
  digitsToString,
  getRankLabel,
  isWinning,
  type PensionWinningNumbers,
} from './winning.js';

const baseWinning: PensionWinningNumbers = {
  round: 200,
  drawDate: new Date('2026-01-01T12:00:00+09:00'),
  winningGroup: 1,
  winningNumber: '123456',
  bonusNumber: '654321',
};

describe('pension720/domain/winning', () => {
  it('returns rank1 when group and six digits are exact match', () => {
    expect(checkPensionWinning({ group: 1, number: '123456' }, baseWinning)).toBe('rank1');
  });

  it('returns rank2 when group differs but six digits match', () => {
    expect(checkPensionWinning({ group: 2, number: '123456' }, baseWinning)).toBe('rank2');
  });

  it('returns bonus when bonus digits match', () => {
    expect(checkPensionWinning({ group: 5, number: '654321' }, baseWinning)).toBe('bonus');
  });

  it('returns rank3 when first five digits match', () => {
    expect(checkPensionWinning({ group: 2, number: '123459' }, baseWinning)).toBe('rank3');
  });

  it('returns rank7 when only last digit matches', () => {
    expect(checkPensionWinning({ group: 5, number: '999996' }, baseWinning)).toBe('rank7');
  });

  it('converts digits and maps labels/winning state', () => {
    expect(digitsToString([0, 1, 2, 3, 4, 5])).toBe('012345');
    expect(getRankLabel('bonus')).toBe('보너스');
    expect(getRankLabel('none')).toBe('낙첨');
    expect(isWinning('rank6')).toBe(true);
    expect(isWinning('none')).toBe(false);
  });
});
