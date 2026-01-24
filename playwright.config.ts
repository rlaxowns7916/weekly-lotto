import { defineConfig, devices } from 'playwright/test';

/**
 * Playwright 설정
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // 테스트 디렉토리
  testDir: './tests',

  // 테스트 타임아웃 (30초)
  timeout: 30000,

  // 각 테스트 간 기대 타임아웃
  expect: {
    timeout: 5000,
  },

  // 실패 시 재시도
  retries: process.env.CI ? 2 : 0,

  // 워커 수 (CI에서는 1개로 제한)
  workers: process.env.CI ? 1 : undefined,

  // 리포터
  reporter: 'html',

  // 공통 설정
  use: {
    // 헤드리스 모드 (HEADED=true 환경변수로 브라우저 표시)
    headless: process.env.HEADED !== 'true',

    // 브라우저 컨텍스트 옵션
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // 스크린샷: 실패 시에만
    screenshot: 'only-on-failure',

    // 비디오: 실패 시에만
    video: 'on-first-retry',

    // Trace: 실패 시에만
    trace: 'on-first-retry',

    // 한국어 설정
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },

  // 프로젝트 설정
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // 출력 디렉토리
  outputDir: 'test-results/',
});
