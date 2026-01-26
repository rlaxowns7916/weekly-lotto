/**
 * 로또 티켓 도메인 타입
 */

// 날짜 유틸리티 re-export (하위 호환성 유지)
export { parseSaleDate, isWithinMinutes } from '../../shared/utils/date.js';

/** 티켓 구매 모드 */
export type Lotto645Mode = 'auto' | 'semi-auto' | 'manual';

/** 구매 모드 한글 표시 */
export function getModeLabel(mode: Lotto645Mode): string {
  switch (mode) {
    case 'auto':
      return '자동';
    case 'semi-auto':
      return '반자동';
    case 'manual':
      return '수동';
  }
}

/** 티켓 슬롯 (A~E) */
export type TicketSlot = 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * 구매한 로또 티켓
 */
export interface PurchasedTicket {
  /** 회차 */
  round: number;
  /** 슬롯 (A~E) */
  slot: TicketSlot;
  /** 선택한 번호 6개 (정렬됨) */
  numbers: number[];
  /** 구매 모드 */
  mode: Lotto645Mode;
  /** 발행일시 (ISO 8601) */
  saleDate?: string;
  /** 추첨일 */
  drawDate?: string;
  /** 당첨 결과 (확인된 경우) */
  winResult?: {
    rank: number; // 0: 미당첨, 1~5: 등수
    amount: number; // 당첨금
  };
}

