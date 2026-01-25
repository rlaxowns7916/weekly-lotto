/**
 * 날짜 관련 유틸리티 함수
 *
 * 로또/연금복권 공통으로 사용되는 날짜 파싱 및 검증 함수
 */

/**
 * 발행일 문자열 파싱 (예: "2026/01/24 (토) 18:20:39")
 *
 * 동행복권 사이트의 시간은 KST(UTC+9)이므로 타임존 정보 포함
 *
 * @param saleDateStr 동행복권 사이트 발행일 형식 문자열
 * @returns ISO 8601 형식 문자열 (예: "2026-01-24T18:20:39+09:00") 또는 null
 */
export function parseSaleDate(saleDateStr: string): string | null {
  const match = saleDateStr.match(/(\d{4})\/(\d{2})\/(\d{2}).*?(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, min, sec] = match;
  return `${year}-${month}-${day}T${hour}:${min}:${sec}+09:00`;
}

/**
 * 발행일이 지정된 시간(분) 이내인지 확인
 *
 * @param saleDate ISO 8601 형식 날짜 문자열
 * @param minutes 허용 시간 (분)
 * @returns 지정된 시간 이내면 true
 */
export function isWithinMinutes(saleDate: string, minutes: number): boolean {
  const saleTime = new Date(saleDate).getTime();
  const now = Date.now();
  const diffMinutes = (now - saleTime) / (1000 * 60);
  return diffMinutes <= minutes;
}

/**
 * ISO 날짜를 한국어 형식으로 포맷
 *
 * @param isoDate ISO 8601 형식 날짜 문자열
 * @returns 한국어 형식 문자열 (예: "2026. 01. 24. (토) 오후 06:20")
 */
export function formatDateKorean(isoDate: string | undefined): string {
  if (!isoDate) return '-';
  try {
    const date = new Date(isoDate);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
  } catch {
    return isoDate;
  }
}

/**
 * 오늘 날짜인지 확인
 *
 * @param date 확인할 Date 객체
 * @returns 오늘이면 true
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    today.getFullYear() === date.getFullYear() &&
    today.getMonth() === date.getMonth() &&
    today.getDate() === date.getDate()
  );
}

/**
 * Date 객체를 YYYY.MM.DD 형식 문자열로 변환
 *
 * @param date Date 객체
 * @returns "YYYY.MM.DD" 형식 문자열
 */
export function formatDateDot(date: Date): string {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}
