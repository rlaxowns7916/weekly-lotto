import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright';

const { getConfigMock, saveErrorScreenshotMock } = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
  saveErrorScreenshotMock: vi.fn(),
}));

vi.mock('../../config/index.js', () => ({
  getConfig: getConfigMock,
}));

vi.mock('../context.js', () => ({
  saveErrorScreenshot: saveErrorScreenshotMock,
}));

import { login } from './login.js';

const MAIN_URL = 'https://www.dhlottery.co.kr/main';
const EXPIRY_URL = 'https://www.dhlottery.co.kr/mbrsrvc/ExpryPswdNoti';

/** Playwright가 대기 실패 시 던지는 오류와 같은 형태 (name으로 구분된다) */
function timeoutError(message: string): Error {
  const error = new Error(message);
  error.name = 'TimeoutError';
  return error;
}

interface PageMockOptions {
  /** 로그인 제출 후 비밀번호 만료 안내로 이동 */
  passwordExpiry?: boolean;
  /** '다음에 변경'을 눌러도 유예가 처리되지 않음 */
  deferFails?: boolean;
  /** 로그인 제출 후 도달하는 URL (미인증 상태 재현용) */
  landingUrl?: string;
  /** '#logoutBtn' 조회가 strict mode 위반을 일으킴 */
  logoutButtonAmbiguous?: boolean;
}

function createPageMock(options: PageMockOptions = {}) {
  let currentUrl = 'about:blank';
  let expiryPending = options.passwordExpiry === true;
  let loggedIn = false;

  const gotoMock = vi.fn(async (url: string) => {
    currentUrl = url;
  });

  const usernameFillMock = vi.fn(async () => {});
  const passwordFillMock = vi.fn(async () => {});

  // 자격증명 제출 = 실제 사이트에서 페이지 이동을 유발하는 지점
  const submitMock = vi.fn(async () => {
    if (expiryPending) {
      currentUrl = EXPIRY_URL;
      return;
    }
    if (options.landingUrl) {
      currentUrl = options.landingUrl;
      return;
    }
    loggedIn = true;
    currentUrl = MAIN_URL;
  });

  const inputLocator = (fill: typeof usernameFillMock) => ({
    waitFor: vi.fn(async () => {}),
    click: vi.fn(async () => {}),
    fill,
    press: submitMock,
    first() {
      return this;
    },
  });

  const usernameLocator = inputLocator(usernameFillMock);
  const passwordLocator = inputLocator(passwordFillMock);

  const logoutLocator = {
    waitFor: vi.fn(async () => {
      if (options.logoutButtonAmbiguous) {
        // 실제 Playwright의 strict mode 위반 (TimeoutError가 아님)
        throw new Error('strict mode violation: locator("#logoutBtn") resolved to 2 elements');
      }
      if (!loggedIn) {
        throw timeoutError('#logoutBtn not visible');
      }
    }),
    click: vi.fn(async () => {}),
    first() {
      return this;
    },
  };

  const deferClickMock = vi.fn(async () => {
    if (options.deferFails) {
      return;
    }
    expiryPending = false;
    loggedIn = true;
    currentUrl = MAIN_URL;
  });

  const deferLocator = {
    waitFor: vi.fn(async () => {
      if (!expiryPending) {
        throw timeoutError('#btnCancel not visible');
      }
    }),
    click: deferClickMock,
    first() {
      return this;
    },
  };

  const invisibleLocator = {
    waitFor: vi.fn(async (opts?: { state?: 'visible' | 'hidden' }) => {
      if (opts?.state === 'hidden') {
        return;
      }
      throw timeoutError('not visible');
    }),
    click: vi.fn(async () => {}),
    first() {
      return this;
    },
  };

  const getByRoleMock = vi.fn((role: string, opts: { name: string }) => {
    if (role === 'textbox' && opts.name === '아이디') return usernameLocator;
    if (role === 'textbox' && opts.name === '비밀번호') return passwordLocator;
    return invisibleLocator;
  });

  const locatorMock = vi.fn((selector: string) => {
    if (selector === '#logoutBtn') return logoutLocator;
    if (selector === '#btnCancel') return deferLocator;
    return invisibleLocator;
  });

  // 실제 waitForURL은 click과 동시에 대기하므로, click이 URL을 바꿀 틈을 준다
  const waitForURLMock = vi.fn(async (predicate: (url: URL) => boolean) => {
    for (let tick = 0; tick < 20; tick += 1) {
      if (predicate(new URL(currentUrl))) {
        return;
      }
      await Promise.resolve();
    }
    throw timeoutError(`waitForURL: ${currentUrl}`);
  });

  const page = {
    goto: gotoMock,
    waitForLoadState: vi.fn(async () => {}),
    waitForTimeout: vi.fn(async () => {}),
    waitForURL: waitForURLMock,
    getByRole: getByRoleMock,
    locator: locatorMock,
    url: () => currentUrl,
  } as unknown as Page;

  return { page, gotoMock, usernameFillMock, passwordFillMock, deferClickMock };
}

