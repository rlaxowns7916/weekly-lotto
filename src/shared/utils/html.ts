/**
 * HTML 관련 유틸리티 함수
 *
 * 이메일 템플릿 등에서 공통으로 사용되는 HTML 처리 함수
 */

/**
 * HTML 특수문자 이스케이프
 *
 * XSS 방지를 위해 HTML 특수문자를 엔티티로 변환
 *
 * @param text 이스케이프할 텍스트
 * @returns 이스케이프된 텍스트
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 이메일 템플릿 반환 타입
 */
export interface EmailTemplateResult {
  subject: string;
  html: string;
  text: string;
}

/**
 * 공통 실패 이메일 템플릿 빌더
 *
 * 모든 도메인(lotto645, pension720, deposit)의 실패 이메일은
 * 동일한 HTML 구조를 사용하며 제목/안내 문구만 다르다.
 */
export function buildFailureEmailTemplate(opts: {
  title: string;
  subject: string;
  guidanceText: string;
  errorSummary: string;
}): EmailTemplateResult {
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
      <td style="background: linear-gradient(135deg, #f44336 0%, #e91e63 100%); padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">${escapeHtml(opts.title)}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px;">
        <p style="text-align: center; font-size: 18px; color: #f44336; margin: 0 0 24px 0; font-weight: 500;">
          오류가 발생했습니다.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fff5f5; border: 2px dashed #f44336; border-radius: 8px; margin: 16px 0;">
          <tr>
            <td style="padding: 20px;">
              <div style="color: #666; margin-bottom: 8px; font-size: 14px;">오류 내용:</div>
              <div style="color: #f44336; word-break: break-all; font-size: 14px;">${escapeHtml(opts.errorSummary)}</div>
            </td>
          </tr>
        </table>
        <p style="margin-top: 24px; color: #666; font-size: 14px; text-align: center;">
          ${escapeHtml(opts.guidanceText)}
        </p>
      </td>
    </tr>
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
[${opts.title}]

오류가 발생했습니다.

오류 내용:
${opts.errorSummary}

${opts.guidanceText}

---
weekly-lotto 자동화 시스템
`;

  return { subject: opts.subject, html, text };
}
