/**
 * 로또 구매 자동화
 *
 * ol.dhlottery.co.kr 직접 접근 방식 (iframe 없음)
 * 로그인 후 구매 페이지로 직접 이동하여 구매
 */

import type { Page } from 'playwright';
import type { PurchasedTicket, TicketSlot } from '../../domain/ticket.js';
import { purchaseSelectors } from '../selectors.js';
import { saveErrorScreenshot } from '../../../shared/browser/context.js';
import { withRetry } from '../../../shared/utils/retry.js';

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
          .locator('.selected_num_list, #closeLayer')
          .first()
          .waitFor({ state: 'attached', timeout: 30000 });

        // 7. 구매 결과 파싱
        const tickets = await parsePurchasedTickets(page);

        console.log(`로또 구매 완료: ${tickets.length}장`);
        for (const ticket of tickets) {
          if (ticket.numbers.length > 0) {
            console.log(`  슬롯 ${ticket.slot}: ${ticket.numbers.join(', ')}`);
          }
        }

        // 8. 닫기 버튼 클릭
        const closeBtn = page.locator(purchaseSelectors.closeButton);
        const closeVisible = await closeBtn.isVisible().catch(() => false);
        if (closeVisible) {
          await closeBtn.click();
        }

        return tickets;
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
 * 구매 결과 화면에서 티켓 정보 파싱
 */
async function parsePurchasedTickets(page: Page): Promise<PurchasedTicket[]> {
  const tickets: PurchasedTicket[] = [];
  const slots: TicketSlot[] = ['A', 'B', 'C', 'D', 'E'];

  try {
    // 회차 정보 추출
    const roundText = await page.locator('text=/제\\d+회/').first().textContent();
    const roundMatch = roundText?.match(/제(\d+)회/);
    const round = roundMatch ? parseInt(roundMatch[1], 10) : 0;

    // 구매 결과 영역에서 번호 추출
    const resultRows = page.locator('.selected_num_list .selected_num');
    const count = await resultRows.count();

    for (let i = 0; i < count && i < 5; i++) {
      const row = resultRows.nth(i);
      const numbersText = await row.textContent();

      if (numbersText) {
        const numbers = numbersText
          .trim()
          .split(/\s+/)
          .map((n) => parseInt(n, 10))
          .filter((n) => !isNaN(n) && n >= 1 && n <= 45);

        if (numbers.length === 6) {
          tickets.push({
            round,
            slot: slots[i]!,
            numbers,
            mode: 'auto',
          });
        }
      }
    }

    // 파싱 실패 시 기본값
    if (tickets.length === 0) {
      console.warn('구매 결과 파싱 실패, 기본값 사용');
      tickets.push({
        round,
        slot: 'A',
        numbers: [],
        mode: 'auto',
      });
    }
  } catch (parseError) {
    console.warn('구매 결과 파싱 중 오류:', parseError);
    tickets.push({
      round: 0,
      slot: 'A',
      numbers: [],
      mode: 'auto',
    });
  }

  return tickets;
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
