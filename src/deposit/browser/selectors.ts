export const depositSelectors = {
  // 충전하기 페이지 (실측 확인됨)
  chargePageUrl: 'https://www.dhlottery.co.kr/mypage/mndpChrg',

  // 금액 드롭다운 (<select> 요소, 실측 확인됨)
  // 허용 값: 5000, 10000, 20000, 30000, 50000, 100000, 150000
  amountSelect: '#EcAmt',

  // 충전하기 버튼 (간편충전 탭 내 — onclick 속성으로 특정)
  chargeButton: 'button[onclick*="fn_openEcRegistAccountCheck"]',

  // 키패드 (DOM에서 확인됨)
  keypadContainer: '#nppfs-keypad-ecpassword',
  keypadImage: '.kpd-image-button',
  keypadDataButtons: '.kpd-data[data-action^="data:"]',
  keypadClearButton: '.kpd-data[data-action="action:clear"]',
  keypadDeleteButton: '.kpd-data[data-action="action:delete"]',
  keypadRefreshButton: '.kpd-data[data-action="action:refresh"]',

  // 충전 완료 다이얼로그 (스크린샷에서 확인됨)
  chargeCompleteDialog: 'text=예치금 충전이 완료되었습니다.',
  chargeCompleteConfirmButton: 'button:has-text("확인")',

  // 충전 내역 조회 (스크린샷에서 확인됨)
  chargeHistoryTab: 'text=충전 내역 조회',
  chargeHistoryEntry: 'text=간편충전',
} as const;
