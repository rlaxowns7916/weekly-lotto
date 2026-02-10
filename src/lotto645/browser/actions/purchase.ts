/**
 * 로또 구매 자동화
 *
 * 모바일 UI (ol.dhlottery.co.kr) 직접 접근 방식
 * 로그인 후 구매 페이지로 직접 이동하여 구매
 */

import type { Page } from 'playwright';
import type { PurchasedTicket } from '../../domain/ticket.js';
import { purchaseSelectors } from '../selectors.js';
import { saveErrorScreenshot } from '../../../shared/browser/context.js';
import { withRetry } from '../../../shared/utils/retry.js';
import { verifyRecentPurchase, checkRecentPurchase } from './check-purchase.js';

/**
 * 구매 액션 수행 (실제 구매)
 *
 * 구매 페이지 이동 → 자동 1매 추가 → 구매하기 → 확인 팝업에서 확인 클릭
 */
async function executePurchase(page: Page): Promise<void> {
  console.log('\n========== 구매 실행 시작 ==========');

  // 1. 구매 페이지로 이동
  console.log('구매 페이지로 이동 중...');
  await page.goto(purchaseSelectors.purchaseUrl, { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
  console.log(`페이지 로드 완료 - URL: ${page.url()}`);

  // 2. 자동 1매 추가 버튼 클릭
  const autoNumberButton = page.locator(purchaseSelectors.autoNumberButton.selector);
  await autoNumberButton.waitFor({ state: 'visible', timeout: 30000 });
  console.log('자동 1매 추가 버튼 클릭...');
  await autoNumberButton.click();
  await page.waitForTimeout(1000);
  console.log('번호 선택 완료');

  // 3. 구매하기 버튼 클릭
  const buyBtn = page.locator(purchaseSelectors.buyButton.selector);
  await buyBtn.waitFor({ state: 'visible', timeout: 30000 });
  console.log('구매하기 버튼 클릭...');
  await buyBtn.click();

  // 4. 구매 확인 팝업 대기
  const confirmPopup = page.locator(purchaseSelectors.confirmPopup);
  await confirmPopup.waitFor({ state: 'visible', timeout: 30000 });
  console.log('구매 확인 팝업 표시됨');

  // 5. 확인 버튼 클릭 + 구매 API 응답 대기
  const confirmBtn = confirmPopup.locator(purchaseSelectors.confirmPopupButton.selector);
  await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });

  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('execBuy.do'),
    { timeout: 30000 },
  );

  console.log('구매 확인 버튼 클릭...');
  await confirmBtn.click();

  const purchaseResponse = await responsePromise;
  console.log(`구매 API 응답: ${purchaseResponse.status()} ${purchaseResponse.url()}`);

  console.log('\n========== 구매 요청 완료 ==========\n');
}

/**
 * 로또 구매 (중복 구매 방지 패턴 적용)
 *
 * "선검증 후구매" 패턴:
 * 1. 구매 시도 전에 먼저 최근 구매 여부 확인 → 있으면 스킵
 * 2. 구매 실행 (retry 전에도 매번 구매 여부 재확인)
 * 3. 구매 후 최종 검증
 *
 * @param page Playwright Page 인스턴스 (로그인된 상태)
 * @param dryRun true면 구매 확인 팝업에서 취소 (기본값: true)
 * @returns 구매한 티켓 목록 (dryRun이면 빈 배열)
 * @throws {Error} 실패 시
 */
export async function purchaseLotto(
  page: Page,
  dryRun: boolean = true,
): Promise<PurchasedTicket[]> {
  // === DRY RUN 모드 ===
  if (dryRun) {
    return await executeDryRun(page);
  }

  // === 실제 구매 진행 ===
  try {
    // 1. 먼저 최근 구매 확인 (이미 구매된 경우 스킵)
    console.log('최근 구매 여부 확인 중...');
    const existingTicket = await checkRecentPurchase(page, 5);
    if (existingTicket) {
      console.log('이미 최근 5분 내 구매된 티켓 발견, 구매 스킵');
      console.log(`  회차: ${existingTicket.round}회`);
      console.log(`  슬롯: ${existingTicket.slot} (${existingTicket.mode === 'auto' ? '자동' : '수동'})`);
      console.log(`  번호: ${existingTicket.numbers.join(', ')}`);
      return [existingTicket];
    }
    console.log('최근 구매 내역 없음, 구매 진행');

    // 2. 구매 실행 (retry 포함)
    await withRetry(
      async () => {
        await executePurchase(page);
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000,
        maxDelayMs: 15000,
      },
    );

    // 3. 최종 검증
    console.log('구매 내역에서 검증 중...');
    const verifiedTicket = await verifyRecentPurchase(page, 5);

    if (!verifiedTicket) {
      throw new Error('구매 검증 실패: 5분 이내 구매 내역을 찾을 수 없습니다');
    }

    console.log(`로또 구매 검증 완료!`);
    console.log(`  회차: ${verifiedTicket.round}회`);
    console.log(`  슬롯: ${verifiedTicket.slot} (${verifiedTicket.mode === 'auto' ? '자동' : '수동'})`);
    console.log(`  번호: ${verifiedTicket.numbers.join(', ')}`);

    return [verifiedTicket];
  } catch (error) {
    await saveErrorScreenshot(page, 'purchase-error');
    throw error;
  }
}

/**
 * DRY RUN 모드 실행
 *
 * 구매하기 버튼 클릭 → 확인 팝업에서 취소 클릭 (실제 구매 안함)
 */
async function executeDryRun(page: Page): Promise<PurchasedTicket[]> {
  return await withRetry(
    async () => {
      try {
        // 1. 구매 페이지로 이동
        console.log('구매 페이지로 이동 중...');
        await page.goto(purchaseSelectors.purchaseUrl, { timeout: 60000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
        console.log(`페이지 로드 완료 - URL: ${page.url()}`);

        // 2. 자동 1매 추가 버튼 클릭
        const autoNumberButton = page.locator(purchaseSelectors.autoNumberButton.selector);
        await autoNumberButton.waitFor({ state: 'visible', timeout: 30000 });
        console.log('자동 1매 추가 버튼 클릭...');
        await autoNumberButton.click();
        await page.waitForTimeout(1000);
        console.log('번호 선택 완료');

        // 3. 구매하기 버튼 클릭
        const buyBtn = page.locator(purchaseSelectors.buyButton.selector);
        await buyBtn.waitFor({ state: 'visible', timeout: 30000 });
        console.log('구매하기 버튼 클릭...');
        await buyBtn.click();

        // 4. 구매 확인 팝업 대기
        const confirmPopup = page.locator(purchaseSelectors.confirmPopup);
        await confirmPopup.waitFor({ state: 'visible', timeout: 30000 });
        console.log('구매 확인 팝업 표시됨');

        // 5. 취소 버튼 클릭 (DRY RUN - 실제 구매 안함)
        const cancelBtn = confirmPopup.locator(purchaseSelectors.cancelPopupButton.selector);
        await cancelBtn.waitFor({ state: 'visible', timeout: 10000 });
        console.log('DRY RUN: 취소 버튼 클릭...');
        await cancelBtn.click();

        // 팝업이 닫힐 때까지 대기
        await confirmPopup.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

        console.log('DRY RUN 완료: 구매 확인 팝업까지 정상 동작');
        console.log('실제 구매를 원하면 DRY_RUN=false로 실행하세요');
        return [];
      } catch (error) {
        await saveErrorScreenshot(page, 'dry-run-error');
        throw error;
      }
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 15000,
    },
  );
}
