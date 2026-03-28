/**
 * 예치금 충전 커맨드
 *
 * 실행:
 *   npm run deposit:charge                    # DRY RUN (키패드 OCR 확인까지만)
 *   HEADED=true npm run deposit:charge        # 브라우저 표시 + DRY RUN
 *   DRY_RUN=false npm run deposit:charge      # 실제 충전 진행
 */

import {
  createBrowserSession,
  closeBrowserSession,
} from '../../shared/browser/context.js';
import { login } from '../../shared/browser/actions/login.js';
import { chargeDeposit } from '../browser/actions/charge.js';
import { sendEmail, hasEmailConfig } from '../../shared/services/email.service.js';
import { handleCommandFailure } from '../../shared/utils/command.js';
import {
  chargeSuccessTemplate,
  chargeFailureTemplate,
} from '../services/email.templates.js';
import { pathToFileURL } from 'node:url';

export async function main(): Promise<void> {
  const dryRun = process.env.DRY_RUN !== 'false';

  if (dryRun) {
    console.log('예치금 충전 테스트 (DRY RUN 모드)');
    console.log('   키패드 OCR 확인까지만 진행됩니다.');
    console.log('   실제 충전: DRY_RUN=false npm run deposit:charge\n');
  } else {
    console.log('예치금 실제 충전 시작...\n');
  }

  const session = await createBrowserSession();

  try {
    console.log('1. 로그인 중...');
    await login(session.page);

    console.log('\n2. 예치금 충전 페이지로 이동...');
    const result = await chargeDeposit(session.page, dryRun);

    if (dryRun) {
      console.log('\nDRY RUN 완료!');
      console.log('   키패드 OCR 인식 정상, 실제 충전은 진행되지 않음');
    } else {
      console.log('\n충전 완료!');
      console.log(`   충전 금액: ${result.amount.toLocaleString()}원`);
      console.log(`   OCR 신뢰도: ${(result.keypadOcrConfidence * 100).toFixed(1)}%`);

      if (hasEmailConfig()) {
        console.log('\n3. 이메일 알림 전송 중...');
        const emailTemplate = chargeSuccessTemplate(result);
        const emailResult = await sendEmail(emailTemplate);
        if (emailResult.success) {
          console.log('   이메일 전송 완료');
        } else {
          console.log(`   이메일 전송 실패: ${emailResult.error}`);
        }
      }
    }
  } catch (error) {
    await handleCommandFailure(
      session.page,
      'deposit-charge-command-failure',
      error,
      chargeFailureTemplate,
    );
  } finally {
    await closeBrowserSession(session);
  }

  console.log('\n완료!');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('\n치명적 실패:', error);
    process.exit(1);
  });
}
