/**
 * 당첨 확인 커맨드
 *
 * 실행:
 *   npm run check-result                    # 최근 회차 당첨 확인
 *   HEADED=true npm run check-result        # 브라우저 표시
 */

import {
  createBrowserSession,
  closeBrowserSession,
  saveErrorScreenshot,
} from '../../shared/browser/context.js';
import { login } from '../../shared/browser/actions/login.js';
import { getTicketsByRound } from '../browser/actions/check-purchase.js';
import { fetchLatestWinningNumbers } from '../browser/actions/fetch-winning.js';
import { checkTicketsWinning, printWinningResult } from '../services/winning-check.service.js';
import { sendEmail, hasEmailConfig } from '../../shared/services/email.service.js';
import { winningResultTemplate } from '../services/email.templates.js';
import { isToday, formatDateDot } from '../../shared/utils/date.js';
import { formatErrorSummary, getErrorDetails } from '../../shared/utils/error.js';
import {
  buildFailureArtifacts,
  captureFailureHtml,
  extractFailureOcr,
} from '../../shared/ocr/index.js';

async function main(): Promise<void> {
  console.log('🔍 당첨 확인 시작...\n');

  const session = await createBrowserSession();

  try {
    // 1. 로그인
    console.log('1. 로그인 중...');
    await login(session.page);

    // 2. 당첨 번호 조회
    console.log('\n2. 당첨 번호 조회 중...');
    const winningNumbers = await fetchLatestWinningNumbers(session.page);

    if (!winningNumbers) {
      console.log('\n' + '='.repeat(50));
      console.log('⏳ 당첨 번호를 조회할 수 없습니다.');
      console.log('='.repeat(50));
      console.log('\n   로또 추첨은 매주 토요일 저녁에 진행됩니다.');
      console.log('   추첨 후 다시 실행해주세요.\n');
      return;
    }

    // 추첨일이 오늘인지 확인
    const drawDate = winningNumbers.drawDate;

    if (!isToday(drawDate)) {
      const drawDateStr = formatDateDot(drawDate);
      console.log(`   최신 당첨: ${winningNumbers.round}회 (${drawDateStr})`);
      console.log('\n' + '='.repeat(50));
      console.log('⏳ 오늘 추첨이 아닙니다.');
      console.log('='.repeat(50));
      console.log('\n   로또 추첨은 매주 토요일 저녁에 진행됩니다.');
      console.log('   추첨일에 다시 실행해주세요.\n');
      return;
    }

    console.log(`   ${winningNumbers.round}회 당첨 번호: ${winningNumbers.numbers.join(', ')} + 보너스 ${winningNumbers.bonusNumber}`);

    // 3. 해당 회차 티켓 조회
    console.log(`\n3. ${winningNumbers.round}회 구매 내역 조회 중...`);
    const tickets = await getTicketsByRound(session.page, winningNumbers.round, 5);

    if (tickets.length === 0) {
      console.log(`\n⚠️ ${winningNumbers.round}회 구매 내역이 없습니다`);
      return;
    }

    console.log(`   ${winningNumbers.round}회 티켓 ${tickets.length}장 조회 완료`);

    // 4. 당첨 확인
    console.log('\n4. 당첨 확인 중...');
    const result = checkTicketsWinning(tickets, winningNumbers);

    // 5. 결과 출력
    printWinningResult(result);

    // 6. 이메일 전송
    if (hasEmailConfig()) {
      console.log('5. 이메일 전송 중...');
      const emailTemplate = winningResultTemplate(result);
      const emailResult = await sendEmail(emailTemplate);

      if (emailResult.success) {
        console.log('   ✅ 이메일 전송 완료');
      } else {
        console.log(`   ⚠️ 이메일 전송 실패: ${emailResult.error}`);
      }
    }

  } catch (error) {
    const details = getErrorDetails(error);
    const screenshotPath = await saveErrorScreenshot(session.page, 'lotto-check-result-command-failure');
    const htmlSnapshot = await captureFailureHtml(session.page, 'lotto-check-result-command-failure');
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
