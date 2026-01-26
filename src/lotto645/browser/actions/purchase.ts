/**
 * 로또 구매 자동화
 *
 * ol.dhlottery.co.kr 직접 접근 방식 (iframe 없음)
 * 로그인 후 구매 페이지로 직접 이동하여 구매
 *
 * 중복 구매 방지를 위한 "선검증 후구매" 패턴:
 * 1. 구매 시도 전에 먼저 최근 구매 여부 확인
 * 2. 구매 실행 (retry 시에도 먼저 구매 여부 재확인)
 * 3. 구매 후 최종 검증
 */

import type { Page } from 'playwright';
import type { PurchasedTicket } from '../../domain/ticket.js';
import { purchaseSelectors } from '../selectors.js';
import { saveErrorScreenshot } from '../../../shared/browser/context.js';
import { withRetry } from '../../../shared/utils/retry.js';
import { verifyRecentPurchase, checkRecentPurchase } from './check-purchase.js';

/**
 * 요소 디버그 정보 출력
 */
async function debugElement(_page: Page, locator: ReturnType<Page['locator']>, name: string): Promise<void> {
  try {
    const box = await locator.boundingBox().catch(() => null);
    const isVisible = await locator.isVisible().catch(() => false);
    const isEnabled = await locator.isEnabled().catch(() => false);
    const tagName = await locator.evaluate((el) => el.tagName).catch(() => 'unknown');
    const className = await locator.evaluate((el) => el.className).catch(() => '');
    const id = await locator.evaluate((el) => el.id).catch(() => '');
    const innerText = await locator.evaluate((el) => (el as HTMLElement).innerText?.substring(0, 50)).catch(() => '');

    console.log(`[DEBUG] ${name}:`);
    console.log(`  - visible: ${isVisible}, enabled: ${isEnabled}`);
    console.log(`  - tag: ${tagName}, id: "${id}", class: "${className}"`);
    console.log(`  - boundingBox: ${box ? `x=${box.x}, y=${box.y}, w=${box.width}, h=${box.height}` : 'null'}`);
    console.log(`  - text: "${innerText}"`);
  } catch (e) {
    console.log(`[DEBUG] ${name}: 정보 수집 실패 - ${e}`);
  }
}

/**
 * 구매 액션만 수행 (검증 없이)
 *
 * 구매 페이지 이동 → 자동번호발급 → 확인 → 구매하기 → 확인 팝업
 * retry 로직 없이 단일 실행만 수행
 *
 * @param page Playwright Page 인스턴스 (로그인된 상태)
 * @throws {Error} 구매 실패 시
 */
