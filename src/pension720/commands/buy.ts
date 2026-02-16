/**
 * 연금복권 720+ 구매 커맨드
 *
 * 실행:
 *   npm run pension:buy                # DRY RUN (구매 직전까지만)
 *   HEADED=true npm run pension:buy    # 브라우저 표시 + DRY RUN
 *   DRY_RUN=false npm run pension:buy  # 실제 구매 진행
 *
 * 조 선택:
 *   요일별 자동 선택 (월=1조, 화=2조, 수=3조, 목=4조, 금=5조)
 *   또는 PENSION_GROUP=3 환경변수로 직접 지정
 */

import {
  createBrowserSession,
  closeBrowserSession,
  saveErrorScreenshot,
} from '../../shared/browser/context.js';
import { login } from '../../shared/browser/actions/login.js';
import { purchasePension } from '../browser/actions/purchase.js';
import { sendEmail, hasEmailConfig } from '../../shared/services/email.service.js';
import { formatErrorSummary, getErrorDetails } from '../../shared/utils/error.js';
import {
  buildFailureArtifacts,
  captureFailureHtml,
  extractFailureOcr,
} from '../../shared/ocr/index.js';
import {
  purchaseSuccessTemplate,
  purchaseFailureTemplate,
} from '../services/email.templates.js';
import type { PensionGroup } from '../domain/ticket.js';
import { isValidGroup } from '../domain/ticket.js';
import { pathToFileURL } from 'node:url';

export async function main(): Promise<void> {
  // DRY_RUN 환경변수 확인 (기본값: true)
  const dryRun = process.env.DRY_RUN !== 'false';

  // PENSION_GROUP 환경변수 확인 (선택적)
  let group: PensionGroup | undefined;
  if (process.env.PENSION_GROUP) {
    const parsedGroup = parseInt(process.env.PENSION_GROUP, 10);
    if (isValidGroup(parsedGroup)) {
      group = parsedGroup;
      console.log(`환경변수에서 조 지정: ${group}조`);
    } else {
      console.warn(`잘못된 PENSION_GROUP 값: ${process.env.PENSION_GROUP} (1-5 사이여야 함)`);
    }
  }

  if (dryRun) {
    console.log('🎰 연금복권 720+ 구매 테스트 (DRY RUN 모드)');
    console.log('   실제 구매는 진행되지 않습니다.');
    console.log('   실제 구매: DRY_RUN=false npm run pension:buy\n');
  } else {
    console.log('🎰 연금복권 720+ 실제 구매 시작...');
    console.log('   ⚠️  실제로 1,000원이 결제됩니다!\n');
  }

  const session = await createBrowserSession();

  try {
    // 1. 로그인
    console.log('1. 로그인 중...');
    await login(session.page);

    // 2. 연금복권 구매
    console.log('\n2. 연금복권 구매 페이지로 이동...');
    const tickets = await purchasePension(session.page, dryRun, group);

    // 3. 결과 출력
    if (dryRun) {
      console.log('\n✅ DRY RUN 완료!');
      console.log('   구매 페이지 접근 정상, 실제 구매는 진행되지 않음');
      console.log('   스크린샷: screenshots/pension-dry-run-before-buy-*.png');
    } else {
      console.log('\n✅ 구매 완료!');

      if (tickets.length > 0) {
        const ticket = tickets[0];
        console.log('\n📋 구매한 번호:');
        console.log(`   회차: ${ticket.round}회`);
        console.log(`   조: ${ticket.pensionNumber.group}조`);
        console.log(`   번호: ${ticket.pensionNumber.number}`);
        console.log(`   모드: ${ticket.mode === 'auto' ? '자동' : '수동'}`);

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
    const details = getErrorDetails(error);
    const screenshotPath = await saveErrorScreenshot(session.page, 'pension-buy-command-failure');
    const htmlSnapshot = await captureFailureHtml(session.page, 'pension-buy-command-failure');
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
    if (details.retry) {
      console.error(
        `   retry.attemptCount=${details.retry.attemptCount}, retry.maxRetries=${details.retry.maxRetries}`
      );
      console.error(`   retry.lastErrorMessage=${details.retry.lastErrorMessage}`);
    }
    if (details.classificationReason) {
      console.error(`   classificationReason=${details.classificationReason}`);
    }

    // 실패 알림 이메일 전송
    if (hasEmailConfig()) {
      const artifactSummary = [
        `ocr.status=${artifacts.ocr.status}`,
        `ocr.hintCode=${artifacts.ocr.hintCode}`,
        `html.status=${artifacts.html.status}`,
        `html.main.path=${artifacts.html.main?.path ?? 'none'}`,
      ].join(' | ');

      const emailTemplate = purchaseFailureTemplate(
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
  } finally {
    await closeBrowserSession(session);
  }

  console.log('\n🎉 완료!');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('\n❌ 치명적 실패:', error);
    process.exit(1);
  });
}
