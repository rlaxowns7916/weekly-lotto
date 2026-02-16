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

  it('wraps exhausted retry errors with structured diagnostics', async () => {
    let attempt = 0;

    const thrown = await withRetry(
      async () => {
        attempt += 1;
        throw new Error('Navigation timeout of 30000ms exceeded');
      },
      { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0, log: false }
    ).catch((error: unknown) => error);

    const appError = thrown as Error & {
      code?: string;
      category?: string;
      retryable?: boolean;
      retry?: {
        attemptCount?: number;
        maxRetries?: number;
        lastErrorMessage?: string;
      };
    };

    expect(attempt).toBe(3);
    expect(appError.code).toBe('NETWORK_NAVIGATION_TIMEOUT');
    expect(appError.category).toBe('NETWORK');
    expect(appError.retryable).toBe(true);
    expect(appError.retry?.attemptCount).toBe(3);
    expect(appError.retry?.maxRetries).toBe(2);
    expect(appError.retry?.lastErrorMessage).toContain('timeout');
  });

  it('marks non-classified errors with UNKNOWN_UNCLASSIFIED and classificationReason', async () => {
    const thrown = await withRetry(
      async () => {
        throw new Error('unmapped business edge condition');
      },
      {
        maxRetries: 0,
        baseDelayMs: 0,
        maxDelayMs: 0,
        log: false,
        shouldRetry: () => false,
      }
    ).catch((error: unknown) => error);

    const appError = thrown as Error & {
      code?: string;
      category?: string;
      classificationReason?: string;
    };

    expect(appError.code).toBe('UNKNOWN_UNCLASSIFIED');
    expect(appError.category).toBe('UNKNOWN');
    expect(appError.classificationReason).toBeTruthy();
  });

  it('maps OCR hint text into known error code or unknown fallback', async () => {
    const ocrError = await withRetry(
      async () => {
        throw new Error('ocr engine is unavailable');
      },
      {
        maxRetries: 0,
        baseDelayMs: 0,
        maxDelayMs: 0,
        log: false,
        shouldRetry: () => false,
      }
    ).catch((error: unknown) => error as { code?: string });

    expect(ocrError.code).toBe('OCR_ENGINE_UNAVAILABLE');

    const fallbackError = await withRetry(
      async () => {
        throw new Error('not-classified-message');
      },
      {
        maxRetries: 0,
        baseDelayMs: 0,
        maxDelayMs: 0,
        log: false,
        shouldRetry: () => false,
      }
    ).catch((error: unknown) => error as { code?: string });

    expect(fallbackError.code).toBe('UNKNOWN_UNCLASSIFIED');
  });
});
