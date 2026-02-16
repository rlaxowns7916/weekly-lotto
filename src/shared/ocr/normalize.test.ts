import { describe, expect, it } from 'vitest';

import type { OcrResult } from './extract.js';
import type { HtmlSnapshotResult } from './html-snapshot.js';
import { buildFailureArtifacts } from './normalize.js';

describe('shared/ocr/normalize', () => {
  it('keeps primary error and records ocr_or_html_failure_reason', () => {
    const ocr: OcrResult = {
      status: 'FAILED',
      text: '',
      lang: 'kor+eng',
      hintCode: 'OCR_ENGINE_UNAVAILABLE',
      failureReason: 'engine unavailable',
    };
    const html: HtmlSnapshotResult = {
      status: 'FAILED',
      main: { path: 'artifacts/html-failures/main.html', url: 'https://example.com' },
      frames: [{ path: 'artifacts/html-failures/frame-0.html', url: 'https://example.com/frame' }],
      captureTs: Date.now(),
      url: 'https://example.com',
      failureReason: 'frame detached',
    };

    const artifacts = buildFailureArtifacts(
      'PURCHASE_VERIFICATION_FAILED',
      ocr,
      html,
      'screenshots/failure.png'
    );

    expect(artifacts.primaryErrorCode).toBe('PURCHASE_VERIFICATION_FAILED');
    expect(artifacts.failureReason).toContain('ocr: engine unavailable');
    expect(artifacts.failureReason).toContain('html: frame detached');
    expect(artifacts.attachmentCandidates.length).toBe(3);
  });
});
