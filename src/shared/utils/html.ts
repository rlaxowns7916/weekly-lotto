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
