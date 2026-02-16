import { describe, expect, it } from 'vitest';

import { type PurchasedPensionTicket } from '../domain/ticket.js';
import { type PensionWinningNumbers } from '../domain/winning.js';
import { winningResultTemplate } from './email.templates.js';
import { checkTicketsWinning } from './winning-check.service.js';

describe('pension720/services/winning-check.service', () => {
  it('returns summary with winnerCount less than or equal to totalCount', () => {
    const tickets: PurchasedPensionTicket[] = [
      {
        round: 200,
        slot: 'A',
        pensionNumber: { group: 1, number: '123456' },
        mode: 'auto',
      },
    ];

    const winningNumbers: PensionWinningNumbers = {
      round: 200,
      drawDate: new Date('2026-01-01T12:00:00+09:00'),
      winningGroup: 1,
      winningNumber: '123456',
      bonusNumber: '654321',
    };

    const result = checkTicketsWinning(tickets, winningNumbers);

    expect(result.round).toBe(winningNumbers.round);
    expect(result.winnerCount).toBeLessThanOrEqual(result.totalCount);
  });

  it('builds losing result template with subject containing 낙첨 and html containing summary', () => {
    const tickets: PurchasedPensionTicket[] = [
      {
        round: 201,
        slot: 'A',
        pensionNumber: { group: 5, number: '999999' },
        mode: 'auto',
      },
    ];

    const winningNumbers: PensionWinningNumbers = {
      round: 201,
      drawDate: new Date('2026-01-08T12:00:00+09:00'),
      winningGroup: 1,
      winningNumber: '123456',
      bonusNumber: '654321',
    };

    const result = checkTicketsWinning(tickets, winningNumbers);
    const template = winningResultTemplate(result);

    expect(template.subject).toContain('낙첨');
    expect(template.html).toContain(result.summary);
  });
});
