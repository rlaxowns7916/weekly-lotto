/**
 * 구매 내역 조회 및 티켓 파싱
 *
 * 재사용 가능한 모듈:
 * - 구매 후 번호 확인
 * - 당첨 여부 확인
 * - 최근 구매 검증
 */

import type { Page, Locator } from 'playwright';
import type { PurchasedTicket } from '../../domain/ticket.js';
import { parseSaleDate, isWithinMinutes } from '../../domain/ticket.js';
import { saveErrorScreenshot } from '../../../shared/browser/context.js';
import { withRetry } from '../../../shared/utils/retry.js';

/**
 * 티켓 모달에서 파싱한 상세 정보
 */
interface TicketDetails extends PurchasedTicket {
  /** 바코드 번호 */
  barcode?: string;
}

/**
 * 구매 내역 페이지로 이동
 */
export async function navigateToPurchaseHistory(page: Page): Promise<void> {
  await withRetry(
    async () => {
      // 구매내역 페이지로 직접 이동
      await page.goto('https://www.dhlottery.co.kr/mypage/mylotteryledger', { timeout: 60000 });
      await page.waitForLoadState('networkidle');

      // 상세 검색 펼치기
      const detailBtn = page.getByRole('button', { name: '상세 검색 펼치기' });
      await detailBtn.waitFor({ state: 'visible', timeout: 30000 });
      await detailBtn.click();

      // 최근 1주일 버튼이 보일 때까지 대기 후 클릭
      const weekBtn = page.getByRole('button', { name: '최근 1주일' });
      await weekBtn.waitFor({ state: 'visible', timeout: 10000 });
      await weekBtn.click();

      // 복권 선택 드롭다운이 활성화될 때까지 대기 후 로또6/45 선택
      const selectBox = page.locator('#ltGdsSelect');
      await selectBox.waitFor({ state: 'attached', timeout: 10000 });
      await selectBox.selectOption('LO40');

      // 검색 버튼 클릭
      const searchBtn = page.getByRole('button', { name: '검색', exact: true });
      await searchBtn.waitFor({ state: 'visible', timeout: 10000 });
      await searchBtn.click();

      // 검색 결과 로딩 대기: 결과 행이 나타나거나 "조회 결과가 없습니다" 메시지가 나타날 때까지
      await Promise.race([
        page.locator('li.whl-row').first().waitFor({ state: 'attached', timeout: 30000 }),
        page.locator('text=조회 결과가 없습니다').waitFor({ state: 'visible', timeout: 30000 }),
      ]);

      console.log('구매 내역 페이지 이동 완료');
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
    }
  ).catch(async (error) => {
    await saveErrorScreenshot(page, 'purchase-history-nav-error');
    throw error;
  });
}

/**
 * 티켓 모달에서 상세 정보 파싱
 *
 * @param modal 티켓 모달 Locator (#Lotto645TicketP)
 * @returns 파싱된 티켓 정보
 */
export async function parseTicketModal(modal: Locator): Promise<TicketDetails | null> {
  try {
    const modalText = await modal.textContent();

    // 회차 추출 (예: "1208회")
    const roundMatch = modalText?.match(/(\d+)\s*회/);
    const round = roundMatch ? parseInt(roundMatch[1], 10) : 0;

    // 발행일 추출 (예: "발행일 2026/01/24 (토) 18:20:39")
    const saleDateMatch = modalText?.match(/발행일\s*([\d/]+\s*\([^)]+\)\s*[\d:]+)/);
    const saleDate = saleDateMatch ? parseSaleDate(saleDateMatch[1]) : undefined;

    // 추첨일 추출 (예: "추첨일 2026/01/24")
    const drawDateMatch = modalText?.match(/추첨일\s*([\d/]+)/);
    const drawDate = drawDateMatch ? drawDateMatch[1].replace(/\//g, '-') : undefined;

    // .ticket-num-box 에서 번호 추출
    const ticketBox = modal.locator('.ticket-num-box').first();

    // 슬롯 (A, B, C, D, E)
    const slotText = await ticketBox.locator('.ticket-cate').first().textContent();
    const slot = (slotText?.trim() || 'A') as 'A' | 'B' | 'C' | 'D' | 'E';

    // 모드 (자동/수동)
    const modeText = await ticketBox.locator('.ticket-set').first().textContent();
    const mode = modeText?.includes('자동') ? 'auto' : 'manual';

    // 번호들 (.ticket-num-in)
    const numberElements = ticketBox.locator('.ticket-num-in');
    const count = await numberElements.count();
    const numbers: number[] = [];

    for (let i = 0; i < count; i++) {
      const numText = await numberElements.nth(i).textContent();
      const num = parseInt(numText?.trim() || '0', 10);
      if (num >= 1 && num <= 45) {
        numbers.push(num);
      }
    }

    if (numbers.length < 6) {
      console.warn(`번호 부족: ${numbers.length}개`);
      return null;
    }

    return {
      round,
      slot,
      numbers: numbers.slice(0, 6),
      mode: mode as 'auto' | 'manual',
      saleDate: saleDate ?? undefined,
      drawDate: drawDate ?? undefined,
    };
  } catch (error) {
    console.error('티켓 모달 파싱 오류:', error);
    return null;
  }
}

