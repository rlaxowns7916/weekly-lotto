import { errors } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';

const maintenanceIndicators = [
  '시스템 점검중 입니다.',
  '시스템 점검 중입니다',
  '시스템 정기 점검',
  '서비스 점검중입니다',
];

export async function skipIfSiteMaintenance(
  page: Page,
  testInfo: TestInfo,
  context: string
): Promise<void> {
  for (const text of maintenanceIndicators) {
    const locator = page.locator(`text=${text}`);
    const isVisible = await locator.first().isVisible().catch(() => false);
    if (isVisible) {
      testInfo.skip(true, `동행복권 사이트 점검으로 인해 ${context} 테스트를 건너뜁니다.`);
    }
  }
}

type NetworkGuardOptions = {
  maxRetries?: number;
  retryDelayMs?: number;
};

const networkGuardSymbol = Symbol('networkGuardInstalled');
const networkErrorIndicators = [
  'net::ERR_CONNECTION_TIMED_OUT',
  'net::ERR_CONNECTION_RESET',
  'net::ERR_NAME_NOT_RESOLVED',
  'net::ERR_NETWORK_CHANGED',
  'Navigation timeout of',
];

function getNetworkErrorMessage(error: unknown): string | null {
  if (error instanceof errors.TimeoutError) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const message = (error as Error).message ?? '';
    if (networkErrorIndicators.some((indicator) => message.includes(indicator))) {
      return message;
    }
  }

  return null;
}

export function attachNetworkGuard(
  page: Page,
  testInfo: TestInfo,
  options: NetworkGuardOptions = {}
): void {
  const state = page as Page & { [networkGuardSymbol]?: boolean };
  if (state[networkGuardSymbol]) {
    return;
  }

  state[networkGuardSymbol] = true;
  const maxRetries = options.maxRetries ?? 2;
  const retryDelayMs = options.retryDelayMs ?? 2000;
  const originalGoto = page.goto.bind(page);

  page.goto = (async (url, gotoOptions) => {
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        return await originalGoto(url, gotoOptions);
      } catch (error) {
        const message = getNetworkErrorMessage(error);
        if (!message) {
          throw error;
        }

        if (attempt === maxRetries) {
          const target = typeof url === 'string'
            ? url
            : url && typeof (url as { toString?: () => string }).toString === 'function'
              ? (url as { toString: () => string }).toString()
              : 'unknown-url';
          testInfo.skip(
            true,
            `동행복권 사이트 접속 실패 (${target}). 네트워크 오류: ${message}`
          );
          return null;
        }

        await page.waitForTimeout(retryDelayMs);
      }
    }

    return null;
  }) as Page['goto'];
}
