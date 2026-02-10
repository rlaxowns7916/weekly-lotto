/**
 * 연금복권 720+ E2E 테스트
 *
 * 1. 당첨번호 조회 테스트 (로그인 불필요)
 * 2. 구매 플로우 테스트 (로그인 필요)
 *
 * 환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요 (구매 테스트)
 */

import { test, expect, Page, TestInfo } from '@playwright/test';
import { attachNetworkGuard, skipIfSiteMaintenance } from './utils/site-availability.js';
import {
  ensureDetailSearchExpanded,
  ensurePurchaseHistoryAccessible,
  getRecentWeekButtonOrSkip,
} from './utils/purchase-history.js';

// URL 상수
const MAIN_URL = 'https://www.dhlottery.co.kr/main';
const LOGIN_URL = 'https://www.dhlottery.co.kr/login';
const PURCHASE_URL = 'https://el.dhlottery.co.kr/game_mobile/pension720/game.jsp';
const PURCHASE_HISTORY_URL = 'https://www.dhlottery.co.kr/mypage/mylotteryledger';

// 연금복권720+ 복권 상품 코드
const PRODUCT_CODE = 'LP72';
// 티켓 모달 ID
const MODAL_ID = '#Pt720TicketP';

// 환경 변수에서 자격 증명 가져오기
const getCredentials = () => ({
  username: process.env.LOTTO_USERNAME || '',
  password: process.env.LOTTO_PASSWORD || '',
});

/**
 * 로그인 수행
 */
async function performLogin(page: Page, testInfo: TestInfo): Promise<boolean> {
  const { username, password } = getCredentials();

  if (!username || !password) {
    return false;
  }

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

  // Enter 키로 로그인 제출
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

async function openPensionMain(page: Page, testInfo: TestInfo): Promise<void> {
  await page.goto(MAIN_URL, { timeout: 120000 });
  await page.waitForLoadState('domcontentloaded');
  await skipIfSiteMaintenance(page, testInfo, '연금복권 메인 페이지');
}

async function openPensionPurchaseHistory(page: Page, testInfo: TestInfo): Promise<boolean> {
  await page.goto(PURCHASE_HISTORY_URL, { timeout: 60000 });
  await page.waitForLoadState('networkidle');
  return ensurePurchaseHistoryAccessible(page, testInfo, '연금복권720+ 구매내역 페이지');
}

test.describe('연금복권 720+ 당첨번호 조회 테스트 (로그인 불필요)', () => {
  test.slow();
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }, testInfo) => {
    attachNetworkGuard(page, testInfo);
    await openPensionMain(page, testInfo);
  });

  test('메인 페이지에서 연금복권 슬라이더가 표시된다', async ({ page }) => {
    const swiperContainer = page.locator('.swiper.wf720');
    await expect(swiperContainer).toBeAttached({ timeout: 30000 });
  });

  test('당첨 번호 슬라이드에서 회차 정보를 추출할 수 있다', async ({ page }) => {
    const roundText = await page.locator('.swiper.wf720 .wf720-round').first().textContent();
    expect(roundText).toMatch(/\d+회/);
  });

  test('1등 당첨 조 번호가 1~5 범위이다', async ({ page }) => {
    const groupList = page.locator('.swiper.wf720 .wf720-list .pension-jo');
    const hasGroup = (await groupList.count()) > 0;

    if (!hasGroup) {
      test.skip(true, '연금복권 조 정보가 표시되지 않아 테스트를 건너뜁니다.');
      return;
    }

    const groupElement = groupList.first();
    await expect(groupElement).toBeVisible({ timeout: 30000 });

    const groupText = await groupElement.textContent();
    const group = parseInt(groupText?.trim() || '0', 10);

    expect(group).toBeGreaterThanOrEqual(1);
    expect(group).toBeLessThanOrEqual(5);
  });

  test('1등 당첨 번호가 6자리이다', async ({ page }) => {
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
    const dateText = await page.locator('.swiper.wf720 .wf720-date').first().textContent();
    expect(dateText).toMatch(/\d{4}\.\d{2}\.\d{2}/);
  });
});

