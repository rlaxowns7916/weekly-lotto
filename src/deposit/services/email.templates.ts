/**
 * 예치금 충전 이메일 HTML 템플릿
 *
 * 주의: 이메일 클라이언트 호환성을 위해 모든 스타일은 인라인으로 작성
 */

import type { ChargeResult } from '../domain/charge.js';
import { buildFailureEmailTemplate, type EmailTemplateResult } from '../../shared/utils/html.js';

/**
 * 충전 성공 이메일 템플릿
 */
export function chargeSuccessTemplate(result: ChargeResult): EmailTemplateResult {
  const subject = `[예치금 충전 완료] ${result.amount.toLocaleString()}원 충전 성공`;
  const statusLabel = result.status === 'dry_run' ? '테스트(DRY_RUN)' : '충전 완료';
  const timestampStr = result.timestamp.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

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
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">예치금 충전 완료</h1>
      </td>
    </tr>
    <!-- Content -->
    <tr>
      <td style="padding: 24px;">
        <p style="text-align: center; font-size: 18px; color: #4caf50; margin: 0 0 24px 0; font-weight: 500;">
          충전이 정상적으로 완료되었습니다!
        </p>

        <!-- Charge Info Box -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; margin: 16px 0;">
          <tr>
            <td style="padding: 20px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #667eea; margin-bottom: 8px;">
                ${result.amount.toLocaleString()}원
              </div>
              <div style="font-size: 14px; color: #666;">${statusLabel}</div>
            </td>
          </tr>
        </table>

        <!-- Info Table -->
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 24px;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666; width: 30%;">충전 금액</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${result.amount.toLocaleString()}원</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">상태</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${statusLabel}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">충전 시각</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${timestampStr}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; color: #666;">OCR 신뢰도</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; font-weight: 600; text-align: right;">${(result.keypadOcrConfidence * 100).toFixed(1)}%</td>
          </tr>
        </table>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="background-color: #f8f9fa; padding: 16px 24px; text-align: center; font-size: 12px; color: #666;">
        <p style="margin: 0 0 8px 0;">이 이메일은 weekly-lotto 자동화 시스템에서 발송되었습니다.</p>
        <p style="margin: 0;">로또 구매 행운을 빕니다!</p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const text = `
[예치금 충전 완료]

충전이 정상적으로 완료되었습니다!

충전 금액: ${result.amount.toLocaleString()}원
상태: ${statusLabel}
충전 시각: ${timestampStr}
OCR 신뢰도: ${(result.keypadOcrConfidence * 100).toFixed(1)}%

---
weekly-lotto 자동화 시스템
`;

  return { subject, html, text };
}

/**
 * 충전 실패 이메일 템플릿
 */
export function chargeFailureTemplate(errorSummary: string): EmailTemplateResult {
  return buildFailureEmailTemplate({
    title: '예치금 충전 실패',
    subject: '[예치금 충전 실패] 확인이 필요합니다',
    guidanceText: '동행복권 사이트에 직접 로그인하여 예치금 잔액을 확인해주세요.',
    errorSummary,
  });
}
