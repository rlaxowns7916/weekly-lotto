/**
 * 로또 구매 자동화
 *
 * ol.dhlottery.co.kr 직접 접근 방식 (iframe 없음)
 * 로그인 후 구매 페이지로 직접 이동하여 구매
 */

import type { Page } from 'playwright';
import type { PurchasedTicket } from '../../domain/ticket.js';
import { purchaseSelectors } from '../selectors.js';
import { saveErrorScreenshot } from '../../../shared/browser/context.js';
import { withRetry } from '../../../shared/utils/retry.js';
import { verifyRecentPurchase } from './check-purchase.js';

/**
 * 로또 구매
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

        // === DRY RUN: 여기서 멈춤 ===
        if (dryRun) {
          console.log('🔸 DRY RUN 모드: 구매 버튼 클릭 전 멈춤');
          console.log('🔸 실제 구매를 원하면 dryRun: false로 실행하세요');
          await saveErrorScreenshot(page, 'dry-run-before-buy');
          return [];
        }

        // === 실제 구매 진행 ===
        // 4. 구매하기 버튼 클릭
        const buyBtn = page.getByRole(purchaseSelectors.buyButton.role, {
          name: purchaseSelectors.buyButton.name,
        });
        await buyBtn.waitFor({ state: 'visible', timeout: 30000 });
        console.log('구매하기 버튼 클릭...');
        await buyBtn.click();

        // 5. 구매 확인 팝업에서 확인 클릭
        const confirmPopupBtn = page
          .locator(purchaseSelectors.confirmPopup)
          .getByRole(purchaseSelectors.confirmPopupButton.role, {
            name: purchaseSelectors.confirmPopupButton.name,
          });
        await confirmPopupBtn.waitFor({ state: 'visible', timeout: 30000 });
        console.log('구매 확인 팝업 - 확인 클릭...');
        await confirmPopupBtn.click();

        // 6. 구매 완료 대기
        await page
          .locator('.selected_num_list, #closeLayer, .layer-alert')
          .first()
          .waitFor({ state: 'attached', timeout: 30000 });

        // 7. 닫기 버튼 클릭 (있으면)
        const closeBtn = page.locator(purchaseSelectors.closeButton);
        const closeVisible = await closeBtn.isVisible().catch(() => false);
        if (closeVisible) {
          await closeBtn.click();
        }

        console.log('구매 요청 완료, 구매 내역에서 검증 중...');

        // 8. 구매 내역 페이지에서 5분 이내 구매 검증
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

/**
 * 잔액 부족 여부 확인
 */
export async function checkInsufficientBalance(page: Page): Promise<boolean> {
  try {
    const errorText = await page.locator('.err_info, .alert_msg').textContent();
    return errorText?.includes('예치금') || errorText?.includes('잔액') || false;
  } catch {
    return false;
  }
}
