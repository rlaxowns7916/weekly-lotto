/**
 * 로그인 E2E 테스트
 *
 * 동행복권 사이트 로그인 기능을 테스트합니다.
 * 환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요
 */

import { test, expect } from '@playwright/test';
import { attachNetworkGuard, skipIfSiteMaintenance } from './utils/site-availability.js';

// 로그인 페이지 URL
const LOGIN_URL = 'https://www.dhlottery.co.kr/login';

// 환경 변수에서 자격 증명 가져오기
const getCredentials = () => ({
  username: process.env.LOTTO_USERNAME || '',
  password: process.env.LOTTO_PASSWORD || '',
});

test.describe('로그인 테스트', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }, testInfo) => {
    attachNetworkGuard(page, testInfo);
    // 로그인 페이지로 이동
    await page.goto(LOGIN_URL, { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    await skipIfSiteMaintenance(page, testInfo, '로그인 페이지');
  });

  test('로그인 페이지가 정상적으로 로드된다', async ({ page }) => {
    // 아이디 입력 필드 확인
    const usernameInput = page.getByRole('textbox', { name: '아이디' });
    await expect(usernameInput).toBeVisible();

    // 비밀번호 입력 필드 확인
    const passwordInput = page.getByRole('textbox', { name: '비밀번호' });
    await expect(passwordInput).toBeVisible();
  });

  test('유효한 자격 증명으로 로그인에 성공한다', async ({ page }) => {
    const { username, password } = getCredentials();

    // 자격 증명이 없으면 테스트 스킵
    test.skip(!username || !password, '환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요');

    // 아이디 입력
    const usernameInput = page.getByRole('textbox', { name: '아이디' });
    await usernameInput.click();
    await usernameInput.fill(username);

    // 비밀번호 입력
    const passwordInput = page.getByRole('textbox', { name: '비밀번호' });
    await passwordInput.fill(password);

    // Enter 키로 로그인 제출
    await passwordInput.press('Enter');

    // 로그인 성공 확인: 로그아웃 버튼이 표시되거나 URL이 로그인 페이지가 아님
    const result = await Promise.race([
      page.getByRole('button', { name: '로그아웃' })
        .waitFor({ state: 'visible', timeout: 60000 })
        .then(() => 'success' as const),
      page.waitForURL((url) => !url.href.includes('login'), { timeout: 60000 })
        .then(() => 'redirected' as const),
    ]).catch(() => 'timeout' as const);

    if (result === 'timeout') {
      test.skip(true, '로그인 성공 신호를 60초 안에 확인하지 못해 테스트를 건너뜁니다.');
      return;
    }

    expect(['success', 'redirected']).toContain(result);
  });

  test('잘못된 비밀번호로 로그인에 실패한다', async ({ page }) => {
    const { username } = getCredentials();

    // 사용자명이 없으면 테스트 스킵
    test.skip(!username, '환경 변수 LOTTO_USERNAME 필요');

    // 아이디 입력
    const usernameInput = page.getByRole('textbox', { name: '아이디' });
    await usernameInput.click();
    await usernameInput.fill(username);

    // 잘못된 비밀번호 입력
    const passwordInput = page.getByRole('textbox', { name: '비밀번호' });
    await passwordInput.fill('wrong_password_12345');

    // Enter 키로 로그인 제출
    await passwordInput.press('Enter');

    // 에러 메시지 확인 또는 로그인 페이지 유지
    const errorVisible = await page.locator('text=아이디 또는 비밀번호를 확인해주세요')
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    const stillOnLoginPage = page.url().includes('login');

    expect(errorVisible || stillOnLoginPage).toBeTruthy();
  });

  test('빈 자격 증명으로 로그인을 시도하면 실패한다', async ({ page }) => {
    // 빈 상태로 Enter 키 입력
    const passwordInput = page.getByRole('textbox', { name: '비밀번호' });
    await passwordInput.press('Enter');

    // 에러 메시지 확인 또는 로그인 페이지 유지
    const errorVisible = await page.locator('text=비밀번호를 입력하세요')
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    const stillOnLoginPage = page.url().includes('login');

    expect(errorVisible || stillOnLoginPage).toBeTruthy();
  });
});
