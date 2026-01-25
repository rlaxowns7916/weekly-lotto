/**
 * 당첨 번호 조회 모듈
 *
 * 동행복권 메인 페이지에서 최근 회차 당첨 번호를 가져옵니다.
 */

import type { Page } from 'playwright';
import type { WinningNumbers } from '../../domain/winning.js';
import { saveErrorScreenshot } from '../context.js';
import { withRetry } from '../../utils/retry.js';

/**
 * 동행복권 메인 페이지 URL
 */
const MAIN_PAGE_URL = 'https://www.dhlottery.co.kr/main';

/**
 * 메인 페이지에서 최신 당첨 번호 조회
 *
 * 메인 페이지의 Lotto 6/45 슬라이더에서 가장 최근 회차 정보를 파싱합니다.
 *
 * @param page Playwright Page
 * @returns 당첨 번호 정보 (실패 시 null)
 */
export async function fetchLatestWinningNumbers(page: Page): Promise<WinningNumbers | null> {
  return await withRetry(
    async () => {
      // 메인 페이지로 이동
      await page.goto(MAIN_PAGE_URL, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1000);

      // 로또 6/45 슬라이더에서 active 슬라이드 찾기
      const activeSlide = page.locator('.swiper.lt645 .swiper-slide.lt645-inbox.swiper-slide-active');
      const isVisible = await activeSlide.isVisible().catch(() => false);

      if (!isVisible) {
        // active가 없으면 마지막 슬라이드 시도
        const allSlides = page.locator('.swiper.lt645 .swiper-slide.lt645-inbox');
        const count = await allSlides.count();
        if (count === 0) {
          throw new Error('당첨 번호 슬라이드를 찾을 수 없습니다');
        }
        return await parseWinningSlide(allSlides.nth(count - 1));
      }

      return await parseWinningSlide(activeSlide);
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
    }
  ).catch(async (error) => {
    await saveErrorScreenshot(page, 'fetch-winning-error');
    console.error('당첨 번호 조회 오류:', error);
    return null;
  });
}

/**
 * 특정 회차 당첨 번호 조회
 *
 * @param page Playwright Page
 * @param targetRound 회차 번호
 * @returns 당첨 번호 정보 (실패 시 null)
 */
export async function fetchWinningNumbersByRound(
  page: Page,
  targetRound: number
): Promise<WinningNumbers | null> {
  return await withRetry(
    async () => {
      // 메인 페이지로 이동
      await page.goto(MAIN_PAGE_URL, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1000);

      // 해당 회차 슬라이드 찾기 (data-ltepsd 속성으로)
      const targetSlide = page.locator(`.swiper.lt645 .swiper-slide.lt645-inbox[data-ltepsd="${targetRound}"]`);
      await targetSlide.waitFor({ state: 'visible', timeout: 10000 });

      return await parseWinningSlide(targetSlide);
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
    }
  ).catch(async (error) => {
    await saveErrorScreenshot(page, 'fetch-winning-by-round-error');
    console.error(`${targetRound}회 당첨 번호 조회 오류:`, error);
    return null;
  });
}

/**
 * 슬라이드에서 당첨 번호 파싱
 */
async function parseWinningSlide(slide: ReturnType<Page['locator']>): Promise<WinningNumbers | null> {
  try {
    // 회차 추출 (예: "1207회")
    const roundText = await slide.locator('.lt645-round').textContent();
    const roundMatch = roundText?.match(/(\d+)/);
    const round = roundMatch ? parseInt(roundMatch[1], 10) : 0;

    if (round === 0) {
      console.warn('회차 정보를 파싱할 수 없습니다');
      return null;
    }

    // 날짜 추출 (예: "2026.01.17")
    const dateText = await slide.locator('.lt645-date').textContent();
    const drawDate = dateText ? parseDrawDate(dateText.trim()) : new Date();

    // 번호 추출 (.lt-ball 요소들)
    const ballElements = slide.locator('.lt645-list .lt-ball');
    const ballCount = await ballElements.count();

    if (ballCount < 7) {
      console.warn(`번호 부족: ${ballCount}개 (최소 7개 필요)`);
      return null;
    }

    const allNumbers: number[] = [];
    for (let i = 0; i < ballCount; i++) {
      const ballEl = ballElements.nth(i);

      // plus 이미지는 건너뛰기
      const isPlus = await ballEl.locator('img[alt="+"]').count() > 0;
      if (isPlus) continue;

      const numText = await ballEl.textContent();
      const num = parseInt(numText?.trim() || '0', 10);
      if (num >= 1 && num <= 45) {
        allNumbers.push(num);
      }
    }

    if (allNumbers.length < 7) {
      console.warn(`유효한 번호 부족: ${allNumbers.length}개`);
      return null;
    }

    // 앞 6개가 당첨번호, 마지막이 보너스
    const numbers = allNumbers.slice(0, 6).sort((a, b) => a - b);
    const bonusNumber = allNumbers[6];

    console.log(`${round}회 당첨번호 조회 성공: ${numbers.join(', ')} + 보너스 ${bonusNumber}`);

    return {
      round,
      drawDate,
      numbers,
      bonusNumber,
    };
  } catch (error) {
    console.error('슬라이드 파싱 오류:', error);
    return null;
  }
}

/**
 * 날짜 문자열 파싱 (예: "2026.01.17")
 */
function parseDrawDate(dateStr: string): Date {
  const match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return new Date();

  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

/**
 * 회차가 일치하는지 확인
 *
 * @param winningRound 당첨 번호 회차
 * @param ticketRound 티켓 회차
 * @returns 일치 여부
 */
export function isRoundMatch(winningRound: number, ticketRound: number): boolean {
  return winningRound === ticketRound;
}
