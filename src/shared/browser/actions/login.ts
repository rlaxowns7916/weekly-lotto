/**
 * 로그인 자동화
 *
 * Playwright codegen 기반으로 작성됨
 */

import type { Page } from 'playwright';
import { loginSelectors } from '../selectors.js';
import { getConfig } from '../../config/index.js';
import { saveErrorScreenshot } from '../context.js';
import { withRetry } from '../../utils/retry.js';
import { AppError, toAppError } from '../../utils/error.js';

const queueOrOverlaySelectors = [
  '#waitPage',
  '#isWaitPage',
  '#ajax_loading',
  '.popup-bg.over.loadingOverlay',
] as const;

async function isLocatorVisible(page: Page, selector: string, timeoutMs = 800): Promise<boolean> {
  return page
    .locator(selector)
    .waitFor({ state: 'visible', timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
}

/**
 * 로그인 폼이 없는 간소화 서비스 페이지인지 판별한다.
 *
 * 주말·혼잡 시간대에는 동행복권이 안내만 있는 간소화 페이지를 노출하며,
 * 아이디 입력칸이 존재하지 않아 재시도해도 로그인할 수 없다.
 */
async function isSimplifiedServicePage(page: Page): Promise<boolean> {
  const visibility = await Promise.all(
    loginSelectors.simplifiedServiceNotice.markers.map((selector) =>
      isLocatorVisible(page, selector, 800)
    )
  );
  return visibility.some(Boolean);
}

async function waitForLoginInterferenceToClear(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const isRejectedState = await isLocatorVisible(page, '#isRejectPage, #isNotUse', 600);
    if (isRejectedState) {
      throw new AppError({
        code: 'NETWORK_NAVIGATION_TIMEOUT',
        category: 'NETWORK',
        retryable: false,
        message: '로그인 실패: 사이트 접속이 차단된 상태입니다',
      });
    }

    const visibility = await Promise.all(
      queueOrOverlaySelectors.map((selector) => isLocatorVisible(page, selector, 600))
    );
    const hasBlockingOverlay = visibility.some(Boolean);

    if (!hasBlockingOverlay) {
      return;
    }

    const closeWaitButtonVisible = await isLocatorVisible(page, '.close-wait-btn', 600);
    if (closeWaitButtonVisible) {
      await page.locator('.close-wait-btn').click({ timeout: 1500 }).catch(() => undefined);
    }

    await Promise.all(
      queueOrOverlaySelectors.map((selector) =>
        page.locator(selector).waitFor({ state: 'hidden', timeout: 2500 }).catch(() => undefined)
      )
    );

    await page.waitForTimeout(500);
  }

  throw new AppError({
    code: 'NETWORK_NAVIGATION_TIMEOUT',
    category: 'NETWORK',
    retryable: true,
    message: '로그인 실패: 대기열 또는 로딩 오버레이가 해제되지 않았습니다',
  });
}

type LoginOutcome = 'success' | 'password_expiry' | 'wrong_credentials' | 'timeout';

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}

/**
 * 로그인 제출 후 도달한 상태를 판별한다.
 *
 * 비밀번호 만료 안내로 이동한 경우 세션은 아직 인증 완료 상태가 아니므로
 * 성공과 구분해서 보고한다.
 */
