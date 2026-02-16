/**
 * 연금복권 720+ 구매 자동화
 *
 * el.dhlottery.co.kr 팝업 방식 (iframe 사용)
 * 요일별로 조 선택: 월=1조, 화=2조, 수=3조, 목=4조, 금=5조
 *
 * 로또와 동일한 "선검증 후구매" 패턴:
 * 1. 구매 시도 전에 먼저 최근 구매 여부 확인
 * 2. 구매 실행
 * 3. 구매 후 최종 검증 (5분 이내 구매 내역 확인)
 */

import type { Page } from 'playwright';
import type { PurchasedPensionTicket, PensionGroup } from '../../domain/ticket.js';
import { purchaseSelectors, getGroupByDayOfWeek, getDayName } from '../selectors.js';
import { saveErrorScreenshot } from '../../../shared/browser/context.js';
import { AppError } from '../../../shared/utils/error.js';
import { withRetry } from '../../../shared/utils/retry.js';
import { verifyRecentPurchase, checkRecentPurchase } from './check-purchase.js';

/**
 * 구매 액션만 수행 (검증 없이)
 */
async function executePurchase(page: Page, selectedGroup: PensionGroup): Promise<void> {
  // 1. 구매 페이지로 직접 이동 (el.dhlottery.co.kr 모바일)
  console.log('구매 페이지로 이동 중...');
  await page.goto(purchaseSelectors.purchaseUrl, { timeout: 60000 });
  await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
  console.log(`페이지 로드 완료 - URL: ${page.url()}`);

  // 2. 번호 선택하기 클릭
  console.log('번호 선택하기 클릭...');
  await page.getByRole('link', { name: '+ 번호 선택하기' }).click();

  // 3. 조 선택
  console.log(`${selectedGroup}조 선택 중...`);
  await page.getByText(`${selectedGroup}조`, { exact: true }).click();
  console.log(`${selectedGroup}조 선택 완료`);

  // 4. 자동번호 클릭
  console.log('자동번호 클릭...');
  await page.getByRole('link', { name: '자동번호' }).click();

  // 5. 선택완료 클릭
  console.log('선택완료 클릭...');
  await page.getByRole('link', { name: '선택완료' }).click();

  // 6. 구매하기 클릭 (dialog 처리)
  console.log('구매하기 클릭...');
  page.once('dialog', async (dialog) => {
    console.log(`Dialog: ${dialog.message()}`);
    await dialog.accept();
  });

  await page.getByRole('link', { name: '구매하기' }).click();

  // 구매 완료 대기 (페이지 상태 변화 대기)
  await page.waitForTimeout(2000);
  console.log('구매 요청 완료');
}

/**
 * 연금복권 720+ 구매
 *
 * @param page Playwright Page 인스턴스 (로그인된 상태, 메인 페이지)
 * @param dryRun true면 구매 버튼 클릭 전에 멈춤 (기본값: true)
 * @param group 조 번호 (1~5), 미지정 시 요일별 자동 선택
 * @returns 구매한 티켓 목록 (dryRun이면 빈 배열)
 */
export async function purchasePension(
  page: Page,
  dryRun: boolean = true,
  group?: PensionGroup
): Promise<PurchasedPensionTicket[]> {
  // 조 결정: 파라미터 없으면 요일별 자동 선택
  const selectedGroup = group ?? getGroupByDayOfWeek() as PensionGroup;
  const dayOfWeek = new Date().getDay();
  console.log(`선택된 조: ${selectedGroup}조 (${getDayName(dayOfWeek)}요일)`);

  // === DRY RUN 모드 ===
  if (dryRun) {
    return await executeDryRun(page, selectedGroup);
  }

  // === 실제 구매 진행 ===
  try {
    // 1. 먼저 최근 구매 확인 (이미 구매된 경우 스킵)
    console.log('최근 구매 여부 확인 중...');
    const existingTicket = await checkRecentPurchase(page, 5);
    if (existingTicket) {
      console.log('이미 최근 5분 내 구매된 티켓 발견, 구매 스킵');
      console.log(`  회차: ${existingTicket.round}회`);
      console.log(`  조: ${existingTicket.pensionNumber.group}조`);
      console.log(`  번호: ${existingTicket.pensionNumber.number}`);
      return [existingTicket];
    }
    console.log('최근 구매 내역 없음, 구매 진행');

    // 2. 구매 실행 (retry 포함)
    await withRetry(
      async () => {
        await executePurchase(page, selectedGroup);
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000,
        maxDelayMs: 15000,
      }
    );

    // 3. 최종 검증 (구매 내역에서 5분 이내 구매 확인)
    console.log('구매 내역에서 검증 중...');
    const verifiedTicket = await verifyRecentPurchase(page, 5);

    if (!verifiedTicket) {
      throw new AppError({
        code: 'PURCHASE_VERIFICATION_FAILED',
        category: 'BUSINESS',
        retryable: false,
        message: '구매 검증 실패: 5분 이내 구매 내역을 찾을 수 없습니다',
      });
    }

    console.log('연금복권 구매 검증 완료!');
    console.log(`  회차: ${verifiedTicket.round}회`);
    console.log(`  조: ${verifiedTicket.pensionNumber.group}조`);
    console.log(`  번호: ${verifiedTicket.pensionNumber.number}`);
    console.log(`  모드: ${verifiedTicket.mode === 'auto' ? '자동' : '수동'}`);

    return [verifiedTicket];
  } catch (error) {
    await saveErrorScreenshot(page, 'pension-purchase-error');
    throw error;
  }
}

/**
 * DRY RUN 모드 실행
 */
async function executeDryRun(page: Page, selectedGroup: PensionGroup): Promise<PurchasedPensionTicket[]> {
  return await withRetry(
    async () => {
      try {
        // 1. 구매 페이지로 직접 이동
        console.log('구매 페이지로 이동 중...');
        await page.goto(purchaseSelectors.purchaseUrl, { timeout: 60000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 60000 });
        console.log(`페이지 로드 완료 - URL: ${page.url()}`);

        // 2. 번호 선택하기 클릭
        console.log('번호 선택하기 클릭...');
        await page.getByRole('link', { name: '+ 번호 선택하기' }).click();

        // 3. 조 선택
        console.log(`${selectedGroup}조 선택 중...`);
        await page.getByText(`${selectedGroup}조`, { exact: true }).click();
        console.log(`${selectedGroup}조 선택 완료`);

        // 4. 자동번호 클릭
        console.log('자동번호 클릭...');
        await page.getByRole('link', { name: '자동번호' }).click();

        // 5. 선택완료 클릭
        console.log('선택완료 클릭...');
        await page.getByRole('link', { name: '선택완료' }).click();

        // DRY RUN: 여기서 멈춤
        console.log('🔸 DRY RUN 모드: 구매하기 버튼 클릭 전 멈춤');
        console.log('🔸 실제 구매를 원하면 DRY_RUN=false로 실행하세요');
        await saveErrorScreenshot(page, 'pension-dry-run-before-buy');
        return [];
      } catch (error) {
        await saveErrorScreenshot(page, 'pension-dry-run-error');
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
