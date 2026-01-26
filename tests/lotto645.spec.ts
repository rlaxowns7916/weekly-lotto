/**
 * 로또 6/45 E2E 테스트
 *
 * 1. 당첨번호 조회 테스트 (로그인 불필요)
 * 2. 구매 플로우 테스트 (로그인 필요)
 * 3. 구매내역 조회 테스트 (로그인 필요)
 *
 * 환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요 (구매/조회 테스트)
 */

import { test, expect, Page } from '@playwright/test';

// URL 상수
const MAIN_URL = 'https://www.dhlottery.co.kr/main';
const LOGIN_URL = 'https://www.dhlottery.co.kr/login';
const PURCHASE_URL = 'https://ol.dhlottery.co.kr/olotto/game/game645.do';
const PURCHASE_HISTORY_URL = 'https://www.dhlottery.co.kr/mypage/mylotteryledger';

// 로또 6/45 복권 상품 코드
const PRODUCT_CODE = 'LO40';
// 티켓 모달 ID
const MODAL_ID = '#Lotto645TicketP';

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
async function dismissAlertPopup(page: Page): Promise<boolean> {
  try {
    const popup = page.locator('#popupLayerAlert');
    const isVisible = await popup.isVisible().catch(() => false);

    if (isVisible) {
      const confirmBtn = popup.locator('input.confirm, button.confirm');
      await confirmBtn.click({ timeout: 5000 });
      await popup.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      return true;
    }
    return false;
  } catch {
    // 팝업이 없으면 무시
    return false;
  }
}

test.describe('로또 6/45 당첨번호 조회 테스트 (로그인 불필요)', () => {
  // 로그인 불필요 - 병렬 실행 가능
  test.describe.configure({ mode: 'parallel' });
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

  test('보너스 번호가 1~45 범위 내에 있다', async ({ page }) => {
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');

    // 보너스 번호 요소 (+ 아이콘 다음에 오는 마지막 번호)
    const ballElements = page.locator('.swiper.lt645 .lt645-list .lt-ball');
    const count = await ballElements.count();

    // 마지막 번호가 보너스 번호
    const lastBall = ballElements.nth(count - 1);
    const bonusText = await lastBall.textContent();
    const bonusNum = parseInt(bonusText?.trim() || '0', 10);

    expect(bonusNum).toBeGreaterThanOrEqual(1);
    expect(bonusNum).toBeLessThanOrEqual(45);
  });

  test('추첨일 정보가 표시된다', async ({ page }) => {
    await page.goto(MAIN_URL, { timeout: 120000 });
    await page.waitForLoadState('domcontentloaded');

    // 추첨일 정보 (lt645-date 클래스)
    const dateText = await page.locator('.swiper.lt645 .lt645-date').first().textContent();

    // 날짜 형식 확인 (예: "2024.01.06")
    expect(dateText).toMatch(/\d{4}\.\d{2}\.\d{2}/);
  });
});

test.describe('로또 6/45 구매 플로우 테스트 (로그인 필요)', () => {
  test.beforeEach(async ({ page }) => {
    const { username, password } = getCredentials();
    test.skip(!username || !password, '환경 변수 LOTTO_USERNAME, LOTTO_PASSWORD 필요');

    const loggedIn = await performLogin(page);
    expect(loggedIn).toBeTruthy();
  });

  test('구매 페이지에 직접 접근할 수 있다', async ({ page }) => {
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
    await page.screenshot({ path: 'test-results/lotto645-dry-run-before-buy.png' });

    // 실제 구매는 진행하지 않음
  });

  test('알림 팝업이 표시되면 닫을 수 있다', async ({ page }) => {
    // 구매 페이지로 직접 이동
    await page.goto(PURCHASE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');

    // 팝업이 나타날 수 있으므로 잠시 대기
    await page.waitForTimeout(2000);

    // 팝업 닫기 시도
    const wasClosed = await dismissAlertPopup(page);

    // 팝업이 있었다면 닫혔는지 확인, 없었다면 그냥 통과
    if (wasClosed) {
      const popup = page.locator('#popupLayerAlert');
      await expect(popup).toBeHidden({ timeout: 5000 });
    }

    // 페이지가 정상적으로 로드되었는지 확인
    expect(page.url()).toContain('ol.dhlottery.co.kr');
  });
});

test.describe('로또 6/45 구매내역 조회 테스트 (로그인 필요)', () => {
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
    await selectBox.selectOption(PRODUCT_CODE);

    // 선택 확인
    const selectedValue = await selectBox.inputValue();
    expect(selectedValue).toBe(PRODUCT_CODE);
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
      test.skip(true, '최근 1주일 내 구매 내역 없음');
      return;
    }

    // 바코드 클릭
    const barcodeElement = page.locator('span.whl-txt.barcd').first();
    await barcodeElement.click();

    // 티켓 상세 모달 확인
    const modal = page.locator(MODAL_ID);
    await expect(modal).toBeVisible({ timeout: 15000 });

    // 모달 내부에 티켓 번호 박스가 있는지 확인
    const ticketBox = modal.locator('.ticket-num-box').first();
    await expect(ticketBox).toBeAttached({ timeout: 10000 });

    // 모달 닫기
    const closeBtn = modal.locator('button').first();
    await closeBtn.click();
    await expect(modal).toBeHidden({ timeout: 5000 });
  });

  test('티켓 모달에서 회차 정보를 추출할 수 있다', async ({ page }) => {
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
      test.skip(true, '최근 1주일 내 구매 내역 없음');
      return;
    }

    // 바코드 클릭
    const barcodeElement = page.locator('span.whl-txt.barcd').first();
    await barcodeElement.click();

    // 티켓 상세 모달 대기
    const modal = page.locator(MODAL_ID);
    await modal.waitFor({ state: 'visible', timeout: 15000 });

    // 회차 정보 추출 (.ticket-title에서)
    const titleText = await modal.locator('.ticket-title').first().textContent();

    // 회차 숫자 확인 (예: "제1207회")
    expect(titleText).toMatch(/\d+회/);

    // 모달 닫기
    const closeBtn = modal.locator('button').first();
    await closeBtn.click();
  });

  test('티켓 모달에서 6개 번호를 추출할 수 있다', async ({ page }) => {
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
      test.skip(true, '최근 1주일 내 구매 내역 없음');
      return;
    }

    // 바코드 클릭
    const barcodeElement = page.locator('span.whl-txt.barcd').first();
    await barcodeElement.click();

    // 티켓 상세 모달 대기
    const modal = page.locator(MODAL_ID);
    await modal.waitFor({ state: 'visible', timeout: 15000 });

    // 6개 번호 추출 (.ticket-num-box .ball에서)
    const ticketBox = modal.locator('.ticket-num-box').first();
    const numberElements = ticketBox.locator('.ball');
    const count = await numberElements.count();

    // 6개인지 확인
    expect(count).toBe(6);

    // 각 번호가 1~45 범위인지 확인
    const numbers: number[] = [];
    for (let i = 0; i < count; i++) {
      const numText = await numberElements.nth(i).textContent();
      const num = parseInt(numText?.trim() || '0', 10);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(45);
      numbers.push(num);
    }

    console.log(`추출된 번호: ${numbers.join(', ')}`);

    // 모달 닫기
    const closeBtn = modal.locator('button').first();
    await closeBtn.click();
  });
});
