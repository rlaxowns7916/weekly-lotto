/**
 * 로또 6/45 CSS 셀렉터 중앙 관리
 *
 * Playwright codegen으로 생성된 코드 기반
 * 사이트 변경 시 이 파일만 업데이트하면 됩니다.
 */

/**
 * 구매 관련 셀렉터
 *
 * 모바일 페이지 접근 방식 (ol 서브도메인 모바일 경로)
 */
export const purchaseSelectors = {
  /** 구매 페이지 URL (모바일) */
  purchaseUrl: 'https://ol.dhlottery.co.kr/olotto/game_mobile/game645.do',

  /** 자동 1매 추가 버튼 */
  autoNumberButton: {
    selector: 'button.btn-green02',
    text: '자동 1매 추가',
  },

  /** 구매하기 버튼 */
  buyButton: {
    selector: '#btnBuy',
    text: '구매하기',
  },

  /** 구매 확인 팝업 */
  confirmPopup: '#popupLayerConfirm',

  /** 구매 확인 팝업 내 확인 버튼 */
  confirmPopupButton: {
    selector: 'button.buttonOk',
    text: '확인',
  },

  /** 구매 확인 팝업 내 취소 버튼 (DRY RUN용) */
  cancelPopupButton: {
    selector: 'button.bg-2',
    text: '취소',
  },
} as const;

