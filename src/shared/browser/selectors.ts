/**
 * 공통 CSS 셀렉터 중앙 관리
 *
 * 모든 게임에서 공유하는 셀렉터 (로그인 등)
 */

/**
 * 로그인 관련 셀렉터
 */
export const loginSelectors = {
  /** 로그인 페이지 URL (직접 접근) */
  url: 'https://www.dhlottery.co.kr/login',

  /** 아이디 입력 필드 (role 기반) */
  usernameInput: { role: 'textbox' as const, name: '아이디' },

  /** 비밀번호 입력 필드 (role 기반) */
  passwordInput: { role: 'textbox' as const, name: '비밀번호' },
} as const;
