import { mkdir, rm, writeFile } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';

import { extractFailureOcr } from './extract.js';

const TEST_DIRECTORY = 'test-results/ocr-unit';

async function createFakeScreenshot(fileName: string): Promise<string> {
  await mkdir(TEST_DIRECTORY, { recursive: true });
  const filePath = `${TEST_DIRECTORY}/${fileName}`;
  await writeFile(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'binary');
  return filePath;
}

describe('shared/ocr/extract', () => {
  afterEach(async () => {
    await rm(TEST_DIRECTORY, { recursive: true, force: true });
  });

  it('extracts text and maps hint code for readable screenshot', async () => {
    const screenshotPath = await createFakeScreenshot('readable.png');

    const result = await extractFailureOcr(screenshotPath, {
      fallbackText: 'selector button not visible',
      timeoutMs: 1000,
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.text).toContain('selector');
    expect(result.hintCode).toBe('DOM_SELECTOR_NOT_VISIBLE');
  });

  it('returns OCR_TEXT_NOT_FOUND when screenshot path does not exist', async () => {
    const result = await extractFailureOcr(`${TEST_DIRECTORY}/missing.png`, {
      fallbackText: 'network timeout',
      timeoutMs: 1000,
    });

    expect(result.status).toBe('FAILED');
    expect(result.hintCode).toBe('OCR_TEXT_NOT_FOUND');
  });

  it('returns OCR_TIMEOUT when extractor exceeds timeout', async () => {
    const screenshotPath = await createFakeScreenshot('timeout.png');

    const result = await extractFailureOcr(screenshotPath, {
      timeoutMs: 10,
      extractor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { text: 'late text' };
      },
    });

    expect(result.status).toBe('FAILED');
    expect(result.hintCode).toBe('OCR_TIMEOUT');
    expect(result.failureReason).toContain('OCR timeout exceeded');
  });

  it('returns OCR_EXTRACTION_FAILED when extractor throws', async () => {
    const screenshotPath = await createFakeScreenshot('throws.png');

    const result = await extractFailureOcr(screenshotPath, {
      timeoutMs: 100,
      extractor: async () => {
        throw new Error('engine crashed');
      },
    });

    expect(result.status).toBe('FAILED');
    expect(result.hintCode).toBe('OCR_EXTRACTION_FAILED');
    expect(result.failureReason).toContain('engine crashed');
  });

  it('uses extractor result text for hint mapping when available', async () => {
    const screenshotPath = await createFakeScreenshot('extractor-success.png');

    const result = await extractFailureOcr(screenshotPath, {
      extractor: async () => ({
        text: 'navigation timeout while loading page',
        confidence: 0.91,
      }),
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.hintCode).toBe('NETWORK_NAVIGATION_TIMEOUT');
    expect(result.confidence).toBe(0.91);
  });
});