/**
 * 바코드 클릭하여 티켓 상세 정보 조회
 *
 * @param page Playwright Page
 * @param barcodeElement 바코드 요소 (span.whl-txt.barcd)
 * @returns 티켓 상세 정보
 */
export async function getTicketDetails(page: Page, barcodeElement: Locator): Promise<TicketDetails | null> {
  return await withRetry(
    async () => {
      // 바코드 클릭하여 모달 열기
      await barcodeElement.waitFor({ state: 'visible', timeout: 10000 });
      await barcodeElement.click();

      // 모달 로딩 대기
      const modal = page.locator('#Lotto645TicketP');
      await modal.waitFor({ state: 'visible', timeout: 15000 });

      // 모달 내부 티켓 번호가 로드될 때까지 대기
      await modal.locator('.ticket-num-box').first().waitFor({ state: 'attached', timeout: 10000 });

      // 티켓 정보 파싱
      const ticket = await parseTicketModal(modal);

      // 모달 닫기 버튼 클릭
      const closeBtn = modal.locator('button').first();
      await closeBtn.click().catch(() => {});

      // 모달이 닫힐 때까지 대기
      await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});

      return ticket;
    },
    {
      maxRetries: 2,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
    }
  ).catch((error) => {
    console.error('티켓 상세 조회 오류:', error);
    return null;
  });
}

/**
 * 최근 구매 내역에서 첫 번째 티켓 조회
 */
export async function getRecentPurchasedNumbers(page: Page): Promise<PurchasedTicket | null> {
  try {
    // 이미 로또6/45로 필터링된 상태
    const barcodeElement = page.locator('span.whl-txt.barcd').first();
    const isVisible = await barcodeElement.isVisible().catch(() => false);

    if (!isVisible) {
      console.warn('로또6/45 구매 내역이 없습니다');
      return null;
    }

    const ticket = await getTicketDetails(page, barcodeElement);

    if (ticket) {
      console.log(`추출 성공 - ${ticket.round}회 ${ticket.slot} (${ticket.mode}): ${ticket.numbers.join(', ')}`);
      if (ticket.saleDate) {
        console.log(`발행일: ${ticket.saleDate}`);
      }
    }

    return ticket;
  } catch (error) {
    await saveErrorScreenshot(page, 'parse-numbers-error');
    console.error('번호 파싱 오류:', error);
    return null;
  }
}

/**
 * 구매 후 최근 티켓 검증
 *
 * @param page Playwright Page
 * @param maxMinutes 구매 후 최대 허용 시간 (분)
 * @returns 검증된 티켓 (시간 초과 시 null)
 */
export async function verifyRecentPurchase(page: Page, maxMinutes: number = 5): Promise<PurchasedTicket | null> {
  await navigateToPurchaseHistory(page);

  const ticket = await getRecentPurchasedNumbers(page);

  if (!ticket) {
    console.warn('최근 구매 내역을 찾을 수 없습니다');
    return null;
  }

  if (!ticket.saleDate) {
    console.warn('발행일 정보가 없습니다. 시간 검증 건너뜀.');
    return ticket;
  }

  if (!isWithinMinutes(ticket.saleDate, maxMinutes)) {
    console.warn(`구매 시간 초과: ${ticket.saleDate} (${maxMinutes}분 이내만 허용)`);
    return null;
  }

  console.log(`구매 검증 성공: ${maxMinutes}분 이내 구매 확인됨`);
  return ticket;
}

/**
 * 구매 내역 조회 및 번호 확인 (전체 플로우)
 */
export async function checkPurchasedNumbers(page: Page): Promise<PurchasedTicket | null> {
  await navigateToPurchaseHistory(page);
  return await getRecentPurchasedNumbers(page);
}

/**
 * 특정 회차의 구매 티켓 여러 개 조회
 *
 * @param page Playwright Page
 * @param targetRound 조회할 회차 (없으면 첫 번째 티켓의 회차 사용)
 * @param maxCount 최대 조회 개수 (기본 5)
 * @returns 같은 회차의 티켓 목록
 */
