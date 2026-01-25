/**
 * 로또 구매 커맨드
 *
 * 실행:
 *   npm run buy                    # DRY RUN (구매 직전까지만)
 *   HEADED=true npm run buy        # 브라우저 표시 + DRY RUN
 *   DRY_RUN=false npm run buy      # 실제 구매 진행
 */

import { createBrowserSession, closeBrowserSession } from '../browser/context.js';
import { login } from '../browser/actions/login.js';
import { purchaseLotto } from '../browser/actions/purchase.js';
import { verifyRecentPurchase } from '../browser/actions/check-purchase.js';
import { sendEmail, hasEmailConfig } from '../services/email.service.js';
import {
  purchaseSuccessTemplate,
  purchaseFailureTemplate,
  purchaseVerificationFailedTemplate,
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

    // 2. 로또 구매 (또는 구매 준비)
    console.log('2. 로또 구매 페이지 이동 중...');
    await purchaseLotto(session.page, dryRun);

    // 3. 결과 출력
    if (dryRun) {
      console.log('\n✅ DRY RUN 완료!');
      console.log('   구매 직전 화면까지 정상 진행됨');
      console.log('   스크린샷: screenshots/dry-run-before-buy-*.png');
    } else {
      console.log('\n✅ 구매 완료!');

      // 4. 구매 내역에서 번호 확인 (5분 이내 구매만 유효)
      console.log('\n3. 구매 내역에서 번호 확인 중...');
      const purchasedTicket = await verifyRecentPurchase(session.page, 5);

      if (purchasedTicket && purchasedTicket.numbers.length > 0) {
        console.log('\n📋 구매한 번호:');
        console.log(`   회차: ${purchasedTicket.round}회`);
        console.log(`   슬롯: ${purchasedTicket.slot} (${purchasedTicket.mode === 'auto' ? '자동' : '수동'})`);
        console.log(`   번호: ${purchasedTicket.numbers.join(', ')}`);
        if (purchasedTicket.saleDate) {
          console.log(`   발행일: ${purchasedTicket.saleDate}`);
        }

        // 이메일 알림 전송
        if (hasEmailConfig()) {
          console.log('\n4. 이메일 알림 전송 중...');
          const emailTemplate = purchaseSuccessTemplate(purchasedTicket);
          const result = await sendEmail(emailTemplate);
          if (result.success) {
            console.log('   ✅ 이메일 전송 완료');
          } else {
            console.log(`   ⚠️ 이메일 전송 실패: ${result.error}`);
          }
        }
      } else {
        console.log('\n⚠️ 번호 확인 실패 (구매 검증 실패 - 5분 이내 구매 내역 없음)');

        // 검증 실패 이메일 전송
        if (hasEmailConfig()) {
          console.log('\n4. 검증 실패 이메일 전송 중...');
          const emailTemplate = purchaseVerificationFailedTemplate(
            '5분 이내 구매 내역을 찾을 수 없습니다. 동행복권 사이트에서 직접 확인해주세요.'
          );
          await sendEmail(emailTemplate);
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
