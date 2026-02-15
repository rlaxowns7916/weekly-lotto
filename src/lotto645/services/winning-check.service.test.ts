import { describe, expect, it } from 'vitest';

import { type PurchasedTicket } from '../domain/ticket.js';
import { type WinningNumbers } from '../domain/winning.js';
import { purchaseFailureTemplate } from './email.templates.js';
import { checkTicketsWinning } from './winning-check.service.js';

describe('lotto645/services/winning-check.service', () => {
  it('returns summary with winnerCount less than or equal to totalCount', () => {
    const tickets: PurchasedTicket[] = [
      {
        round: 1000,
        slot: 'A',
        numbers: [1, 2, 3, 4, 5, 6],
        mode: 'auto',
      },
    ];

    const winningNumbers: WinningNumbers = {
      round: 1000,
      drawDate: new Date('2026-01-01T12:00:00+09:00'),
      numbers: [1, 2, 3, 4, 5, 6],
      bonusNumber: 7,
    };

    const result = checkTicketsWinning(tickets, winningNumbers);

    expect(result.round).toBe(winningNumbers.round);
    expect(result.winnerCount).toBeLessThanOrEqual(result.totalCount);
  });

  it('builds failure template with failure subject and escaped error message', () => {
    const errorMessage = 'smtp <auth> failed';
    const template = purchaseFailureTemplate(errorMessage);

    expect(template.subject).toContain('실패');
    expect(template.html).toContain('smtp &lt;auth&gt; failed');
  });
});
