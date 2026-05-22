/**
 * 구매 내역 조회 공통 액션
 *
 * 로또6/45와 연금복권720+ 모두 동일한 구매 내역 페이지를 사용하며,
 * 상품 코드만 다름
 */

import type { Page } from 'playwright';
import { saveErrorScreenshot } from '../context.js';
import { getErrorMessage, toAppError } from '../../utils/error.js';
import { withRetry } from '../../utils/retry.js';

/**
 * 복권 상품 코드
 */
export type LotteryProductCode = 'LO40' | 'LP72';

/**
 * 복권 상품 정보
 */
export const LOTTERY_PRODUCTS = {
  /** 로또6/45 */
  LO40: {
    code: 'LO40' as const,
    name: '로또6/45',
    modalId: '#Lotto645TicketP',
    ticketSelector: '.ticket-num-box',
  },
  /** 연금복권720+ */
  LP72: {
    code: 'LP72' as const,
    name: '연금복권720+',
    modalId: '#Pt720TicketP',
    ticketSelector: '.ticket-num-line',
  },
} as const;

export type LotteryProduct = (typeof LOTTERY_PRODUCTS)[LotteryProductCode];

/**
 * 구매내역 페이지 진입 시 노출되는 알림 팝업 셀렉터
 */
const HISTORY_POPUP_SELECTORS = [
  '.popup-wrap.on.msgPop',
  '.pop-up-wrapper.w-alert.msgPop',
];

/**
 * 페이지 진입 직후 알림 팝업이 떠 있으면 닫는다.
 * 팝업이 떠 있으면 '1주일' 버튼을 가려 visible 대기가 실패한다.
 */
async function dismissHistoryPopup(page: Page): Promise<void> {
  for (const selector of HISTORY_POPUP_SELECTORS) {
    const popup = page.locator(selector);
    const isVisible = await popup.isVisible().catch(() => false);
    if (!isVisible) continue;

    const confirmButton = popup.getByRole('button', { name: '확인' });
    if ((await confirmButton.count()) > 0) {
      await confirmButton.first().click().catch(() => {});
    } else {
      const closeButton = popup.locator('.btn-close, button:has-text("닫기"), button:has-text("확인")');
      if ((await closeButton.count()) > 0) {
        await closeButton.first().click().catch(() => {});
      } else {
        await popup.click().catch(() => {});
      }
    }

    await popup.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

/**
 * 구매 내역 페이지로 이동하고 상품 필터링
 *
 * @param page Playwright Page
 * @param productCode 복권 상품 코드 ('LO40' | 'LP72')
 * @param screenshotPrefix 에러 스크린샷 파일명 접두어
 */
export async function navigateToPurchaseHistory(
  page: Page,
  productCode: LotteryProductCode,
  screenshotPrefix: string = 'purchase-history'
): Promise<void> {
  const product = LOTTERY_PRODUCTS[productCode];

  await withRetry(
    async () => {
      // 구매내역 페이지로 직접 이동
      await page.goto('https://www.dhlottery.co.kr/mypage/mylotteryledger', { timeout: 60000 });
      await page.waitForLoadState('networkidle');

      // 알림 팝업 dismiss (1주일 버튼을 가릴 수 있음)
      await dismissHistoryPopup(page);

      // 페이지 최상단으로 스크롤
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500); // 렌더링 안정화

      // 상세 검색 토글(구 UI)이 존재하면 '펼치기' 상태일 때만 클릭.
      // 새 모바일 UI는 검색 영역이 항상 펼쳐져 있어 토글이 DOM에 없다.
      const detailBtn = page.getByRole('button', { name: /상세 검색/ });
      if ((await detailBtn.count()) > 0) {
        const first = detailBtn.first();
        if (await first.isVisible().catch(() => false)) {
          const label = (await first.textContent().catch(() => '')) ?? '';
          if (label.includes('펼치기')) {
            await first.scrollIntoViewIfNeeded();
            await first.click({ force: true });
            await page.waitForTimeout(300); // 펼침 애니메이션 대기
          }
        }
      }

      // 1주일 빠른 선택 버튼 클릭 (구 UI: "최근 1주일", 신 UI: "1주일")
      const weekBtn = page.getByRole('button', { name: /^(최근 )?1주일$/ });
      const weekFirst = weekBtn.first();
      await weekFirst.waitFor({ state: 'visible', timeout: 30000 });
      await weekFirst.scrollIntoViewIfNeeded();
      await weekFirst.click({ force: true });

      // 복권 선택 드롭다운에서 상품 선택
      const selectBox = page.locator('#ltGdsSelect');
      await selectBox.waitFor({ state: 'attached', timeout: 10000 });
      await selectBox.selectOption(productCode);

      // 검색 버튼 클릭 + API 응답 대기
      const searchBtn = page.locator('#btnSrch');
      await searchBtn.waitFor({ state: 'visible', timeout: 10000 });

      await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().includes('selectMyLotteryledger.do') && resp.status() === 200,
          { timeout: 30000 }
        ),
        searchBtn.click({ force: true }),
      ]);

      console.log(`${product.name} 구매 내역 페이지 이동 완료`);
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
    }
  ).catch(async (error) => {
    await saveErrorScreenshot(page, `${screenshotPrefix}-nav-error`);
    const message = getErrorMessage(error).toLowerCase();
    const isNetworkError =
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('net::');

    throw toAppError(error, {
      code: isNetworkError ? 'NETWORK_NAVIGATION_TIMEOUT' : 'DOM_SELECTOR_NOT_VISIBLE',
      category: isNetworkError ? 'NETWORK' : 'DOM',
      retryable: isNetworkError,
    });
  });
}

/**
 * 바코드 요소 목록 조회
 *
 * @param page Playwright Page
 * @returns 바코드 요소 Locator
 */
export function getBarcodeElements(page: Page) {
  return page.locator('span.whl-txt.barcd');
}
