/**
 * 예치금 충전 브라우저 액션
 *
 * 충전하기 페이지 이동 → 금액 선택 → 충전하기 버튼 클릭 → 충전 전 잔액 확인 →
 * 키패드 비밀번호 입력 → 완료 다이얼로그 확인 → 충전 후 잔액 확인 → 잔액 대조 판정
 *
 * 완료 다이얼로그를 못 봤다는 사실만으로는 충전 실패를 단정할 수 없다.
 * 돈이 이미 빠져나간 뒤 타임아웃이 났을 수 있기 때문이다. 그래서 결과는
 * 다이얼로그가 아니라 충전 전/후 잔액 대조로 판정한다.
 */

import type { Page } from 'playwright';
import type { ChargeResult } from '../../domain/charge.js';
import { verifyChargeByBalance, type ChargeVerification } from '../../domain/balance.js';
import { readDepositBalance } from './balance.js';
import { depositSelectors } from '../selectors.js';
import { saveErrorScreenshot } from '../../../shared/browser/context.js';
import { AppError, getErrorMessage } from '../../../shared/utils/error.js';
import { withRetry } from '../../../shared/utils/retry.js';
import { getConfig } from '../../../shared/config/index.js';
import {
  TesseractKeypadRecognizer,
  recognizeKeypad,
  inputPassword,
  type KeypadDigitMap,
} from './keypad.js';

/** 잔액을 못 읽었을 때도 로그가 깨지지 않도록 표기를 통일한다 */
function formatBalance(balance: number | null): string {
  return balance === null ? '확인 불가' : `${balance.toLocaleString()}원`;
}

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
 * 충전 완료 다이얼로그를 기다리고 확인 버튼을 누른다.
 *
 * 비밀번호 제출 이후이므로 예외를 던지지 않는다. 다이얼로그를 못 본 것은
 * 실패가 아니라 '결과를 모른다'는 뜻이며, 판정은 잔액 대조가 담당한다.
 *
 * @returns 다이얼로그를 확인했으면 true
 */
async function confirmChargeDialog(page: Page): Promise<boolean> {
  console.log('충전 완료 대기 중...');

  const dialogShown = await page
    .locator(depositSelectors.chargeCompleteDialog)
    .waitFor({ state: 'visible', timeout: 60000 })
    .then(() => true)
    .catch(() => false);

  if (!dialogShown) {
    console.log('충전 완료 다이얼로그를 확인하지 못했습니다 (잔액으로 판정합니다)');
    return false;
  }

  console.log('충전 완료 다이얼로그 표시됨');
  await page
    .locator(depositSelectors.chargeCompleteConfirmButton)
    .click()
    .then(() => console.log('확인 버튼 클릭'))
    .catch(() => console.log('확인 버튼 클릭 실패 (판정에는 영향 없음)'));

  return true;
}

/**
 * 충전 후 잔액을 다시 읽는다.
 *
 * 사이트가 잔액을 비동기로 갱신할 수 있어 페이지를 새로 받아 조회한다.
 * 비밀번호 제출 이후이므로 예외를 던지지 않는다.
 */
async function readBalanceAfterCharge(page: Page): Promise<number | null> {
  await page
    .goto(depositSelectors.chargePageUrl, { timeout: 30000, waitUntil: 'domcontentloaded' })
    .catch(() => undefined);

  return readDepositBalance(page);
}

/**
 * 충전이 성공하지 않았으면 오류를 던진다.
 *
 * 재시도해도 안전한 경우는 '잔액이 그대로'일 때뿐이다. 그 외에는
 * 중복 충전을 막기 위해 재시도 불가(`retryable=false`)로 분류한다.
 */
