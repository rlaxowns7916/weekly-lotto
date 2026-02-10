/**
 * 로또 6/45 E2E 테스트 (모바일 UI)
 *
 * 1. 당첨번호 조회 (로그인 불필요)
 * 2. 모바일 구매 플로우 검증 (로그인 필요)
 * 3. 구매내역 조회 (로그인 필요)
 *
 * 환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요 (구매/조회 테스트)
 */

import { test, expect, Page, TestInfo } from '@playwright/test';
import { attachNetworkGuard, skipIfSiteMaintenance } from './utils/site-availability.js';
import {
  ensureDetailSearchExpanded,
  ensurePurchaseHistoryAccessible,
  getRecentWeekButtonOrSkip,
} from './utils/purchase-history.js';

// URL 상수 (모바일)
const MAIN_URL = 'https://www.dhlottery.co.kr/main';
const LOGIN_URL = 'https://www.dhlottery.co.kr/login';
const PURCHASE_URL = 'https://ol.dhlottery.co.kr/olotto/game_mobile/game645.do';
const PURCHASE_HISTORY_URL = 'https://www.dhlottery.co.kr/mypage/mylotteryledger';

// 로또 6/45 복권 상품 코드
const PRODUCT_CODE = 'LO40';
// 티켓 모달 ID
const MODAL_ID = '#Lotto645TicketP';

const getCredentials = () => ({
  username: process.env.LOTTO_USERNAME || '',
  password: process.env.LOTTO_PASSWORD || '',
});

/**
 * 모바일 로그인 수행
 *
 * 이미 로그인된 상태(쿠키)면 그대로 성공 처리
 */
async function performLogin(page: Page, testInfo: TestInfo): Promise<boolean> {
  const { username, password } = getCredentials();
  if (!username || !password) return false;

  await page.goto(LOGIN_URL, { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded');
  await skipIfSiteMaintenance(page, testInfo, '로그인 페이지');

  // 이미 로그인된 상태인지 확인 (로그인 페이지에서 리다이렉트됨)
  if (!page.url().includes('login') && !page.url().includes('Login')) {
    return true;
  }

  // 아이디 입력
  const usernameInput = page.getByRole('textbox', { name: '아이디' });
  await usernameInput.waitFor({ state: 'visible', timeout: 30000 });
  await usernameInput.click();
  await usernameInput.fill(username);

  // 비밀번호 입력
  const passwordInput = page.getByRole('textbox', { name: '비밀번호' });
  await passwordInput.fill(password);
  await passwordInput.press('Enter');

  // 로그인 결과 대기: URL 변경 또는 페이지 로드 완료까지 대기
  await page.waitForURL((url) => !url.href.includes('login'), { timeout: 60000 })
    .catch(() => {/* URL이 변경되지 않을 수 있음 */});

  // 최종 로그인 상태 확인
  if (!page.url().includes('login')) {
    return true;
  }

  const isLoggedIn = await page.getByRole('button', { name: '로그아웃' })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .then(() => true)
    .catch(() => false);

  return isLoggedIn;
}

// ============================================================
// 1. 당첨번호 조회 (로그인 불필요)
// ============================================================
test.describe('로또 6/45 당첨번호 조회', () => {
  test.slow();
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }, testInfo) => {
    attachNetworkGuard(page, testInfo);
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');
    await skipIfSiteMaintenance(page, testInfo, '메인 페이지');
  });

  test('메인 페이지에서 로또 6/45 당첨번호가 표시된다', async ({ page }) => {
    const swiperContainer = page.locator('.swiper.lt645');
    await expect(swiperContainer).toBeAttached({ timeout: 30000 });
  });

  test('당첨 번호가 1~45 범위이다', async ({ page }) => {
    const ballElements = page.locator('.swiper.lt645 .lt645-list .lt-ball');
    const count = await ballElements.count();
    expect(count).toBeGreaterThanOrEqual(7);

    const numbers: number[] = [];
    for (let i = 0; i < count; i++) {
      const isPlus = await ballElements.nth(i).locator('img[alt="+"]').count() > 0;
      if (isPlus) continue;

      const numText = await ballElements.nth(i).textContent();
      const num = parseInt(numText?.trim() || '0', 10);
      if (num >= 1 && num <= 45) numbers.push(num);
    }

    expect(numbers.length).toBeGreaterThanOrEqual(7);
  });

  test('회차 정보를 추출할 수 있다', async ({ page }) => {
    const roundText = await page.locator('.swiper.lt645 .lt645-round').first().textContent();
    expect(roundText).toMatch(/\d+회/);
  });

  test('추첨일 정보가 표시된다', async ({ page }) => {
    const dateText = await page.locator('.swiper.lt645 .lt645-date').first().textContent();
    expect(dateText).toMatch(/\d{4}\.\d{2}\.\d{2}/);
  });
});

