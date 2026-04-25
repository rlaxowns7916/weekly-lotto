/**
 * 연금복권 720+ 당첨 번호 조회 모듈
 *
 * 동행복권 연금복권 720+ 추첨결과 페이지에서 최근 회차 당첨 번호를 가져옵니다.
 *
 * 2026-04 기준: `/main`은 간소화 페이지로 전환되어 더 이상 당첨 번호 슬라이더를 노출하지 않는다.
 * 추첨결과는 `/pt720/result` 경로에서 `wf720Swiper` 컴포넌트로 제공된다.
 */

import type { Page } from 'playwright';
import type { PensionWinningNumbers } from '../../domain/winning.js';
import type { PensionGroup } from '../../domain/ticket.js';
import { digitsToString } from '../../domain/winning.js';
import { AppError } from '../../../shared/utils/error.js';
import { withRetry } from '../../../shared/utils/retry.js';

/**
 * 동행복권 연금복권 720+ 추첨결과 페이지 URL
 */
const RESULT_PAGE_URL = 'https://www.dhlottery.co.kr/pt720/result';

/**
 * 추첨결과 페이지에서 최신 연금복권 720+ 당첨 번호 조회
 *
 * @param page Playwright Page
 * @returns 당첨 번호 정보 (데이터 없음 시 null, 에러 시 throw)
 */
export async function fetchLatestPensionWinning(page: Page): Promise<PensionWinningNumbers | null> {
  return await withRetry(
    async () => {
      await page.goto(RESULT_PAGE_URL, { waitUntil: 'networkidle', timeout: 60000 });

      const swiperContainer = page.locator('.wf720Swiper');
      await swiperContainer.waitFor({ state: 'attached', timeout: 30000 });

      const activeSlide = page.locator('.wf720Swiper .swiper-slide-active');
      const isVisible = await activeSlide.isVisible().catch(() => false);

      if (!isVisible) {
        const allSlides = page.locator('.wf720Swiper .swiper-slide');
        const count = await allSlides.count();
        if (count === 0) {
          throw new AppError({
            code: 'DOM_SELECTOR_NOT_VISIBLE',
            category: 'DOM',
            retryable: false,
            message: '연금복권 당첨 번호 슬라이드를 찾을 수 없습니다',
          });
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
  );
}

/**
 * 슬라이드에서 연금복권 당첨 번호 파싱
 *
 * 새 DOM 구조:
 *   .result-infoWrap
 *     .infoWrap-topBox
 *       .result-txt > .psltEpsd          (회차)
 *       .result-date                      (추첨일)
 *     .result-wfBallWrapper
 *       .result-wfBall (1등)
 *         .wf720-num-list
 *           .wf-ball.pension-jo           (1등 조)
 *           .wf-ball.wf-{1..6}n           (1등 6자리 번호)
 *       .result-wfBall (보너스)
 *         .wf720-num-list
 *           .wf-ball.wf-{1..6}n           (보너스 6자리 번호)
 */
async function parsePensionWinningSlide(
  slide: ReturnType<Page['locator']>
): Promise<PensionWinningNumbers | null> {
  try {
    const roundText = await slide.locator('.psltEpsd').first().textContent();
    const roundMatch = roundText?.match(/(\d+)/);
    const round = roundMatch ? parseInt(roundMatch[1], 10) : 0;

    if (round === 0) {
      console.warn('회차 정보를 파싱할 수 없습니다');
      return null;
    }

    const dateText = await slide.locator('.result-date').first().textContent();
    const drawDate = dateText ? parseDrawDate(dateText.trim()) : new Date();

    const winningSection = slide.locator('.result-wfBall').nth(0);
    const bonusSection = slide.locator('.result-wfBall').nth(1);

    const groupText = await winningSection.locator('.wf-ball.pension-jo').first().textContent();
    const winningGroup = parseInt(groupText?.trim() || '0', 10) as PensionGroup;
    if (winningGroup < 1 || winningGroup > 5) {
      console.warn(`잘못된 조 번호: ${winningGroup}`);
      return null;
    }

    const winningDigits = await extractDigits(winningSection.locator('.wf-ball:not(.pension-jo)'));
    if (winningDigits.length !== 6) {
      console.warn(`1등 번호 자릿수 오류: ${winningDigits.length}자리`);
      return null;
    }

    const bonusDigits = await extractDigits(bonusSection.locator('.wf-ball:not(.pension-jo)'));
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
 * .wf-ball 요소들에서 0~9 자릿수만 추출
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
 * 날짜 문자열 파싱 (예: "2026.04.23" 또는 "2026.04.23 추첨")
 */
function parseDrawDate(dateStr: string): Date {
  const match = dateStr.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return new Date();

  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
