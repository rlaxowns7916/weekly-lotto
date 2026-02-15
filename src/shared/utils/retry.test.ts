import { describe, expect, it } from 'vitest';

import { withRetry } from './retry.js';

describe('shared/utils/retry', () => {
  it('retries until success when retry condition is met', async () => {
    let attempt = 0;

    const result = await withRetry(
      async () => {
        attempt += 1;
        if (attempt < 3) {
          throw new Error('timeout while connecting');
        }
        return 'ok';
      },
      { maxRetries: 3, baseDelayMs: 0, maxDelayMs: 0, shouldRetry: () => true, log: false }
    );

    expect(result).toBe('ok');
    expect(attempt).toBe(3);
  });

  it('does not retry when shouldRetry returns false', async () => {
    let attempt = 0;

    await expect(
      withRetry(
        async () => {
          attempt += 1;
          throw new Error('fatal');
        },
        { maxRetries: 5, baseDelayMs: 0, maxDelayMs: 0, shouldRetry: () => false, log: false }
      )
    ).rejects.toThrow('fatal');

    expect(attempt).toBe(1);
  });

  it('throws after maximum retries are exhausted', async () => {
    let attempt = 0;

    await expect(
      withRetry(
        async () => {
          attempt += 1;
          throw new Error('network timeout');
        },
        { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0, shouldRetry: () => true, log: false }
      )
    ).rejects.toThrow('network timeout');

    expect(attempt).toBe(3);
  });
});
