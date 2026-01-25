/**
 * 연금복권 720+ 당첨 번호 조회 모듈
 *
 * 동행복권 메인 페이지에서 최근 회차 당첨 번호를 가져옵니다.
 */

import type { Page } from 'playwright';
import type { PensionWinningNumbers } from '../../domain/winning.js';
import type { PensionGroup } from '../../domain/ticket.js';
import { digitsToString } from '../../domain/winning.js';
import { saveErrorScreenshot } from '../../../shared/browser/context.js';
import { withRetry } from '../../../shared/utils/retry.js';

/**
 * 동행복권 메인 페이지 URL
 */
const MAIN_PAGE_URL = 'https://www.dhlottery.co.kr/main';

/**
 * 메인 페이지에서 최신 연금복권 720+ 당첨 번호 조회
 *
 * @param page Playwright Page
 * @returns 당첨 번호 정보 (실패 시 null)
 */
export async function fetchLatestPensionWinning(page: Page): Promise<PensionWinningNumbers | null> {
  return await withRetry(
    async () => {
      // 메인 페이지로 이동
      await page.goto(MAIN_PAGE_URL, { waitUntil: 'networkidle', timeout: 60000 });

      // 연금복권 720+ 슬라이더가 로드될 때까지 대기
      const swiperContainer = page.locator('.swiper.wf720');
      await swiperContainer.waitFor({ state: 'attached', timeout: 30000 });

      // active 슬라이드 찾기
      const activeSlide = page.locator('.swiper.wf720 .swiper-slide.wf720-inbox.swiper-slide-active');
      const isVisible = await activeSlide.isVisible().catch(() => false);

      if (!isVisible) {
        // active가 없으면 마지막 슬라이드 시도
        const allSlides = page.locator('.swiper.wf720 .swiper-slide.wf720-inbox');
        const count = await allSlides.count();
        if (count === 0) {
          throw new Error('연금복권 당첨 번호 슬라이드를 찾을 수 없습니다');
        }
        return await parsePensionWinningSlide(allSlides.nth(count - 1));
      }

      return await parsePensionWinningSlide(activeSlide);
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
    }
  ).catch(async (error) => {
    await saveErrorScreenshot(page, 'fetch-pension-winning-error');
    console.error('연금복권 당첨 번호 조회 오류:', error);
    return null;
  });
}

/**
 * 슬라이드에서 연금복권 당첨 번호 파싱
 */
async function parsePensionWinningSlide(
  slide: ReturnType<Page['locator']>
): Promise<PensionWinningNumbers | null> {
  try {
    // 회차 추출 (예: "299회")
    const roundText = await slide.locator('.wf720-round').textContent();
    const roundMatch = roundText?.match(/(\d+)/);
    const round = roundMatch ? parseInt(roundMatch[1], 10) : 0;

    if (round === 0) {
      console.warn('회차 정보를 파싱할 수 없습니다');
      return null;
    }

    // 날짜 추출 (예: "2026.01.22")
    const dateText = await slide.locator('.wf720-date').textContent();
    const drawDate = dateText ? parseDrawDate(dateText.trim()) : new Date();

    // 1등 당첨 번호 파싱
    const firstPrizeList = slide.locator('.wf720-list').first();

    // 조 번호 추출
    const groupElement = firstPrizeList.locator('.pension-jo');
    const groupText = await groupElement.textContent();
    const winningGroup = parseInt(groupText?.trim() || '0', 10) as PensionGroup;

    if (winningGroup < 1 || winningGroup > 5) {
      console.warn(`잘못된 조 번호: ${winningGroup}`);
      return null;
    }

    // 1등 번호 추출 (6자리)
    const winningBalls = firstPrizeList.locator('.rightArea .wf-ball');
    const winningDigits = await extractDigits(winningBalls);

    if (winningDigits.length !== 6) {
      console.warn(`1등 번호 자릿수 오류: ${winningDigits.length}자리`);
      return null;
    }

    // 보너스 번호 파싱 (두 번째 wf720-list)
    const bonusList = slide.locator('.wf720-list').nth(1);
    const bonusBalls = bonusList.locator('.rightArea .wf-ball');
    const bonusDigits = await extractDigits(bonusBalls);

    if (bonusDigits.length !== 6) {
      console.warn(`보너스 번호 자릿수 오류: ${bonusDigits.length}자리`);
      return null;
    }

    const winningNumber = digitsToString(winningDigits);
    const bonusNumber = digitsToString(bonusDigits);

    console.log(
      `${round}회 연금복권 당첨번호 조회 성공: ${winningGroup}조 ${winningNumber} / 보너스 ${bonusNumber}`
    );

    return {
      round,
      drawDate,
      winningGroup,
      winningNumber,
      bonusNumber,
    };
  } catch (error) {
    console.error('슬라이드 파싱 오류:', error);
    return null;
  }
}

/**
 * .wf-ball 요소들에서 숫자 추출
 */
async function extractDigits(balls: ReturnType<Page['locator']>): Promise<number[]> {
  const digits: number[] = [];
  const count = await balls.count();

  for (let i = 0; i < count; i++) {
    const text = await balls.nth(i).textContent();
    const digit = parseInt(text?.trim() || '', 10);
    if (!isNaN(digit) && digit >= 0 && digit <= 9) {
      digits.push(digit);
    }
  }

  return digits;
}

/**
 * 날짜 문자열 파싱 (예: "2026.01.22")
 */
function parseDrawDate(dateStr: string): Date {
  const match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return new Date();

  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
