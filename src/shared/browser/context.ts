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

  const isHeadless = !options.headed && !config.headed;

  const browser = await chromium.launch({
    headless: isHeadless,
    slowMo: options.slowMo,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      // Headless 감지 우회
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      // User-Agent에서 HeadlessChrome 제거
      ...(isHeadless ? ['--headless=new'] : []),
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    // Headless 탐지 우회 설정
    bypassCSP: true,
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      // HeadlessChrome 노출 방지
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    },
  });

  const page = await context.newPage();

  // navigator 속성 우회 (headless/봇 탐지 우회)
  await page.addInitScript(() => {
    // webdriver 숨기기
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    // platform을 Windows로 위장 (Linux 감지 우회)
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
    });
    // plugins 배열 채우기
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    // languages 설정
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en-US', 'en'],
    });
  });

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
