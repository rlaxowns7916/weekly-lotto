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
import {
  navigateToPurchaseHistory as navigateToHistory,
  LOTTERY_PRODUCTS,
} from '../../../shared/browser/actions/purchase-history.js';

/**
 * 티켓 모달에서 파싱한 상세 정보
 */
interface TicketDetails extends PurchasedTicket {
  /** 바코드 번호 */
  barcode?: string;
}

/** 로또6/45 상품 정보 */
const PRODUCT = LOTTERY_PRODUCTS.LO40;

/**
 * 구매 내역 페이지로 이동 (로또6/45)
 */
async function navigateToPurchaseHistory(page: Page): Promise<void> {
  await navigateToHistory(page, PRODUCT.code, 'lotto645-history');
}

/**
 * 티켓 모달에서 상세 정보 파싱
 *
 * @param modal 티켓 모달 Locator (#Lotto645TicketP)
 * @returns 파싱된 티켓 정보
 */
async function parseTicketModal(modal: Locator): Promise<TicketDetails | null> {
  try {
    const modalText = await modal.textContent();

    // 디버그: 모달 텍스트 출력
    if (!modalText || modalText.trim().length < 10) {
      console.warn('모달 텍스트가 비어있거나 너무 짧음:', modalText?.slice(0, 100));
    }

    // 회차 추출 (예: "1208회")
    const roundMatch = modalText?.match(/(\d+)\s*회/);
    const round = roundMatch ? parseInt(roundMatch[1], 10) : 0;

    // 회차 파싱 실패 시 디버그 로그
    if (round === 0) {
      console.warn('회차 파싱 실패. 모달 텍스트 샘플:', modalText?.slice(0, 200));
    }

    // 발행일 추출 (예: "발행일 2026/01/24 (토) 18:20:39")
    const saleDateMatch = modalText?.match(/발행일\s*([\d/]+\s*\([^)]+\)\s*[\d:]+)/);
    const saleDate = saleDateMatch ? parseSaleDate(saleDateMatch[1]) : undefined;

    // 발행일 파싱 실패 시 디버그 로그
    if (!saleDate) {
      console.warn('발행일 파싱 실패. 발행일 매치:', saleDateMatch?.[1]);
    }

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
async function getTicketDetails(page: Page, barcodeElement: Locator): Promise<TicketDetails | null> {
  return await withRetry(
    async () => {
      // 바코드 클릭하여 모달 열기
      await barcodeElement.waitFor({ state: 'visible', timeout: 10000 });
      await barcodeElement.click();

      // 모달 로딩 대기
      const modal = page.locator('#Lotto645TicketP');
      await modal.waitFor({ state: 'visible', timeout: 15000 });

      // 실제 데이터 로딩 대기: 회차 정보 + 번호 6개
      await Promise.all([
        modal.locator('text=/\\d+회/').first().waitFor({ state: 'visible', timeout: 10000 }),
        modal.locator('.ticket-num-in').nth(5).waitFor({ state: 'visible', timeout: 10000 }),
      ]);

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
      maxRetries: 3,
      baseDelayMs: 500,
      maxDelayMs: 3000,
    }
  ).catch((error) => {
    console.error('티켓 상세 조회 오류:', error);
    return null;
  });
}

/**
 * 최근 구매 내역에서 첫 번째 티켓 조회
 */
async function getRecentPurchasedNumbers(page: Page): Promise<PurchasedTicket | null> {
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
 * 최근 N분 내 구매 여부만 확인 (구매 전 중복 체크용)
 *
 * verifyRecentPurchase와 달리 경고 로그 없이 조용히 확인만 함.
 * 구매 시도 전에 이미 구매된 티켓이 있는지 확인하는 용도.
 *
 * @param page Playwright Page
 * @param maxMinutes 최근 구매로 간주할 시간 (분)
 * @returns 최근 구매된 티켓 또는 null
 */
export async function checkRecentPurchase(page: Page, maxMinutes: number): Promise<PurchasedTicket | null> {
  try {
    await navigateToPurchaseHistory(page);

    const ticket = await getRecentPurchasedNumbers(page);

    if (!ticket || !ticket.saleDate) {
      return null;
    }

    if (!isWithinMinutes(ticket.saleDate, maxMinutes)) {
      return null;
    }

    return ticket;
  } catch (error) {
    // 구매 확인 실패 시 null 반환 (구매 진행 허용)
    console.log('최근 구매 확인 중 오류 (무시):', error);
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
function groupTicketsByRound(tickets: PurchasedTicket[]): Map<number, PurchasedTicket[]> {
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
