/**
 * 연금복권 720+ CSS 셀렉터 중앙 관리
 *
 * Playwright codegen으로 생성된 코드 기반
 */

/**
 * 구매 관련 셀렉터
 */
export const purchaseSelectors = {
  /** 구매 페이지 URL (모바일) */
  purchaseUrl: 'https://el.dhlottery.co.kr/game_mobile/pension720/game.jsp',

  /** 조 선택 텍스트 (1조~5조) */
  groupText: (group: number) => `${group}조`,

  /** 자동번호선택 텍스트 */
  autoNumberText: '자동번호선택',

  /** 선택완료 텍스트 */
  selectionCompleteText: '선택완료',

  /** 구매하기 링크 */
  buyLink: { role: 'link' as const, name: '구매하기' },
} as const;

/**
 * 요일별 조 매핑
 * 월요일=1조, 화요일=2조, 수요일=3조, 목요일=4조, 금요일=5조
 */
export function getGroupByDayOfWeek(): number {
  const dayOfWeek = new Date().getDay(); // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토

  switch (dayOfWeek) {
    case 1: return 1; // 월요일 → 1조
    case 2: return 2; // 화요일 → 2조
    case 3: return 3; // 수요일 → 3조
    case 4: return 4; // 목요일 → 4조
    case 5: return 5; // 금요일 → 5조
    default:
      // 주말(토/일)은 기본 1조
      console.warn(`주말(${dayOfWeek})에는 기본 1조 선택`);
      return 1;
  }
}

/**
 * 요일 이름 반환
 */
export function getDayName(dayOfWeek: number): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[dayOfWeek] || '?';
}
