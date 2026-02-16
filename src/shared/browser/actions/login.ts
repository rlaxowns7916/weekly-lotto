/**
 * 로그인 자동화
 *
 * Playwright codegen 기반으로 작성됨
 */

import type { Page } from 'playwright';
import { loginSelectors } from '../selectors.js';
import { getConfig } from '../../config/index.js';
import { saveErrorScreenshot } from '../context.js';
import { withRetry } from '../../utils/retry.js';
import { AppError, toAppError } from '../../utils/error.js';

const queueOrOverlaySelectors = [
  '#waitPage',
  '#isWaitPage',
  '#ajax_loading',
  '.popup-bg.over.loadingOverlay',
] as const;

async function isLocatorVisible(page: Page, selector: string, timeoutMs = 800): Promise<boolean> {
  return page
    .locator(selector)
    .waitFor({ state: 'visible', timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
}

async function waitForLoginInterferenceToClear(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const isRejectedState = await isLocatorVisible(page, '#isRejectPage, #isNotUse', 600);
    if (isRejectedState) {
      throw new AppError({
        code: 'NETWORK_NAVIGATION_TIMEOUT',
        category: 'NETWORK',
        retryable: false,
        message: '로그인 실패: 사이트 접속이 차단된 상태입니다',
      });
    }

    const visibility = await Promise.all(
      queueOrOverlaySelectors.map((selector) => isLocatorVisible(page, selector, 600))
    );
    const hasBlockingOverlay = visibility.some(Boolean);

    if (!hasBlockingOverlay) {
      return;
    }

    const closeWaitButtonVisible = await isLocatorVisible(page, '.close-wait-btn', 600);
    if (closeWaitButtonVisible) {
      await page.locator('.close-wait-btn').click({ timeout: 1500 }).catch(() => undefined);
    }

    await Promise.all(
      queueOrOverlaySelectors.map((selector) =>
        page.locator(selector).waitFor({ state: 'hidden', timeout: 2500 }).catch(() => undefined)
      )
    );

    await page.waitForTimeout(500);
  }

  throw new AppError({
    code: 'NETWORK_NAVIGATION_TIMEOUT',
    category: 'NETWORK',
    retryable: true,
    message: '로그인 실패: 대기열 또는 로딩 오버레이가 해제되지 않았습니다',
  });
}

/**
 * 동행복권 사이트 로그인
 *
 * @param page Playwright Page 인스턴스
 * @throws {Error} 로그인 실패 시
 */
export async function login(page: Page): Promise<void> {
  const config = getConfig();

  if (!config.username || !config.password) {
    throw new AppError({
      code: 'AUTH_INVALID_CREDENTIALS',
      category: 'AUTH',
      retryable: false,
      message: '로그인 실패: LOTTO_USERNAME, LOTTO_PASSWORD 환경변수가 필요합니다',
    });
  }

  const { username, password } = config;

  await withRetry(
    async () => {
      await page.goto(loginSelectors.homeUrl, { timeout: 60000 });
      await page.waitForLoadState('domcontentloaded');
      await waitForLoginInterferenceToClear(page, 10000);

      await page.goto(loginSelectors.url, { timeout: 60000 });
      await page.waitForLoadState('domcontentloaded');
      await waitForLoginInterferenceToClear(page, 45000);

      // 아이디 입력
      const usernameInput = page.getByRole(loginSelectors.usernameInput.role, {
        name: loginSelectors.usernameInput.name,
      });
      await usernameInput.waitFor({ state: 'visible', timeout: 30000 });
      await usernameInput.click();
      await usernameInput.fill(username);

      // 비밀번호 입력
      const passwordInput = page.getByRole(loginSelectors.passwordInput.role, {
        name: loginSelectors.passwordInput.name,
      });
      await passwordInput.fill(password);

      // Enter 키로 로그인 제출
      await passwordInput.press('Enter');
      await waitForLoginInterferenceToClear(page, 30000);

      // 로그인 결과 대기: 로그아웃 버튼(성공) 또는 에러 메시지(실패)
      const result = await Promise.race([
        page.getByRole('button', { name: '로그아웃' })
          .waitFor({ state: 'visible', timeout: 60000 })
          .then(() => 'success' as const),
        page.locator('text=아이디 또는 비밀번호를 확인해주세요')
          .waitFor({ state: 'visible', timeout: 60000 })
          .then(() => 'wrong_credentials' as const),
        page.locator('text=비밀번호를 입력하세요')
          .waitFor({ state: 'visible', timeout: 60000 })
          .then(() => 'wrong_credentials' as const),
      ]).catch(() => 'timeout' as const);

      if (result === 'success') {
        console.log('로그인 성공');
        console.log(`로그인 후 URL: ${page.url()}`);
        // 로그인 후 페이지에서 바로 버튼 찾기 (메인 페이지로 이동하지 않음)
        return;
      }

      if (result === 'wrong_credentials') {
        // 진짜 로그인 실패 - 재시도 의미 없음
        throw new AppError({
          code: 'AUTH_INVALID_CREDENTIALS',
          category: 'AUTH',
          retryable: false,
          message: '로그인 실패: 아이디 또는 비밀번호가 틀렸습니다',
        });
      }

      // 타임아웃 - URL로 재확인
      const currentUrl = page.url();
      if (!currentUrl.includes('login') && !currentUrl.includes('Login')) {
        console.log('로그인 성공 (URL 확인)');
        console.log(`로그인 후 URL: ${currentUrl}`);
        // 로그인 후 페이지에서 바로 버튼 찾기 (메인 페이지로 이동하지 않음)
        return;
      }

      // 사이트 느림으로 인한 실패 - 재시도 가능
      throw new AppError({
        code: 'NETWORK_NAVIGATION_TIMEOUT',
        category: 'NETWORK',
        retryable: true,
        message: '로그인 타임아웃: 사이트 응답 또는 대기열 해제가 지연됩니다',
      });
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
      shouldRetry: (error) => {
        if (error instanceof AppError) {
          return error.retryable;
        }
        return true;
      },
    }
  ).catch(async (error) => {
    await saveErrorScreenshot(page, 'login-error');
    throw toAppError(error);
  });
}
