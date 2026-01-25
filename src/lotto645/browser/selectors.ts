/**
 * 로또 6/45 CSS 셀렉터 중앙 관리
 *
 * Playwright codegen으로 생성된 코드 기반
 * 사이트 변경 시 이 파일만 업데이트하면 됩니다.
 */

/**
 * 구매 관련 셀렉터
 *
 * ol.dhlottery.co.kr 직접 접근 방식 (iframe 없음)
 */
export const purchaseSelectors = {
  /** 구매 페이지 URL (ol 서브도메인 직접 접근) */
  purchaseUrl: 'https://ol.dhlottery.co.kr/olotto/game/game645.do',

  /** 자동번호발급 링크 */
  autoNumberLink: {
    role: 'link' as const,
    name: /자동번호발급/,
  },

  /** 확인 버튼 (슬롯 추가 후) */
  confirmButton: { role: 'button' as const, name: '확인' },

  /** 구매하기 버튼 */
  buyButton: { role: 'button' as const, name: '구매하기' },

  /** 구매 확인 팝업 */
  confirmPopup: '#popupLayerConfirm',

  /** 구매 확인 팝업 내 확인 버튼 */
  confirmPopupButton: { role: 'button' as const, name: '확인' },

  /** 닫기 버튼 */
  closeButton: '#closeLayer',
} as const;

