import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright';
import { depositSelectors } from '../selectors.js';
import type { ChargeResult } from '../../domain/charge.js';

const {
  getConfigMock,
  saveErrorScreenshotMock,
  recognizeKeypadMock,
  inputPasswordMock,
  disposeMock,
  readDepositBalanceMock,
} = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
  saveErrorScreenshotMock: vi.fn(),
  recognizeKeypadMock: vi.fn(),
  inputPasswordMock: vi.fn(),
  disposeMock: vi.fn(),
  readDepositBalanceMock: vi.fn(),
}));

vi.mock('../../../shared/config/index.js', () => ({ getConfig: getConfigMock }));
vi.mock('../../../shared/browser/context.js', () => ({
  saveErrorScreenshot: saveErrorScreenshotMock,
}));
vi.mock('./balance.js', () => ({ readDepositBalance: readDepositBalanceMock }));
vi.mock('./keypad.js', () => ({
  TesseractKeypadRecognizer: class {
    dispose = disposeMock;
  },
  recognizeKeypad: recognizeKeypadMock,
  inputPassword: inputPasswordMock,
}));

import { chargeDeposit } from './charge.js';

const CHARGE_AMOUNT = 20000;

function timeoutError(message: string): Error {
  const error = new Error(message);
  error.name = 'TimeoutError';
  return error;
}

interface PageMockOptions {
  /** 충전 완료 다이얼로그가 끝내 표시되지 않음 (결과 알 수 없음) */
  dialogTimesOut?: boolean;
}

function createPageMock(options: PageMockOptions = {}) {
  const page = {
    goto: vi.fn(async () => {}),
    reload: vi.fn(async () => {}),
    waitForTimeout: vi.fn(async () => {}),
    url: () => depositSelectors.chargePageUrl,
    locator: vi.fn((selector: string) => ({
      first() {
        return this;
      },
      selectOption: vi.fn(async () => {}),
      click: vi.fn(async () => {}),
      waitFor: vi.fn(async () => {
        if (options.dialogTimesOut && selector === depositSelectors.chargeCompleteDialog) {
          throw timeoutError(
            `Timeout 60000ms exceeded waiting for locator("${selector}") to be visible`
          );
        }
      }),
    })),
  } as unknown as Page;

  return page;
}

interface SettledCharge {
  ok: boolean;
  result?: ChargeResult;
  error?: unknown;
}

/** withRetry의 백오프 대기를 건너뛰며 충전을 끝까지 실행한다 */
async function runChargeSkippingBackoff(page: Page): Promise<SettledCharge> {
  vi.useFakeTimers();
  try {
    const settled: Promise<SettledCharge> = chargeDeposit(page, false).then(
      (result) => ({ ok: true, result }),
      (error: unknown) => ({ ok: false, error })
    );
    await vi.runAllTimersAsync();
    return await settled;
  } finally {
    vi.useRealTimers();
  }
}

