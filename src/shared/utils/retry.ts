/**
 * 재시도 유틸리티 (지수 백오프 + Jitter)
 */

export interface RetryOptions {
  /** 최대 재시도 횟수 (기본값: 3) */
  maxRetries?: number;
  /** 기본 대기 시간 (밀리초, 기본값: 1000) */
  baseDelayMs?: number;
  /** 최대 대기 시간 (밀리초, 기본값: 10000) */
  maxDelayMs?: number;
  /** 재시도할 에러 판별 함수 (기본값: 모든 에러) */
  shouldRetry?: (error: unknown) => boolean;
  /** 재시도 시 로그 출력 (기본값: true) */
  log?: boolean;
}

/**
 * 지수 백오프 + Jitter로 대기 시간 계산
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  // 지수 백오프: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);

  // 최대값 제한
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Jitter: 0.5 ~ 1.5 배 랜덤
  const jitter = 0.5 + Math.random();

  return Math.floor(cappedDelay * jitter);
}

/**
 * 재시도 가능한 에러인지 판별 (네트워크 에러 등)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('net::') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('connection') ||
      message.includes('network')
    );
  }
  return false;
}

/**
 * 함수를 재시도 로직으로 감싸기
 *
 * @example
 * const result = await withRetry(
 *   () => fetchData(),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    shouldRetry = isRetryableError,
    log = true,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 마지막 시도였으면 에러 던지기
      if (attempt >= maxRetries) {
        break;
      }

      // 재시도 가능한 에러인지 확인
      if (!shouldRetry(error)) {
        break;
      }

      // 대기 시간 계산
      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs);

      if (log) {
        console.warn(
          `⚠️ 시도 ${attempt + 1}/${maxRetries + 1} 실패, ${delay}ms 후 재시도...`
        );
      }

      // 대기
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * 지정된 시간만큼 대기
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