const validConfig = {
  username: 'demo-user',
  password: 'demo-pass',
  headed: false,
  ci: false,
};

/** withRetry의 백오프 대기를 건너뛰며 login을 끝까지 실행한다 */
async function runLoginSkippingBackoff(page: Page): Promise<unknown> {
  vi.useFakeTimers();
  try {
    const settled = login(page).then(
      () => ({ ok: true }) as const,
      (error: unknown) => ({ ok: false, error }) as const
    );
    await vi.runAllTimersAsync();
    return await settled;
  } finally {
    vi.useRealTimers();
  }
}

describe('shared/browser/actions/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveErrorScreenshotMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('visits homepage before login page and submits credentials', async () => {
    getConfigMock.mockReturnValue(validConfig);

    const { page, gotoMock, usernameFillMock, passwordFillMock } = createPageMock();

    await login(page);

    expect(gotoMock.mock.calls.map((call) => call[0])).toEqual([
      'https://www.dhlottery.co.kr/',
      'https://www.dhlottery.co.kr/login',
    ]);
    expect(usernameFillMock).toHaveBeenCalledWith('demo-user');
    expect(passwordFillMock).toHaveBeenCalledWith('demo-pass');
    expect(page.url()).toBe(MAIN_URL);
  });

  it('defers the password expiry notice and completes login', async () => {
    getConfigMock.mockReturnValue(validConfig);

    const { page, deferClickMock } = createPageMock({ passwordExpiry: true });

    await login(page);

    expect(deferClickMock).toHaveBeenCalledOnce();
    expect(page.url()).toBe(MAIN_URL);
  });

  it('fails when the expiry notice cannot be deferred', async () => {
    getConfigMock.mockReturnValue(validConfig);

    const { page } = createPageMock({ passwordExpiry: true, deferFails: true });

    const result = (await runLoginSkippingBackoff(page)) as {
      ok: boolean;
      error?: { code?: string; retryable?: boolean };
    };

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('DOM_SELECTOR_NOT_VISIBLE');
    expect(result.error?.retryable).toBe(true);
  });

  // 회귀 방지: 과거 구현은 'login'이 없는 URL이면 성공으로 단정해
  // 만료 안내 같은 미인증 페이지를 로그인 성공으로 오판했다.
  it('does not report success when it lands on an unauthenticated page', async () => {
    getConfigMock.mockReturnValue(validConfig);

    const { page } = createPageMock({
      landingUrl: 'https://www.dhlottery.co.kr/mbrsrvc/SomeOtherNoti',
    });

    const result = (await runLoginSkippingBackoff(page)) as {
      ok: boolean;
      error?: { code?: string };
    };

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('NETWORK_NAVIGATION_TIMEOUT');
  });

  // 이 버그(로그아웃 버튼 중복 -> strict mode 위반)가 조용히 삼켜져
  // URL 폴백으로 흘러간 것이 최초 장애의 원인이었다.
  it('surfaces a strict mode violation instead of masking it as a timeout', async () => {
    getConfigMock.mockReturnValue(validConfig);

    const { page } = createPageMock({ logoutButtonAmbiguous: true });

    const result = (await runLoginSkippingBackoff(page)) as {
      ok: boolean;
      error?: { message?: string };
    };

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('strict mode violation');
  });

  it('throws AUTH_INVALID_CREDENTIALS when credentials are missing', async () => {
    getConfigMock.mockReturnValue({
      headed: false,
      ci: false,
    });

    const { page } = createPageMock();

    await expect(login(page)).rejects.toThrow(
      '로그인 실패: LOTTO_USERNAME, LOTTO_PASSWORD 환경변수가 필요합니다'
    );
  });
});