describe('deposit/browser/actions/charge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockReturnValue({ depositPassword: '123456', depositAmount: CHARGE_AMOUNT });
    saveErrorScreenshotMock.mockResolvedValue(null);
    disposeMock.mockResolvedValue(undefined);
    inputPasswordMock.mockResolvedValue(undefined);
    recognizeKeypadMock.mockResolvedValue(
      Object.fromEntries(
        Array.from({ length: 10 }, (_, digit) => [digit, { coords: [0, 0], confidence: 0.9 }])
      )
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // DRY_RUN이 잔액을 읽지 않으면 실충전 전에 셀렉터를 검증할 방법이 없다.
  // 돈을 쓰지 않고 잔액 조회 경로를 확인할 수 있어야 한다.
  it('reads and reports the balance in dry run without submitting a charge', async () => {
    readDepositBalanceMock.mockResolvedValue(47000);

    const result = await chargeDeposit(createPageMock(), true);

    expect(result.status).toBe('dry_run');
    expect(result.balance).toEqual({ before: 47000, after: null });
    expect(inputPasswordMock).not.toHaveBeenCalled();
  });

  it('still completes dry run when the balance cannot be read', async () => {
    readDepositBalanceMock.mockResolvedValue(null);

    const result = await chargeDeposit(createPageMock(), true);

    expect(result.status).toBe('dry_run');
    expect(result.balance).toEqual({ before: null, after: null });
  });

  // 이 테스트가 이번 변경의 핵심이다. 다이얼로그 타임아웃만 보고 실패로 단정하면
  // 이미 빠져나간 돈을 놓치고, 재시도까지 하면 중복 충전이 된다.
  it('reports success when the dialog times out but the balance grew by the charge amount', async () => {
    readDepositBalanceMock.mockResolvedValueOnce(10000).mockResolvedValueOnce(30000);

    const settled = await runChargeSkippingBackoff(createPageMock({ dialogTimesOut: true }));

    expect(settled.ok).toBe(true);
    expect(settled.result?.status).toBe('success');
    expect(settled.result?.balance).toEqual({ before: 10000, after: 30000 });
    expect(settled.result?.verification?.verdict).toBe('charged');
    // 중복 충전 방지: 비밀번호는 단 한 번만 제출되어야 한다
    expect(inputPasswordMock).toHaveBeenCalledTimes(1);
  });

  // 잔액이 그대로면 충전은 확실히 미발생이므로 재시도해도 안전하다.
  it('retries when the balance is unchanged, then succeeds once the balance grows', async () => {
    readDepositBalanceMock
      .mockResolvedValueOnce(10000)
      .mockResolvedValueOnce(10000)
      .mockResolvedValueOnce(10000)
      .mockResolvedValueOnce(30000);

    const settled = await runChargeSkippingBackoff(createPageMock({ dialogTimesOut: true }));

    expect(settled.ok).toBe(true);
    expect(settled.result?.status).toBe('success');
    expect(inputPasswordMock).toHaveBeenCalledTimes(2);
  });

  // 판정 불가 상태에서 재시도하면 중복 충전 위험이 있으므로 즉시 멈춘다.
  it('fails without retrying when the outcome cannot be verified', async () => {
    readDepositBalanceMock.mockResolvedValue(null);

    const settled = await runChargeSkippingBackoff(createPageMock({ dialogTimesOut: true }));

    expect(settled.ok).toBe(false);
    expect((settled.error as { code?: string }).code).toBe('DEPOSIT_VERIFICATION_FAILED');
    expect((settled.error as { retryable?: boolean }).retryable).toBe(false);
    expect(inputPasswordMock).toHaveBeenCalledTimes(1);
  });

  // 잔액 셀렉터가 실제 사이트에서 빗나가도, 다이얼로그가 확인되면 기존처럼 성공해야 한다.
  it('reports success on a confirmed dialog even when the balance is unreadable', async () => {
    readDepositBalanceMock.mockResolvedValue(null);

    const settled = await runChargeSkippingBackoff(createPageMock());

    expect(settled.ok).toBe(true);
    expect(settled.result?.status).toBe('success');
    expect(settled.result?.verification?.verdict).toBe('unknown');
  });

  it('records the balance snapshot on a fully verified charge', async () => {
    readDepositBalanceMock.mockResolvedValueOnce(10000).mockResolvedValueOnce(30000);

    const settled = await runChargeSkippingBackoff(createPageMock());

    expect(settled.ok).toBe(true);
    expect(settled.result?.balance).toEqual({ before: 10000, after: 30000 });
    expect(settled.result?.verification?.verdict).toBe('charged');
  });

  // 6자리 입력이 끝나면 NProtect가 자동 제출한다. 마지막 탭에서 오류가 나도
  // 제출은 이미 됐을 수 있으므로, raw 오류를 그대로 던지면 재시도로 분류돼
  // 중복 충전이 된다. 입력 실패도 잔액으로 판정해야 한다.
  it('reports success when password input throws but the balance shows the charge landed', async () => {
    inputPasswordMock.mockRejectedValue(timeoutError('locator.tap: Timeout 30000ms exceeded'));
    readDepositBalanceMock.mockResolvedValueOnce(10000).mockResolvedValueOnce(30000);

    const settled = await runChargeSkippingBackoff(createPageMock({ dialogTimesOut: true }));

    expect(settled.ok).toBe(true);
    expect(settled.result?.status).toBe('success');
    expect(inputPasswordMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces the password input failure when the balance proves nothing was charged', async () => {
    inputPasswordMock.mockRejectedValue(timeoutError('locator.tap: Timeout 30000ms exceeded'));
    readDepositBalanceMock.mockResolvedValue(10000);

    const settled = await runChargeSkippingBackoff(createPageMock({ dialogTimesOut: true }));

    expect(settled.ok).toBe(false);
    expect((settled.error as { code?: string }).code).toBe('DEPOSIT_CHARGE_FAILED');
    expect((settled.error as { message?: string }).message).toContain('locator.tap');
  });

  // 다이얼로그는 완료라는데 잔액이 그대로면 어느 쪽도 믿을 수 없다.
  // 돈이 걸린 판단이므로 재시도하지 않고 사람에게 알린다.
  it('fails without retrying when the dialog and the balance disagree', async () => {
    readDepositBalanceMock.mockResolvedValue(10000);

    const settled = await runChargeSkippingBackoff(createPageMock());

    expect(settled.ok).toBe(false);
    expect((settled.error as { code?: string }).code).toBe('DEPOSIT_VERIFICATION_FAILED');
    expect(inputPasswordMock).toHaveBeenCalledTimes(1);
  });
});
