/**
 * Playwright 브라우저 컨텍스트 관리
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { getConfig } from '../config/index.js';

/**
 * 브라우저 실행 옵션
 */
export interface BrowserOptions {
  /** headed 모드 (브라우저 표시) */
  headed?: boolean;
  /** 슬로우 모션 (밀리초) */
  slowMo?: number;
}

/**
 * 브라우저 및 컨텍스트 래퍼
 */
export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/**
 * 브라우저 세션 생성
 *
 * @param options 브라우저 옵션
 * @returns 브라우저 세션
 */
export async function createBrowserSession(
  options: BrowserOptions = {}
): Promise<BrowserSession> {
  const config = getConfig();

  const browser = await chromium.launch({
    headless: !options.headed && !config.headed,
    slowMo: options.slowMo,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    // 실패 시 스크린샷 저장 설정
    recordVideo: undefined, // 필요시 { dir: 'videos/' }
  });

  const page = await context.newPage();

  return { browser, context, page };
}

/**
 * 브라우저 세션 종료
 */
export async function closeBrowserSession(session: BrowserSession): Promise<void> {
  await session.context.close();
  await session.browser.close();
}

/**
 * 에러 발생 시 스크린샷 저장
 */
export async function saveErrorScreenshot(
  page: Page,
  name: string
): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const path = `screenshots/${name}-${timestamp}.png`;
    await page.screenshot({ path, fullPage: false, timeout: 5000 });
    console.error(`스크린샷 저장됨: ${path}`);
    return path;
  } catch {
    console.error('스크린샷 저장 실패 (타임아웃)');
    return null;
  }
}

/**
 * 에러 핸들링과 함께 액션 실행
 */
export async function withErrorScreenshot<T>(
  page: Page,
  actionName: string,
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    await saveErrorScreenshot(page, actionName);
    throw error;
  }
}
