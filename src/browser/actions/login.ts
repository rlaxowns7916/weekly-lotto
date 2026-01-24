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
      // 메인 페이지로 이동
      await page.goto(loginSelectors.url, { timeout: 30000 });
      await page.waitForLoadState('networkidle');

      // 로그인 버튼 클릭
      await page.getByRole(loginSelectors.loginButton.role, {
        name: loginSelectors.loginButton.name,
      }).click();

      // 아이디 입력
      await page.getByRole(loginSelectors.usernameInput.role, {
        name: loginSelectors.usernameInput.name,
      }).click();
      await page.getByRole(loginSelectors.usernameInput.role, {
        name: loginSelectors.usernameInput.name,
      }).fill(config.username);

      // 비밀번호 입력
      await page.getByRole(loginSelectors.passwordInput.role, {
        name: loginSelectors.passwordInput.name,
      }).fill(config.password);

      // Enter 키로 로그인 제출
      await page.getByRole(loginSelectors.passwordInput.role, {
        name: loginSelectors.passwordInput.name,
      }).press('Enter');

      // 로그인 완료 대기 - 로그아웃 버튼이 나타날 때까지 대기
      try {
        await page.getByRole('button', { name: '로그아웃' }).waitFor({ 
          state: 'visible', 
          timeout: 15000 
        });
        console.log('로그인 성공');
      } catch {
        // 로그아웃 버튼이 없으면 URL로 재확인
        const currentUrl = page.url();
        if (currentUrl.includes('login') || currentUrl.includes('Login')) {
          throw new Error('로그인 실패: 아이디 또는 비밀번호를 확인해주세요');
        }
        console.log('로그인 성공 (URL 확인)');
      }
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
    }
  ).catch(async (error) => {
    await saveErrorScreenshot(page, 'login-error');
    throw error;
  });
}
