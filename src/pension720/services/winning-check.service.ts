/**
 * 연금복권 720+ 당첨 확인 서비스
 */

import type { PurchasedPensionTicket } from '../domain/ticket.js';
import type { PensionWinningNumbers, PensionWinningRank } from '../domain/winning.js';
import { checkPensionWinning, getPrizeInfo, getRankLabel, isWinning } from '../domain/winning.js';
import { formatKrw } from '../../shared/utils/format.js';

/**
 * 개별 티켓 당첨 결과
 */
export interface PensionTicketWinningResult {
  ticket: PurchasedPensionTicket;
  rank: PensionWinningRank;
  rankLabel: string;
  isWinner: boolean;
  /** 일치하는 자릿수 정보 */
  matchInfo: string;
  /** 등수별 당첨금 표시 문자열 (예: "월 700만원 X 20년", "5만원", "-") */
  prizeDisplay: string;
  /** 일시금 (원). 1등/2등/보너스(연금형)는 null */
  prizeLumpSum: number | null;
}

/**
 * 전체 당첨 확인 결과
 */
export interface PensionWinningCheckResult {
  round: number;
  winningNumbers: PensionWinningNumbers;
  tickets: PensionTicketWinningResult[];
  winnerCount: number;
  totalCount: number;
  /** 일시금 합계 (원) — 3~7등 lumpSum 합산 */
  totalLumpSum: number;
  /** 월지급 연금형 당첨 건수 (1등/2등/보너스) */
  monthlyAnnuityCount: number;
  summary: string;
}

/**
 * 일치 정보 생성
 */
function getMatchInfo(
  ticket: PurchasedPensionTicket,
  rank: PensionWinningRank
): string {
  const myNum = ticket.pensionNumber.number;

  switch (rank) {
    case 'rank1':
      return `${ticket.pensionNumber.group}조 + 6자리 모두 일치`;
    case 'rank2':
      return `조 다름, 6자리 모두 일치`;
    case 'bonus':
      return `보너스 번호 일치`;
    case 'rank3':
      return `뒤 5자리 일치 (${myNum.substring(1)})`;
    case 'rank4':
      return `뒤 4자리 일치 (${myNum.substring(2)})`;
    case 'rank5':
      return `뒤 3자리 일치 (${myNum.substring(3)})`;
    case 'rank6':
      return `뒤 2자리 일치 (${myNum.substring(4)})`;
    case 'rank7':
      return `끝 1자리 일치 (${myNum.charAt(5)})`;
    default:
      return '일치 없음';
  }
}

/**
 * 여러 티켓의 당첨 여부 확인
 */
export function checkTicketsWinning(
  tickets: PurchasedPensionTicket[],
  winningNumbers: PensionWinningNumbers
): PensionWinningCheckResult {
  const results: PensionTicketWinningResult[] = tickets.map((ticket) => {
    const rank = checkPensionWinning(ticket.pensionNumber, winningNumbers);
    const matchInfo = getMatchInfo(ticket, rank);
    const prize = getPrizeInfo(rank);

    return {
      ticket,
      rank,
      rankLabel: getRankLabel(rank),
      isWinner: isWinning(rank),
      matchInfo,
      prizeDisplay: prize.display,
      prizeLumpSum: prize.lumpSum,
    };
  });

  const winnerCount = results.filter((r) => r.isWinner).length;
  const totalCount = tickets.length;
  const totalLumpSum = results.reduce((sum, r) => sum + (r.prizeLumpSum ?? 0), 0);
  const monthlyAnnuityCount = results.filter((r) => r.isWinner && r.prizeLumpSum === null).length;

  let summary: string;
  if (winnerCount === 0) {
    summary = `${winningNumbers.round}회 당첨 결과: ${totalCount}장 모두 낙첨`;
  } else {
    const rankCounts = new Map<PensionWinningRank, number>();
    results.forEach((r) => {
      if (r.isWinner) {
        rankCounts.set(r.rank, (rankCounts.get(r.rank) || 0) + 1);
      }
    });

    const rankSummary = Array.from(rankCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([rank, count]) => `${getRankLabel(rank)} ${count}장`)
      .join(', ');

    const prizeBits: string[] = [];
    if (totalLumpSum > 0) prizeBits.push(`일시금 ${formatKrw(totalLumpSum)}`);
    if (monthlyAnnuityCount > 0) prizeBits.push(`월지급 ${monthlyAnnuityCount}건`);
    const prizeSuffix = prizeBits.length > 0 ? ` / ${prizeBits.join(' + ')}` : '';

    summary = `${winningNumbers.round}회 당첨 결과: ${totalCount}장 중 ${winnerCount}장 당첨! (${rankSummary})${prizeSuffix}`;
  }

  return {
    round: winningNumbers.round,
    winningNumbers,
    tickets: results,
    winnerCount,
    totalCount,
    totalLumpSum,
    monthlyAnnuityCount,
    summary,
  };
}

/**
 * 당첨 결과를 콘솔에 출력
 */
export function printWinningResult(result: PensionWinningCheckResult): void {
  console.log('\n' + '='.repeat(50));
  console.log(`📋 ${result.round}회 연금복권 720+ 당첨 확인 결과`);
  console.log('='.repeat(50));

  console.log(`\n🎱 1등 당첨번호: ${result.winningNumbers.winningGroup}조 ${result.winningNumbers.winningNumber}`);
  console.log(`🎁 보너스 번호: 각조 ${result.winningNumbers.bonusNumber}`);

  console.log(`\n📊 내 티켓 (${result.totalCount}장):`);
  console.log('-'.repeat(50));

  result.tickets.forEach((t) => {
    const icon = t.isWinner ? '🎉' : '❌';
    console.log(
      `${icon} [${t.ticket.slot}] ${t.ticket.pensionNumber.group}조 ${t.ticket.pensionNumber.number} → ${t.rankLabel} / ${t.prizeDisplay} (${t.matchInfo})`
    );
  });

  console.log('-'.repeat(50));
  if (result.totalLumpSum > 0) {
    console.log(`💵 회차 일시금 합계: ${formatKrw(result.totalLumpSum)}`);
  }
  if (result.monthlyAnnuityCount > 0) {
    console.log(`💵 회차 월지급 연금형 당첨: ${result.monthlyAnnuityCount}건`);
  }
  console.log(`\n${result.summary}`);
  console.log('='.repeat(50) + '\n');
}
