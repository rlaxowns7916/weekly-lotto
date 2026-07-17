/**
 * 연금복권 720+ 구매 내역 조회 및 티켓 파싱
 *
 * lotto645와 동일한 구조, 검색 조건(LP72)과 모달ID(#Pt720TicketP)만 다름
 */

import type { Page, Locator } from 'playwright';
import type { PurchasedPensionTicket, PensionGroup } from '../../domain/ticket.js';
import { isValidGroup, formatPensionNumber } from '../../domain/ticket.js';
import { saveErrorScreenshot } from '../../../shared/browser/context.js';
import { withRetry } from '../../../shared/utils/retry.js';
import { parseSaleDate, isWithinMinutes, KST_TIME_ZONE } from '../../../shared/utils/date.js';
import {
  navigateToPurchaseHistory as navigateToHistory,
  LOTTERY_PRODUCTS,
} from '../../../shared/browser/actions/purchase-history.js';

/** 연금복권720+ 상품 정보 */
const PRODUCT = LOTTERY_PRODUCTS.LP72;

/**
 * 구매 내역 페이지로 이동 (연금복권720+)
 */
async function navigateToPurchaseHistory(page: Page): Promise<void> {
  await navigateToHistory(page, PRODUCT.code, 'pension720-history');
}

/**
 * 티켓 모달에서 상세 정보 파싱
 *
 * HTML 구조:
 * <div class="ticket-num-line">
 *   <div class="ticket-txt-wrap pension"><div class="ticket-cate">1조</div></div>
 *   <div class="ticket-num-wrap">
 *     <div class="ticket-num"><p class="ticket-num-in">9</p></div>
 *     ...
 *   </div>
 * </div>
 */
