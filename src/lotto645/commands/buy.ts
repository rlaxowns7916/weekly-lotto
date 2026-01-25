/**
 * 로또 구매 커맨드
 *
 * 실행:
 *   npm run buy                    # DRY RUN (구매 직전까지만)
 *   HEADED=true npm run buy        # 브라우저 표시 + DRY RUN
 *   DRY_RUN=false npm run buy      # 실제 구매 진행
 */

import { createBrowserSession, closeBrowserSession } from '../../shared/browser/context.js';
import { login } from '../../shared/browser/actions/login.js';
import { buyLottoViaApi } from '../api/purchase-api.js';
import { sendEmail, hasEmailConfig } from '../../shared/services/email.service.js';
import {
  purchaseSuccessTemplate,
  purchaseFailureTemplate,
} from '../services/email.templates.js';

async function main(): Promise<void> {
  // DRY_RUN 환경변수 확인 (기본값: true)
  const dryRun = process.env.DRY_RUN !== 'false';

  if (dryRun) {
    console.log('🎰 로또 구매 테스트 (DRY RUN 모드)');
    console.log('   실제 구매는 진행되지 않습니다.');
    console.log('   실제 구매: DRY_RUN=false npm run buy\n');
  } else {
    console.log('🎰 로또 실제 구매 시작...');
    console.log('   ⚠️  실제로 1,000원이 결제됩니다!\n');
  }

  const session = await createBrowserSession();

  try {
    // 1. 로그인
    console.log('1. 로그인 중...');
    await login(session.page);

    // 2. 로또 구매 (API 직접 호출)
    if (dryRun) {
      console.log('\n2. DRY RUN 모드: API 호출 테스트...');
      // DRY RUN에서는 회차 정보만 조회
      const { getCurrentRound } = await import('../api/purchase-api.js');
      const round = await getCurrentRound(session.context);
      console.log(`   현재 회차: ${round}회`);
      console.log('\n✅ DRY RUN 완료!');
      console.log('   API 연결 정상, 실제 구매는 진행되지 않음');
    } else {
      console.log('\n2. 로또 구매 (API 직접 호출)...');
      const tickets = await buyLottoViaApi(session.context, 1);

      console.log('\n✅ 구매 완료!');

      if (tickets.length > 0) {
        const ticket = tickets[0];
        console.log('\n📋 구매한 번호:');
        console.log(`   회차: ${ticket.round}회`);
        console.log(`   슬롯: ${ticket.slot} (${ticket.mode === 'auto' ? '자동' : '수동'})`);
        console.log(`   번호: ${ticket.numbers.join(', ')}`);

        // 이메일 알림 전송
        if (hasEmailConfig()) {
          console.log('\n3. 이메일 알림 전송 중...');
          const emailTemplate = purchaseSuccessTemplate(ticket);
          const result = await sendEmail(emailTemplate);
          if (result.success) {
            console.log('   ✅ 이메일 전송 완료');
          } else {
            console.log(`   ⚠️ 이메일 전송 실패: ${result.error}`);
          }
        }
      }
    }

  } catch (error) {
    console.error('\n❌ 실패:', error);

    // 실패 알림 이메일 전송
    if (hasEmailConfig()) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const emailTemplate = purchaseFailureTemplate(errorMessage);
      await sendEmail(emailTemplate).catch((e) => {
        console.error('이메일 전송 중 오류:', e);
      });
    }

    process.exit(1);
  } finally {
    await closeBrowserSession(session);
  }

  console.log('\n🎉 완료!');
}

main();