async function waitForLoginOutcome(page: Page, timeoutMs: number): Promise<LoginOutcome> {
  const candidates: Array<{ signal: Promise<unknown>; outcome: LoginOutcome }> = [
    {
      // 로그인 완료의 유일한 양성 신호
      signal: page
        .locator(loginSelectors.logoutButton)
        .waitFor({ state: 'visible', timeout: timeoutMs }),
      outcome: 'success',
    },
    {
      // 만료 안내는 URL로 판별한다. '#btnCancel'은 다른 페이지에도 존재할 수 있어
      // 버튼 존재만으로는 이 페이지에 있다고 단정할 수 없다.
      signal: page.waitForURL(
        (url) => url.href.includes(loginSelectors.passwordExpiryNotice.urlFragment),
        { timeout: timeoutMs }
      ),
      outcome: 'password_expiry',
    },
    {
      // 안내 문구는 페이지에 중복 노출될 수 있어 first()로 좁힌다
      signal: page
        .locator('text=아이디 또는 비밀번호를 확인해주세요')
        .first()
        .waitFor({ state: 'visible', timeout: timeoutMs }),
      outcome: 'wrong_credentials',
    },
    {
      signal: page
        .locator('text=비밀번호를 입력하세요')
        .first()
        .waitFor({ state: 'visible', timeout: timeoutMs }),
      outcome: 'wrong_credentials',
    },
  ];

  // 각 분기에 개별 핸들러를 달아 unhandled rejection을 만들지 않으면서,
  // 타임아웃이 아닌 오류(strict mode 위반 등)는 삼키지 않고 드러낸다.
  // 이 오류를 숨기면 셀렉터가 깨져도 'timeout'으로 보여 원인 파악이 불가능해진다.
  return new Promise<LoginOutcome>((resolve, reject) => {
    let pending = candidates.length;

    for (const { signal, outcome } of candidates) {
      signal.then(
        () => resolve(outcome),
        (error: unknown) => {
          if (!isTimeoutError(error)) {
            reject(error);
            return;
          }

          pending -= 1;
          if (pending === 0) {
            resolve('timeout');
          }
        }
      );
    }
  });
}

/**
 * 비밀번호 변경안내에서 '다음에 변경'을 눌러 유예하고 로그인을 완료시킨다.
 *
 * 유예에 성공하면 사이트가 loginSuccess.do로 리다이렉트하며 세션이 인증된다.
 */
async function deferPasswordExpiry(page: Page): Promise<void> {
  const { urlFragment, deferButton } = loginSelectors.passwordExpiryNotice;

  console.log('비밀번호 만료 안내 감지: "다음에 변경"으로 유예합니다');

  await Promise.all([
    page.waitForURL((url) => !url.href.includes(urlFragment), { timeout: 30000 }),
    page.locator(deferButton).click({ timeout: 10000 }),
  ]).catch((error) => {
    throw new AppError({
      code: 'DOM_SELECTOR_NOT_VISIBLE',
      category: 'DOM',
      retryable: true,
      message: '로그인 실패: 비밀번호 만료 안내 유예 처리가 완료되지 않았습니다',
      cause: error,
    });
  });

  await page.waitForLoadState('domcontentloaded');
}

/**
 * 동행복권 사이트 로그인
 *
 * @param page Playwright Page 인스턴스
 * @throws {Error} 로그인 실패 시
 */