async function executePurchase(page: Page): Promise<void> {
  // === 환경 정보 출력 ===
  console.log('\n========== 구매 실행 시작 ==========');
  console.log(`[ENV] 실행 시각: ${new Date().toISOString()}`);
  console.log(`[ENV] Node.js: ${process.version}`);
  console.log(`[ENV] Platform: ${process.platform}`);
  console.log(`[ENV] HEADED: ${process.env.HEADED || 'false (headless)'}`);

  // 브라우저 정보
  const userAgent = await page.evaluate(() => navigator.userAgent);
  const webdriver = await page.evaluate(() => (navigator as Navigator & { webdriver?: boolean }).webdriver);
  const platform = await page.evaluate(() => navigator.platform);
  console.log(`[BROWSER] userAgent: ${userAgent}`);
  console.log(`[BROWSER] webdriver: ${webdriver}`);
  console.log(`[BROWSER] platform: ${platform}`);

  // 네트워크 요청 모니터링 설정
  const networkRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('dhlottery') && (req.url().includes('Buy') || req.url().includes('buy'))) {
      networkRequests.push(`[REQ] ${req.method()} ${req.url()}`);
      console.log(`[NETWORK] 요청 감지: ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', (res) => {
    if (res.url().includes('dhlottery') && (res.url().includes('Buy') || res.url().includes('buy'))) {
      console.log(`[NETWORK] 응답 감지: ${res.status()} ${res.url()}`);
    }
  });

  // 1. 구매 페이지로 직접 이동 (ol.dhlottery.co.kr)
  console.log('\n[STEP 1] 구매 페이지로 이동 중...');
  const startTime = Date.now();
  await page.goto(purchaseSelectors.purchaseUrl, { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
  console.log(`[STEP 1] 완료 (${Date.now() - startTime}ms) - URL: ${page.url()}`);

  // 알림 팝업이 있으면 닫기 (예: 판매시간 안내 등)
  await dismissAlertPopup(page);

  // 2. 자동번호발급 링크 클릭 → 번호 생성 팝업 대기
  console.log('\n[STEP 2] 자동번호발급 링크 찾는 중...');
  const autoNumberLink = page.getByRole(purchaseSelectors.autoNumberLink.role, {
    name: purchaseSelectors.autoNumberLink.name,
  });
  await autoNumberLink.waitFor({ state: 'visible', timeout: 30000 });
  await debugElement(page, autoNumberLink, '자동번호발급 링크');
  console.log('[STEP 2] 자동번호발급 클릭...');
  await autoNumberLink.click();
  console.log('[STEP 2] 클릭 완료');

  // 3. 확인 버튼 클릭 (번호 생성 완료 후 나타남) → A슬롯에 번호 추가됨
  console.log('\n[STEP 3] 확인 버튼 찾는 중...');
  const confirmBtn = page.getByRole(purchaseSelectors.confirmButton.role, {
    name: purchaseSelectors.confirmButton.name,
  });
  await confirmBtn.waitFor({ state: 'visible', timeout: 30000 });
  await debugElement(page, confirmBtn, '확인 버튼');
  console.log('[STEP 3] 확인 버튼 클릭...');
  await confirmBtn.click();

  // 확인 버튼이 사라질 때까지 대기 (번호가 슬롯에 추가되면 버튼 사라짐)
  await confirmBtn.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  console.log('[STEP 3] 번호 선택 완료');

  // 4. 구매하기 버튼 클릭 → 구매 확인 팝업 표시
  console.log('\n[STEP 4] 구매하기 버튼 찾는 중...');
  const buyBtn = page.getByRole(purchaseSelectors.buyButton.role, {
    name: purchaseSelectors.buyButton.name,
  });
  await buyBtn.waitFor({ state: 'visible', timeout: 30000 });
  await debugElement(page, buyBtn, '구매하기 버튼');
  console.log('[STEP 4] 구매하기 버튼 클릭...');
  await buyBtn.click();
  console.log('[STEP 4] 클릭 완료');

  // 5. 구매 확인 팝업에서 확인 클릭 + 구매 API 응답 대기
  console.log('\n[STEP 5] 구매 확인 팝업 대기 중...');
  const confirmPopup = page.locator(purchaseSelectors.confirmPopup);
  await confirmPopup.waitFor({ state: 'visible', timeout: 30000 });

  // 팝업 HTML 구조 덤프
  const popupHtml = await confirmPopup.innerHTML().catch(() => 'HTML 가져오기 실패');
  console.log(`[DEBUG] 팝업 HTML 구조:\n${popupHtml.substring(0, 500)}...`);

  // 팝업 내 모든 버튼 찾기
  const allButtons = await confirmPopup.locator('button, input[type="button"], a.btn').all();
  console.log(`[DEBUG] 팝업 내 버튼 개수: ${allButtons.length}`);
  for (let i = 0; i < allButtons.length; i++) {
    const btnText = await allButtons[i].textContent().catch(() => '');
    const btnTag = await allButtons[i].evaluate((el) => el.tagName).catch(() => '');
    const btnClass = await allButtons[i].evaluate((el) => el.className).catch(() => '');
    console.log(`[DEBUG] 버튼[${i}]: tag=${btnTag}, class="${btnClass}", text="${btnText?.trim()}"`);
  }

  const confirmPopupBtn = confirmPopup.getByRole(purchaseSelectors.confirmPopupButton.role, {
    name: purchaseSelectors.confirmPopupButton.name,
  });
  await confirmPopupBtn.waitFor({ state: 'visible', timeout: 10000 });
  await debugElement(page, confirmPopupBtn, '구매 확인 팝업 - 확인 버튼');
  console.log('[STEP 5] 구매 확인 팝업 표시됨');

  // 구매 직전 스크린샷 (디버깅용)
  await saveErrorScreenshot(page, 'before-purchase-confirm');

  // 구매 API 응답 리스너 등록 후 클릭
  console.log('\n[STEP 6] 구매 API 응답 리스너 등록...');
  const responsePromise = page.waitForResponse(
    (resp) => {
      const url = resp.url();
      const matches = url.includes('gameBuy.do') || url.includes('buy') || url.includes('Buy');
      if (matches) {
        console.log(`[NETWORK] Response 매칭: ${url}`);
      }
      return url.includes('execBuy.do');
    },
    { timeout: 30000 }
  );

  console.log('[STEP 6] 구매 확인 버튼 클릭 시도...');
  const clickStartTime = Date.now();

  // 클릭 전 버튼 상태 다시 확인
  const btnVisibleBefore = await confirmPopupBtn.isVisible();
  const btnEnabledBefore = await confirmPopupBtn.isEnabled();
  console.log(`[STEP 6] 클릭 전 상태 - visible: ${btnVisibleBefore}, enabled: ${btnEnabledBefore}`);

  await confirmPopupBtn.click();
  console.log(`[STEP 6] 클릭 완료 (${Date.now() - clickStartTime}ms)`);

  // 클릭 후 팝업 상태 확인
  await page.waitForTimeout(500); // 짧은 대기
  const popupVisibleAfter = await confirmPopup.isVisible().catch(() => 'error');
  console.log(`[STEP 6] 클릭 후 팝업 visible: ${popupVisibleAfter}`);

  // 구매 API 응답 대기
  console.log('[STEP 6] 구매 API 응답 대기 중 (30초 타임아웃)...');
  const purchaseResponse = await responsePromise.catch((e) => {
    console.error(`[STEP 6] 구매 API 응답 대기 실패: ${e.message}`);
    return null;
  });

  if (purchaseResponse) {
    const responseText = await purchaseResponse.text().catch(() => '');
    console.log(`[STEP 6] 구매 API 응답 수신!`);
    console.log(`[STEP 6] - URL: ${purchaseResponse.url()}`);
    console.log(`[STEP 6] - Status: ${purchaseResponse.status()}`);
    console.log(`[STEP 6] - Body: ${responseText.substring(0, 300)}`);
  } else {
    console.warn('[STEP 6] 구매 API 호출이 감지되지 않음');
    console.log(`[STEP 6] 감지된 네트워크 요청들: ${networkRequests.length > 0 ? networkRequests.join('\n') : '없음'}`);
    await saveErrorScreenshot(page, 'no-purchase-api');
  }

  // 결과 스크린샷
  await saveErrorScreenshot(page, 'after-purchase-confirm');

  // 6. 구매 완료 레이어 확인 (#closeLayer 버튼이 있는 결과 팝업)
  console.log('\n[STEP 7] 구매 완료 레이어 확인 중...');
  const closeBtn = page.locator('#closeLayer');
  const hasCloseBtn = await closeBtn.isVisible().catch(() => false);
  console.log(`[STEP 7] 구매 완료 레이어 표시: ${hasCloseBtn}`);

  if (hasCloseBtn) {
    await debugElement(page, closeBtn, '닫기 버튼');
  }

  // 현재 페이지 상태 덤프
  const visiblePopups = await page.locator('.layer, [class*="popup"], [class*="modal"]').all();
  console.log(`[DEBUG] 현재 표시된 레이어/팝업 개수: ${visiblePopups.length}`);
  for (let i = 0; i < Math.min(visiblePopups.length, 5); i++) {
    const popupVisible = await visiblePopups[i].isVisible().catch(() => false);
    const popupClass = await visiblePopups[i].evaluate((el) => el.className).catch(() => '');
    if (popupVisible) {
      console.log(`[DEBUG] 팝업[${i}]: class="${popupClass}"`);
    }
  }

  // 에러 팝업 확인 (.layer-alert에 에러 메시지가 있는지)
  const errorAlert = page.locator('.layer-alert');
  if (await errorAlert.isVisible().catch(() => false)) {
    const errorMessage = await errorAlert.textContent().catch(() => '');
    const cleanMessage = errorMessage?.replace(/\s+/g, ' ').trim() || '알 수 없는 오류';
    console.log(`[DEBUG] 에러 팝업 발견: ${cleanMessage}`);

    // 에러 메시지 확인
    if (
      cleanMessage.includes('예치금') ||
      cleanMessage.includes('잔액') ||
      cleanMessage.includes('세션') ||
      cleanMessage.includes('로그인') ||
      cleanMessage.includes('실패') ||
      cleanMessage.includes('오류')
    ) {
      console.error(`[ERROR] 구매 실패 팝업: ${cleanMessage}`);
      throw new Error(`구매 실패: ${cleanMessage}`);
    }
    console.log(`[DEBUG] 알림 팝업 내용: ${cleanMessage}`);
  }

  // 7. 닫기 버튼 클릭 (구매 결과 팝업이 있으면)
  if (hasCloseBtn) {
    console.log('[STEP 7] 닫기 버튼 클릭...');
    await closeBtn.click();
    console.log('[STEP 7] 구매 결과 팝업 닫기 완료');
  } else {
    console.warn('[STEP 7] 구매 결과 팝업이 표시되지 않음 - 구매 실패 가능성');
  }

  console.log('\n========== 구매 요청 완료 ==========\n');
}

/**
 * 로또 구매 (중복 구매 방지 패턴 적용)
 *
 * "선검증 후구매" 패턴:
 * 1. 구매 시도 전에 먼저 최근 구매 여부 확인 → 있으면 스킵
 * 2. 구매 실행 (retry 전에도 매번 구매 여부 재확인)
 * 3. 구매 후 최종 검증
 *
 * @param page Playwright Page 인스턴스 (로그인된 상태)
 * @param dryRun true면 구매 버튼 클릭 전에 멈춤 (기본값: true)
 * @returns 구매한 티켓 목록 (dryRun이면 빈 배열)
 * @throws {Error} 실패 시
 */
export async function purchaseLotto(
  page: Page,
  dryRun: boolean = true
): Promise<PurchasedTicket[]> {
  // === DRY RUN 모드 ===
  if (dryRun) {
    return await executeDryRun(page);
  }

  // === 실제 구매 진행 ===
  try {
    // 1. 먼저 최근 구매 확인 (이미 구매된 경우 스킵)
    console.log('최근 구매 여부 확인 중...');
    const existingTicket = await checkRecentPurchase(page, 5);
    if (existingTicket) {
      console.log('이미 최근 5분 내 구매된 티켓 발견, 구매 스킵');
      console.log(`  회차: ${existingTicket.round}회`);
      console.log(`  슬롯: ${existingTicket.slot} (${existingTicket.mode === 'auto' ? '자동' : '수동'})`);
      console.log(`  번호: ${existingTicket.numbers.join(', ')}`);
      return [existingTicket];
    }
    console.log('최근 구매 내역 없음, 구매 진행');

    // 2. 구매 실행 (retry 포함)
    // 참고: 구매 성공 후 검증 실패로 retry 시 중복 구매 가능성 있음
    // → executePurchase 내부에서 구매 API 응답으로 성공 여부 확인
    await withRetry(
      async () => {
        await executePurchase(page);
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000,
        maxDelayMs: 15000,
      }
    );

    // 3. 최종 검증
    console.log('구매 내역에서 검증 중...');
    const verifiedTicket = await verifyRecentPurchase(page, 5);

    if (!verifiedTicket) {
      throw new Error('구매 검증 실패: 5분 이내 구매 내역을 찾을 수 없습니다');
    }

    console.log(`로또 구매 검증 완료!`);
    console.log(`  회차: ${verifiedTicket.round}회`);
    console.log(`  슬롯: ${verifiedTicket.slot} (${verifiedTicket.mode === 'auto' ? '자동' : '수동'})`);
    console.log(`  번호: ${verifiedTicket.numbers.join(', ')}`);

    return [verifiedTicket];
  } catch (error) {
    await saveErrorScreenshot(page, 'purchase-error');
    throw error;
  }
}

/**
 * DRY RUN 모드 실행
 *
 * 구매하기 버튼 클릭 → 확인 팝업에서 취소 클릭 (실제 구매 안함)
 */
async function executeDryRun(page: Page): Promise<PurchasedTicket[]> {
  return await withRetry(
    async () => {
      try {
        // 1. 구매 페이지로 직접 이동 (ol.dhlottery.co.kr)
        console.log('구매 페이지로 이동 중...');
        await page.goto(purchaseSelectors.purchaseUrl, { timeout: 60000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
        console.log(`페이지 로드 완료 - URL: ${page.url()}`);

        // 알림 팝업이 있으면 닫기 (예: 판매시간 안내 등)
        await dismissAlertPopup(page);

        // 2. 자동번호발급 링크 클릭
        const autoNumberLink = page.getByRole(purchaseSelectors.autoNumberLink.role, {
          name: purchaseSelectors.autoNumberLink.name,
        });
        await autoNumberLink.waitFor({ state: 'visible', timeout: 30000 });
        console.log('자동번호발급 클릭...');
        await autoNumberLink.click();

        // 3. 확인 버튼 클릭 (슬롯 추가)
        const confirmBtn = page.getByRole(purchaseSelectors.confirmButton.role, {
          name: purchaseSelectors.confirmButton.name,
        });
        await confirmBtn.waitFor({ state: 'visible', timeout: 30000 });
        console.log('확인 버튼 클릭...');
        await confirmBtn.click();

        // 확인 버튼이 사라질 때까지 대기
        await confirmBtn.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
        console.log('번호 선택 완료');

        // 4. 구매하기 버튼 클릭
        const buyBtn = page.getByRole(purchaseSelectors.buyButton.role, {
          name: purchaseSelectors.buyButton.name,
        });
        await buyBtn.waitFor({ state: 'visible', timeout: 30000 });
        console.log('구매하기 버튼 클릭...');
        await buyBtn.click();

        // 5. 구매 확인 팝업 대기
        const confirmPopup = page.locator(purchaseSelectors.confirmPopup);
        await confirmPopup.waitFor({ state: 'visible', timeout: 30000 });
        console.log('구매 확인 팝업 표시됨');

        await saveErrorScreenshot(page, 'dry-run-before-cancel');

        // 6. 취소 버튼 클릭 (DRY RUN - 실제 구매 안함)
        const cancelBtn = confirmPopup.getByRole('button', { name: '취소' });
        await cancelBtn.waitFor({ state: 'visible', timeout: 10000 });
        console.log('🔸 DRY RUN: 취소 버튼 클릭...');
        await cancelBtn.click();

        // 팝업이 닫힐 때까지 대기
        await confirmPopup.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

        console.log('🔸 DRY RUN 완료: 구매 확인 팝업까지 정상 동작');
        console.log('🔸 실제 구매를 원하면 DRY_RUN=false로 실행하세요');
        return [];
      } catch (error) {
        await saveErrorScreenshot(page, 'dry-run-error');
        throw error;
      }
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 15000,
    }
  );
}

/**
 * 알림 팝업 닫기 (#popupLayerAlert)
 * 판매시간 안내 등 다양한 알림이 표시될 수 있음
 */
async function dismissAlertPopup(page: Page): Promise<void> {
  try {
    const popup = page.locator('#popupLayerAlert');
    const isVisible = await popup.isVisible().catch(() => false);

    if (isVisible) {
      // 팝업 메시지 로깅
      const message = await popup.locator('.layer-message').textContent().catch(() => '');
      console.log(`알림 팝업 발견: ${message?.trim() || '(메시지 없음)'}`);

      // 확인 버튼 클릭하여 닫기
      const confirmBtn = popup.locator('input.confirm, button.confirm');
      await confirmBtn.click({ timeout: 5000 });
      console.log('알림 팝업 닫음');

      // 팝업이 닫힐 때까지 대기
      await popup.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  } catch (error) {
    console.log('알림 팝업 처리 중 오류 (무시):', error);
  }
}
