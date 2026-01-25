/**
 * 이메일 HTML 템플릿
 *
 * 주의: 이메일 클라이언트 호환성을 위해 모든 스타일은 인라인으로 작성
 */

import type { PurchasedTicket } from '../domain/ticket.js';
import { getModeLabel } from '../domain/ticket.js';
import { formatDateKorean } from '../../shared/utils/date.js';
import { escapeHtml } from '../../shared/utils/html.js';

/**
 * 번호에 따른 배경색 반환
 */
function getNumberBgColor(num: number): string {
  if (num <= 10) return '#ffc107'; // 노란색
  if (num <= 20) return '#2196f3'; // 파란색
  if (num <= 30) return '#f44336'; // 빨간색
  if (num <= 40) return '#9e9e9e'; // 회색
  return '#4caf50'; // 녹색
}

/**
 * 번호 HTML 생성 (인라인 스타일)
 */
function renderNumbers(numbers: number[]): string {
  return numbers
    .map(
      (num) =>
        `<span style="display: inline-block; width: 36px; height: 36px; line-height: 36px; border-radius: 50%; background-color: ${getNumberBgColor(num)}; color: white; font-weight: bold; font-size: 14px; text-align: center; margin: 4px;">${num}</span>`
    )
    .join('');
}

// formatDateKorean을 내부 alias로 사용 (기존 코드 호환성)
const formatDate = formatDateKorean;

/**
 * 구매 성공 이메일 템플릿
 */
