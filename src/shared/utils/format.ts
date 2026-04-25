/**
 * 표시용 포매팅 유틸리티
 */

/**
 * 정수 원화 금액을 천 단위 콤마 + "원" 접미사로 변환한다.
 *
 * @example
 *   formatKrw(1830801165) // "1,830,801,165원"
 *   formatKrw(0) // "0원"
 */
export function formatKrw(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  const rounded = Math.round(amount);
  return `${rounded.toLocaleString('ko-KR')}원`;
}

/**
 * "29,292,818,640원" 같은 문자열에서 정수 금액(원)만 추출한다.
 * 숫자가 없으면 0을 반환한다.
 */
export function parseKrw(text: string | null | undefined): number {
  if (!text) return 0;
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return 0;
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
