import { beforeEach, describe, expect, it, vi } from 'vitest';
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

function createPageMock(): {
  page: Page;
  gotoMock: ReturnType<typeof vi.fn>;
  usernameFillMock: ReturnType<typeof vi.fn>;
  passwordFillMock: ReturnType<typeof vi.fn>;
} {
  let currentUrl = 'about:blank';

  const gotoMock = vi.fn(async (url: string) => {
    currentUrl = url;
  });

  const waitForLoadStateMock = vi.fn(async () => {});
  const usernameFillMock = vi.fn(async () => {});
  const passwordFillMock = vi.fn(async () => {});

  const usernameLocator = {
    waitFor: vi.fn(async () => {}),
    click: vi.fn(async () => {}),
    fill: usernameFillMock,
    press: vi.fn(async () => {}),
  };

  const passwordLocator = {
    waitFor: vi.fn(async () => {}),
    click: vi.fn(async () => {}),
    fill: passwordFillMock,
    press: vi.fn(async () => {}),
  };

  const logoutLocator = {
    waitFor: vi.fn(async () => {
      currentUrl = 'https://www.dhlottery.co.kr/main';
    }),
  };

  const neverVisibleLocator = {
    waitFor: vi.fn(() => new Promise<never>(() => {})),
    click: vi.fn(async () => {}),
  };

  const hiddenOverlayLocator = {
    waitFor: vi.fn(async (options?: { state?: 'visible' | 'hidden' }) => {
      if (options?.state === 'hidden') {
        return;
      }

      throw new Error('not visible');
    }),
    click: vi.fn(async () => {}),
  };

  const getByRoleMock = vi.fn((role: string, options: { name: string }) => {
    if (role === 'textbox' && options.name === '아이디') return usernameLocator;
    if (role === 'textbox' && options.name === '비밀번호') return passwordLocator;
    if (role === 'button' && options.name === '로그아웃') return logoutLocator;
    return neverVisibleLocator;
  });

  const locatorMock = vi.fn((selector: string) => {
    if (selector.includes('아이디 또는 비밀번호를 확인해주세요')) {
      return neverVisibleLocator;
    }

    if (selector.includes('비밀번호를 입력하세요')) {
      return neverVisibleLocator;
    }

    if (
      selector === '#waitPage' ||
      selector === '#isWaitPage' ||
      selector === '#ajax_loading' ||
      selector === '.popup-bg.over.loadingOverlay' ||
      selector === '#isRejectPage, #isNotUse' ||
      selector === '.close-wait-btn'
    ) {
      return hiddenOverlayLocator;
    }

    return hiddenOverlayLocator;
  });

  const page = {
    goto: gotoMock,
    waitForLoadState: waitForLoadStateMock,
    waitForTimeout: vi.fn(async () => {}),
    getByRole: getByRoleMock,
    locator: locatorMock,
    url: () => currentUrl,
  } as unknown as Page;

  return { page, gotoMock, usernameFillMock, passwordFillMock };
}

describe('shared/browser/actions/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveErrorScreenshotMock.mockResolvedValue(null);
  });

  it('visits homepage before login page and submits credentials', async () => {
    getConfigMock.mockReturnValue({
      username: 'demo-user',
      password: 'demo-pass',
      headed: false,
      ci: false,
    });

    const { page, gotoMock, usernameFillMock, passwordFillMock } = createPageMock();

    await login(page);

    expect(gotoMock.mock.calls.map((call) => call[0])).toEqual([
      'https://www.dhlottery.co.kr/',
      'https://www.dhlottery.co.kr/login',
    ]);
    expect(usernameFillMock).toHaveBeenCalledWith('demo-user');
    expect(passwordFillMock).toHaveBeenCalledWith('demo-pass');
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