async function parseTicketModal(modal: Locator): Promise<PurchasedPensionTicket | null> {
  try {
    const modalText = await modal.textContent();

    // 디버그: 모달 텍스트 출력
    if (!modalText || modalText.trim().length < 10) {
      console.warn('모달 텍스트가 비어있거나 너무 짧음:', modalText?.slice(0, 100));
    }

    // 회차 추출
    const roundMatch = modalText?.match(/(\d+)\s*회/);
    const round = roundMatch ? parseInt(roundMatch[1], 10) : 0;

    // 회차 파싱 실패 시 디버그 로그
    if (round === 0) {
      console.warn('회차 파싱 실패. 모달 텍스트 샘플:', modalText?.slice(0, 200));
    }

    // 발행일 추출
    const saleDateMatch = modalText?.match(/발행일\s*([\d/]+\s*\([^)]+\)\s*[\d:]+)/);
    const saleDate = saleDateMatch ? parseSaleDate(saleDateMatch[1]) : undefined;

    // 발행일 파싱 실패 시 디버그 로그
    if (!saleDate) {
      console.warn('발행일 파싱 실패. 발행일 매치:', saleDateMatch?.[1]);
    }

    // 추첨일 추출
    const drawDateMatch = modalText?.match(/추첨일\s*([\d/]+)/);
    const drawDate = drawDateMatch ? drawDateMatch[1].replace(/\//g, '-') : undefined;

    // 슬롯 (A, B, C...) - 모달 상단에서 추출
    const slotMatch = modalText?.match(/([A-E])\s*슬롯/i);
    const slot = slotMatch ? slotMatch[1].toUpperCase() : 'A';

    // 모드 (자동/수동)
    const mode = modalText?.includes('자동') ? 'auto' : 'manual';

    // .ticket-num-line에서 조 번호와 6자리 번호 추출
    const ticketLine = modal.locator('.ticket-num-line').first();

    // 조 번호: .ticket-cate에서 "1조" → 1 추출
    const groupText = await ticketLine.locator('.ticket-cate').first().textContent();
    const groupMatch = groupText?.match(/([1-5])/);
    let groupNum = groupMatch ? parseInt(groupMatch[1], 10) : 0;

    // fallback: 전체 모달 텍스트에서 조 추출
    if (!isValidGroup(groupNum)) {
      const fallbackMatch = modalText?.match(/([1-5])\s*조/);
      groupNum = fallbackMatch ? parseInt(fallbackMatch[1], 10) : 0;
    }

    if (!isValidGroup(groupNum)) {
      console.warn(`잘못된 조 번호: ${groupNum}`);
      return null;
    }

    // 6자리 번호: .ticket-num-in에서 추출
    const numberElements = ticketLine.locator('.ticket-num-in');
    const count = await numberElements.count();
    const digits: string[] = [];

    for (let i = 0; i < count; i++) {
      const numText = await numberElements.nth(i).textContent();
      const digit = numText?.trim() || '';
      if (/^\d$/.test(digit)) {
        digits.push(digit);
      }
    }

    if (digits.length < 6) {
      console.warn(`번호 자릿수 부족: ${digits.length}자리`);
      return null;
    }

    return {
      round,
      slot,
      pensionNumber: {
        group: groupNum as PensionGroup,
        number: formatPensionNumber(digits.slice(0, 6).join('')),
      },
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
 */
async function getTicketDetails(page: Page, barcodeElement: Locator): Promise<PurchasedPensionTicket | null> {
  return await withRetry(
    async () => {
      await barcodeElement.waitFor({ state: 'visible', timeout: 10000 });
      await barcodeElement.click();

      const modal = page.locator(PRODUCT.modalId);
      await modal.waitFor({ state: 'visible', timeout: 15000 });

      // 실제 데이터 로딩 대기: 회차 정보 + 번호 6자리
      await Promise.all([
        modal.locator('text=/\\d+회/').first().waitFor({ state: 'visible', timeout: 10000 }),
        modal.locator('.ticket-num-in').nth(5).waitFor({ state: 'visible', timeout: 10000 }),
      ]);

      const ticket = await parseTicketModal(modal);

      const closeBtn = modal.locator('button').first();
      await closeBtn.click().catch(() => {});
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
async function getRecentPurchasedTicket(page: Page): Promise<PurchasedPensionTicket | null> {
  try {
    const barcodeElement = page.locator('span.whl-txt.barcd').first();
    const isVisible = await barcodeElement.isVisible().catch(() => false);

    if (!isVisible) {
      console.warn('연금복권720+ 구매 내역이 없습니다');
      return null;
    }

    const ticket = await getTicketDetails(page, barcodeElement);

    if (ticket) {
      console.log(`추출 성공 - ${ticket.round}회 ${ticket.slot} (${ticket.mode}): ${ticket.pensionNumber.group}조 ${ticket.pensionNumber.number}`);
      if (ticket.saleDate) {
        console.log(`발행일: ${ticket.saleDate}`);
      }
    }

    return ticket;
  } catch (error) {
    await saveErrorScreenshot(page, 'pension720-parse-error');
    console.error('번호 파싱 오류:', error);
    return null;
  }
}

/**
 * 최근 N분 내 구매 여부 확인
 */
export async function checkRecentPurchase(page: Page, maxMinutes: number): Promise<PurchasedPensionTicket | null> {
  try {
    await navigateToPurchaseHistory(page);
    const ticket = await getRecentPurchasedTicket(page);

    if (!ticket || !ticket.saleDate) return null;
    if (!isWithinMinutes(ticket.saleDate, maxMinutes)) return null;

    return ticket;
  } catch (error) {
    console.log('최근 구매 확인 중 오류 (무시):', error);
    return null;
  }
}

/**
 * 구매 후 최근 티켓 검증
 */
export async function verifyRecentPurchase(page: Page, maxMinutes: number = 5): Promise<PurchasedPensionTicket | null> {
  await navigateToPurchaseHistory(page);
  const ticket = await getRecentPurchasedTicket(page);

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
 * 일주일치 전체 구매 내역 조회
 */
export async function getAllTicketsInWeek(
  page: Page,
  maxCount: number = 20
): Promise<PurchasedPensionTicket[]> {
  await navigateToPurchaseHistory(page);

  const tickets: PurchasedPensionTicket[] = [];
  const barcodeElements = page.locator('span.whl-txt.barcd');
  const totalCount = await barcodeElements.count();

  if (totalCount === 0) {
    console.warn('연금복권720+ 구매 내역이 없습니다');
    return tickets;
  }

  console.log(`연금복권720+ 구매 내역 ${totalCount}개 발견 (최대 ${maxCount}개 조회)`);

  for (let i = 0; i < Math.min(totalCount, maxCount); i++) {
    try {
      const barcodeElement = barcodeElements.nth(i);
      const isVisible = await barcodeElement.isVisible().catch(() => false);
      if (!isVisible) continue;

      const ticket = await getTicketDetails(page, barcodeElement);
      if (!ticket) continue;

      tickets.push(ticket);
      console.log(
        `[${tickets.length}/${Math.min(totalCount, maxCount)}] ${ticket.round}회 ${ticket.slot} (${ticket.mode}): ${ticket.pensionNumber.group}조 ${ticket.pensionNumber.number}`
      );
    } catch (error) {
      console.error(`티켓 ${i + 1} 조회 오류:`, error);
    }
  }

  console.log(`총 ${tickets.length}개 연금복권720+ 티켓 조회 완료`);
  return tickets;
}

/**
 * 회차별로 티켓 그룹화
 */
function groupTicketsByRound(tickets: PurchasedPensionTicket[]): Map<number, PurchasedPensionTicket[]> {
  const grouped = new Map<number, PurchasedPensionTicket[]>();
  for (const ticket of tickets) {
    const existing = grouped.get(ticket.round) || [];
    existing.push(ticket);
    grouped.set(ticket.round, existing);
  }
  return grouped;
}

/**
 * 특정 회차의 구매 티켓 여러 개 조회
 */
export async function getTicketsByRound(
  page: Page,
  targetRound?: number,
  maxCount: number = 5
): Promise<PurchasedPensionTicket[]> {
  await navigateToPurchaseHistory(page);

  const tickets: PurchasedPensionTicket[] = [];
  const barcodeElements = page.locator('span.whl-txt.barcd');
  const totalCount = await barcodeElements.count();

  if (totalCount === 0) {
    console.warn('연금복권720+ 구매 내역이 없습니다');
    return tickets;
  }

  console.log(`연금복권720+ 구매 내역 ${totalCount}개 발견`);

  let round = targetRound;

  for (let i = 0; i < Math.min(totalCount, maxCount * 2); i++) {
    if (tickets.length >= maxCount) break;

    try {
      const barcodeElement = barcodeElements.nth(i);
      const isVisible = await barcodeElement.isVisible().catch(() => false);
      if (!isVisible) continue;

      const ticket = await getTicketDetails(page, barcodeElement);
      if (!ticket) continue;

      if (round === undefined) {
        round = ticket.round;
        console.log(`대상 회차: ${round}회`);
      }

      if (ticket.round === round) {
        tickets.push(ticket);
        console.log(
          `[${tickets.length}/${maxCount}] ${ticket.round}회 ${ticket.slot} (${ticket.mode}): ${ticket.pensionNumber.group}조 ${ticket.pensionNumber.number}`
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
 * 티켓 목록 콘솔 출력 (회차별 그룹화)
 */
export function printTicketsSummary(tickets: PurchasedPensionTicket[]): void {
  if (tickets.length === 0) {
    console.log('구매 내역이 없습니다.');
    return;
  }

  const grouped = groupTicketsByRound(tickets);
  const sortedRounds = Array.from(grouped.keys()).sort((a, b) => b - a);

  console.log('\n' + '='.repeat(60));
  console.log(`📋 최근 1주일 연금복권720+ 구매 내역 (총 ${tickets.length}장)`);
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
            timeZone: KST_TIME_ZONE,
          })
        : '';
      console.log(
        `   [${ticket.slot}] ${ticket.pensionNumber.group}조 ${ticket.pensionNumber.number} (${ticket.mode === 'auto' ? '자동' : '수동'}) ${dateStr}`
      );
    }
  }

  console.log('\n' + '='.repeat(60));
}
