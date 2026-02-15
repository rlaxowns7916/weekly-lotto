import type { Locator, Page, TestInfo } from '@playwright/test';

const maintenanceIndicators = [
  '시스템 점검중 입니다.',
  '시스템 점검 중입니다',
  '시스템 정기 점검',
  '서비스 점검중입니다',
];

type SelectorProbe = {
  label: string;
  query: string;
};

type SelectorProbeResult = {
  label: string;
  count: number;
  visible: boolean;
};

async function probeSelector(page: Page, probe: SelectorProbe): Promise<SelectorProbeResult> {
  const locator = page.locator(probe.query);
  const count = await locator.count().catch(() => 0);
  const visible = count > 0
    ? await locator.first().isVisible().catch(() => false)
    : false;

  return {
    label: probe.label,
    count,
    visible,
  };
}

async function detectMaintenanceMessage(page: Page): Promise<string | null> {
  for (const indicator of maintenanceIndicators) {
    const visible = await page.locator(`text=${indicator}`).first().isVisible().catch(() => false);
    if (visible) {
      return indicator;
    }
  }

  return null;
}

export async function buildFailureReason(
  page: Page,
  context: string,
  probes: SelectorProbe[]
): Promise<string> {
  const url = page.url();
  const title = await page.title().catch(() => 'unknown-title');
  const isLoginPage = /\/login/i.test(url);
  const maintenanceMessage = await detectMaintenanceMessage(page);
  const selectorStates = await Promise.all(probes.map((probe) => probeSelector(page, probe)));

  const selectorSummary = selectorStates
    .map((state) => `${state.label}(count=${state.count},visible=${state.visible})`)
    .join(', ');

  return [
    `context=${context}`,
    `url=${url}`,
    `title=${title}`,
    `isLoginPage=${isLoginPage}`,
    `maintenance=${maintenanceMessage ?? 'none'}`,
    `selectors=[${selectorSummary}]`,
  ].join(' | ');
}

export async function waitVisibleWithReason(
  page: Page,
  locator: Locator,
  timeoutMs: number,
  context: string,
  probes: SelectorProbe[],
  testInfo: TestInfo
): Promise<void> {
  try {
    await locator.waitFor({ state: 'visible', timeout: timeoutMs });
  } catch (error) {
    const reason = await buildFailureReason(page, context, probes);
    await testInfo.attach(`${context}-diagnostics`, {
      body: reason,
      contentType: 'text/plain',
    });

    const baseMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`${context} 실패: ${reason}\n원본 오류: ${baseMessage}`);
  }
}
