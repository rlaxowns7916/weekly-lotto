/**
 * 연금복권 720+ 이메일 HTML 템플릿
 */

import type { PurchasedPensionTicket } from '../domain/ticket.js';
import type { PensionWinningCheckResult } from './winning-check.service.js';
import { getModeLabel } from '../domain/ticket.js';
import { formatDateKorean } from '../../shared/utils/date.js';
import { buildFailureEmailTemplate, type EmailTemplateResult } from '../../shared/utils/html.js';

// formatDateKorean을 내부 alias로 사용 (기존 코드 호환성)
const formatDate = formatDateKorean;

/**
 * 구매 성공 이메일 템플릿
 */
export function purchaseSuccessTemplate(ticket: PurchasedPensionTicket): { subject: string; html: string; text: string } {
  const subject = `[연금복권 구매 완료] ${ticket.round}회 ${ticket.slot}슬롯 - ${ticket.pensionNumber.group}조 ${ticket.pensionNumber.number}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <tr>
      <td style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">연금복권 720+ 구매 완료</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px;">
        <p style="text-align: center; font-size: 18px; color: #4caf50; margin: 0 0 24px 0; font-weight: 500;">
          구매가 정상적으로 완료되었습니다!
        </p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; margin: 16px 0;">
          <tr>
            <td style="padding: 20px; text-align: center;">
              <div style="margin-bottom: 12px; font-size: 16px;">
                <strong>${ticket.round}회</strong> | ${ticket.slot}슬롯 | ${getModeLabel(ticket.mode)}
              </div>
              <div style="margin: 16px 0; font-size: 28px; font-weight: bold; color: #f5576c;">
                ${ticket.pensionNumber.group}조 ${ticket.pensionNumber.number}
              </div>
            </td>
          </tr>
        </table>
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
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">조</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${ticket.pensionNumber.group}조</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">번호</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${ticket.pensionNumber.number}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">구매 방식</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${getModeLabel(ticket.mode)}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">발행일시</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${formatDate(ticket.saleDate)}</td>
          </tr>
        </table>
      </td>
    </tr>
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
[연금복권 720+ 구매 완료]

구매가 정상적으로 완료되었습니다!

회차: ${ticket.round}회
슬롯: ${ticket.slot}
조: ${ticket.pensionNumber.group}조
번호: ${ticket.pensionNumber.number}
구매 방식: ${getModeLabel(ticket.mode)}
발행일시: ${formatDate(ticket.saleDate)}

---
weekly-lotto 자동화 시스템
`;

  return { subject, html, text };
}

/**
 * 구매 실패 이메일 템플릿
 */
export function purchaseFailureTemplate(error: string): EmailTemplateResult {
  return buildFailureEmailTemplate({
    title: '연금복권 720+ 구매 실패',
    subject: '[연금복권 구매 실패] 확인이 필요합니다',
    guidanceText: '동행복권 사이트에 직접 로그인하여 구매 상태를 확인해주세요.',
    errorSummary: error,
  });
}

/**
 * 당첨 결과 이메일 템플릿
 */
export function winningResultTemplate(result: PensionWinningCheckResult): { subject: string; html: string; text: string } {
  const hasWinner = result.winnerCount > 0;
  const headerGradient = hasWinner
    ? 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)'
    : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
  const headerTitle = hasWinner ? '당첨을 축하합니다!' : '당첨 확인 결과';
  const statusColor = hasWinner ? '#ffd700' : '#666';

  const subject = hasWinner
    ? `[연금복권 당첨!] ${result.round}회 - ${result.winnerCount}장 당첨!`
    : `[연금복권 결과] ${result.round}회 - ${result.totalCount}장 낙첨`;

  const ticketsHtml = result.tickets
    .map((t) => {
      const icon = t.isWinner ? '&#127881;' : '&#10060;';
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
          <div style="margin: 12px 0; font-size: 20px; font-weight: bold;">
            ${t.ticket.pensionNumber.group}조 ${t.ticket.pensionNumber.number}
          </div>
          <div style="font-size: 12px; color: #666;">
            ${t.matchInfo}
          </div>
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
    <tr>
      <td style="background: ${headerGradient}; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">${headerTitle}</h1>
        <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">${result.round}회 연금복권 720+ 당첨 확인</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px; background-color: #f8f9fa; border-bottom: 1px solid #eee;">
        <div style="text-align: center; margin-bottom: 12px; font-size: 14px; color: #666;">1등 당첨번호</div>
        <div style="text-align: center; font-size: 24px; font-weight: bold; color: #f5576c;">
          ${result.winningNumbers.winningGroup}조 ${result.winningNumbers.winningNumber}
        </div>
        <div style="text-align: center; margin-top: 12px; font-size: 14px; color: #666;">
          보너스: 각조 ${result.winningNumbers.bonusNumber}
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px; text-align: center; background-color: ${hasWinner ? '#fff8e1' : '#ffffff'};">
        <p style="margin: 0; font-size: 16px; color: ${statusColor}; font-weight: 500;">
          ${result.summary}
        </p>
      </td>
    </tr>
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

  const ticketsText = result.tickets
    .map((t) => {
      const icon = t.isWinner ? '🎉' : '❌';
      return `${icon} [${t.ticket.slot}] ${t.ticket.pensionNumber.group}조 ${t.ticket.pensionNumber.number} → ${t.rankLabel} (${t.matchInfo})`;
    })
    .join('\n');

  const text = `
[연금복권 720+ 당첨 확인 결과]

${result.round}회 당첨 번호: ${result.winningNumbers.winningGroup}조 ${result.winningNumbers.winningNumber}
보너스: 각조 ${result.winningNumbers.bonusNumber}

${result.summary}

내 티켓 (${result.totalCount}장):
${ticketsText}

---
weekly-lotto 자동화 시스템
`;

  return { subject, html, text };
}