function assertChargeSucceeded(params: {
  verification: ChargeVerification;
  dialogConfirmed: boolean;
  before: number | null;
  after: number | null;
  submitError: unknown;
}): void {
  const { verification, dialogConfirmed, before, after, submitError } = params;
  const balanceLog = `충전 전 ${formatBalance(before)} → 충전 후 ${formatBalance(after)}`;
  const submitCause = submitError ? ` 원인: ${getErrorMessage(submitError)}` : '';

  if (verification.verdict === 'charged') {
    console.log(`충전 확인: ${balanceLog}`);
    return;
  }

  if (verification.verdict === 'not_charged') {
    if (dialogConfirmed) {
      // 사이트는 완료라는데 잔액은 그대로다. 어느 쪽도 믿을 수 없으므로
      // 재시도하지 않고 사람이 확인하도록 넘긴다.
      throw new AppError({
        code: 'DEPOSIT_VERIFICATION_FAILED',
        category: 'BUSINESS',
        retryable: false,
        message:
          `충전 결과 불일치: 완료 다이얼로그는 표시됐지만 잔액이 변하지 않았습니다 (${balanceLog}). ` +
          '중복 충전을 피하기 위해 재시도하지 않습니다. 동행복권에서 직접 확인해주세요.',
      });
    }

    // 잔액이 그대로 = 충전 미발생이 확정. 재시도해도 중복 충전되지 않는다.
    throw new AppError({
      code: 'DEPOSIT_CHARGE_FAILED',
      category: 'BUSINESS',
      retryable: true,
      message: `충전 미발생: 잔액이 변하지 않았습니다 (${balanceLog}).${submitCause}`,
      cause: submitError ?? undefined,
    });
  }

  // verdict === 'unknown'
  if (dialogConfirmed) {
    // 잔액은 못 읽었지만 사이트가 완료를 확인해줬다. 기존 판정 기준을 유지한다.
    console.log(`충전 완료(잔액 미검증): ${balanceLog}`);
    return;
  }

  throw new AppError({
    code: 'DEPOSIT_VERIFICATION_FAILED',
    category: 'BUSINESS',
    retryable: false,
    message:
      `충전 결과 확인 불가: ${verification.reason} (${balanceLog}). ` +
      `중복 충전을 피하기 위해 재시도하지 않습니다. 동행복권에서 직접 확인해주세요.${submitCause}`,
    cause: submitError ?? undefined,
  });
}

/**
 * 충전 실행 (단일 시도)
 */
async function executeCharge(page: Page, depositAmount: number, depositPassword: string): Promise<ChargeResult> {
  const recognizer = new TesseractKeypadRecognizer();

  try {
    const { digitMap, minConfidence } = await prepareChargeAndRecognize(page, depositAmount, recognizer);

    const before = await readDepositBalance(page);
    console.log(`충전 전 예치금: ${formatBalance(before)}`);

    // ===== 여기부터 되돌릴 수 없다 =====
    // 아래 코드는 어떤 오류도 그대로 던지지 않는다. raw 오류가 새어 나가면
    // 상위 withRetry가 재시도 가능한 것으로 보고 충전 전체를 재실행한다.
    // 입력 실패까지 포함해 모든 결과는 잔액 대조로만 판정한다.
    console.log('비밀번호 입력 중...');
    let submitError: unknown = null;
    try {
      await inputPassword(page, depositPassword, digitMap);
      console.log('비밀번호 입력 완료');
    } catch (error) {
      // 6자리를 채우면 NProtect가 자동 제출하므로, 마지막 탭에서 실패했다면
      // 이미 제출됐을 수 있다. 실패로 단정하지 않고 잔액으로 확인한다.
      submitError = error;
      console.log('비밀번호 입력 중 오류 발생 (잔액으로 충전 여부를 확인합니다)');
    }

    const dialogConfirmed = await confirmChargeDialog(page);

    const after = await readBalanceAfterCharge(page);
    console.log(`충전 후 예치금: ${formatBalance(after)}`);

    const verification = verifyChargeByBalance({ before, after, amount: depositAmount });
    console.log(`판정: ${verification.verdict} — ${verification.reason}`);

    assertChargeSucceeded({ verification, dialogConfirmed, before, after, submitError });

    console.log('\n========== 예치금 충전 완료 ==========\n');

    return {
      amount: depositAmount,
      status: 'success',
      timestamp: new Date(),
      keypadOcrConfidence: minConfidence,
      balance: { before, after },
      verification,
      dialogConfirmed,
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

      // 실충전 전에 잔액 조회 경로(셀렉터/텍스트 스캔)를 돈 들이지 않고 검증한다
      const before = await readDepositBalance(page);
      console.log(`현재 예치금: ${formatBalance(before)}`);
      if (before === null) {
        console.log('경고: 잔액을 읽지 못했습니다. 실충전 시 잔액 대조 판정이 동작하지 않습니다.');
      }

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
        balance: { before, after: null },
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
      // 기본 판별(메시지에 'timeout'이 있으면 재시도)을 쓰면 안 된다.
      // 충전 제출 후 다이얼로그 타임아웃까지 재시도로 분류돼 중복 충전이 발생한다.
      // 충전이 확실히 미발생일 때만 retryable=true로 표시된다.
      shouldRetry: (error) => (error instanceof AppError ? error.retryable : true),
    },
  );
}
