/**
 * 연금복권 720+ E2E 테스트
 *
 * 1. 당첨번호 조회 테스트 (로그인 불필요)
 * 2. 구매 플로우 테스트 (로그인 필요)
 *
 * 환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요 (구매 테스트)
 */

import { test, expect, Page } from '@playwright/test';

// URL 상수
const MAIN_URL = 'https://www.dhlottery.co.kr/main';
const LOGIN_URL = 'https://www.dhlottery.co.kr/login';
const PURCHASE_URL = 'https://el.dhlottery.co.kr/game_mobile/pension720/game.jsp';

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
 * 요일에 따른 조 반환 (월=1조, 화=2조, ... 금=5조, 주말=1조)
 */
function getGroupByDayOfWeek(): number {
  const dayOfWeek = new Date().getDay();
  switch (dayOfWeek) {
    case 1: return 1;
    case 2: return 2;
    case 3: return 3;
    case 4: return 4;
    case 5: return 5;
    default: return 1; // 주말은 1조
  }
}

test.describe('연금복권 720+ 당첨번호 조회 테스트 (로그인 불필요)', () => {
  test.slow();

  test('메인 페이지에서 연금복권 슬라이더가 표시된다', async ({ page }) => {
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');

    const swiperContainer = page.locator('.swiper.wf720');
    await expect(swiperContainer).toBeAttached({ timeout: 30000 });
  });

  test('당첨 번호 슬라이드에서 회차 정보를 추출할 수 있다', async ({ page }) => {
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');

    const roundText = await page.locator('.swiper.wf720 .wf720-round').first().textContent();
    expect(roundText).toMatch(/\d+회/);
  });

  test('1등 당첨 조 번호가 1~5 범위이다', async ({ page }) => {
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');

    const groupElement = page.locator('.swiper.wf720 .wf720-list .pension-jo').first();
    await expect(groupElement).toBeVisible({ timeout: 30000 });

    const groupText = await groupElement.textContent();
    const group = parseInt(groupText?.trim() || '0', 10);

    expect(group).toBeGreaterThanOrEqual(1);
    expect(group).toBeLessThanOrEqual(5);
  });

  test('1등 당첨 번호가 6자리이다', async ({ page }) => {
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');

    const firstPrizeList = page.locator('.swiper.wf720 .wf720-list').first();
    const winningBalls = firstPrizeList.locator('.rightArea .wf-ball');

    const count = await winningBalls.count();
    expect(count).toBe(6);

    for (let i = 0; i < count; i++) {
      const text = await winningBalls.nth(i).textContent();
      const digit = parseInt(text?.trim() || '', 10);
      expect(digit).toBeGreaterThanOrEqual(0);
      expect(digit).toBeLessThanOrEqual(9);
    }
  });

  test('보너스 번호가 6자리이다', async ({ page }) => {
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');

    const bonusList = page.locator('.swiper.wf720 .wf720-list').nth(1);
    const bonusBalls = bonusList.locator('.rightArea .wf-ball');

    const count = await bonusBalls.count();
    expect(count).toBe(6);

    for (let i = 0; i < count; i++) {
      const text = await bonusBalls.nth(i).textContent();
      const digit = parseInt(text?.trim() || '', 10);
      expect(digit).toBeGreaterThanOrEqual(0);
      expect(digit).toBeLessThanOrEqual(9);
    }
  });

  test('추첨일 정보가 표시된다', async ({ page }) => {
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');

    const dateText = await page.locator('.swiper.wf720 .wf720-date').first().textContent();
    expect(dateText).toMatch(/\d{4}\.\d{2}\.\d{2}/);
  });
});

test.describe('연금복권 720+ 구매 플로우 테스트 (로그인 필요)', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password } = getCredentials();
    test.skip(!username || !password, '환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요');

    const loggedIn = await performLogin(page);
    expect(loggedIn).toBeTruthy();
  });

  test('구매 페이지(game_mobile)에 접근할 수 있다', async ({ page }) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('el.dhlottery.co.kr');
    expect(page.url()).toContain('game_mobile/pension720');
  });

  test('번호 선택하기 링크가 표시된다', async ({ page }) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    const selectNumberLink = page.getByRole('link', { name: '+ 번호 선택하기' });
    await expect(selectNumberLink).toBeVisible({ timeout: 30000 });
  });

  test('번호 선택하기 클릭 후 조 선택이 가능하다', async ({ page }) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    // 번호 선택하기 클릭
    await page.getByRole('link', { name: '+ 번호 선택하기' }).click();

    // 1조~5조 버튼 중 하나가 표시되는지 확인
    const group1 = page.getByText('1조', { exact: true });
    await expect(group1).toBeVisible({ timeout: 30000 });
  });

  test('조 선택 후 자동번호 링크가 표시된다', async ({ page }) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    // 번호 선택하기 클릭
    await page.getByRole('link', { name: '+ 번호 선택하기' }).click();

    // 1조 선택
    await page.getByText('1조', { exact: true }).click();

    // 자동번호 링크 확인
    const autoNumberLink = page.getByRole('link', { name: '자동번호' });
    await expect(autoNumberLink).toBeVisible({ timeout: 30000 });
  });

  test('DRY RUN: 번호 선택 → 조 선택 → 자동번호 → 선택완료까지 진행', async ({ page }) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    const selectedGroup = getGroupByDayOfWeek();

    // 1. 번호 선택하기 클릭
    await page.getByRole('link', { name: '+ 번호 선택하기' }).click();

    // 2. 조 선택 (요일에 따라)
    await page.getByText(`${selectedGroup}조`, { exact: true }).click();

    // 3. 자동번호 클릭
    await page.getByRole('link', { name: '자동번호' }).click();

    // 4. 선택완료 클릭
    await page.getByRole('link', { name: '선택완료' }).click();

    // 5. 구매하기 버튼이 표시되는지 확인 (실제 클릭하지 않음 - DRY RUN)
    const buyBtn = page.getByRole('link', { name: '구매하기' });
    await expect(buyBtn).toBeVisible({ timeout: 30000 });

    // 스크린샷 (확인용)
    await page.screenshot({ path: 'test-results/pension720-dry-run-before-buy.png' });
  });
});
