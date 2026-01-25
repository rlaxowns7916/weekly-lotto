/**
 * 로또 구매 자동화
 *
 * Playwright codegen 기반으로 작성됨
 * 주의: 로또6/45 버튼 클릭 시 새 팝업이 열리고, 팝업 내 iframe에서 구매 진행
 */

import type { Page, FrameLocator } from 'playwright';
import type { PurchasedTicket, TicketSlot } from '../../domain/ticket.js';
import { purchaseSelectors } from '../selectors.js';
import { saveErrorScreenshot } from '../context.js';
import { withRetry } from '../../utils/retry.js';

/**
 * 로또 구매 준비 (구매 직전까지만 진행)
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
  let purchasePage: Page | null = null;

  return await withRetry(
    async () => {
      try {
        // 같은 컨텍스트에서 새 페이지 생성 (쿠키/세션 공유)
        // headless 환경에서 팝업이 안정적으로 동작하지 않아 직접 페이지 생성 방식 사용
        const context = page.context();
        purchasePage = await context.newPage();

        // 구매 페이지로 직접 이동
        console.log(`구매 페이지로 이동: ${purchaseSelectors.purchaseUrl}`);
        await purchasePage.goto(purchaseSelectors.purchaseUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        console.log(`페이지 로드 완료 - URL: ${purchasePage.url()}`);

        // iframe이 존재하는지 먼저 확인
        const iframeLocator = purchasePage.locator(`iframe[name="${purchaseSelectors.iframeName}"]`);
        console.log('iframe 대기 중...');
        await iframeLocator.waitFor({ state: 'attached', timeout: 60000 });
        console.log('iframe 발견');

        // iframe 내용이 로드될 때까지 대기
        const iframe = iframeLocator.contentFrame();

        // 자동번호발급 링크가 보일 때까지 대기
        const autoNumberLink = iframe.getByRole(purchaseSelectors.autoNumberLink.role, {
          name: purchaseSelectors.autoNumberLink.name,
        });
        await autoNumberLink.waitFor({ state: 'visible', timeout: 60000 });

        // 자동번호발급 링크 클릭
        await autoNumberLink.click();

        // 확인 버튼이 보일 때까지 대기 후 클릭 (슬롯 추가)
        const confirmBtn = iframe.getByRole(purchaseSelectors.confirmButton.role, {
          name: purchaseSelectors.confirmButton.name,
        });
        await confirmBtn.waitFor({ state: 'visible', timeout: 30000 });
        await confirmBtn.click();

        // === DRY RUN: 여기서 멈춤 ===
        if (dryRun) {
          console.log('🔸 DRY RUN 모드: 구매 버튼 클릭 전 멈춤');
          console.log('🔸 실제 구매를 원하면 dryRun: false로 실행하세요');

          // 스크린샷 저장 (확인용)
          await saveErrorScreenshot(purchasePage, 'dry-run-before-buy');

          // 팝업 닫기
          await purchasePage.close();

          return [];
        }

        // === 실제 구매 진행 ===
        // 구매하기 버튼 대기 후 클릭
        const buyBtn = iframe.getByRole(purchaseSelectors.buyButton.role, {
          name: purchaseSelectors.buyButton.name,
        });
        await buyBtn.waitFor({ state: 'visible', timeout: 30000 });
        await buyBtn.click();

        // 구매 확인 팝업에서 확인 클릭
        const confirmPopupBtn = iframe.locator(purchaseSelectors.confirmPopup)
          .getByRole(purchaseSelectors.confirmPopupButton.role, {
            name: purchaseSelectors.confirmPopupButton.name,
          });
        await confirmPopupBtn.waitFor({ state: 'visible', timeout: 30000 });
        await confirmPopupBtn.click();

        // 구매 완료 대기: 결과 영역이 나타날 때까지
        await iframe.locator('.selected_num_list, #closeLayer').first().waitFor({ state: 'attached', timeout: 30000 });

        // 구매 결과 파싱 (구매 완료 화면에서)
        const tickets = await parsePurchasedTickets(iframe);

        // 결과 출력
        console.log(`로또 구매 완료: ${tickets.length}장`);
        for (const ticket of tickets) {
          if (ticket.numbers.length > 0) {
            console.log(`  슬롯 ${ticket.slot}: ${ticket.numbers.join(', ')}`);
          }
        }

        // 닫기 버튼 클릭
        const closeBtn = iframe.locator(purchaseSelectors.closeButton);
        await closeBtn.waitFor({ state: 'visible', timeout: 10000 });
        await closeBtn.click();

        // 팝업 닫기
        await purchasePage.close();

        return tickets;
      } catch (error) {
        if (purchasePage) {
          await saveErrorScreenshot(purchasePage, 'purchase-error');
          await purchasePage.close();
        } else {
          await saveErrorScreenshot(page, 'purchase-error');
        }
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
 *
 * TODO: 실제 구매 결과 화면 구조에 맞게 구현 필요
 * 현재는 기본 5장 자동 구매로 가정
 */
async function parsePurchasedTickets(container: Page | FrameLocator): Promise<PurchasedTicket[]> {
  const tickets: PurchasedTicket[] = [];
  const slots: TicketSlot[] = ['A', 'B', 'C', 'D', 'E'];

  try {
    // 구매 결과 영역에서 번호 추출 시도
    // 실제 사이트 구조에 따라 셀렉터 수정 필요
    const resultRows = container.locator('.selected_num_list .selected_num');
    const count = await resultRows.count();

    for (let i = 0; i < count && i < 5; i++) {
      const row = resultRows.nth(i);
      const numbersText = await row.textContent();

      if (numbersText) {
        // 번호 파싱 (예: "01 05 12 23 34 45" 형식)
        const numbers = numbersText
          .trim()
          .split(/\s+/)
          .map((n) => parseInt(n, 10))
          .filter((n) => !isNaN(n) && n >= 1 && n <= 45);

        if (numbers.length === 6) {
          tickets.push({
            round: 0, // 회차는 별도 파싱 필요
            slot: slots[i]!,
            numbers,
            mode: 'auto',
          });
        }
      }
    }

    // 파싱 실패 시 기본값 (1장 구매 가정)
    if (tickets.length === 0) {
      console.warn('구매 결과 파싱 실패, 기본값 사용 (1장)');
      tickets.push({
        round: 0,
        slot: 'A',
        numbers: [], // 번호는 이메일에서 확인
        mode: 'auto',
      });
    }
  } catch (parseError) {
    console.warn('구매 결과 파싱 중 오류:', parseError);
    // 파싱 실패해도 구매는 완료된 것으로 처리 (1장)
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
export async function checkInsufficientBalance(iframe: FrameLocator): Promise<boolean> {
  try {
    const errorText = await iframe.locator('.err_info, .alert_msg').textContent();
    return errorText?.includes('예치금') || errorText?.includes('잔액') || false;
  } catch {
    return false;
  }
}
