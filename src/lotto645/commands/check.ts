/**
 * 최근 구매 내역 확인 커맨드
 *
 * 실행:
 *   npm run check                    # 일주일치 구매 내역 조회
 *   HEADED=true npm run check        # 브라우저 표시
 */

import {
  createBrowserSession,
  closeBrowserSession,
  saveErrorScreenshot,
} from '../../shared/browser/context.js';
import { login } from '../../shared/browser/actions/login.js';
import { formatErrorSummary, getErrorDetails } from '../../shared/utils/error.js';
import {
  buildFailureArtifacts,
  captureFailureHtml,
  extractFailureOcr,
} from '../../shared/ocr/index.js';
import { getAllTicketsInWeek, printTicketsSummary } from '../browser/actions/check-purchase.js';

async function main(): Promise<void> {
  console.log('🔍 최근 구매 내역 확인 시작...\n');

  const session = await createBrowserSession();

  try {
    // 1. 로그인
    console.log('1. 로그인 중...');
    await login(session.page);

    // 2. 일주일치 구매 내역 조회
    console.log('\n2. 구매 내역 조회 중...');
    const tickets = await getAllTicketsInWeek(session.page);

    // 3. 결과 출력
    printTicketsSummary(tickets);

  } catch (error) {
    const details = getErrorDetails(error);
    const screenshotPath = await saveErrorScreenshot(session.page, 'lotto-check-command-failure');
    const htmlSnapshot = await captureFailureHtml(session.page, 'lotto-check-command-failure');
    const ocrResult = await extractFailureOcr(screenshotPath ?? 'screenshots/missing.png', {
      fallbackText: formatErrorSummary(error),
    });
    const artifacts = buildFailureArtifacts(details.code, ocrResult, htmlSnapshot, screenshotPath);

    console.error(`\n❌ 실패: ${details.message}`);
    console.error(`   error.code=${details.code}`);
    console.error(`   error.category=${details.category}`);
    console.error(`   error.retryable=${details.retryable}`);
    console.error(`   ocr.status=${artifacts.ocr.status}`);
    console.error(`   ocr.hintCode=${artifacts.ocr.hintCode}`);
    console.error(`   html.status=${artifacts.html.status}`);
    console.error(`   html.main.path=${artifacts.html.main?.path ?? 'none'}`);
    process.exit(1);
  } finally {
    await closeBrowserSession(session);
  }

  console.log('\n🎉 완료!');
}

main();
