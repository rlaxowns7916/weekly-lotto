import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createBrowserSessionMock: vi.fn(),
  closeBrowserSessionMock: vi.fn(),
  saveErrorScreenshotMock: vi.fn(),
  loginMock: vi.fn(),
  purchasePensionMock: vi.fn(),
  sendEmailMock: vi.fn(),
  hasEmailConfigMock: vi.fn(),
  getErrorDetailsMock: vi.fn(),
  formatErrorSummaryMock: vi.fn(),
  buildFailureArtifactsMock: vi.fn(),
  captureFailureHtmlMock: vi.fn(),
  extractFailureOcrMock: vi.fn(),
  purchaseSuccessTemplateMock: vi.fn(),
  purchaseFailureTemplateMock: vi.fn(),
}));

vi.mock('../../shared/browser/context.js', () => ({
  createBrowserSession: mocks.createBrowserSessionMock,
  closeBrowserSession: mocks.closeBrowserSessionMock,
  saveErrorScreenshot: mocks.saveErrorScreenshotMock,
}));

vi.mock('../../shared/browser/actions/login.js', () => ({
  login: mocks.loginMock,
}));

vi.mock('../browser/actions/purchase.js', () => ({
  purchasePension: mocks.purchasePensionMock,
}));

vi.mock('../../shared/services/email.service.js', () => ({
  sendEmail: mocks.sendEmailMock,
  hasEmailConfig: mocks.hasEmailConfigMock,
}));

vi.mock('../../shared/utils/error.js', () => ({
  getErrorDetails: mocks.getErrorDetailsMock,
  formatErrorSummary: mocks.formatErrorSummaryMock,
}));

vi.mock('../../shared/ocr/index.js', () => ({
  buildFailureArtifacts: mocks.buildFailureArtifactsMock,
  captureFailureHtml: mocks.captureFailureHtmlMock,
  extractFailureOcr: mocks.extractFailureOcrMock,
}));

vi.mock('../services/email.templates.js', () => ({
  purchaseSuccessTemplate: mocks.purchaseSuccessTemplateMock,
  purchaseFailureTemplate: mocks.purchaseFailureTemplateMock,
}));

import { main } from './buy.js';

describe('pension720/commands/buy failure diagnostics email flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PENSION_GROUP;
    process.env.DRY_RUN = 'false';

    mocks.createBrowserSessionMock.mockResolvedValue({ page: { id: 'page' } });
    mocks.closeBrowserSessionMock.mockResolvedValue(undefined);
    mocks.loginMock.mockResolvedValue(undefined);
    mocks.purchasePensionMock.mockRejectedValue(new Error('forced pension purchase failure'));

    mocks.getErrorDetailsMock.mockReturnValue({
      code: 'PURCHASE_VERIFICATION_FAILED',
      category: 'BUSINESS',
      retryable: false,
      message: '구매 검증 실패',
    });
    mocks.formatErrorSummaryMock.mockReturnValue('formatted pension failure summary');
    mocks.saveErrorScreenshotMock.mockResolvedValue('screenshots/pension-failure.png');
    mocks.captureFailureHtmlMock.mockResolvedValue({
      status: 'SUCCESS',
      main: { path: 'artifacts/html-failures/pension-main.html', url: 'https://example.com/main' },
      frames: [
        { path: 'artifacts/html-failures/pension-frame-0.html', url: 'https://example.com/frame' },
      ],
      captureTs: Date.now(),
      url: 'https://example.com/main',
    });
    mocks.extractFailureOcrMock.mockResolvedValue({
      status: 'SUCCESS',
      text: 'navigation timeout',
      confidence: 0.88,
      lang: 'kor+eng',
      hintCode: 'NETWORK_NAVIGATION_TIMEOUT',
    });

    mocks.buildFailureArtifactsMock.mockReturnValue({
      screenshotPath: 'screenshots/pension-failure.png',
      primaryErrorCode: 'PURCHASE_VERIFICATION_FAILED',
      ocr: {
        status: 'SUCCESS',
        text: 'navigation timeout',
        confidence: 0.88,
        lang: 'kor+eng',
        hintCode: 'NETWORK_NAVIGATION_TIMEOUT',
      },
      html: {
        status: 'SUCCESS',
        main: { path: 'artifacts/html-failures/pension-main.html', url: 'https://example.com/main' },
        frames: [
          { path: 'artifacts/html-failures/pension-frame-0.html', url: 'https://example.com/frame' },
        ],
        captureTs: Date.now(),
        url: 'https://example.com/main',
      },
      attachmentCandidates: [
        {
          filename: 'pension-failure.png',
          path: 'screenshots/pension-failure.png',
          contentType: 'image/png',
        },
        {
          filename: 'pension-main.html',
          path: 'artifacts/html-failures/pension-main.html',
          contentType: 'text/html',
        },
      ],
      failureReason: undefined,
    });

    mocks.hasEmailConfigMock.mockReturnValue(true);
    mocks.purchaseFailureTemplateMock.mockReturnValue({
      subject: 'pension failure',
      html: '<p>failure</p>',
      text: 'failure',
    });
    mocks.sendEmailMock.mockResolvedValue({ success: true, messageId: 'msg-2', attachmentStatus: 'FULL' });
  });

  it('sends failure email with OCR summary and attachments when purchase fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`EXIT_${code ?? 'undefined'}`);
    }) as (code?: string | number | null) => never);

    await expect(main()).rejects.toThrow('EXIT_1');

    expect(mocks.purchasePensionMock).toHaveBeenCalledWith({ id: 'page' }, false, undefined);
    expect(mocks.saveErrorScreenshotMock).toHaveBeenCalledWith(
      { id: 'page' },
      'pension-buy-command-failure'
    );
    expect(mocks.captureFailureHtmlMock).toHaveBeenCalledWith({ id: 'page' }, 'pension-buy-command-failure');
    expect(mocks.extractFailureOcrMock).toHaveBeenCalledWith('screenshots/pension-failure.png', {
      fallbackText: 'formatted pension failure summary',
    });

    expect(mocks.purchaseFailureTemplateMock).toHaveBeenCalledWith(
      expect.stringContaining('ocr.status=SUCCESS')
    );
    expect(mocks.purchaseFailureTemplateMock).toHaveBeenCalledWith(
      expect.stringContaining('ocr.hintCode=NETWORK_NAVIGATION_TIMEOUT')
    );
    expect(mocks.purchaseFailureTemplateMock).toHaveBeenCalledWith(
      expect.stringContaining('html.main.path=artifacts/html-failures/pension-main.html')
    );

    expect(mocks.sendEmailMock).toHaveBeenCalledTimes(1);

    const sendEmailPayload = mocks.sendEmailMock.mock.calls[0][0] as {
      attachments?: Array<{ filename: string }>;
      subject: string;
    };

    expect(sendEmailPayload.subject).toBe('pension failure');
    expect(sendEmailPayload.attachments).toBeDefined();
    expect(sendEmailPayload.attachments).toHaveLength(2);
    expect(sendEmailPayload.attachments?.map((attachment) => attachment.filename)).toEqual([
      'pension-failure.png',
      'pension-main.html',
    ]);
  });
});
