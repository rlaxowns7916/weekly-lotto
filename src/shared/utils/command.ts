/**
 * 커맨드 공통 실패 처리 유틸리티
 *
 * 모든 커맨드(lotto:buy, pension:buy, deposit:charge)에서
 * 동일하게 사용되는 실패 아티팩트 수집 + 로깅 + 이메일 전송 패턴을 통합
 */

import type { Page } from 'playwright';
import { saveErrorScreenshot } from '../browser/context.js';
import { formatErrorSummary, getErrorDetails } from './error.js';
import {
  buildFailureArtifacts,
  captureFailureHtml,
  extractFailureOcr,
} from '../ocr/index.js';
import { sendEmail, hasEmailConfig } from '../services/email.service.js';
import type { EmailTemplateResult } from './html.js';

/**
 * 커맨드 실패 시 공통 처리: 스크린샷/HTML/OCR 아티팩트 수집 → 로깅 → 이메일 전송 → process.exit(1)
 */
export async function handleCommandFailure(
  page: Page,
  artifactTag: string,
  error: unknown,
  failureEmailTemplate: (summary: string) => EmailTemplateResult,
): Promise<never> {
  const details = getErrorDetails(error);
  const screenshotPath = await saveErrorScreenshot(page, artifactTag);
  const htmlSnapshot = await captureFailureHtml(page, artifactTag);
  const ocrResult = await extractFailureOcr(screenshotPath ?? 'screenshots/missing.png', {
    fallbackText: formatErrorSummary(error),
  });
  const artifacts = buildFailureArtifacts(details.code, ocrResult, htmlSnapshot, screenshotPath);

  console.error(`\n실패: ${details.message}`);
  console.error(`   error.code=${details.code}`);
  console.error(`   error.category=${details.category}`);
  console.error(`   error.retryable=${details.retryable}`);
  console.error(`   ocr.status=${artifacts.ocr.status}`);
  console.error(`   ocr.hintCode=${artifacts.ocr.hintCode}`);
  console.error(`   html.status=${artifacts.html.status}`);
  console.error(`   html.main.path=${artifacts.html.main?.path ?? 'none'}`);
  if (details.retry) {
    console.error(
      `   retry.attemptCount=${details.retry.attemptCount}, retry.maxRetries=${details.retry.maxRetries}`
    );
    console.error(`   retry.lastErrorMessage=${details.retry.lastErrorMessage}`);
  }
  if (details.classificationReason) {
    console.error(`   classificationReason=${details.classificationReason}`);
  }

  if (hasEmailConfig()) {
    const artifactSummary = [
      `ocr.status=${artifacts.ocr.status}`,
      `ocr.hintCode=${artifacts.ocr.hintCode}`,
      `html.status=${artifacts.html.status}`,
      `html.main.path=${artifacts.html.main?.path ?? 'none'}`,
    ].join(' | ');

    const emailTemplate = failureEmailTemplate(
      `${formatErrorSummary(error)} | ${artifactSummary}`
    );
    await sendEmail({
      ...emailTemplate,
      attachments: artifacts.attachmentCandidates,
    }).catch((e) => {
      console.error('이메일 전송 중 오류:', e);
    });
  }

  process.exit(1);
}