export function purchaseSuccessTemplate(ticket: PurchasedTicket): { subject: string; html: string; text: string } {
  const subject = `[로또 구매 완료] ${ticket.round}회 ${ticket.slot}슬롯 - ${ticket.numbers.join(', ')}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">로또 6/45 구매 완료</h1>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 24px;">
        <p style="text-align: center; font-size: 18px; color: #4caf50; margin: 0 0 24px 0; font-weight: 500;">
          구매가 정상적으로 완료되었습니다!
        </p>

        <!-- Ticket Box -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; margin: 16px 0;">
          <tr>
            <td style="padding: 20px; text-align: center;">
              <div style="margin-bottom: 12px; font-size: 16px;">
                <strong>${ticket.round}회</strong> | ${ticket.slot}슬롯 | ${getModeLabel(ticket.mode)}
              </div>
              <div style="margin: 16px 0;">
                ${renderNumbers(ticket.numbers)}
              </div>
            </td>
          </tr>
        </table>

        <!-- Info Table -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; width: 30%;">회차</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${ticket.round}회</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">슬롯</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${ticket.slot}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">번호</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${ticket.numbers.join(', ')}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">구매 방식</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${getModeLabel(ticket.mode)}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">발행일시</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${formatDate(ticket.saleDate)}</td>
          </tr>
          ${ticket.drawDate ? `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">추첨일</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${ticket.drawDate}</td>
          </tr>
          ` : ''}
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #f8f9fa; padding: 16px 24px; text-align: center; font-size: 12px; color: #666;">
        <p style="margin: 0 0 8px 0;">이 이메일은 weekly-lotto 자동화 시스템에서 발송되었습니다.</p>
        <p style="margin: 0;">행운을 빕니다!</p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `
[로또 6/45 구매 완료]

구매가 정상적으로 완료되었습니다!

회차: ${ticket.round}회
슬롯: ${ticket.slot}
번호: ${ticket.numbers.join(', ')}
구매 방식: ${getModeLabel(ticket.mode)}
발행일시: ${formatDate(ticket.saleDate)}
${ticket.drawDate ? `추첨일: ${ticket.drawDate}` : ''}

---
weekly-lotto 자동화 시스템
`;

  return { subject, html, text };
}

/**
 * 구매 실패 이메일 템플릿
 */
export function purchaseFailureTemplate(error: string): { subject: string; html: string; text: string } {
  const subject = '[로또 구매 실패] 확인이 필요합니다';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, #f44336 0%, #e91e63 100%); padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">로또 6/45 구매 실패</h1>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 24px;">
        <p style="text-align: center; font-size: 18px; color: #f44336; margin: 0 0 24px 0; font-weight: 500;">
          구매 중 오류가 발생했습니다.
        </p>

        <!-- Error Box -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fff5f5; border: 2px dashed #f44336; border-radius: 8px; margin: 16px 0;">
          <tr>
            <td style="padding: 20px;">
              <div style="color: #666; margin-bottom: 8px; font-size: 14px;">오류 내용:</div>
              <div style="color: #f44336; word-break: break-all; font-size: 14px;">${escapeHtml(error)}</div>
            </td>
          </tr>
        </table>

        <p style="margin-top: 24px; color: #666; font-size: 14px; text-align: center;">
          동행복권 사이트에 직접 로그인하여 구매 상태를 확인해주세요.
        </p>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #f8f9fa; padding: 16px 24px; text-align: center; font-size: 12px; color: #666;">
        <p style="margin: 0;">이 이메일은 weekly-lotto 자동화 시스템에서 발송되었습니다.</p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `
[로또 6/45 구매 실패]

구매 중 오류가 발생했습니다.

오류 내용:
${error}

동행복권 사이트에 직접 로그인하여 구매 상태를 확인해주세요.

---
weekly-lotto 자동화 시스템
`;

  return { subject, html, text };
}

/**
 * 당첨 결과 이메일 템플릿용 타입 (순환 의존성 방지)
 */
interface WinningResultForEmail {
  round: number;
  winningNumbers: {
    numbers: number[];
    bonusNumber: number;
  };
  tickets: Array<{
    ticket: PurchasedTicket;
    rank: string;
    rankLabel: string;
    isWinner: boolean;
    matchingNumbers: number[];
    bonusMatch: boolean;
  }>;
  winnerCount: number;
  totalCount: number;
  summary: string;
}

/**
 * 일치하는 번호 강조 표시
 */
function renderNumbersWithHighlight(
  numbers: number[],
  matchingNumbers: number[],
  bonusNumber?: number,
  bonusMatch?: boolean
): string {
  return numbers
    .map((num) => {
      const isMatch = matchingNumbers.includes(num);
      const isBonus = bonusMatch && num === bonusNumber;
      const bgColor = getNumberBgColor(num);
      const borderStyle = isMatch
        ? 'border: 3px solid #000;'
        : isBonus
          ? 'border: 3px solid #ff4081;'
          : '';
      return `<span style="display: inline-block; width: 36px; height: 36px; line-height: 36px; border-radius: 50%; background-color: ${bgColor}; color: white; font-weight: bold; font-size: 14px; text-align: center; margin: 4px; ${borderStyle}">${num}</span>`;
    })
    .join('');
}

/**
 * 당첨 결과 이메일 템플릿
 */
export function winningResultTemplate(result: WinningResultForEmail): { subject: string; html: string; text: string } {
  const hasWinner = result.winnerCount > 0;
  const headerGradient = hasWinner
    ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)'
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  const headerTitle = hasWinner ? '당첨을 축하합니다!' : '당첨 확인 결과';
  const statusColor = hasWinner ? '#ffd700' : '#666';

  const subject = hasWinner
    ? `[로또 당첨!] ${result.round}회 - ${result.winnerCount}장 당첨!`
    : `[로또 결과] ${result.round}회 - ${result.totalCount}장 낙첨`;

  // 티켓 결과 HTML 생성
  const ticketsHtml = result.tickets
    .map((t) => {
      const icon = t.isWinner ? '&#127881;' : '&#10060;'; // 🎉 or ❌
      const resultColor = t.isWinner ? '#4caf50' : '#999';
      const bgColor = t.isWinner ? '#f0fff0' : '#fafafa';

      return `
      <tr>
        <td style="padding: 16px; background-color: ${bgColor}; border-bottom: 1px solid #eee;">
          <div style="margin-bottom: 8px;">
            <span style="font-size: 18px;">${icon}</span>
            <strong style="margin-left: 8px;">${t.ticket.slot}슬롯</strong>
            <span style="color: ${resultColor}; font-weight: bold; margin-left: 12px;">${t.rankLabel}</span>
          </div>
          <div style="margin: 12px 0;">
            ${renderNumbersWithHighlight(
              t.ticket.numbers,
              t.matchingNumbers,
              result.winningNumbers.bonusNumber,
              t.bonusMatch
            )}
          </div>
          ${t.matchingNumbers.length > 0 ? `
          <div style="font-size: 12px; color: #666;">
            일치: ${t.matchingNumbers.join(', ')}${t.bonusMatch ? ' + 보너스' : ''}
          </div>
          ` : ''}
        </td>
      </tr>
    `;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <!-- Header -->
    <tr>
      <td style="background: ${headerGradient}; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">${headerTitle}</h1>
        <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">${result.round}회 당첨 확인</p>
      </td>
    </tr>

    <!-- Winning Numbers -->
    <tr>
      <td style="padding: 24px; background-color: #f8f9fa; border-bottom: 1px solid #eee;">
        <div style="text-align: center; margin-bottom: 12px; font-size: 14px; color: #666;">당첨 번호</div>
        <div style="text-align: center;">
          ${renderNumbers(result.winningNumbers.numbers)}
          <span style="display: inline-block; margin-left: 8px; font-size: 14px; color: #666;">+</span>
          <span style="display: inline-block; width: 36px; height: 36px; line-height: 36px; border-radius: 50%; background-color: #ff4081; color: white; font-weight: bold; font-size: 14px; text-align: center; margin: 4px;">${result.winningNumbers.bonusNumber}</span>
        </div>
      </td>
    </tr>

    <!-- Summary -->
    <tr>
      <td style="padding: 20px; text-align: center; background-color: ${hasWinner ? '#fff8e1' : '#ffffff'};">
        <p style="margin: 0; font-size: 16px; color: ${statusColor}; font-weight: 500;">
          ${result.summary}
        </p>
      </td>
    </tr>

    <!-- Tickets -->
    <tr>
      <td style="padding: 0;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding: 16px 24px; background-color: #f8f9fa; border-bottom: 1px solid #eee;">
              <strong>내 티켓 (${result.totalCount}장)</strong>
            </td>
          </tr>
          ${ticketsHtml}
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8f9fa; padding: 16px 24px; text-align: center; font-size: 12px; color: #666;">
        <p style="margin: 0 0 8px 0;">이 이메일은 weekly-lotto 자동화 시스템에서 발송되었습니다.</p>
        ${hasWinner ? '<p style="margin: 0; color: #ffd700;">축하합니다! 동행복권 사이트에서 당첨금을 확인하세요.</p>' : '<p style="margin: 0;">다음 기회에 행운을 빕니다!</p>'}
      </td>
    </tr>
  </table>
</body>
</html>
`;

  // 텍스트 버전
  const ticketsText = result.tickets
    .map((t) => {
      const icon = t.isWinner ? '🎉' : '❌';
      const matchInfo = t.matchingNumbers.length > 0
        ? `(일치: ${t.matchingNumbers.join(', ')}${t.bonusMatch ? ' +보너스' : ''})`
        : '';
      return `${icon} [${t.ticket.slot}] ${t.ticket.numbers.join(', ')} → ${t.rankLabel} ${matchInfo}`;
    })
    .join('\n');

  const text = `
[로또 6/45 당첨 확인 결과]

${result.round}회 당첨 번호: ${result.winningNumbers.numbers.join(', ')} + 보너스 ${result.winningNumbers.bonusNumber}

${result.summary}

내 티켓 (${result.totalCount}장):
${ticketsText}

---
weekly-lotto 자동화 시스템
`;

  return { subject, html, text };
}