test.describe('연금복권 720+ 구매 플로우 테스트 (로그인 필요)', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page }, testInfo) => {
    const { username, password } = getCredentials();
    test.skip(!username || !password, '환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요');

    attachNetworkGuard(page, testInfo);
    const loggedIn = await performLogin(page, testInfo);
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

  test('DRY RUN: 번호 선택 → 조 선택 → 자동번호 → 선택완료까지 진행', async ({ page }, testInfo) => {
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    const selectedGroup = getGroupByDayOfWeek();

    // 1. 번호 선택하기 클릭
    await page.getByRole('link', { name: '+ 번호 선택하기' }).click();

    // 2. 조 선택 (요일에 따라)
    await page.getByText(`${selectedGroup}조`, { exact: true }).click();

    // 3. 자동번호 클릭
    await page.getByRole('link', { name: '자동번호' }).click();

    // 4. 선택완료 클릭 (로딩 중이면 대기)
    const loadingOverlay = page.locator('#ajax_loading');
    const overlayVisible = await loadingOverlay.isVisible().catch(() => false);
    if (overlayVisible) {
      const overlayGone = await loadingOverlay
        .waitFor({ state: 'hidden', timeout: 30000 })
        .then(() => true)
        .catch(() => false);

      if (!overlayGone) {
        testInfo.skip(true, '번호 선택 진행 중 로딩 상태가 해제되지 않아 테스트를 건너뜁니다.');
      }
    }

    await page.getByRole('link', { name: '선택완료' }).click();

    // 5. 구매하기 버튼이 표시되는지 확인 (실제 클릭하지 않음 - DRY RUN)
    const buyBtn = page.getByRole('link', { name: '구매하기' });
    await expect(buyBtn).toBeVisible({ timeout: 30000 });

    // 스크린샷 (확인용)
    await page.screenshot({ path: 'test-results/pension720-dry-run-before-buy.png' });
  });
});

