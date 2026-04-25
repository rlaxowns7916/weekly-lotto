/**
 * 당첨 확인 서비스
 *
 * 구매한 티켓과 당첨 번호를 비교하여 결과 반환
 */

import type { PurchasedTicket } from '../domain/ticket.js';
import type { WinningNumbers, WinningRank } from '../domain/winning.js';
import { checkWinning, getMatchingNumbers, getRankLabel, isWinning } from '../domain/winning.js';
import { formatKrw } from '../../shared/utils/format.js';

/**
 * 개별 티켓 당첨 결과
 */
export interface TicketWinningResult {
  /** 티켓 정보 */
  ticket: PurchasedTicket;
  /** 당첨 등수 */
  rank: WinningRank;
  /** 등수 한글 표시 */
  rankLabel: string;
  /** 당첨 여부 */
  isWinner: boolean;
  /** 일치하는 번호 목록 */
  matchingNumbers: number[];
  /** 보너스 번호 일치 여부 */
  bonusMatch: boolean;
  /** 1게임당 당첨금 (낙첨이면 0, 회차 금액 정보가 없으면 0) */
  prizeAmount: number;
}

/**
 * 전체 당첨 확인 결과
 */
export interface WinningCheckResult {
  /** 확인 회차 */
  round: number;
  /** 당첨 번호 정보 */
  winningNumbers: WinningNumbers;
  /** 개별 티켓 결과 목록 */
  tickets: TicketWinningResult[];
  /** 당첨 티켓 수 */
  winnerCount: number;
  /** 총 티켓 수 */
  totalCount: number;
  /** 사용자 회차 총 당첨금 (모든 슬롯 prizeAmount 합) */
  totalUserPrize: number;
  /** 등위별 1게임당 당첨금 표시 가능 여부 (false면 회차 금액 미수집) */
  prizesAvailable: boolean;
  /** 요약 메시지 */
  summary: string;
}

function getPrizeAmount(rank: WinningRank, winningNumbers: WinningNumbers): number {
  if (rank === 'none') return 0;
  return winningNumbers.prizes?.get(rank)?.amountPerWinner ?? 0;
}

/**
 * 여러 티켓의 당첨 여부 확인
 *
 * @param tickets 구매한 티켓 목록
 * @param winningNumbers 당첨 번호 정보 (선택적으로 등위별 금액 포함)
 * @returns 당첨 확인 결과 (각 티켓별 prizeAmount + 회차 합계 totalUserPrize)
 */
export function checkTicketsWinning(
  tickets: PurchasedTicket[],
  winningNumbers: WinningNumbers
): WinningCheckResult {
  const prizesAvailable = !!winningNumbers.prizes && winningNumbers.prizes.size > 0;

  const results: TicketWinningResult[] = tickets.map((ticket) => {
    const rank = checkWinning(ticket.numbers, winningNumbers);
    const matchingNumbers = getMatchingNumbers(ticket.numbers, winningNumbers.numbers);
    const bonusMatch = ticket.numbers.includes(winningNumbers.bonusNumber);
    const prizeAmount = getPrizeAmount(rank, winningNumbers);

    return {
      ticket,
      rank,
      rankLabel: getRankLabel(rank),
      isWinner: isWinning(rank),
      matchingNumbers,
      bonusMatch,
      prizeAmount,
    };
  });

  const winnerCount = results.filter((r) => r.isWinner).length;
  const totalCount = tickets.length;
  const totalUserPrize = results.reduce((sum, r) => sum + r.prizeAmount, 0);

  // 요약 메시지 생성
  let summary: string;
  if (winnerCount === 0) {
    summary = `${winningNumbers.round}회 당첨 결과: ${totalCount}장 모두 낙첨`;
  } else {
    const rankCounts = new Map<WinningRank, number>();
    results.forEach((r) => {
      if (r.isWinner) {
        rankCounts.set(r.rank, (rankCounts.get(r.rank) || 0) + 1);
      }
    });

    const rankSummary = Array.from(rankCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([rank, count]) => `${getRankLabel(rank)} ${count}장`)
      .join(', ');

    const prizeSuffix = totalUserPrize > 0 ? ` / 총 ${formatKrw(totalUserPrize)}` : '';
    summary = `${winningNumbers.round}회 당첨 결과: ${totalCount}장 중 ${winnerCount}장 당첨! (${rankSummary})${prizeSuffix}`;
  }

  return {
    round: winningNumbers.round,
    winningNumbers,
    tickets: results,
    winnerCount,
    totalCount,
    totalUserPrize,
    prizesAvailable,
    summary,
  };
}

/**
 * 당첨 결과를 콘솔에 출력
 */
export function printWinningResult(result: WinningCheckResult): void {
  console.log('\n' + '='.repeat(50));
  console.log(`📋 ${result.round}회 당첨 확인 결과`);
  console.log('='.repeat(50));

  console.log(`\n🎱 당첨 번호: ${result.winningNumbers.numbers.join(', ')} + 보너스 ${result.winningNumbers.bonusNumber}`);

  if (result.prizesAvailable) {
    console.log('\n💰 회차 등위별 1게임당 당첨금:');
    (['rank1', 'rank2', 'rank3', 'rank4', 'rank5'] as const).forEach((r) => {
      const info = result.winningNumbers.prizes?.get(r);
      if (!info) return;
      console.log(`   ${getRankLabel(r)}: ${formatKrw(info.amountPerWinner)} (당첨 ${info.winnerCount.toLocaleString('ko-KR')}게임)`);
    });
  }

  console.log(`\n📊 내 티켓 (${result.totalCount}장):`);
  console.log('-'.repeat(50));

  result.tickets.forEach((t) => {
    const matchInfo = t.matchingNumbers.length > 0
      ? `(일치: ${t.matchingNumbers.join(', ')}${t.bonusMatch ? ' +보너스' : ''})`
      : '(일치 없음)';

    const icon = t.isWinner ? '🎉' : '❌';
    const prizeSuffix = result.prizesAvailable ? ` / ${formatKrw(t.prizeAmount)}` : '';
    console.log(
      `${icon} [${t.ticket.slot}] ${t.ticket.numbers.join(', ')} → ${t.rankLabel}${prizeSuffix} ${matchInfo}`
    );
  });

  console.log('-'.repeat(50));
  if (result.prizesAvailable && result.totalCount > 0) {
    console.log(`💵 회차 총 당첨금: ${formatKrw(result.totalUserPrize)}`);
  }
  console.log(`\n${result.summary}`);
  console.log('='.repeat(50) + '\n');
}
