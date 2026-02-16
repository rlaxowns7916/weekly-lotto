import { access, rm } from 'node:fs/promises';
import type { Page } from 'playwright';
import { afterEach, describe, expect, it } from 'vitest';

import { captureFailureHtml } from './html-snapshot.js';

describe('shared/ocr/html-snapshot', () => {
  afterEach(async () => {
    await rm('artifacts/html-failures', { recursive: true, force: true });
  });

  it('captures main and frame html paths', async () => {
    const mainFrame = {
      content: async () => '<html><body>main</body></html>',
      url: () => 'https://example.com/main',
    };
    const childFrame = {
      content: async () => '<html><body>frame</body></html>',
      url: () => 'https://example.com/frame',
    };

    const page = {
      url: () => 'https://example.com/main',
      content: async () => '<html><body>main</body></html>',
      frames: () => [mainFrame, childFrame],
      mainFrame: () => mainFrame,
    } as unknown as Page;

    const result = await captureFailureHtml(page, 'ocr-html-test');

    expect(result.status).toBe('SUCCESS');
    expect(result.main?.path).toContain('artifacts/html-failures/ocr-html-test');
    expect(result.frames.length).toBe(1);

    if (result.main?.path) {
      await access(result.main.path);
    }
    await access(result.frames[0].path);
  });
});
