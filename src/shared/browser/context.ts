/**
 * Playwright 브라우저 컨텍스트 관리
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
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

export interface HtmlSnapshotFile {
  path: string;
  url: string;
}

export interface FailureHtmlSnapshotResult {
  status: 'SUCCESS' | 'FAILED';
  main?: HtmlSnapshotFile;
  frames: HtmlSnapshotFile[];
  captureTs: number;
  url: string;
  failureReason?: string;
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
    viewport: { width: 390, height: 844 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    // Headless 탐지 우회 설정
    bypassCSP: true,
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"iOS"',
    },
  });

  // context 레벨에서 navigator 속성 우회 (페이지 생성 전에 설정)
  // 사이트의 봇 탐지 스크립트보다 먼저 실행되어야 함
  await context.addInitScript(`
    // Navigator.prototype에서 platform getter 재정의 (모바일)
    delete Navigator.prototype.platform;
    Navigator.prototype.__defineGetter__('platform', function() {
      return 'iPhone';
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

function maskSensitiveText(input: string): string {
  return input
    .replace(/(password\s*[=:]\s*)([^&\s"'<>]+)/gi, '$1***')
    .replace(/(token\s*[=:]\s*)([^&\s"'<>]+)/gi, '$1***')
    .replace(/(authorization\s*[=:]\s*)([^&\s"'<>]+)/gi, '$1***');
}

export async function saveFailureHtmlSnapshot(
  page: Page,
  name: string
): Promise<FailureHtmlSnapshotResult> {
  const captureTs = Date.now();
  const baseUrl = page.url();
  const directoryPath = 'artifacts/html-failures';

  try {
    await mkdir(directoryPath, { recursive: true });

    const mainHtml = maskSensitiveText(await page.content());
    const mainPath = `${directoryPath}/${name}-${captureTs}-main.html`;
    await writeFile(mainPath, mainHtml, 'utf-8');

    const frames: HtmlSnapshotFile[] = [];
    const frameErrors: string[] = [];

    for (const [index, frame] of page.frames().entries()) {
      if (frame === page.mainFrame()) {
        continue;
      }

      try {
        const frameHtml = maskSensitiveText(await frame.content());
        const framePath = `${directoryPath}/${name}-${captureTs}-frame-${index}.html`;
        await writeFile(framePath, frameHtml, 'utf-8');
        frames.push({ path: framePath, url: frame.url() });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        frameErrors.push(`frame-${index}: ${message}`);
      }
    }

    return {
      status: 'SUCCESS',
      main: { path: mainPath, url: baseUrl },
      frames,
      captureTs,
      url: baseUrl,
      failureReason: frameErrors.length > 0 ? frameErrors.join(' | ') : undefined,
    };
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error);
    console.error(`HTML 스냅샷 저장 실패: ${failureReason}`);

    return {
      status: 'FAILED',
      frames: [],
      captureTs,
      url: baseUrl,
      failureReason,
    };
  }
}
