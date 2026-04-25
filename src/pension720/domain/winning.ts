/**
 * 연금복권 720+ 당첨 번호 도메인 타입
 *
 * 당첨 기준:
 * - 1등: 조 + 번호 6자리 모두 일치 → 월 700만원 x 20년
 * - 2등: 조 다름, 번호 6자리 모두 일치 → 월 100만원 x 10년
 * - 보너스: 각조 보너스 번호 6자리 일치 → 월 100만원 x 10년
 * - 3등: 앞 or 뒤 5자리 일치 → 100만원
 * - 4등: 앞 or 뒤 4자리 일치 → 10만원
 * - 5등: 앞 or 뒤 3자리 일치 → 5만원
 * - 6등: 앞 or 뒤 2자리 일치 → 5천원
 * - 7등: 끝 1자리 일치 → 1천원
 */

import type { PensionGroup, PensionNumber } from './ticket.js';

/**
 * 연금복권 720+ 당첨 번호
 */
export interface PensionWinningNumbers {
  /** 회차 */
  round: number;
  /** 추첨일 */
  drawDate: Date;
  /** 1등 당첨 조 */
  winningGroup: PensionGroup;
  /** 1등 당첨 번호 (6자리) */
  winningNumber: string;
  /** 보너스 번호 (6자리, 각조 공통) */
  bonusNumber: string;
}

/** 연금복권 당첨 등수 */
export type PensionWinningRank =
  | 'rank1'
  | 'rank2'
  | 'bonus'
  | 'rank3'
  | 'rank4'
  | 'rank5'
  | 'rank6'
  | 'rank7'
  | 'none';

/** 등수별 한글 표시 */
export function getRankLabel(rank: PensionWinningRank): string {
  switch (rank) {
    case 'rank1':
      return '1등';
    case 'rank2':
      return '2등';
    case 'bonus':
      return '보너스';
    case 'rank3':
      return '3등';
    case 'rank4':
      return '4등';
    case 'rank5':
      return '5등';
    case 'rank6':
      return '6등';
    case 'rank7':
      return '7등';
    case 'none':
      return '낙첨';
  }
}

/** 당첨 여부 확인 */
export function isWinning(rank: PensionWinningRank): boolean {
  return rank !== 'none';
}

/**
 * 등수별 당첨금 정보
 *
 * `lumpSum`이 `null`이면 일시금이 아닌 월지급 연금형 상금이며,
 * `display` 문자열을 표시 용도로 사용한다. 회차 합계 계산에는 lumpSum만 합산한다.
 */
export interface PensionPrizeInfo {
  /** 표시 문자열 (예: "월 700만원 X 20년", "5만원") */
  display: string;
  /** 일시금 (원). 연금형은 null */
  lumpSum: number | null;
}

/**
 * 연금복권 720+ 등수별 당첨금 (회차와 무관하게 고정)
 *
 * 출처: 동행복권 추첨결과 페이지(`/pt720/result`)의 등위 안내 테이블.
 * 1등/2등/보너스는 월지급 연금형이라 일시금 합산 대상에서 제외된다.
 */
export const PENSION_PRIZES: Readonly<Record<PensionWinningRank, PensionPrizeInfo>> = {
  rank1: { display: '월 700만원 X 20년', lumpSum: null },
  rank2: { display: '월 100만원 X 10년', lumpSum: null },
  bonus: { display: '월 100만원 X 10년', lumpSum: null },
  rank3: { display: '100만원', lumpSum: 1_000_000 },
  rank4: { display: '10만원', lumpSum: 100_000 },
  rank5: { display: '5만원', lumpSum: 50_000 },
  rank6: { display: '5천원', lumpSum: 5_000 },
  rank7: { display: '1천원', lumpSum: 1_000 },
  none: { display: '-', lumpSum: 0 },
} as const;

export function getPrizeInfo(rank: PensionWinningRank): PensionPrizeInfo {
  return PENSION_PRIZES[rank];
}

/**
 * 번호 배열을 6자리 문자열로 변환
 */
export function digitsToString(digits: number[]): string {
  return digits.map((d) => d.toString()).join('');
}

/**
 * 연금복권 당첨 확인
 *
 * @param purchased 구매한 번호 (조 + 6자리)
 * @param winning 당첨 번호 정보
 * @returns 당첨 등수
 */
export function checkPensionWinning(
  purchased: PensionNumber,
  winning: PensionWinningNumbers
): PensionWinningRank {
  const myNum = purchased.number;
  const winNum = winning.winningNumber;
  const bonusNum = winning.bonusNumber;

  // 1등: 조 + 번호 6자리 모두 일치
  if (purchased.group === winning.winningGroup && myNum === winNum) {
    return 'rank1';
  }

  // 2등: 조 다름, 번호 6자리 모두 일치
  if (purchased.group !== winning.winningGroup && myNum === winNum) {
    return 'rank2';
  }

  // 보너스: 각조 보너스 번호 6자리 일치
  if (myNum === bonusNum) {
    return 'bonus';
  }

  // 3등~7등: 앞 or 뒤 자리 일치 확인
  // 3등: 앞5자리 or 뒤5자리
  if (myNum.substring(0, 5) === winNum.substring(0, 5) || myNum.substring(1) === winNum.substring(1)) {
    return 'rank3';
  }

  // 4등: 앞4자리 or 뒤4자리
  if (myNum.substring(0, 4) === winNum.substring(0, 4) || myNum.substring(2) === winNum.substring(2)) {
    return 'rank4';
  }

  // 5등: 앞3자리 or 뒤3자리
  if (myNum.substring(0, 3) === winNum.substring(0, 3) || myNum.substring(3) === winNum.substring(3)) {
    return 'rank5';
  }

  // 6등: 앞2자리 or 뒤2자리
  if (myNum.substring(0, 2) === winNum.substring(0, 2) || myNum.substring(4) === winNum.substring(4)) {
    return 'rank6';
  }

  // 7등: 끝1자리
  if (myNum.charAt(5) === winNum.charAt(5)) {
    return 'rank7';
  }

  return 'none';
}
