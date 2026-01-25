/**
 * 로또 구매 자동화
 *
 * ol.dhlottery.co.kr 직접 접근 방식 (iframe 없음)
 * 로그인 후 구매 페이지로 직접 이동하여 구매
 *
 * 중복 구매 방지를 위한 "선검증 후구매" 패턴:
 * 1. 구매 시도 전에 먼저 최근 구매 여부 확인
 * 2. 구매 실행 (retry 시에도 먼저 구매 여부 재확인)
 * 3. 구매 후 최종 검증
 */

import type { Page } from 'playwright';
import type { PurchasedTicket } from '../../domain/ticket.js';
import { purchaseSelectors } from '../selectors.js';
import { saveErrorScreenshot } from '../../../shared/browser/context.js';
import { withRetry } from '../../../shared/utils/retry.js';
import { verifyRecentPurchase, checkRecentPurchase } from './check-purchase.js';

/**
 * 구매 액션만 수행 (검증 없이)
 *
 * 구매 페이지 이동 → 자동번호발급 → 확인 → 구매하기 → 확인 팝업
 * retry 로직 없이 단일 실행만 수행
 *
 * @param page Playwright Page 인스턴스 (로그인된 상태)
 * @throws {Error} 구매 실패 시
 */
async function executePurchase(page: Page): Promise<void> {
  // 1. 구매 페이지로 직접 이동 (ol.dhlottery.co.kr)
  console.log('구매 페이지로 이동 중...');
  await page.goto(purchaseSelectors.purchaseUrl, { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
  console.log(`페이지 로드 완료 - URL: ${page.url()}`);

  // 알림 팝업이 있으면 닫기 (예: 판매시간 안내 등)
  await dismissAlertPopup(page);

  // 2. 자동번호발급 링크 클릭 → 번호 생성 팝업 대기
  const autoNumberLink = page.getByRole(purchaseSelectors.autoNumberLink.role, {
    name: purchaseSelectors.autoNumberLink.name,
  });
  await autoNumberLink.waitFor({ state: 'visible', timeout: 30000 });
  console.log('자동번호발급 클릭...');
  await autoNumberLink.click();

  // 3. 확인 버튼 클릭 (번호 생성 완료 후 나타남) → A슬롯에 번호 추가됨
  const confirmBtn = page.getByRole(purchaseSelectors.confirmButton.role, {
    name: purchaseSelectors.confirmButton.name,
  });
  await confirmBtn.waitFor({ state: 'visible', timeout: 30000 });
  console.log('확인 버튼 클릭...');
  await confirmBtn.click();

  // A슬롯에 번호가 추가될 때까지 대기 (구매하기 버튼 활성화 조건)
  await page.locator('.slot_num .num').first().waitFor({ state: 'visible', timeout: 10000 });
  console.log('A슬롯 번호 추가됨');

  // 4. 구매하기 버튼 클릭 → 구매 확인 팝업 표시
  const buyBtn = page.getByRole(purchaseSelectors.buyButton.role, {
    name: purchaseSelectors.buyButton.name,
  });
  await buyBtn.waitFor({ state: 'visible', timeout: 30000 });
  console.log('구매하기 버튼 클릭...');
  await buyBtn.click();

  // 5. 구매 확인 팝업에서 확인 클릭 + 구매 API 응답 대기
  const confirmPopup = page.locator(purchaseSelectors.confirmPopup);
  await confirmPopup.waitFor({ state: 'visible', timeout: 30000 });

  const confirmPopupBtn = confirmPopup.getByRole(purchaseSelectors.confirmPopupButton.role, {
    name: purchaseSelectors.confirmPopupButton.name,
  });
  await confirmPopupBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log('구매 확인 팝업 표시됨');

  // 구매 직전 스크린샷 (디버깅용)
  await saveErrorScreenshot(page, 'before-purchase-confirm');

  // 구매 API 응답 리스너 등록 후 클릭
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('gameBuy.do'),
    { timeout: 30000 }
  );

  console.log('구매 확인 버튼 클릭...');
  await confirmPopupBtn.click();

  // 구매 API 응답 대기
  const purchaseResponse = await responsePromise.catch((e) => {
    console.error('구매 API 응답 대기 실패:', e.message);
    return null;
  });

  if (purchaseResponse) {
    const responseText = await purchaseResponse.text().catch(() => '');
    console.log(`구매 API 응답: ${responseText.substring(0, 200)}`);
  } else {
    console.warn('구매 API 호출이 감지되지 않음');
    await saveErrorScreenshot(page, 'no-purchase-api');
  }

  // 결과 스크린샷
  await saveErrorScreenshot(page, 'after-purchase-confirm');

  // 6. 구매 완료 레이어 확인 (#closeLayer 버튼이 있는 결과 팝업)
  const closeBtn = page.locator('#closeLayer');
  const hasCloseBtn = await closeBtn.isVisible().catch(() => false);
  console.log(`구매 완료 레이어 표시: ${hasCloseBtn}`);

  // 에러 팝업 확인 (.layer-alert에 에러 메시지가 있는지)
  const errorAlert = page.locator('.layer-alert');
  if (await errorAlert.isVisible().catch(() => false)) {
    const errorMessage = await errorAlert.textContent().catch(() => '');
    const cleanMessage = errorMessage?.replace(/\s+/g, ' ').trim() || '알 수 없는 오류';

    // 에러 메시지 확인
    if (
      cleanMessage.includes('예치금') ||
      cleanMessage.includes('잔액') ||
      cleanMessage.includes('세션') ||
      cleanMessage.includes('로그인') ||
      cleanMessage.includes('실패') ||
      cleanMessage.includes('오류')
    ) {
      console.error(`구매 실패 팝업: ${cleanMessage}`);
      throw new Error(`구매 실패: ${cleanMessage}`);
    }
    console.log(`알림 팝업 내용: ${cleanMessage}`);
  }

  // 7. 닫기 버튼 클릭 (구매 결과 팝업이 있으면)
  if (hasCloseBtn) {
    await closeBtn.click();
    console.log('구매 결과 팝업 닫기 완료');
  } else {
    console.warn('구매 결과 팝업이 표시되지 않음 - 구매 실패 가능성');
  }

  console.log('구매 요청 완료');
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
 * @param dryRun true면 구매 버튼 클릭 전에 멈춤 (기본값: true)
 * @returns 구매한 티켓 목록 (dryRun이면 빈 배열)
 * @throws {Error} 실패 시
 */
export async function purchaseLotto(
  page: Page,
  dryRun: boolean = true
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
    // 참고: 구매 성공 후 검증 실패로 retry 시 중복 구매 가능성 있음
    // → executePurchase 내부에서 구매 API 응답으로 성공 여부 확인
    await withRetry(
      async () => {
        await executePurchase(page);
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000,
        maxDelayMs: 15000,
      }
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
 * 구매 버튼 클릭 전까지만 진행하고 멈춤
 */
async function executeDryRun(page: Page): Promise<PurchasedTicket[]> {
  return await withRetry(
    async () => {
      try {
        // 1. 구매 페이지로 직접 이동 (ol.dhlottery.co.kr)
        console.log('구매 페이지로 이동 중...');
        await page.goto(purchaseSelectors.purchaseUrl, { timeout: 60000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
        console.log(`페이지 로드 완료 - URL: ${page.url()}`);

        // 알림 팝업이 있으면 닫기 (예: 판매시간 안내 등)
        await dismissAlertPopup(page);

        // 2. 자동번호발급 링크 클릭
        const autoNumberLink = page.getByRole(purchaseSelectors.autoNumberLink.role, {
          name: purchaseSelectors.autoNumberLink.name,
        });
        await autoNumberLink.waitFor({ state: 'visible', timeout: 30000 });
        console.log('자동번호발급 클릭...');
        await autoNumberLink.click();

        // 3. 확인 버튼 클릭 (슬롯 추가)
        const confirmBtn = page.getByRole(purchaseSelectors.confirmButton.role, {
          name: purchaseSelectors.confirmButton.name,
        });
        await confirmBtn.waitFor({ state: 'visible', timeout: 30000 });
        console.log('확인 버튼 클릭...');
        await confirmBtn.click();

        console.log('🔸 DRY RUN 모드: 구매 버튼 클릭 전 멈춤');
        console.log('🔸 실제 구매를 원하면 dryRun: false로 실행하세요');
        await saveErrorScreenshot(page, 'dry-run-before-buy');
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
    }
  );
}

/**
 * 알림 팝업 닫기 (#popupLayerAlert)
 * 판매시간 안내 등 다양한 알림이 표시될 수 있음
 */
async function dismissAlertPopup(page: Page): Promise<void> {
  try {
    const popup = page.locator('#popupLayerAlert');
    const isVisible = await popup.isVisible().catch(() => false);

    if (isVisible) {
      // 팝업 메시지 로깅
      const message = await popup.locator('.layer-message').textContent().catch(() => '');
      console.log(`알림 팝업 발견: ${message?.trim() || '(메시지 없음)'}`);

      // 확인 버튼 클릭하여 닫기
      const confirmBtn = popup.locator('input.confirm, button.confirm');
      await confirmBtn.click({ timeout: 5000 });
      console.log('알림 팝업 닫음');

      // 팝업이 닫힐 때까지 대기
      await popup.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  } catch (error) {
    console.log('알림 팝업 처리 중 오류 (무시):', error);
  }
}
