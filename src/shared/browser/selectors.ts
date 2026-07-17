/**
 * 공통 CSS 셀렉터 중앙 관리
 *
 * 모든 게임에서 공유하는 셀렉터 (로그인 등)
 */

/**
 * 로그인 관련 셀렉터
 */
export const loginSelectors = {
  homeUrl: 'https://www.dhlottery.co.kr/',

  /** 로그인 페이지 URL (직접 접근) */
  url: 'https://www.dhlottery.co.kr/login',

  /** 아이디 입력 필드 (role 기반) */
  usernameInput: { role: 'textbox' as const, name: '아이디' },

  /** 비밀번호 입력 필드 (role 기반) */
  passwordInput: { role: 'textbox' as const, name: '비밀번호' },

  /**
   * 로그인 완료 판별용 로그아웃 버튼
   *
   * 헤더에 '로그아웃' 텍스트 버튼이 복수로 존재해 role/text 기반 조회는
   * strict mode 위반을 일으키므로 id로 특정한다.
   */
  logoutButton: '#logoutBtn',

  /**
   * 비밀번호 변경안내(만료) 인터스티셜
   *
   * 장기간 비밀번호를 변경하지 않으면 로그인 직후 이 페이지로 이동하며,
   * '다음에 변경'으로 유예하기 전까지 세션이 인증 완료되지 않는다.
   */
  passwordExpiryNotice: {
    urlFragment: 'ExpryPswdNoti',
    /** '다음에 변경' 버튼 (유예 후 loginSuccess.do로 리다이렉트) */
    deferButton: '#btnCancel',
  },
} as const;
