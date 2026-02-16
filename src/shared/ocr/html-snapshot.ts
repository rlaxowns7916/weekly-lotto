import type { Page } from 'playwright';
import {
  saveFailureHtmlSnapshot,
  type FailureHtmlSnapshotResult,
} from '../browser/context.js';

export type HtmlSnapshotResult = FailureHtmlSnapshotResult;

export async function captureFailureHtml(
  page: Page,
  prefix: string
): Promise<HtmlSnapshotResult> {
  return saveFailureHtmlSnapshot(page, prefix);
}
