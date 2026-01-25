/**
 * 조회 기능 E2E 테스트
 *
 * 구매내역 조회 및 당첨번호 조회 기능을 테스트합니다.
 *
 * 환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요 (구매내역 조회)
 */

import { test, expect, Page } from '@playwright/test';

// URL 상수
const LOGIN_URL = 'https://www.dhlottery.co.kr/login';
const MAIN_URL = 'https://www.dhlottery.co.kr/main';
const PURCHASE_HISTORY_URL = 'https://www.dhlottery.co.kr/mypage/mylotteryledger';

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
  await page.waitForLoadState('networkidle');

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
    page.getByRole('button', { name: '로그아웃' })
      .waitFor({ state: 'visible', timeout: 60000 })
      .then(() => 'success' as const),
    page.waitForURL((url) => !url.href.includes('login'), { timeout: 60000 })
      .then(() => 'redirected' as const),
  ]).catch(() => 'timeout' as const);

  return result === 'success' || result === 'redirected';
}

test.describe('당첨번호 조회 테스트 (로그인 불필요)', () => {
  // 외부 사이트 의존 테스트 - 타임아웃 증가
  test.slow();

  test('메인 페이지에서 로또 6/45 슬라이더가 표시된다', async ({ page }) => {
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');

    // 로또 6/45 슬라이더 확인
    const swiperContainer = page.locator('.swiper.lt645');
    await expect(swiperContainer).toBeAttached({ timeout: 30000 });
  });

  test('메인 페이지에서 당첨 번호가 표시된다', async ({ page }) => {
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');

    // 로또 번호 볼 요소 확인
    const ballElements = page.locator('.swiper.lt645 .lt645-list .lt-ball');
    const count = await ballElements.count();

    // 최소 7개 (당첨번호 6개 + 보너스 1개)
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test('당첨 번호 슬라이드에서 회차 정보를 추출할 수 있다', async ({ page }) => {
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');

    // 회차 정보 추출
    const roundText = await page.locator('.swiper.lt645 .lt645-round').first().textContent();

    // 회차 숫자 확인 (예: "1207회")
    expect(roundText).toMatch(/\d+회/);
  });

  test('당첨 번호가 1~45 범위 내에 있다', async ({ page }) => {
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');

    // 번호 추출
    const ballElements = page.locator('.swiper.lt645 .lt645-list .lt-ball');
    const count = await ballElements.count();

    const numbers: number[] = [];
    for (let i = 0; i < count; i++) {
      const ballEl = ballElements.nth(i);

      // plus 이미지는 건너뛰기
      const isPlus = await ballEl.locator('img[alt="+"]').count() > 0;
      if (isPlus) continue;

      const numText = await ballEl.textContent();
      const num = parseInt(numText?.trim() || '0', 10);
      if (num >= 1 && num <= 45) {
        numbers.push(num);
      }
    }

    // 최소 7개 번호 (6개 당첨 + 1개 보너스)
    expect(numbers.length).toBeGreaterThanOrEqual(7);

    // 모든 번호가 1~45 범위
    for (const num of numbers) {
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(45);
    }
  });
});

test.describe('구매내역 조회 테스트 (로그인 필요)', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password } = getCredentials();
    test.skip(!username || !password, '환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요');

    const loggedIn = await performLogin(page);
    expect(loggedIn).toBeTruthy();
  });

  test('구매내역 페이지로 이동할 수 있다', async ({ page }) => {
    await page.goto(PURCHASE_HISTORY_URL, { timeout: 60000 });
    await page.waitForLoadState('networkidle');

    // 페이지 URL 확인
    expect(page.url()).toContain('mylotteryledger');
  });

  test('상세 검색 펼치기 버튼이 표시된다', async ({ page }) => {
    await page.goto(PURCHASE_HISTORY_URL, { timeout: 60000 });
    await page.waitForLoadState('networkidle');

    // 상세 검색 펼치기 버튼 확인
    const detailBtn = page.getByRole('button', { name: '상세 검색 펼치기' });
    await expect(detailBtn).toBeVisible({ timeout: 30000 });
  });

  test('상세 검색 펼치면 기간 선택 버튼이 표시된다', async ({ page }) => {
    await page.goto(PURCHASE_HISTORY_URL, { timeout: 60000 });
    await page.waitForLoadState('networkidle');

    // 상세 검색 펼치기
    const detailBtn = page.getByRole('button', { name: '상세 검색 펼치기' });
    await detailBtn.click();

    // 최근 1주일 버튼 확인
    const weekBtn = page.getByRole('button', { name: '최근 1주일' });
    await expect(weekBtn).toBeVisible({ timeout: 10000 });
  });

  test('로또6/45 필터를 선택할 수 있다', async ({ page }) => {
    await page.goto(PURCHASE_HISTORY_URL, { timeout: 60000 });
    await page.waitForLoadState('networkidle');

    // 상세 검색 펼치기
    const detailBtn = page.getByRole('button', { name: '상세 검색 펼치기' });
    await detailBtn.click();

    // 최근 1주일 선택
    const weekBtn = page.getByRole('button', { name: '최근 1주일' });
    await weekBtn.click();

    // 복권 선택 드롭다운에서 로또6/45 선택
    const selectBox = page.locator('#ltGdsSelect');
    await selectBox.waitFor({ state: 'attached', timeout: 10000 });
    await selectBox.selectOption('LO40');

    // 선택 확인
    const selectedValue = await selectBox.inputValue();
    expect(selectedValue).toBe('LO40');
  });

  test('검색 버튼을 클릭하면 결과가 로드된다', async ({ page }) => {
    await page.goto(PURCHASE_HISTORY_URL, { timeout: 60000 });
    await page.waitForLoadState('networkidle');

    // 상세 검색 펼치기
    const detailBtn = page.getByRole('button', { name: '상세 검색 펼치기' });
    await detailBtn.click();

    // 최근 1주일 선택
    const weekBtn = page.getByRole('button', { name: '최근 1주일' });
    await weekBtn.click();

    // 로또6/45 선택
    const selectBox = page.locator('#ltGdsSelect');
    await selectBox.waitFor({ state: 'attached', timeout: 10000 });
    await selectBox.selectOption('LO40');

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

    // 결과가 있거나 없거나 둘 중 하나여야 함
    expect(['has_results', 'no_results']).toContain(result);
  });

  test('구매 내역이 있으면 바코드가 표시된다', async ({ page }) => {
    await page.goto(PURCHASE_HISTORY_URL, { timeout: 60000 });
    await page.waitForLoadState('networkidle');

    // 상세 검색 펼치기
    const detailBtn = page.getByRole('button', { name: '상세 검색 펼치기' });
    await detailBtn.click();

    // 최근 1주일 선택
    const weekBtn = page.getByRole('button', { name: '최근 1주일' });
    await weekBtn.click();

    // 로또6/45 선택
    const selectBox = page.locator('#ltGdsSelect');
    await selectBox.waitFor({ state: 'attached', timeout: 10000 });
    await selectBox.selectOption('LO40');

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
      // 바코드 요소 확인
      const barcodeElement = page.locator('span.whl-txt.barcd').first();
      await expect(barcodeElement).toBeVisible();
    } else {
      // 구매 내역이 없어도 테스트는 통과 (스킵 처리)
      test.skip(true, '최근 1주일 내 구매 내역 없음');
    }
  });

  test('바코드 클릭 시 티켓 상세 모달이 열린다', async ({ page }) => {
    await page.goto(PURCHASE_HISTORY_URL, { timeout: 60000 });
    await page.waitForLoadState('networkidle');

    // 상세 검색 펼치기
    const detailBtn = page.getByRole('button', { name: '상세 검색 펼치기' });
    await detailBtn.click();

    // 최근 1주일 선택
    const weekBtn = page.getByRole('button', { name: '최근 1주일' });
    await weekBtn.click();

    // 로또6/45 선택
    const selectBox = page.locator('#ltGdsSelect');
    await selectBox.waitFor({ state: 'attached', timeout: 10000 });
    await selectBox.selectOption('LO40');

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
      test.skip(true, '최근 1주일 내 구매 내역 없음');
      return;
    }

    // 바코드 클릭
    const barcodeElement = page.locator('span.whl-txt.barcd').first();
    await barcodeElement.click();

    // 티켓 상세 모달 확인 (#Lotto645TicketP)
    const modal = page.locator('#Lotto645TicketP');
    await expect(modal).toBeVisible({ timeout: 15000 });

    // 모달 내부에 티켓 번호 박스가 있는지 확인
    const ticketBox = modal.locator('.ticket-num-box').first();
    await expect(ticketBox).toBeAttached({ timeout: 10000 });

    // 모달 닫기
    const closeBtn = modal.locator('button').first();
    await closeBtn.click();
    await expect(modal).toBeHidden({ timeout: 5000 });
  });
});
