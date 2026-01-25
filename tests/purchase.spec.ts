/**
 * 구매 플로우 E2E 테스트
 *
 * ol.dhlottery.co.kr 직접 접근 방식으로 로또 구매 과정을 테스트합니다.
 * 실제 구매는 하지 않고 구매 직전까지만 진행합니다 (DRY RUN).
 *
 * 환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요
 */

import { test, expect, Page } from '@playwright/test';

// URL 상수 (실제 소스 코드와 동일)
const LOGIN_URL = 'https://www.dhlottery.co.kr/login';
const PURCHASE_URL = 'https://ol.dhlottery.co.kr/olotto/game/game645.do';

// 환경 변수에서 자격 증명 가져오기
const getCredentials = () => ({
  username: process.env.LOTTO_USERNAME || '',
  password: process.env.LOTTO_PASSWORD || '',
});

/**
 * 로그인 수행
 */
async function performLogin(page: Page): Promise<boolean> {
  const { username, password } = getCredentials();

  if (!username || !password) {
    return false;
  }

  await page.goto(LOGIN_URL, { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');

  // 아이디 입력
  const usernameInput = page.getByRole('textbox', { name: '아이디' });
  await usernameInput.waitFor({ state: 'visible', timeout: 30000 });
  await usernameInput.click();
  await usernameInput.fill(username);

  // 비밀번호 입력
  const passwordInput = page.getByRole('textbox', { name: '비밀번호' });
  await passwordInput.fill(password);

  // Enter 키로 로그인 제출
  await passwordInput.press('Enter');

  // 로그인 성공 대기
  const result = await Promise.race([
    page
      .getByRole('button', { name: '로그아웃' })
      .waitFor({ state: 'visible', timeout: 60000 })
      .then(() => 'success' as const),
    page
      .waitForURL((url) => !url.href.includes('login'), { timeout: 60000 })
      .then(() => 'redirected' as const),
  ]).catch(() => 'timeout' as const);

  return result === 'success' || result === 'redirected';
}

/**
 * 알림 팝업 닫기 (#popupLayerAlert)
 */
async function dismissAlertPopup(page: Page): Promise<void> {
  try {
    const popup = page.locator('#popupLayerAlert');
    const isVisible = await popup.isVisible().catch(() => false);

    if (isVisible) {
      const confirmBtn = popup.locator('input.confirm, button.confirm');
      await confirmBtn.click({ timeout: 5000 });
      await popup.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  } catch {
    // 팝업이 없으면 무시
  }
}

test.describe('구매 플로우 테스트', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password } = getCredentials();
    test.skip(!username || !password, '환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요');

    const loggedIn = await performLogin(page);
    expect(loggedIn).toBeTruthy();
  });

  test('구매 페이지(ol.dhlottery.co.kr)에 직접 접근할 수 있다', async ({ page }) => {
    // 구매 페이지로 직접 이동
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    // 알림 팝업 닫기 (있으면)
    await dismissAlertPopup(page);

    // URL 확인
    expect(page.url()).toContain('ol.dhlottery.co.kr');
  });

  test('구매 페이지에서 자동번호발급 링크가 표시된다', async ({ page }) => {
    // 구매 페이지로 직접 이동
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    // 알림 팝업 닫기 (있으면)
    await dismissAlertPopup(page);

    // 자동번호발급 링크 확인 (iframe 없이 직접 접근)
    const autoNumberLink = page.getByRole('link', { name: /자동번호발급/ });
    await expect(autoNumberLink).toBeVisible({ timeout: 30000 });
  });

  test('자동번호발급 클릭 후 확인 버튼이 표시된다', async ({ page }) => {
    // 구매 페이지로 직접 이동
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    // 알림 팝업 닫기 (있으면)
    await dismissAlertPopup(page);

    // 자동번호발급 링크 클릭
    const autoNumberLink = page.getByRole('link', { name: /자동번호발급/ });
    await autoNumberLink.waitFor({ state: 'visible', timeout: 30000 });
    await autoNumberLink.click();

    // 확인 버튼 확인
    const confirmBtn = page.getByRole('button', { name: '확인' });
    await expect(confirmBtn).toBeVisible({ timeout: 30000 });
  });

  test('DRY RUN: 자동번호발급 → 확인 → 구매하기 버튼까지 진행', async ({ page }) => {
    // 구매 페이지로 직접 이동
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    // 알림 팝업 닫기 (있으면)
    await dismissAlertPopup(page);

    // 자동번호발급 링크 클릭
    const autoNumberLink = page.getByRole('link', { name: /자동번호발급/ });
    await autoNumberLink.waitFor({ state: 'visible', timeout: 30000 });
    await autoNumberLink.click();

    // 확인 버튼 클릭 (슬롯 추가)
    const confirmBtn = page.getByRole('button', { name: '확인' });
    await confirmBtn.waitFor({ state: 'visible', timeout: 30000 });
    await confirmBtn.click();

    // 구매하기 버튼이 표시되는지 확인 (실제 클릭하지 않음 - DRY RUN)
    const buyBtn = page.getByRole('button', { name: '구매하기' });
    await expect(buyBtn).toBeVisible({ timeout: 30000 });

    // 스크린샷 (확인용)
    await page.screenshot({ path: 'test-results/dry-run-before-buy.png' });

    // 실제 구매는 진행하지 않음
  });
});
