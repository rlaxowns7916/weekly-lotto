/**
 * 최근 구매 내역 확인 커맨드
 *
 * 실행:
 *   npm run check                    # 일주일치 구매 내역 조회
 *   HEADED=true npm run check        # 브라우저 표시
 */

import { createBrowserSession, closeBrowserSession } from '../browser/context.js';
import { login } from '../browser/actions/login.js';
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
    console.error('\n❌ 실패:', error);
    process.exit(1);
  } finally {
    await closeBrowserSession(session);
  }

  console.log('\n🎉 완료!');
}

main();
