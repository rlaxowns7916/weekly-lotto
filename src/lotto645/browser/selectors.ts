/**
 * 로또 6/45 CSS 셀렉터 중앙 관리
 *
 * Playwright codegen으로 생성된 코드 기반
 * 사이트 변경 시 이 파일만 업데이트하면 됩니다.
 */

/**
 * 구매 관련 셀렉터
 */
export const purchaseSelectors = {
  /** 로또6/45 버튼 (새 팝업 열림) */
  lottoButton: { role: 'button' as const, name: '로또6/' },

  /** 구매 페이지 URL (팝업 대신 직접 이동용) */
  purchaseUrl: 'https://el.dhlottery.co.kr/game/TotalGame.jsp?LottoId=LO40',

  /** 구매 페이지 iframe 이름 */
  iframeName: 'ifrm_tab',

  /** 자동번호발급 링크 */
  autoNumberLink: {
    role: 'link' as const,
    name: '자동번호발급 구매 수량 전체를 자동번호로 발급 받을 수 있습니다',
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

