import type { AppErrorCode } from '../utils/error.js';
import type { EmailAttachment } from '../services/email.service.js';
import type { HtmlSnapshotResult } from './html-snapshot.js';
import type { OcrResult } from './extract.js';

export interface FailureArtifacts {
  screenshotPath: string | null;
  primaryErrorCode: AppErrorCode;
  ocr: OcrResult;
  html: HtmlSnapshotResult;
  attachmentCandidates: EmailAttachment[];
  failureReason?: string;
}

function toFilename(pathValue: string): string {
  const segments = pathValue.split('/');
  return segments[segments.length - 1] ?? pathValue;
}

export function buildFailureArtifacts(
  primaryErrorCode: AppErrorCode,
  ocr: OcrResult,
  html: HtmlSnapshotResult,
  screenshotPath: string | null
): FailureArtifacts {
  const attachmentCandidates: EmailAttachment[] = [];

  if (screenshotPath) {
    attachmentCandidates.push({
      filename: toFilename(screenshotPath),
      path: screenshotPath,
      contentType: 'image/png',
    });
  }

  if (html.main?.path) {
    attachmentCandidates.push({
      filename: toFilename(html.main.path),
      path: html.main.path,
      contentType: 'text/html',
    });
  }

  for (const frame of html.frames) {
    attachmentCandidates.push({
      filename: toFilename(frame.path),
      path: frame.path,
      contentType: 'text/html',
    });
  }

  const reasons: string[] = [];
  if (ocr.status === 'FAILED' && ocr.failureReason) {
    reasons.push(`ocr: ${ocr.failureReason}`);
  }
  if (html.status === 'FAILED' && html.failureReason) {
    reasons.push(`html: ${html.failureReason}`);
  }

  return {
    screenshotPath,
    primaryErrorCode,
    ocr,
    html,
    attachmentCandidates,
    failureReason: reasons.length > 0 ? reasons.join(' | ') : undefined,
  };
}
