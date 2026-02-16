import { stat } from 'node:fs/promises';
import { classifyErrorMessage, type AppErrorCode } from '../utils/error.js';

export interface OcrOptions {
  timeoutMs?: number;
  lang?: string;
  fallbackText?: string;
  extractor?: OcrExtractor;
}

export interface OcrExtractorResult {
  text: string;
  confidence?: number;
}

export type OcrExtractor = (
  screenshotPath: string,
  options: { timeoutMs: number; lang: string }
) => Promise<OcrExtractorResult>;

export interface OcrResult {
  status: 'SUCCESS' | 'FAILED';
  text: string;
  confidence?: number;
  lang: string;
  hintCode: AppErrorCode;
  failureReason?: string;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_LANG = 'kor+eng';

async function ensureScreenshotExists(screenshotPath: string): Promise<void> {
  await stat(screenshotPath);
}

function toOcrFailure(
  hintCode: AppErrorCode,
  lang: string,
  failureReason: string
): OcrResult {
  return {
    status: 'FAILED',
    text: '',
    lang,
    hintCode,
    failureReason,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`OCR timeout exceeded: ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

export async function extractFailureOcr(
  screenshotPath: string,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const lang = options.lang ?? DEFAULT_LANG;
  const fallbackText = options.fallbackText?.trim() ?? '';
  const extractor = options.extractor;

  try {
    await withTimeout(ensureScreenshotExists(screenshotPath), timeoutMs);
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : String(error);
    return toOcrFailure('OCR_TEXT_NOT_FOUND', lang, failureReason);
  }

  if (extractor) {
    try {
      const extraction = await withTimeout(
        extractor(screenshotPath, { timeoutMs, lang }),
        timeoutMs
      );
      const extractedText = extraction.text.trim();

      if (!extractedText) {
        return toOcrFailure(
          'OCR_TEXT_NOT_FOUND',
          lang,
          'OCR extractor completed but returned empty text.'
        );
      }

      const classification = classifyErrorMessage(extractedText);
      return {
        status: 'SUCCESS',
        text: extractedText,
        confidence: extraction.confidence,
        lang,
        hintCode: classification.code,
      };
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : String(error);
      const timeoutMarker = `OCR timeout exceeded: ${timeoutMs}ms`;

      return toOcrFailure(
        failureReason.includes(timeoutMarker) ? 'OCR_TIMEOUT' : 'OCR_EXTRACTION_FAILED',
        lang,
        failureReason
      );
    }
  }

  if (!fallbackText) {
    return toOcrFailure(
      'OCR_ENGINE_UNAVAILABLE',
      lang,
      'No OCR engine configured. Provide fallbackText or add OCR engine integration.'
    );
  }

  const classification = classifyErrorMessage(fallbackText);
  return {
    status: 'SUCCESS',
    text: fallbackText,
    confidence: 0.5,
    lang,
    hintCode: classification.code,
  };
}
