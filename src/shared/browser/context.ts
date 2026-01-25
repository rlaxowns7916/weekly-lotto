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

  // context 레벨에서 navigator 속성 우회 (페이지 생성 전에 설정)
  // 사이트의 봇 탐지 스크립트보다 먼저 실행되어야 함
  await context.addInitScript(`
    // Navigator.prototype에서 platform getter 재정의
    // 사이트 체크: /win16|win32|win64|mac/ig.test(navigator.platform)
    delete Navigator.prototype.platform;
    Navigator.prototype.__defineGetter__('platform', function() {
      return 'Win32';
    });

    // webdriver 숨기기
    delete Navigator.prototype.webdriver;
    Navigator.prototype.__defineGetter__('webdriver', function() {
      return undefined;
    });

    // plugins 배열 채우기
    Navigator.prototype.__defineGetter__('plugins', function() {
      return [1, 2, 3, 4, 5];
    });

    // languages 설정
    Navigator.prototype.__defineGetter__('languages', function() {
      return ['ko-KR', 'ko', 'en-US', 'en'];
    });
  `);

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

