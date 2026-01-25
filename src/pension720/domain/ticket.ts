/**
 * 연금복권 720+ 티켓 도메인 타입
 */

/** 조 번호 (1~5) */
export type PensionGroup = 1 | 2 | 3 | 4 | 5;

/** 구매 모드 */
export type PensionMode = 'auto' | 'manual';

/**
 * 연금복권 번호
 * 조(1~5) + 6자리 숫자
 */
export interface PensionNumber {
  /** 조 번호 (1~5) */
  group: PensionGroup;
  /** 6자리 번호 (문자열로 앞자리 0 보존, 예: "012345") */
  number: string;
}

/**
 * 구매된 연금복권 티켓
 */
export interface PurchasedPensionTicket {
  /** 회차 */
  round: number;
  /** 슬롯 (A~E) */
  slot: string;
  /** 선택한 번호 */
  pensionNumber: PensionNumber;
  /** 구매 모드 */
  mode: PensionMode;
  /** 발행일시 (ISO 8601) */
  saleDate?: string;
  /** 추첨일 */
  drawDate?: string;
}

/**
 * 조 번호 유효성 검사
 */
export function isValidGroup(group: number): group is PensionGroup {
  return group >= 1 && group <= 5;
}

/**
 * 6자리 번호 유효성 검사
 */
export function isValidPensionNumber(number: string): boolean {
  return /^\d{6}$/.test(number);
}

/**
 * 번호를 6자리 문자열로 포맷
 */
export function formatPensionNumber(number: number | string): string {
  const num = typeof number === 'string' ? parseInt(number, 10) : number;
  return num.toString().padStart(6, '0');
}

/**
 * 모드 한글 라벨
 */
export function getModeLabel(mode: PensionMode): string {
  return mode === 'auto' ? '자동' : '수동';
}

/**
 * 조 한글 라벨
 */
export function getGroupLabel(group: PensionGroup): string {
  return `${group}조`;
}
