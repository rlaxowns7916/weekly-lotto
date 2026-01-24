/**
 * 당첨 번호 및 등수 판정 도메인 타입
 */

/** 당첨 등수 */
export type WinningRank = 'rank1' | 'rank2' | 'rank3' | 'rank4' | 'rank5' | 'none';

/** 등수별 한글 표시 */
export function getRankLabel(rank: WinningRank): string {
  switch (rank) {
    case 'rank1':
      return '1등';
    case 'rank2':
      return '2등';
    case 'rank3':
      return '3등';
    case 'rank4':
      return '4등';
    case 'rank5':
      return '5등';
    case 'none':
      return '낙첨';
  }
}

/** 당첨 여부 확인 */
export function isWinning(rank: WinningRank): boolean {
  return rank !== 'none';
}

/**
 * 등수별 당첨 정보
 */
export interface PrizeInfo {
  /** 등수 */
  rank: WinningRank;
  /** 총 당첨금액 (원) */
  totalAmount: number;
  /** 당첨자 수 */
  winnerCount: number;
  /** 1인당 당첨금액 (원) */
  amountPerWinner: number;
}

/**
 * 당첨 번호 정보
 */
export interface WinningNumbers {
  /** 회차 */
  round: number;
  /** 추첨일 */
  drawDate: Date;
  /** 당첨번호 6개 (정렬됨) */
  numbers: number[];
  /** 보너스 번호 */
  bonusNumber: number;
  /** 등수별 당첨 정보 */
  prizes?: Map<WinningRank, PrizeInfo>;
}

/**
 * 구매한 번호와 당첨 번호를 비교하여 등수 반환
 *
 * 등수 기준:
 * - 1등: 6개 일치
 * - 2등: 5개 일치 + 보너스 번호
 * - 3등: 5개 일치
 * - 4등: 4개 일치
 * - 5등: 3개 일치
 * - 낙첨: 2개 이하 일치
 */
export function checkWinning(
  purchasedNumbers: number[],
  winning: WinningNumbers
): WinningRank {
  const matchCount = countMatches(purchasedNumbers, winning.numbers);
  const bonusMatch = purchasedNumbers.includes(winning.bonusNumber);

  switch (matchCount) {
    case 6:
      return 'rank1';
    case 5:
      return bonusMatch ? 'rank2' : 'rank3';
    case 4:
      return 'rank4';
    case 3:
      return 'rank5';
    default:
      return 'none';
  }
}

/**
 * 두 번호 배열에서 일치하는 개수 계산
 */
function countMatches(purchased: number[], winning: number[]): number {
  return purchased.filter((n) => winning.includes(n)).length;
}

/**
 * 일치하는 번호 목록 반환
 */
export function getMatchingNumbers(
  purchased: number[],
  winning: number[]
): number[] {
  return purchased.filter((n) => winning.includes(n));
}
