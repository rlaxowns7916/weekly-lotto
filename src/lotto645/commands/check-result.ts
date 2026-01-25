/**
 * 당첨 확인 커맨드
 *
 * 실행:
 *   npm run check-result                    # 최근 회차 당첨 확인
 *   HEADED=true npm run check-result        # 브라우저 표시
 *
 * 환경 변수 (선택):
 *   WINNING_NUMBERS: 당첨 번호 수동 지정 (예: "1,2,3,4,5,6,7" - 마지막이 보너스)
 *   WINNING_ROUND: WINNING_NUMBERS 사용 시 회차 지정
 */

import { createBrowserSession, closeBrowserSession } from '../../shared/browser/context.js';
import { login } from '../../shared/browser/actions/login.js';
import { getTicketsByRound } from '../browser/actions/check-purchase.js';
import { fetchLatestWinningNumbers } from '../browser/actions/fetch-winning.js';
import type { WinningNumbers } from '../domain/winning.js';
import { checkTicketsWinning, printWinningResult } from '../services/winning-check.service.js';
import { sendEmail, hasEmailConfig } from '../../shared/services/email.service.js';
import { winningResultTemplate } from '../services/email.templates.js';

/**
 * 환경변수에서 당첨 번호 파싱 (수동 지정용)
 * 형식: "1,2,3,4,5,6,7" (마지막이 보너스 번호)
 */
function parseWinningNumbersFromEnv(): WinningNumbers | null {
  const envNumbers = process.env.WINNING_NUMBERS;
  const envRound = process.env.WINNING_ROUND;

  if (!envNumbers) {
    return null;
  }

  const round = envRound ? parseInt(envRound, 10) : 0;
  if (!round) {
    console.error('WINNING_NUMBERS 사용 시 WINNING_ROUND도 지정해야 합니다');
    return null;
  }

  try {
    const parts = envNumbers.split(',').map((n) => parseInt(n.trim(), 10));
    if (parts.length !== 7 || parts.some(isNaN)) {
      console.error('WINNING_NUMBERS 형식 오류: "1,2,3,4,5,6,7" (7개 숫자, 마지막이 보너스)');
      return null;
    }

    const numbers = parts.slice(0, 6).sort((a, b) => a - b);
    const bonusNumber = parts[6];

    return {
      round,
      drawDate: new Date(),
      numbers,
      bonusNumber,
    };
  } catch {
    console.error('WINNING_NUMBERS 파싱 오류');
    return null;
  }
}

async function main(): Promise<void> {
  console.log('🔍 당첨 확인 시작...\n');

  // 환경변수에서 수동 지정된 경우 먼저 확인
  const manualWinningNumbers = parseWinningNumbersFromEnv();
  if (manualWinningNumbers) {
    console.log('(환경변수에서 당첨번호 사용)');
    console.log(`당첨 번호: ${manualWinningNumbers.numbers.join(', ')} + 보너스 ${manualWinningNumbers.bonusNumber}\n`);
  }

  const session = await createBrowserSession();

  try {
    // 1. 로그인
    console.log('1. 로그인 중...');
    await login(session.page);

    // 2. 당첨 번호 먼저 조회 (early return)
    console.log('\n2. 당첨 번호 조회 중...');

    let winningNumbers: WinningNumbers | null = manualWinningNumbers;

    if (!winningNumbers) {
      winningNumbers = await fetchLatestWinningNumbers(session.page);

      if (!winningNumbers) {
        console.log('\n' + '='.repeat(50));
        console.log('⏳ 당첨 번호를 조회할 수 없습니다.');
        console.log('='.repeat(50));
        console.log('\n   로또 추첨은 매주 토요일 저녁에 진행됩니다.');
        console.log('   추첨 후 다시 실행해주세요.\n');
        return;
      }

      // 추첨일이 오늘인지 확인 (오늘 추첨이 아니면 early return)
      const today = new Date();
      const drawDate = winningNumbers.drawDate;
      const isToday =
        today.getFullYear() === drawDate.getFullYear() &&
        today.getMonth() === drawDate.getMonth() &&
        today.getDate() === drawDate.getDate();

      if (!isToday) {
        const drawDateStr = `${drawDate.getFullYear()}.${String(drawDate.getMonth() + 1).padStart(2, '0')}.${String(drawDate.getDate()).padStart(2, '0')}`;
        console.log(`   최신 당첨: ${winningNumbers.round}회 (${drawDateStr})`);
        console.log('\n' + '='.repeat(50));
        console.log('⏳ 오늘 추첨이 아닙니다.');
        console.log('='.repeat(50));
        console.log('\n   로또 추첨은 매주 토요일 저녁에 진행됩니다.');
        console.log('   추첨일에 다시 실행해주세요.\n');
        return;
      }

      console.log(`   ${winningNumbers.round}회 당첨 번호: ${winningNumbers.numbers.join(', ')} + 보너스 ${winningNumbers.bonusNumber}`);
    }

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
    console.error('\n❌ 실패:', error);
    process.exit(1);
  } finally {
    await closeBrowserSession(session);
  }

  console.log('\n🎉 완료!');
}

main();
