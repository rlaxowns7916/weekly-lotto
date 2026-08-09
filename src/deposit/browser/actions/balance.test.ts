import { describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright';
import { readDepositBalance } from './balance.js';
import { depositSelectors } from '../selectors.js';

interface PageMockOptions {
  /** 셀렉터별 textContent 응답. 없는 키는 요소 미존재로 취급한다 */
  elementText?: Record<string, string>;
  /** 페이지 본문 전체 텍스트 */
  bodyText?: string;
  /** 페이지 컨텍스트가 끊겨 모든 조회가 예외를 던지는 상황 */
  pageBroken?: boolean;
}

function createPageMock(options: PageMockOptions = {}) {
  const textContentCalls: string[] = [];

  const locatorMock = vi.fn((selector: string) => ({
    first() {
      return this;
    },
    textContent: vi.fn(async () => {
      if (options.pageBroken) {
        throw new Error('Execution context was destroyed');
      }
      textContentCalls.push(selector);
      const text = options.elementText?.[selector];
      if (text === undefined) {
        throw new Error(`Timeout: locator("${selector}") not found`);
      }
      return text;
    }),
    innerText: vi.fn(async () => {
      if (options.pageBroken) {
        throw new Error('Execution context was destroyed');
      }
      if (options.bodyText === undefined) {
        throw new Error('Timeout: body not found');
      }
      return options.bodyText;
    }),
  }));

  const page = { locator: locatorMock } as unknown as Page;

  return { page, textContentCalls };
}

describe('deposit/browser/actions/balance', () => {
  it('reads the balance from a candidate selector', async () => {
    const [firstCandidate] = depositSelectors.balanceCandidates;
    const { page } = createPageMock({ elementText: { [firstCandidate]: '47,000원' } });

    await expect(readDepositBalance(page)).resolves.toBe(47000);
  });

  it('falls through to the next candidate when the first is missing', async () => {
    const [, secondCandidate] = depositSelectors.balanceCandidates;
    const { page, textContentCalls } = createPageMock({
      elementText: { [secondCandidate]: '12,000원' },
    });

    await expect(readDepositBalance(page)).resolves.toBe(12000);
    expect(textContentCalls).toContain(secondCandidate);
  });

  // 실측하지 못한 후보 셀렉터가 모두 빗나가도 본문 텍스트로 잔액을 복구해야 한다.
  it('falls back to scanning the page body text', async () => {
    const { page } = createPageMock({
      bodyText: '충전금액 5,000원 10,000원 현재 예치금 88,000원',
    });

    await expect(readDepositBalance(page)).resolves.toBe(88000);
  });

  it('returns null when neither selectors nor body text yield a balance', async () => {
    const { page } = createPageMock({ bodyText: '예치금 충전이 완료되었습니다.' });

    await expect(readDepositBalance(page)).resolves.toBeNull();
  });

  // 이 함수가 던지면 비밀번호 제출 이후 raw 타임아웃이 재시도로 흘러가
  // 중복 충전이 발생한다. 어떤 경우에도 예외를 밖으로 내보내면 안 된다.
  it('returns null instead of throwing when the page context is broken', async () => {
    const { page } = createPageMock({ pageBroken: true });

    await expect(readDepositBalance(page)).resolves.toBeNull();
  });
});
