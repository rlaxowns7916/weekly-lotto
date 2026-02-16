export type AppErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'NETWORK_NAVIGATION_TIMEOUT'
  | 'DOM_SELECTOR_NOT_VISIBLE'
  | 'PARSE_FORMAT_INVALID'
  | 'PURCHASE_VERIFICATION_FAILED'
  | 'EMAIL_SEND_FAILED'
  | 'OCR_ENGINE_UNAVAILABLE'
  | 'OCR_TIMEOUT'
  | 'OCR_TEXT_NOT_FOUND'
  | 'OCR_EXTRACTION_FAILED'
  | 'UNKNOWN_UNCLASSIFIED';

export type AppErrorCategory =
  | 'AUTH'
  | 'NETWORK'
  | 'DOM'
  | 'PARSE'
  | 'BUSINESS'
  | 'EMAIL'
  | 'OCR'
  | 'UNKNOWN';

export interface RetryDiagnostic {
  attemptCount: number;
  maxRetries: number;
  lastErrorMessage: string;
}

export interface AppErrorOptions {
  code: AppErrorCode;
  category: AppErrorCategory;
  message: string;
  retryable: boolean;
  classificationReason?: string;
  retry?: RetryDiagnostic;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly category: AppErrorCategory;
  readonly retryable: boolean;
  readonly classificationReason?: string;
  readonly retry?: RetryDiagnostic;
  declare readonly cause: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code;
    this.category = options.category;
    this.retryable = options.retryable;
    this.classificationReason = options.classificationReason;
    this.retry = options.retry;
    this.cause = options.cause;
  }
}

function includesKeyword(input: string, keywords: string[]): boolean {
  return keywords.some((keyword) => input.includes(keyword));
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function classifyErrorMessage(message: string): {
  code: AppErrorCode;
  category: AppErrorCategory;
  retryable: boolean;
  classificationReason?: string;
} {
  const normalized = message.toLowerCase();

  if (includesKeyword(normalized, ['아이디', '비밀번호', 'credential', 'auth'])) {
    return {
      code: 'AUTH_INVALID_CREDENTIALS',
      category: 'AUTH',
      retryable: false,
    };
  }

  if (includesKeyword(normalized, ['timeout', 'timed out', 'net::', 'connection', 'network'])) {
    return {
      code: 'NETWORK_NAVIGATION_TIMEOUT',
      category: 'NETWORK',
      retryable: true,
    };
  }

  if (includesKeyword(normalized, ['selector', 'visible', 'locator'])) {
    return {
      code: 'DOM_SELECTOR_NOT_VISIBLE',
      category: 'DOM',
      retryable: false,
    };
  }

  if (includesKeyword(normalized, ['parse', '파싱', 'format'])) {
    return {
      code: 'PARSE_FORMAT_INVALID',
      category: 'PARSE',
      retryable: false,
    };
  }

  if (includesKeyword(normalized, ['구매 검증 실패', 'verification'])) {
    return {
      code: 'PURCHASE_VERIFICATION_FAILED',
      category: 'BUSINESS',
      retryable: false,
    };
  }

  if (includesKeyword(normalized, ['smtp', 'mail', 'email'])) {
    return {
      code: 'EMAIL_SEND_FAILED',
      category: 'EMAIL',
      retryable: false,
    };
  }

  if (includesKeyword(normalized, ['ocr timeout', 'tesseract timeout'])) {
    return {
      code: 'OCR_TIMEOUT',
      category: 'OCR',
      retryable: true,
    };
  }

  if (includesKeyword(normalized, ['ocr engine', 'tesseract', 'worker init'])) {
    return {
      code: 'OCR_ENGINE_UNAVAILABLE',
      category: 'OCR',
      retryable: false,
    };
  }

  if (includesKeyword(normalized, ['ocr text not found', 'no ocr text'])) {
    return {
      code: 'OCR_TEXT_NOT_FOUND',
      category: 'OCR',
      retryable: false,
    };
  }

  if (includesKeyword(normalized, ['ocr extract', 'ocr extraction'])) {
    return {
      code: 'OCR_EXTRACTION_FAILED',
      category: 'OCR',
      retryable: false,
    };
  }

  return {
    code: 'UNKNOWN_UNCLASSIFIED',
    category: 'UNKNOWN',
    retryable: false,
    classificationReason: `No classification rule matched: ${message}`,
  };
}

export function toAppError(
  error: unknown,
  overrides: Partial<Omit<AppErrorOptions, 'message'>> = {}
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const message = getErrorMessage(error);
  const inferred = classifyErrorMessage(message);

  return new AppError({
    code: overrides.code ?? inferred.code,
    category: overrides.category ?? inferred.category,
    retryable: overrides.retryable ?? inferred.retryable,
    message,
    classificationReason:
      overrides.classificationReason ??
      (overrides.code === 'UNKNOWN_UNCLASSIFIED'
        ? inferred.classificationReason ?? `No explicit reason provided: ${message}`
        : inferred.classificationReason),
    retry: overrides.retry,
    cause: overrides.cause ?? error,
  });
}

export function getErrorDetails(error: unknown): {
  message: string;
  code: AppErrorCode;
  category: AppErrorCategory;
  retryable: boolean;
  classificationReason?: string;
  retry?: RetryDiagnostic;
} {
  const appError = toAppError(error);

  return {
    message: appError.message,
    code: appError.code,
    category: appError.category,
    retryable: appError.retryable,
    classificationReason: appError.classificationReason,
    retry: appError.retry,
  };
}

export function formatErrorSummary(error: unknown): string {
  const details = getErrorDetails(error);
  const parts = [
    `code=${details.code}`,
    `category=${details.category}`,
    `retryable=${details.retryable}`,
    `message=${details.message}`,
  ];

  if (details.retry) {
    parts.push(
      `retry.attemptCount=${details.retry.attemptCount}`,
      `retry.maxRetries=${details.retry.maxRetries}`,
      `retry.lastErrorMessage=${details.retry.lastErrorMessage}`
    );
  }

  if (details.classificationReason) {
    parts.push(`classificationReason=${details.classificationReason}`);
  }

  return parts.join(' | ');
}