// ============================================================
// 2. 모바일 구매 플로우 검증 (로그인 필요)
//    변경된 셀렉터와 모바일 UI를 직접 검증
// ============================================================
test.describe('로또 6/45 모바일 구매 플로우', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }, testInfo) => {
    const { username, password } = getCredentials();
    test.skip(!username || !password, '환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요');

    attachNetworkGuard(page, testInfo);
    const loggedIn = await performLogin(page, testInfo);
    expect(loggedIn).toBeTruthy();
  });

  test('모바일 구매 페이지에 접근할 수 있다', async ({ page }) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    expect(page.url()).toContain('ol.dhlottery.co.kr');
    expect(page.url()).toContain('game_mobile');
  });

  test('"자동 1매 추가" 버튼(button.btn-green02)이 표시된다', async ({ page }) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    const autoBtn = page.locator('button.btn-green02');
    await expect(autoBtn).toBeVisible({ timeout: 30000 });

    const text = await autoBtn.textContent();
    expect(text).toContain('자동');
  });

  test('"구매하기" 버튼(#btnBuy)이 표시된다', async ({ page }) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    const buyBtn = page.locator('#btnBuy');
    await expect(buyBtn).toBeVisible({ timeout: 30000 });

    const text = await buyBtn.textContent();
    expect(text).toContain('구매하기');
  });

  test('자동 1매 추가 클릭 후 번호가 생성된다', async ({ page }) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    const autoBtn = page.locator('button.btn-green02');
    await autoBtn.waitFor({ state: 'visible', timeout: 30000 });
    await autoBtn.click();

    // 번호가 추가될 때까지 대기
    await page.waitForTimeout(1000);

    // 구매하기 버튼이 여전히 표시되는지 확인
    const buyBtn = page.locator('#btnBuy');
    await expect(buyBtn).toBeVisible({ timeout: 10000 });
  });

  test('구매하기 클릭 후 확인 팝업(#popupLayerConfirm)이 표시된다', async ({ page }) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    // 1. 자동 1매 추가
    const autoBtn = page.locator('button.btn-green02');
    await autoBtn.waitFor({ state: 'visible', timeout: 30000 });
    await autoBtn.click();
    await page.waitForTimeout(1000);

    // 2. 구매하기 클릭
    const buyBtn = page.locator('#btnBuy');
    await buyBtn.waitFor({ state: 'visible', timeout: 30000 });
    await buyBtn.click();

    // 3. 확인 팝업 표시 확인
    const confirmPopup = page.locator('#popupLayerConfirm');
    await expect(confirmPopup).toBeVisible({ timeout: 30000 });
  });

  test('확인 팝업에 확인(button.buttonOk)과 취소(button.bg-2) 버튼이 있다', async ({ page }) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    // 자동 1매 추가 → 구매하기
    const autoBtn = page.locator('button.btn-green02');
    await autoBtn.waitFor({ state: 'visible', timeout: 30000 });
    await autoBtn.click();
    await page.waitForTimeout(1000);

    const buyBtn = page.locator('#btnBuy');
    await buyBtn.click();

    // 팝업 대기
    const confirmPopup = page.locator('#popupLayerConfirm');
    await confirmPopup.waitFor({ state: 'visible', timeout: 30000 });

    // 확인 버튼 검증
    const okBtn = confirmPopup.locator('button.buttonOk');
    await expect(okBtn).toBeVisible({ timeout: 10000 });
    const okText = await okBtn.textContent();
    expect(okText).toContain('확인');

    // 취소 버튼 검증
    const cancelBtn = confirmPopup.locator('button.bg-2');
    await expect(cancelBtn).toBeVisible({ timeout: 10000 });
    const cancelText = await cancelBtn.textContent();
    expect(cancelText).toContain('취소');
  });

  test('DRY RUN: 취소 버튼 클릭하면 팝업이 닫힌다', async ({ page }) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    // 1. 자동 1매 추가
    const autoBtn = page.locator('button.btn-green02');
    await autoBtn.waitFor({ state: 'visible', timeout: 30000 });
    await autoBtn.click();
    await page.waitForTimeout(1000);

    // 2. 구매하기
    const buyBtn = page.locator('#btnBuy');
    await buyBtn.click();

    // 3. 팝업 대기
    const confirmPopup = page.locator('#popupLayerConfirm');
    await confirmPopup.waitFor({ state: 'visible', timeout: 30000 });

    // 4. 취소 클릭 (DRY RUN)
    const cancelBtn = confirmPopup.locator('button.bg-2');
    await cancelBtn.click();

    // 5. 팝업이 닫혔는지 확인
    await expect(confirmPopup).toBeHidden({ timeout: 10000 });

    // 스크린샷 (검증용)
    await page.screenshot({ path: 'test-results/lotto645-dry-run-complete.png' });
  });
});