export async function getTicketsByRound(
  page: Page,
  targetRound?: number,
  maxCount: number = 5
): Promise<PurchasedTicket[]> {
  await navigateToPurchaseHistory(page);

  const tickets: PurchasedTicket[] = [];
  
  // 이미 로또6/45로 필터링된 상태
  const barcodeElements = page.locator('span.whl-txt.barcd');
  const totalCount = await barcodeElements.count();

  if (totalCount === 0) {
    console.warn('로또6/45 구매 내역이 없습니다');
    return tickets;
  }

  console.log(`로또6/45 구매 내역 ${totalCount}개 발견`);

  // 회차 결정: targetRound가 없으면 첫 번째 티켓에서 추출
  let round = targetRound;

  for (let i = 0; i < Math.min(totalCount, maxCount * 2); i++) {
    // maxCount * 2까지 검색 (다른 회차 건너뛸 수 있으므로)
    if (tickets.length >= maxCount) break;

    try {
      const barcodeElement = barcodeElements.nth(i);
      const isVisible = await barcodeElement.isVisible().catch(() => false);

      if (!isVisible) continue;

      const ticket = await getTicketDetails(page, barcodeElement);

      if (!ticket) continue;

      // 첫 번째 티켓에서 회차 결정
      if (round === undefined) {
        round = ticket.round;
        console.log(`대상 회차: ${round}회`);
      }

      // 같은 회차만 수집
      if (ticket.round === round) {
        tickets.push(ticket);
        console.log(
          `[${tickets.length}/${maxCount}] ${ticket.round}회 ${ticket.slot} (${ticket.mode}): ${ticket.numbers.join(', ')}`
        );
      } else {
        console.log(`회차 불일치 (${ticket.round}회 != ${round}회), 건너뜀`);
      }
    } catch (error) {
      console.error(`티켓 ${i + 1} 조회 오류:`, error);
    }
  }

  console.log(`${round}회 티켓 ${tickets.length}개 조회 완료`);
  return tickets;
}

/**
 * 당첨 확인을 위한 티켓 조회 결과
 */
export interface TicketCheckResult {
  /** 조회된 회차 */
  round: number;
  /** 해당 회차의 티켓 목록 */
  tickets: PurchasedTicket[];
}

/**
 * 일주일치 전체 구매 내역 조회
 *
 * @param page Playwright Page
 * @param maxCount 최대 조회 개수 (기본 20)
 * @returns 모든 티켓 목록 (회차별로 그룹화하지 않음)
 */
export async function getAllTicketsInWeek(
  page: Page,
  maxCount: number = 20
): Promise<PurchasedTicket[]> {
  await navigateToPurchaseHistory(page);

  const tickets: PurchasedTicket[] = [];
  
  // 이미 로또6/45로 필터링된 상태이므로 바코드만 찾으면 됨
  const barcodeElements = page.locator('span.whl-txt.barcd');
  const totalCount = await barcodeElements.count();

  if (totalCount === 0) {
    console.warn('로또6/45 구매 내역이 없습니다');
    return tickets;
  }

  console.log(`로또6/45 구매 내역 ${totalCount}개 발견 (최대 ${maxCount}개 조회)`);

  for (let i = 0; i < Math.min(totalCount, maxCount); i++) {
    try {
      const barcodeElement = barcodeElements.nth(i);
      const isVisible = await barcodeElement.isVisible().catch(() => false);

      if (!isVisible) continue;

      const ticket = await getTicketDetails(page, barcodeElement);

      if (!ticket) continue;

      tickets.push(ticket);
      console.log(
        `[${tickets.length}/${Math.min(totalCount, maxCount)}] ${ticket.round}회 ${ticket.slot} (${ticket.mode}): ${ticket.numbers.join(', ')}`
      );
    } catch (error) {
      console.error(`티켓 ${i + 1} 조회 오류:`, error);
    }
  }

  console.log(`총 ${tickets.length}개 로또6/45 티켓 조회 완료`);
  return tickets;
}

/**
 * 회차별로 티켓 그룹화
 *
 * @param tickets 티켓 목록
 * @returns 회차별 티켓 Map
 */
export function groupTicketsByRound(tickets: PurchasedTicket[]): Map<number, PurchasedTicket[]> {
  const grouped = new Map<number, PurchasedTicket[]>();

  for (const ticket of tickets) {
    const existing = grouped.get(ticket.round) || [];
    existing.push(ticket);
    grouped.set(ticket.round, existing);
  }

  return grouped;
}

/**
 * 티켓 목록 콘솔 출력 (회차별 그룹화)
 */
export function printTicketsSummary(tickets: PurchasedTicket[]): void {
  if (tickets.length === 0) {
    console.log('구매 내역이 없습니다.');
    return;
  }

  const grouped = groupTicketsByRound(tickets);
  const sortedRounds = Array.from(grouped.keys()).sort((a, b) => b - a); // 최신 회차 먼저

  console.log('\n' + '='.repeat(60));
  console.log(`📋 최근 1주일 구매 내역 (총 ${tickets.length}장)`);
  console.log('='.repeat(60));

  for (const round of sortedRounds) {
    const roundTickets = grouped.get(round)!;
    console.log(`\n🎱 ${round}회 (${roundTickets.length}장)`);
    console.log('-'.repeat(40));

    for (const ticket of roundTickets) {
      const dateStr = ticket.saleDate
        ? new Date(ticket.saleDate).toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      console.log(
        `   [${ticket.slot}] ${ticket.numbers.join(', ')} (${ticket.mode === 'auto' ? '자동' : '수동'}) ${dateStr}`
      );
    }
  }

  console.log('\n' + '='.repeat(60));
}
