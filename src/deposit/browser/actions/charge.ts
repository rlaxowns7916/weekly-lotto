/**
 * 예치금 충전 브라우저 액션
 *
 * 충전하기 페이지 이동 → 금액 선택 → 충전하기 버튼 클릭 →
 * 키패드 비밀번호 입력 → 완료 다이얼로그 확인 → 충전 내역 검증
 */

import type { Page } from 'playwright';
import type { ChargeResult } from '../../domain/charge.js';
import { depositSelectors } from '../selectors.js';
import { saveErrorScreenshot } from '../../../shared/browser/context.js';
import { AppError } from '../../../shared/utils/error.js';
import { withRetry } from '../../../shared/utils/retry.js';
import { getConfig } from '../../../shared/config/index.js';
import {
  TesseractKeypadRecognizer,
  recognizeKeypad,
  inputPassword,
  type KeypadDigitMap,
} from './keypad.js';

/**
 * 충전 페이지로 이동 (withRetry 사용)
 */
async function navigateToChargePage(page: Page): Promise<void> {
  console.log('충전하기 페이지로 이동 중...');

  await withRetry(
    async () => {
      try {
        await page.goto(depositSelectors.chargePageUrl, {
          timeout: 30000,
          waitUntil: 'domcontentloaded',
        });
      } catch {
        // goto 자체 실패는 무시하고 URL로 판단
      }

      if (!page.url().includes('mndpChrg')) {
        throw new AppError({
          code: 'NETWORK_NAVIGATION_TIMEOUT',
          category: 'NETWORK',
          retryable: true,
          message: `충전 페이지 이동 실패 (현재: ${page.url()})`,
        });
      }

      await page.locator(depositSelectors.amountSelect).waitFor({ state: 'visible', timeout: 30000 });
    },
    { maxRetries: 4, baseDelayMs: 1000, maxDelayMs: 10000 },
  );

  console.log(`페이지 로드 완료 - URL: ${page.url()}`);
}

/**
 * 충전 준비: 페이지 이동 → 금액 선택 → 충전 버튼 클릭 → 키패드 OCR
 * DRY_RUN과 실제 충전 양쪽에서 공유
 */
async function prepareChargeAndRecognize(
  page: Page,
  depositAmount: number,
  recognizer: TesseractKeypadRecognizer,
): Promise<{ digitMap: KeypadDigitMap; minConfidence: number }> {
  await navigateToChargePage(page);

  console.log(`충전 금액 선택: ${depositAmount.toLocaleString()}원`);
  const amountSelect = page.locator(depositSelectors.amountSelect);
  await amountSelect.waitFor({ state: 'visible', timeout: 30000 });
  await amountSelect.selectOption(String(depositAmount));
  await page.waitForTimeout(500);

  const chargeBtn = page.locator(depositSelectors.chargeButton);
  await chargeBtn.waitFor({ state: 'visible', timeout: 30000 });
  console.log('충전하기 버튼 클릭...');
  await chargeBtn.click();

  console.log('키패드 대기 중...');
  const keypadContainer = page.locator(depositSelectors.keypadContainer);
  await keypadContainer.waitFor({ state: 'visible', timeout: 30000 });
  console.log('키패드 표시됨');

  const digitMap = await recognizeKeypad(page, recognizer);
  const minConfidence = Math.min(
    ...Object.values(digitMap).map(d => d.confidence),
  );
  console.log(`키패드 OCR 완료: 10개 숫자 인식, 최저 confidence ${minConfidence.toFixed(2)}`);

  return { digitMap, minConfidence };
}

/**
 * 충전 실행 (단일 시도)
 */
async function executeCharge(page: Page, depositAmount: number, depositPassword: string): Promise<ChargeResult> {
  const recognizer = new TesseractKeypadRecognizer();

  try {
    const { digitMap, minConfidence } = await prepareChargeAndRecognize(page, depositAmount, recognizer);

    console.log('비밀번호 입력 중...');
    await inputPassword(page, depositPassword, digitMap);
    console.log('비밀번호 입력 완료');

    console.log('충전 완료 대기 중...');
    const completeDialog = page.locator(depositSelectors.chargeCompleteDialog);
    await completeDialog.waitFor({ state: 'visible', timeout: 60000 });
    console.log('충전 완료 다이얼로그 표시됨');

    const confirmBtn = page.locator(depositSelectors.chargeCompleteConfirmButton);
    await confirmBtn.click();
    console.log('확인 버튼 클릭');

    console.log('충전 내역 검증 중...');
    const historyEntry = page.locator(depositSelectors.chargeHistoryEntry).first();
    await historyEntry.waitFor({ state: 'visible', timeout: 10000 });
    console.log('충전 내역 검증 완료');

    console.log('\n========== 예치금 충전 완료 ==========\n');

    return {
      amount: depositAmount,
      status: 'success',
      timestamp: new Date(),
      keypadOcrConfidence: minConfidence,
    };
  } finally {
    await recognizer.dispose();
  }
}

/**
 * 예치금 충전 실행
 *
 * @param page Playwright Page 인스턴스 (로그인된 상태)
 * @param dryRun true면 키패드 OCR 확인까지만 진행 (기본값: true)
 * @returns 충전 결과
 */
export async function chargeDeposit(
  page: Page,
  dryRun: boolean = true,
): Promise<ChargeResult> {
  const config = getConfig();

  if (!config.depositPassword) {
    throw new AppError({
      code: 'AUTH_INVALID_CREDENTIALS',
      category: 'AUTH',
      retryable: false,
      message: '충전 실패: DEPOSIT_PASSWORD 환경변수가 필요합니다',
    });
  }

  const depositAmount = config.depositAmount ?? 20000;

  console.log('\n========== 예치금 충전 시작 ==========');

  if (dryRun) {
    const recognizer = new TesseractKeypadRecognizer();
    try {
      const { digitMap, minConfidence } = await prepareChargeAndRecognize(page, depositAmount, recognizer);

      await saveErrorScreenshot(page, 'deposit-keypad-dry-run');

      console.log('\n키패드 숫자 위치 매핑:');
      for (const [digit, entry] of Object.entries(digitMap).sort()) {
        console.log(`  숫자 ${digit}: ${entry.coords} (confidence: ${entry.confidence.toFixed(2)})`);
      }

      console.log('\nDRY RUN 완료: 키패드 OCR 인식까지 정상 동작');
      console.log('실제 충전을 원하면 DRY_RUN=false로 실행하세요');

      return {
        amount: depositAmount,
        status: 'dry_run',
        timestamp: new Date(),
        keypadOcrConfidence: minConfidence,
      };
    } finally {
      await recognizer.dispose();
    }
  }

  return await withRetry(
    async () => executeCharge(page, depositAmount, config.depositPassword!),
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 15000,
    },
  );
}
