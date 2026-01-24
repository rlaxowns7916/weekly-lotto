/**
 * 로또 티켓 도메인 타입
 */

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

/**
 * 발행일이 지정된 시간(분) 이내인지 확인
 */
export function isWithinMinutes(saleDate: string, minutes: number): boolean {
  const saleTime = new Date(saleDate).getTime();
  const now = Date.now();
  const diffMinutes = (now - saleTime) / (1000 * 60);
  return diffMinutes <= minutes;
}

/**
 * 발행일 문자열 파싱 (예: "2026/01/24 (토) 18:20:39")
 */
export function parseSaleDate(saleDateStr: string): string | null {
  // "2026/01/24 (토) 18:20:39" -> "2026-01-24T18:20:39"
  const match = saleDateStr.match(/(\d{4})\/(\d{2})\/(\d{2}).*?(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, min, sec] = match;
  return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
}

/**
 * 구매 요청 티켓 (번호 없이 모드만 지정)
 */
export interface TicketRequest {
  /** 선택한 번호 (없으면 자동) */
  numbers?: number[];
  /** 구매 모드 */
  mode: Lotto645Mode;
}

/**
 * 자동 구매 요청 티켓 생성
 */
export function createAutoTicketRequest(): TicketRequest {
  return {
    numbers: [],
    mode: 'auto',
  };
}

/**
 * 여러 개의 자동 구매 요청 티켓 생성
 */
export function createAutoTicketRequests(count: number): TicketRequest[] {
  return Array.from({ length: count }, () => createAutoTicketRequest());
}

/**
 * 티켓 번호 유효성 검증
 * - 번호는 1~45 범위
 * - 6개 번호
 * - 중복 없음
 */
export function validateTicketNumbers(numbers: number[]): boolean {
  if (numbers.length !== 6) return false;
  if (numbers.some((n) => n < 1 || n > 45)) return false;
  if (new Set(numbers).size !== 6) return false;
  return true;
}

/**
 * 번호 배열 정렬
 */
export function sortNumbers(numbers: number[]): number[] {
  return [...numbers].sort((a, b) => a - b);
}
