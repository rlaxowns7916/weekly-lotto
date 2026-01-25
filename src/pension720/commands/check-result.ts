/**
 * 연금복권 720+ 당첨 번호 확인 커맨드
 *
 * 실행:
 *   npx tsx src/pension720/commands/check-result.ts
 *   HEADED=true npx tsx src/pension720/commands/check-result.ts
 */

import { createBrowserSession, closeBrowserSession } from '../../shared/browser/context.js';
import { fetchLatestPensionWinning } from '../browser/actions/fetch-winning.js';

async function main(): Promise<void> {
  console.log('🔍 연금복권 720+ 당첨 번호 조회 시작...\n');

  const session = await createBrowserSession();

  try {
    // 당첨 번호 조회
    console.log('당첨 번호 조회 중...');
    const winning = await fetchLatestPensionWinning(session.page);

    if (!winning) {
      console.log('\n' + '='.repeat(50));
      console.log('⏳ 당첨 번호를 조회할 수 없습니다.');
      console.log('='.repeat(50));
      return;
    }

    // 결과 출력
    const drawDateStr = `${winning.drawDate.getFullYear()}.${String(winning.drawDate.getMonth() + 1).padStart(2, '0')}.${String(winning.drawDate.getDate()).padStart(2, '0')}`;

    console.log('\n' + '='.repeat(50));
    console.log(`📋 ${winning.round}회 연금복권 720+ 당첨 번호`);
    console.log('='.repeat(50));
    console.log(`\n추첨일: ${drawDateStr}`);
    console.log(`\n🎱 1등 당첨번호: ${winning.winningGroup}조 ${winning.winningNumber}`);
    console.log(`🎁 보너스 번호: 각조 ${winning.bonusNumber}`);
    console.log('\n' + '='.repeat(50));

  } catch (error) {
    console.error('\n❌ 실패:', error);
    process.exit(1);
  } finally {
    await closeBrowserSession(session);
  }

  console.log('\n🎉 완료!');
}

main();