test.describe('연금복권 720+ 구매내역 조회 테스트 (로그인 필요)', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page }, testInfo) => {
    const { username, password } = getCredentials();
    test.skip(!username || !password, '환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요');

    attachNetworkGuard(page, testInfo);
    const loggedIn = await performLogin(page, testInfo);
    expect(loggedIn).toBeTruthy();
  });

  test('구매내역 페이지로 이동할 수 있다', async ({ page }, testInfo) => {
    const accessible = await openPensionPurchaseHistory(page, testInfo);
    if (!accessible) {
      return;
    }

    expect(page.url()).toContain('mylotteryledger');
  });

  test('연금복권720+ 필터를 선택할 수 있다', async ({ page }, testInfo) => {
    const accessible = await openPensionPurchaseHistory(page, testInfo);
    if (!accessible) {
      return;
    }

    // 상세 검색 영역 열기
    await ensureDetailSearchExpanded(page);

    // 최근 1주일 선택
    const weekBtn = await getRecentWeekButtonOrSkip(page, testInfo, '연금복권720+ 구매내역 상세 검색');
    if (!weekBtn) {
      return;
    }
    await weekBtn.click();

    // 복권 선택 드롭다운에서 연금복권720+ 선택
    const selectBox = page.locator('#ltGdsSelect');
    await selectBox.waitFor({ state: 'attached', timeout: 10000 });
    await selectBox.selectOption(PRODUCT_CODE);

    // 선택 확인
    const selectedValue = await selectBox.inputValue();
    expect(selectedValue).toBe(PRODUCT_CODE);
  });

  test('검색 버튼을 클릭하면 결과가 로드된다', async ({ page }, testInfo) => {
    const accessible = await openPensionPurchaseHistory(page, testInfo);
    if (!accessible) {
      return;
    }

    // 상세 검색 영역 열기
    await ensureDetailSearchExpanded(page);

    // 최근 1주일 선택
    const weekBtn = await getRecentWeekButtonOrSkip(page, testInfo, '연금복권720+ 구매내역 상세 검색');
    if (!weekBtn) {
      return;
    }
    await weekBtn.click();

    // 연금복권720+ 선택
    const selectBox = page.locator('#ltGdsSelect');
    await selectBox.waitFor({ state: 'attached', timeout: 10000 });
    await selectBox.selectOption(PRODUCT_CODE);

    // 검색 버튼 클릭
    const searchBtn = page.getByRole('button', { name: '검색', exact: true });
    await searchBtn.click();

    // 결과 로딩 대기: 결과 행이 나타나거나 "조회 결과가 없습니다" 메시지
    const result = await Promise.race([
      page.locator('li.whl-row').first().waitFor({ state: 'attached', timeout: 30000 })
        .then(() => 'has_results' as const),
      page.locator('text=조회 결과가 없습니다').waitFor({ state: 'visible', timeout: 30000 })
        .then(() => 'no_results' as const),
    ]).catch(() => 'timeout' as const);

    expect(['has_results', 'no_results']).toContain(result);
  });

  test('구매 내역이 있으면 바코드가 표시된다', async ({ page }, testInfo) => {
    const accessible = await openPensionPurchaseHistory(page, testInfo);
    if (!accessible) {
      return;
    }

    // 상세 검색 영역 열기
    await ensureDetailSearchExpanded(page);

    // 최근 1주일 선택
    const weekBtn = await getRecentWeekButtonOrSkip(page, testInfo, '연금복권720+ 구매내역 상세 검색');
    if (!weekBtn) {
      return;
    }
    await weekBtn.click();

    // 연금복권720+ 선택
    const selectBox = page.locator('#ltGdsSelect');
    await selectBox.waitFor({ state: 'attached', timeout: 10000 });
    await selectBox.selectOption(PRODUCT_CODE);

    // 검색 버튼 클릭
    const searchBtn = page.getByRole('button', { name: '검색', exact: true });
    await searchBtn.click();

    // 결과 로딩 대기
    const hasResults = await page
      .locator('li.whl-row')
      .first()
      .waitFor({ state: 'attached', timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    if (hasResults) {
      const barcodeElement = page.locator('span.whl-txt.barcd').first();
      await expect(barcodeElement).toBeVisible();
    } else {
      test.skip(true, '최근 1주일 내 연금복권720+ 구매 내역 없음');
    }
  });

  test('바코드 클릭 시 티켓 상세 모달이 열린다', async ({ page }, testInfo) => {
    const accessible = await openPensionPurchaseHistory(page, testInfo);
    if (!accessible) {
      return;
    }

    // 상세 검색 영역 열기
    await ensureDetailSearchExpanded(page);

    // 최근 1주일 선택
    const weekBtn = await getRecentWeekButtonOrSkip(page, testInfo, '연금복권720+ 구매내역 상세 검색');
    if (!weekBtn) {
      return;
    }
    await weekBtn.click();

    // 연금복권720+ 선택
    const selectBox = page.locator('#ltGdsSelect');
    await selectBox.waitFor({ state: 'attached', timeout: 10000 });
    await selectBox.selectOption(PRODUCT_CODE);

    // 검색 버튼 클릭
    const searchBtn = page.getByRole('button', { name: '검색', exact: true });
    await searchBtn.click();

    // 결과 로딩 대기
    const hasResults = await page
      .locator('span.whl-txt.barcd')
      .first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    if (!hasResults) {
      test.skip(true, '최근 1주일 내 연금복권720+ 구매 내역 없음');
      return;
    }

    // 바코드 클릭
    const barcodeElement = page.locator('span.whl-txt.barcd').first();
    await barcodeElement.click();

    // 티켓 상세 모달 확인
    const modal = page.locator(MODAL_ID);
    await expect(modal).toBeVisible({ timeout: 15000 });

    // 모달 내부에 티켓 번호가 있는지 확인
    const ticketLine = modal.locator('.ticket-num-line').first();
    await expect(ticketLine).toBeAttached({ timeout: 10000 });

    // 모달 닫기
    const closeBtn = modal.locator('button').first();
    await closeBtn.click();
    await expect(modal).toBeHidden({ timeout: 5000 });
  });

  test('티켓 모달에서 조 번호를 추출할 수 있다', async ({ page }, testInfo) => {
    const accessible = await openPensionPurchaseHistory(page, testInfo);
    if (!accessible) {
      return;
    }

    // 상세 검색 영역 열기
    await ensureDetailSearchExpanded(page);

    // 최근 1주일 선택
    const weekBtn = await getRecentWeekButtonOrSkip(page, testInfo, '연금복권720+ 구매내역 상세 검색');
    if (!weekBtn) {
      return;
    }
    await weekBtn.click();

    // 연금복권720+ 선택
    const selectBox = page.locator('#ltGdsSelect');
    await selectBox.waitFor({ state: 'attached', timeout: 10000 });
    await selectBox.selectOption(PRODUCT_CODE);

    // 검색 버튼 클릭
    const searchBtn = page.getByRole('button', { name: '검색', exact: true });
    await searchBtn.click();

    // 결과 로딩 대기
    const hasResults = await page
      .locator('span.whl-txt.barcd')
      .first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    if (!hasResults) {
      test.skip(true, '최근 1주일 내 연금복권720+ 구매 내역 없음');
      return;
    }

    // 바코드 클릭
    const barcodeElement = page.locator('span.whl-txt.barcd').first();
    await barcodeElement.click();

    // 티켓 상세 모달 대기
    const modal = page.locator(MODAL_ID);
    await modal.waitFor({ state: 'visible', timeout: 15000 });

    // 조 번호 추출 (.ticket-cate에서)
    const ticketLine = modal.locator('.ticket-num-line').first();
    const groupText = await ticketLine.locator('.ticket-cate').first().textContent();

    // 조 번호가 1~5 범위인지 확인
    const groupMatch = groupText?.match(/([1-5])/);
    expect(groupMatch).not.toBeNull();
    const groupNum = parseInt(groupMatch![1], 10);
    expect(groupNum).toBeGreaterThanOrEqual(1);
    expect(groupNum).toBeLessThanOrEqual(5);

    // 모달 닫기
    const closeBtn = modal.locator('button').first();
    await closeBtn.click();
  });

  test('티켓 모달에서 6자리 번호를 추출할 수 있다', async ({ page }, testInfo) => {
    const accessible = await openPensionPurchaseHistory(page, testInfo);
    if (!accessible) {
      return;
    }

    // 상세 검색 영역 열기
    await ensureDetailSearchExpanded(page);

    // 최근 1주일 선택
    const weekBtn = await getRecentWeekButtonOrSkip(page, testInfo, '연금복권720+ 구매내역 상세 검색');
    if (!weekBtn) {
      return;
    }
    await weekBtn.click();

    // 연금복권720+ 선택
    const selectBox = page.locator('#ltGdsSelect');
    await selectBox.waitFor({ state: 'attached', timeout: 10000 });
    await selectBox.selectOption(PRODUCT_CODE);

    // 검색 버튼 클릭
    const searchBtn = page.getByRole('button', { name: '검색', exact: true });
    await searchBtn.click();

    // 결과 로딩 대기
    const hasResults = await page
      .locator('span.whl-txt.barcd')
      .first()
      .waitFor({ state: 'visible', timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    if (!hasResults) {
      test.skip(true, '최근 1주일 내 연금복권720+ 구매 내역 없음');
      return;
    }

    // 바코드 클릭
    const barcodeElement = page.locator('span.whl-txt.barcd').first();
    await barcodeElement.click();

    // 티켓 상세 모달 대기
    const modal = page.locator(MODAL_ID);
    await modal.waitFor({ state: 'visible', timeout: 15000 });

    // 6자리 번호 추출 (.ticket-num-in에서)
    const ticketLine = modal.locator('.ticket-num-line').first();
    const numberElements = ticketLine.locator('.ticket-num-in');
    const count = await numberElements.count();

    // 6자리인지 확인
    if (count === 0) {
      test.skip(true, '티켓 번호가 노출되지 않아 6자리 확인을 건너뜁니다.');
      return;
    }

    expect(count).toBe(6);

    // 각 자리가 0~9 범위인지 확인
    const digits: number[] = [];
    for (let i = 0; i < count; i++) {
      const numText = await numberElements.nth(i).textContent();
      const digit = parseInt(numText?.trim() || '', 10);
      expect(digit).toBeGreaterThanOrEqual(0);
      expect(digit).toBeLessThanOrEqual(9);
      digits.push(digit);
    }

    console.log(`추출된 번호: ${digits.join('')}`);

    // 모달 닫기
    const closeBtn = modal.locator('button').first();
    await closeBtn.click();
  });
});
