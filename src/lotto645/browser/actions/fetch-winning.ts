/**
 * 당첨 번호 조회 모듈
 *
 * 동행복권 로또 6/45 추첨결과 페이지에서 최근 회차 당첨 번호를 가져옵니다.
 */

import type { Page } from 'playwright';
import type { WinningNumbers } from '../../domain/winning.js';
import { AppError } from '../../../shared/utils/error.js';
import { withRetry } from '../../../shared/utils/retry.js';

/**
 * 동행복권 로또 6/45 추첨결과 페이지 URL
 *
 * 2026-04 기준: `/main`은 간소화 페이지로 전환되어 더 이상 당첨 번호 슬라이더를 노출하지 않는다.
 * 추첨결과는 `/lt645/result` 경로에서 `lt645Swiper` 컴포넌트로 제공된다.
 */
const RESULT_PAGE_URL = 'https://www.dhlottery.co.kr/lt645/result';

/**
 * 추첨결과 페이지에서 최신 당첨 번호 조회
 *
 * @param page Playwright Page
 * @returns 당첨 번호 정보 (데이터 없음 시 null, 에러 시 throw)
 */
export async function fetchLatestWinningNumbers(page: Page): Promise<WinningNumbers | null> {
  return await withRetry(
    async () => {
      await page.goto(RESULT_PAGE_URL, { waitUntil: 'networkidle', timeout: 60000 });

      const swiperContainer = page.locator('.lt645Swiper');
      await swiperContainer.waitFor({ state: 'attached', timeout: 30000 });

      const activeSlide = page.locator('.lt645Swiper .swiper-slide-active');
      const isVisible = await activeSlide.isVisible().catch(() => false);

      if (!isVisible) {
        const allSlides = page.locator('.lt645Swiper .swiper-slide');
        const count = await allSlides.count();
        if (count === 0) {
          throw new AppError({
            code: 'DOM_SELECTOR_NOT_VISIBLE',
            category: 'DOM',
            retryable: false,
            message: '당첨 번호 슬라이드를 찾을 수 없습니다',
          });
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
  );
}

/**
 * 슬라이드에서 당첨 번호 파싱
 *
 * 새 DOM 구조:
 *   .result-infoWrap
 *     .infoWrap-topBox
 *       .result-txt > .ltEpsd        (회차)
 *       .result-date                  (추첨일)
 *     .result-ballWrapper
 *       .result-ballBox
 *         .result-ball x6             (당첨번호)
 *         <figure>+ icon</figure>     (구분자)
 *         .result-ball x1             (보너스 번호)
 */
async function parseWinningSlide(slide: ReturnType<Page['locator']>): Promise<WinningNumbers | null> {
  try {
    const roundText = await slide.locator('.ltEpsd').first().textContent();
    const roundMatch = roundText?.match(/(\d+)/);
    const round = roundMatch ? parseInt(roundMatch[1], 10) : 0;

    if (round === 0) {
      console.warn('회차 정보를 파싱할 수 없습니다');
      return null;
    }

    const dateText = await slide.locator('.result-date').first().textContent();
    const drawDate = dateText ? parseDrawDate(dateText.trim()) : new Date();

    const ballElements = slide.locator('.result-ballBox .result-ball');
    const ballCount = await ballElements.count();

    if (ballCount < 7) {
      console.warn(`번호 부족: ${ballCount}개 (최소 7개 필요)`);
      return null;
    }

    const allNumbers: number[] = [];
    for (let i = 0; i < ballCount; i++) {
      const numText = await ballElements.nth(i).textContent();
      const num = parseInt(numText?.trim() || '0', 10);
      if (num >= 1 && num <= 45) {
        allNumbers.push(num);
      }
    }

    if (allNumbers.length < 7) {
      console.warn(`유효한 번호 부족: ${allNumbers.length}개`);
      return null;
    }

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
 * 날짜 문자열 파싱 (예: "2026.04.25" 또는 "2026.04.25 추첨")
 */
function parseDrawDate(dateStr: string): Date {
  const match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return new Date();

  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
