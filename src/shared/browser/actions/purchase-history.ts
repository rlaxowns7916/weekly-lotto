/**
 * 구매 내역 조회 공통 액션
 *
 * 로또6/45와 연금복권720+ 모두 동일한 구매 내역 페이지를 사용하며,
 * 상품 코드만 다름
 */

import type { Page } from 'playwright';
import { saveErrorScreenshot } from '../context.js';
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

      // 페이지 최상단으로 스크롤 (상세 검색 버튼이 보이도록)
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500); // 렌더링 안정화

      // 상세 검색 펼치기 (최근 1주일 버튼이 상세 검색 영역 안에 있음)
      const detailBtn = page.getByRole('button', { name: '상세 검색 펼치기' });
      if (await detailBtn.isVisible().catch(() => false)) {
        await detailBtn.scrollIntoViewIfNeeded();
        await detailBtn.click({ force: true });
        await page.waitForTimeout(300); // 영역 펼쳐지는 애니메이션 대기
      }

      // 최근 1주일 버튼 클릭
      const weekBtn = page.getByRole('button', { name: '최근 1주일' });
      await weekBtn.waitFor({ state: 'visible', timeout: 10000 });
      await weekBtn.scrollIntoViewIfNeeded();
      await weekBtn.click({ force: true });

      // 복권 선택 드롭다운에서 상품 선택
      const selectBox = page.locator('#ltGdsSelect');
      await selectBox.waitFor({ state: 'attached', timeout: 10000 });
      await selectBox.selectOption(productCode);

      // 검색 버튼 클릭 + API 응답 대기
      const searchBtn = page.getByRole('button', { name: '검색', exact: true });
      await searchBtn.waitFor({ state: 'visible', timeout: 10000 });

      await Promise.all([
        page.waitForResponse(
          (resp) => resp.url().includes('selectMyLotteryledger.do') && resp.status() === 200,
          { timeout: 30000 }
        ),
        searchBtn.click(),
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
    throw error;
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
