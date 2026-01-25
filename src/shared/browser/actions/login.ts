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

/**
 * 동행복권 사이트 로그인
 *
 * @param page Playwright Page 인스턴스
 * @throws {Error} 로그인 실패 시
 */
export async function login(page: Page): Promise<void> {
  const config = getConfig();

  await withRetry(
    async () => {
      // 로그인 페이지로 직접 이동
      await page.goto(loginSelectors.url, { timeout: 60000 });
      await page.waitForLoadState('domcontentloaded');

      // 아이디 입력
      const usernameInput = page.getByRole(loginSelectors.usernameInput.role, {
        name: loginSelectors.usernameInput.name,
      });
      await usernameInput.waitFor({ state: 'visible', timeout: 30000 });
      await usernameInput.click();
      await usernameInput.fill(config.username);

      // 비밀번호 입력
      const passwordInput = page.getByRole(loginSelectors.passwordInput.role, {
        name: loginSelectors.passwordInput.name,
      });
      await passwordInput.fill(config.password);

      // Enter 키로 로그인 제출
      await passwordInput.press('Enter');

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
        throw new Error('로그인 실패: 아이디 또는 비밀번호가 틀렸습니다 (재시도 안함)');
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
      throw new Error('로그인 타임아웃: 사이트 응답이 느립니다');
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
      shouldRetry: (error) => {
        // 아이디/비밀번호 오류는 재시도 안 함
        if (error instanceof Error && error.message.includes('재시도 안함')) {
          return false;
        }
        return true;
      },
    }
  ).catch(async (error) => {
    await saveErrorScreenshot(page, 'login-error');
    throw error;
  });
}