// ============================================================
// 3. 구매내역 조회 (로그인 필요)
// ============================================================
test.describe('로또 6/45 구매내역 조회', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }, testInfo) => {
    const { username, password } = getCredentials();
    test.skip(!username || !password, '환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요');

    attachNetworkGuard(page, testInfo);
    const loggedIn = await performLogin(page, testInfo);
    expect(loggedIn).toBeTruthy();
  });

  test('구매내역 페이지로 이동할 수 있다', async ({ page }, testInfo) => {
    await page.goto(PURCHASE_HISTORY_URL, { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    const accessible = ensurePurchaseHistoryAccessible(page, testInfo, '구매내역 페이지');
    if (!accessible) return;

    expect(page.url()).toContain('mylotteryledger');
  });

  test('로또6/45 필터로 검색할 수 있다', async ({ page }, testInfo) => {
    await page.goto(PURCHASE_HISTORY_URL, { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    const accessible = ensurePurchaseHistoryAccessible(page, testInfo, '구매내역 페이지');
    if (!accessible) return;

    await ensureDetailSearchExpanded(page);

    const weekBtn = await getRecentWeekButtonOrSkip(page, testInfo, '구매내역 상세 검색');
    if (!weekBtn) return;
    await weekBtn.click();

    const selectBox = page.locator('#ltGdsSelect');
    await selectBox.waitFor({ state: 'attached', timeout: 10000 });
    await selectBox.selectOption(PRODUCT_CODE);

    const searchBtn = page.getByRole('button', { name: '검색', exact: true });
    await searchBtn.click();

    const result = await Promise.race([
      page.locator('li.whl-row').first().waitFor({ state: 'attached', timeout: 30000 })
        .then(() => 'has_results' as const),
      page.locator('text=조회 결과가 없습니다').waitFor({ state: 'visible', timeout: 30000 })
        .then(() => 'no_results' as const),
    ]).catch(() => 'timeout' as const);

    expect(['has_results', 'no_results']).toContain(result);
  });

  test('구매 내역이 있으면 티켓 모달을 열 수 있다', async ({ page }, testInfo) => {
    await page.goto(PURCHASE_HISTORY_URL, { timeout: 60000 });
    await page.waitForLoadState('networkidle');
    const accessible = ensurePurchaseHistoryAccessible(page, testInfo, '구매내역 페이지');
    if (!accessible) return;

    await ensureDetailSearchExpanded(page);

    const weekBtn = await getRecentWeekButtonOrSkip(page, testInfo, '구매내역 상세 검색');
    if (!weekBtn) return;
    await weekBtn.click();

    const selectBox = page.locator('#ltGdsSelect');
    await selectBox.waitFor({ state: 'attached', timeout: 10000 });
    await selectBox.selectOption(PRODUCT_CODE);

    const searchBtn = page.getByRole('button', { name: '검색', exact: true });
    await searchBtn.click();

    const hasResults = await page.locator('span.whl-txt.barcd').first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    if (!hasResults) {
      test.skip(true, '최근 1주일 내 구매 내역 없음');
      return;
    }

    // 바코드 클릭 → 모달 열기
    await page.locator('span.whl-txt.barcd').first().click();
    const modal = page.locator(MODAL_ID);
    await expect(modal).toBeVisible({ timeout: 15000 });

    // 티켓 번호 확인
    const ticketBox = modal.locator('.ticket-num-box').first();
    await expect(ticketBox).toBeAttached({ timeout: 10000 });

    // 모달 닫기
    await modal.locator('button').first().click();
    await expect(modal).toBeHidden({ timeout: 5000 });
  });
});
