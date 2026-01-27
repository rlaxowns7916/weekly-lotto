import type { Locator, Page, TestInfo } from '@playwright/test';

const historyPopupSelectors = [
  '.popup-wrap.on.msgPop',
  '.pop-up-wrapper.w-alert.msgPop',
];

export function getDetailSearchToggleButton(page: Page): Locator {
  return page.getByRole('button', { name: /상세 검색/ });
}

export async function ensureDetailSearchExpanded(page: Page): Promise<void> {
  const toggleButton = getDetailSearchToggleButton(page);
  const buttonCount = await toggleButton.count();

  if (buttonCount === 0) {
    return;
  }

  const button = toggleButton.first();
  await button.waitFor({ state: 'visible', timeout: 30000 });
  const label = (await button.textContent()) ?? '';

  if (label.includes('펼치기')) {
    await button.click();
  }
}

export async function getRecentWeekButtonOrSkip(
  page: Page,
  testInfo: TestInfo,
  context: string
): Promise<Locator | null> {
  await dismissHistoryPopup(page);
  const weekButton = page.getByRole('button', { name: '최근 1주일' });
  const count = await weekButton.count();

  if (count === 0) {
    testInfo.skip(true, `${context}에서 '최근 1주일' 버튼을 찾을 수 없어 테스트를 건너뜁니다.`);
    return null;
  }

  const button = weekButton.first();
  await button.waitFor({ state: 'visible', timeout: 30000 });
  return button;
}

export function ensurePurchaseHistoryAccessible(
  page: Page,
  testInfo: TestInfo,
  context: string
): boolean {
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    testInfo.skip(true, `동행복권 세션 만료 또는 로그인 요구로 ${context}에 접근할 수 없습니다.`);
    return false;
  }

  return true;
}

export async function dismissHistoryPopup(page: Page): Promise<void> {
  for (const selector of historyPopupSelectors) {
    const popup = page.locator(selector);
    const isVisible = await popup.isVisible().catch(() => false);
    if (!isVisible) {
      continue;
    }

    const confirmButton = popup.getByRole('button', { name: '확인' });
    if ((await confirmButton.count()) > 0) {
      await confirmButton.first().click();
    } else {
      const closeButton = popup.locator('.btn-close, button:has-text("닫기"), button:has-text("확인")');
      if ((await closeButton.count()) > 0) {
        await closeButton.first().click();
      } else {
        await popup.click();
      }
    }

    await popup.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}