export async function login(page: Page): Promise<void> {
  const config = getConfig();

  if (!config.username || !config.password) {
    throw new AppError({
      code: 'AUTH_INVALID_CREDENTIALS',
      category: 'AUTH',
      retryable: false,
      message: '로그인 실패: LOTTO_USERNAME, LOTTO_PASSWORD 환경변수가 필요합니다',
    });
  }

  const { username, password } = config;

  await withRetry(
    async () => {
      await page.goto(loginSelectors.homeUrl, { timeout: 60000 });
      await page.waitForLoadState('domcontentloaded');
      await waitForLoginInterferenceToClear(page, 10000);

      // 재시도로 재진입했을 때 이미 세션이 살아있으면 로그인 페이지로 돌아가지 않는다.
      // 로그인 상태로 /login에 가면 리다이렉트되어 아이디 입력칸을 찾지 못한다.
      if (await isLocatorVisible(page, loginSelectors.logoutButton, 2000)) {
        console.log('이미 로그인된 세션입니다');
        console.log(`로그인 후 URL: ${page.url()}`);
        return;
      }

      await page.goto(loginSelectors.url, { timeout: 60000 });
      await page.waitForLoadState('domcontentloaded');
      await waitForLoginInterferenceToClear(page, 45000);

      // 아이디 입력
      const usernameInput = page.getByRole(loginSelectors.usernameInput.role, {
        name: loginSelectors.usernameInput.name,
      });
      const usernameVisible = await usernameInput
        .waitFor({ state: 'visible', timeout: 30000 })
        .then(() => true)
        .catch(() => false);

      if (!usernameVisible) {
        // 로그인 폼이 뜨지 않았다. raw Playwright 타임아웃을 그대로 던지면
        // 메시지의 '아이디' 문구 때문에 AUTH_INVALID_CREDENTIALS로 오분류되므로
        // 원인을 구분해 정확한 AppError로 던진다.
        if (await isSimplifiedServicePage(page)) {
          // 주말·혼잡 시간대 간소화 페이지: 로그인 폼 자체가 없어 재시도는 무의미하다.
          throw new AppError({
            code: 'NETWORK_NAVIGATION_TIMEOUT',
            category: 'NETWORK',
            retryable: false,
            message:
              '로그인 실패: 동행복권이 간소화 페이지를 운영 중입니다 ' +
              '(주말·혼잡 시간대 모바일 로그인/구매 제한). 평일 정상 운영 시간에 재시도하세요.',
          });
        }

        // 그 외 폼 미표시는 사이트 지연/일시 장애로 보고 재시도를 허용한다.
        throw new AppError({
          code: 'NETWORK_NAVIGATION_TIMEOUT',
          category: 'NETWORK',
          retryable: true,
          message: '로그인 실패: 로그인 폼(아이디 입력창)이 표시되지 않습니다',
        });
      }

      await usernameInput.click();
      await usernameInput.fill(username);

      // 비밀번호 입력
      const passwordInput = page.getByRole(loginSelectors.passwordInput.role, {
        name: loginSelectors.passwordInput.name,
      });
      await passwordInput.fill(password);

      // Enter 키로 로그인 제출
      await passwordInput.press('Enter');
      await waitForLoginInterferenceToClear(page, 30000);

      // 로그인 결과 대기: 로그아웃 버튼(성공), 만료 안내, 또는 에러 메시지(실패)
      let result = await waitForLoginOutcome(page, 60000);

      // 만료 안내는 아직 인증 전 상태이므로 유예 후 결과를 다시 판별한다
      if (result === 'password_expiry') {
        await deferPasswordExpiry(page);
        result = await waitForLoginOutcome(page, 30000);
      }

      if (result === 'success') {
        console.log('로그인 성공');
        console.log(`로그인 후 URL: ${page.url()}`);
        // 로그인 후 페이지에서 바로 버튼 찾기 (메인 페이지로 이동하지 않음)
        return;
      }

      if (result === 'wrong_credentials') {
        // 진짜 로그인 실패 - 재시도 의미 없음
        throw new AppError({
          code: 'AUTH_INVALID_CREDENTIALS',
          category: 'AUTH',
          retryable: false,
          message: '로그인 실패: 아이디 또는 비밀번호가 틀렸습니다',
        });
      }

      if (result === 'password_expiry') {
        // 유예 후에도 안내가 남아있음 (유예 처리 자체가 거부된 상태)
        throw new AppError({
          code: 'DOM_SELECTOR_NOT_VISIBLE',
          category: 'DOM',
          retryable: true,
          message: '로그인 실패: 비밀번호 만료 안내 유예 후에도 인증이 완료되지 않았습니다',
        });
      }

      // 타임아웃 - 로그아웃 버튼을 확인하지 못했다는 것은 인증 미완료라는 뜻이다.
      // URL만 보고 성공으로 추정하면(과거 구현) 만료 안내 같은 미인증 인터스티셜을
      // 성공으로 오판해 이후 단계가 세션 만료로 실패한다.
      throw new AppError({
        code: 'NETWORK_NAVIGATION_TIMEOUT',
        category: 'NETWORK',
        retryable: true,
        message: `로그인 실패: 로그인 완료를 확인하지 못했습니다 (URL: ${page.url()})`,
      });
    },
    {
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
      shouldRetry: (error) => {
        if (error instanceof AppError) {
          return error.retryable;
        }
        return true;
      },
    }
  ).catch(async (error) => {
    await saveErrorScreenshot(page, 'login-error');
    throw toAppError(error);
  });
}
