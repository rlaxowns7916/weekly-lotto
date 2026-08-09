/**
 * 예치금 잔액 조회 액션
 *
 * 충전 전/후 잔액을 비교해 충전 발생 여부를 판정하기 위한 읽기 전용 액션이다.
 *
 * 이 모듈의 함수는 어떤 경우에도 예외를 던지지 않는다. 비밀번호 제출 이후
 * 호출되는데, 여기서 raw 타임아웃이 새어 나가면 상위 `withRetry`가 이를
 * 재시도 가능한 오류로 보고 충전 전체를 다시 실행해 중복 충전이 발생한다.
 */

import type { Page } from 'playwright';
import { depositSelectors } from '../selectors.js';
import { parseAmountText, parseBalanceText } from '../../domain/balance.js';

const ELEMENT_TIMEOUT_MS = 3000;
const BODY_TIMEOUT_MS = 5000;

/**
 * 현재 페이지에서 예치금 잔액을 읽는다.
 *
 * 후보 셀렉터를 순서대로 시도하고, 모두 실패하면 본문 텍스트를 스캔한다.
 *
 * @returns 잔액(원). 어떤 경로로도 읽지 못하면 null
 */
export async function readDepositBalance(page: Page): Promise<number | null> {
  for (const selector of depositSelectors.balanceCandidates) {
    const text = await page
      .locator(selector)
      .first()
      .textContent({ timeout: ELEMENT_TIMEOUT_MS })
      .catch(() => null);

    if (!text) {
      continue;
    }

    // 라벨이 함께 담긴 엘리먼트와 금액만 담긴 엘리먼트를 모두 지원한다
    const amount = parseBalanceText(text) ?? parseAmountText(text);
    if (amount !== null) {
      return amount;
    }
  }

  const bodyText = await page
    .locator('body')
    .innerText({ timeout: BODY_TIMEOUT_MS })
    .catch(() => null);

  return bodyText ? parseBalanceText(bodyText) : null;
}
