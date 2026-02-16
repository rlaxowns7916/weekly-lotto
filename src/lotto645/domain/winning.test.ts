import { describe, expect, it } from 'vitest';

import {
  checkWinning,
  getMatchingNumbers,
  getRankLabel,
  isWinning,
  type WinningNumbers,
} from './winning.js';

const baseWinning: WinningNumbers = {
  round: 1000,
  drawDate: new Date('2026-01-01T12:00:00+09:00'),
  numbers: [1, 2, 3, 4, 5, 6],
  bonusNumber: 7,
};

describe('lotto645/domain/winning', () => {
  it('returns rank1 when all six numbers match', () => {
    expect(checkWinning([1, 2, 3, 4, 5, 6], baseWinning)).toBe('rank1');
  });

  it('returns rank2 when five numbers and bonus number match', () => {
    expect(checkWinning([1, 2, 3, 4, 5, 7], baseWinning)).toBe('rank2');
  });

  it('returns none when there are fewer than three matches', () => {
    expect(checkWinning([1, 11, 21, 31, 41, 45], baseWinning)).toBe('none');
  });

  it('counts duplicate purchased numbers as one logical match', () => {
    expect(checkWinning([1, 1, 1, 1, 1, 1], baseWinning)).toBe('none');
  });

  it('returns unique matching numbers', () => {
    expect(getMatchingNumbers([1, 1, 2, 8, 8], [1, 2, 3, 4, 5, 6])).toEqual([1, 2]);
  });

  it('maps labels and winning state correctly', () => {
    expect(getRankLabel('rank3')).toBe('3등');
    expect(getRankLabel('none')).toBe('낙첨');
    expect(isWinning('rank5')).toBe(true);
    expect(isWinning('none')).toBe(false);
  });
});
