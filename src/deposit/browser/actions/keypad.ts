/**
 * 키패드 OCR 모듈
 *
 * NProtect NPPFS 보안 키패드를 Tesseract.js OCR로 인식하여
 * 6자리 비밀번호를 입력한다.
 *
 * 전략: 각 셀을 Playwright clip 스크린샷으로 캡처 → Canvas로 색상반전
 * (흰글씨/파란배경 → 검은글씨/흰배경) → Tesseract.js OCR.
 * 9/10 인식 시 나머지 1개는 수학적 추론(0-9 중 유일 누락값).
 */

import type { Page, Locator } from 'playwright';
import Tesseract from 'tesseract.js';
import { depositSelectors } from '../selectors.js';
import { AppError } from '../../../shared/utils/error.js';

/**
 * 브라우저 Canvas를 사용하여 이미지 색상 반전
 * 흰글씨/파란배경 → 검은글씨/흰배경 (Tesseract 최적화)
 */
async function invertImageInBrowser(page: Page, pngBuffer: Buffer): Promise<Buffer> {
  const base64 = pngBuffer.toString('base64');
  const invertedBase64: string = await page.evaluate(async (src: string) => {
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];       // R
          data[i + 1] = 255 - data[i + 1]; // G
          data[i + 2] = 255 - data[i + 2]; // B
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png').split(',')[1]);
      };
      img.src = `data:image/png;base64,${src}`;
    });
  }, base64);
  return Buffer.from(invertedBase64, 'base64');
}

const MIN_CONFIDENCE = 0.70;
const MAX_KEYPAD_RETRIES = 3;

/** OCR 엔진 교체 가능 인터페이스 */
export interface KeypadRecognizer {
  recognize(cellImage: Buffer): Promise<{ digit: string; confidence: number }>;
  dispose(): Promise<void>;
}

/** Tesseract.js 기본 구현 */
export class TesseractKeypadRecognizer implements KeypadRecognizer {
  private worker: Tesseract.Worker | null = null;

  private async getWorker(): Promise<Tesseract.Worker> {
    if (!this.worker) {
      this.worker = await Tesseract.createWorker('eng');
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      });
    }
    return this.worker;
  }

  async recognize(cellImage: Buffer): Promise<{ digit: string; confidence: number }> {
    const worker = await this.getWorker();
    const result = await worker.recognize(cellImage);
    const text = result.data.text.trim();
    const confidence = result.data.confidence / 100;

    const match = text.match(/\d/);
    return {
      digit: match ? match[0] : text,
      confidence,
    };
  }

  async dispose(): Promise<void> {
    await this.worker?.terminate();
    this.worker = null;
  }
}

/** 키패드 그리드 위치 → 숫자 매핑 */
export interface KeypadDigitMap {
  [digit: string]: { element: Locator; coords: string; confidence: number };
}

/**
 * 키패드 1회 인식 시도
 */
async function recognizeKeypadOnce(
  page: Page,
  recognizer: KeypadRecognizer,
): Promise<KeypadDigitMap> {
  const container = page.locator(depositSelectors.keypadContainer);
  const box = await container.boundingBox();
  if (!box) {
    throw new AppError({
      code: 'KEYPAD_OCR_FAILED',
      category: 'OCR',
      retryable: true,
      message: '키패드 컨테이너 위치를 감지할 수 없습니다',
    });
  }

  const dataButtons = page.locator(depositSelectors.keypadDataButtons);
  const buttonCount = await dataButtons.count();

  const digitMap: KeypadDigitMap = {};
  const unmappedButtons: { button: Locator; coords: string }[] = [];

  for (let i = 0; i < buttonCount; i++) {
    const button = dataButtons.nth(i);
    const buttonBox = await button.boundingBox();
    if (!buttonBox || buttonBox.width < 10 || buttonBox.height < 10) continue;

    const centerX = Math.round(buttonBox.x + buttonBox.width / 2);
    const centerY = Math.round(buttonBox.y + buttonBox.height / 2);
    const coords = `(${centerX},${centerY})`;

    const rawCellImage = await page.screenshot({
      clip: {
        x: buttonBox.x,
        y: buttonBox.y,
        width: buttonBox.width,
        height: buttonBox.height,
      },
    });
    const cellImage = await invertImageInBrowser(page, rawCellImage);

    const { digit, confidence } = await recognizer.recognize(cellImage);

    if (/^\d$/.test(digit)) {
      digitMap[digit] = { element: button, coords, confidence };
    } else {
      unmappedButtons.push({ button, coords });
    }
  }

  // 9/10 인식 시 누락된 숫자 추론 (0-9 각 1회씩 → 9개 알면 나머지 1개 확정)
  if (Object.keys(digitMap).length === 9 && unmappedButtons.length === 1) {
    const allDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const missingDigit = allDigits.find(d => !(d in digitMap));
    if (missingDigit) {
      const { button, coords } = unmappedButtons[0];
      const minConf = Math.min(...Object.values(digitMap).map(d => d.confidence));
      digitMap[missingDigit] = { element: button, coords, confidence: minConf };
      console.log(`키패드 OCR: 숫자 ${missingDigit} 추론 (0-9 중 유일 누락 → 나머지 버튼에 확정)`);
    }
  }

  return digitMap;
}

/**
 * 키패드 인식 (confidence 검증 + refresh 재시도 포함)
 */
export async function recognizeKeypad(
  page: Page,
  recognizer?: KeypadRecognizer,
): Promise<KeypadDigitMap> {
  const rec = recognizer ?? new TesseractKeypadRecognizer();
  const ownRecognizer = !recognizer;

  try {
    for (let attempt = 0; attempt < MAX_KEYPAD_RETRIES; attempt++) {
      const digitMap = await recognizeKeypadOnce(page, rec);
      const recognized = Object.keys(digitMap).length;
      const allAboveThreshold = Object.values(digitMap)
        .every(d => d.confidence >= MIN_CONFIDENCE);

      if (allAboveThreshold && recognized === 10) {
        return digitMap;
      }

      console.log(
        `키패드 OCR 시도 ${attempt + 1}/${MAX_KEYPAD_RETRIES}: ` +
        `인식된 숫자 ${recognized}/10, ` +
        `최저 confidence ${recognized > 0 ? Math.min(...Object.values(digitMap).map(d => d.confidence)).toFixed(2) : '0.00'}` +
        (recognized < 10 ? `, 누락: ${['0','1','2','3','4','5','6','7','8','9'].filter(d => !(d in digitMap)).join(',')}` : '')
      );

      const refreshBtn = page.locator(depositSelectors.keypadRefreshButton);
      try {
        await refreshBtn.waitFor({ state: 'visible', timeout: 2000 });
        await refreshBtn.click();
        await page.waitForTimeout(1000);
      } catch {
        // refresh 버튼이 없으면 무시
      }
    }

    throw new AppError({
      code: 'KEYPAD_OCR_FAILED',
      category: 'OCR',
      retryable: true,
      message: `키패드 OCR 인식 실패: ${MAX_KEYPAD_RETRIES}회 시도 후에도 10개 숫자 모두 인식 불가`,
    });
  } finally {
    if (ownRecognizer) {
      await rec.dispose();
    }
  }
}

/**
 * 비밀번호 입력
 *
 * Playwright Locator.tap()을 사용하여 각 숫자 버튼을 탭합니다.
 * NProtect 키패드는 모바일 에뮬레이션에서 trusted touch 이벤트만 인식하므로
 * click() 대신 tap()을 사용합니다.
 * 6자리 완료 후 NProtect가 자동 제출합니다.
 */
export async function inputPassword(
  page: Page,
  password: string,
  digitMap: KeypadDigitMap,
): Promise<void> {
  for (let i = 0; i < password.length; i++) {
    const char = password[i];
    const entry = digitMap[char];
    if (!entry) {
      throw new AppError({
        code: 'KEYPAD_OCR_FAILED',
        category: 'OCR',
        retryable: false,
        message: `키패드에서 숫자 '${char}'을(를) 찾을 수 없습니다`,
      });
    }

    await entry.element.tap();
    console.log(`  비밀번호 ${i + 1}/${password.length} 입력`);

    // NProtect 클릭 처리 대기
    await page.waitForTimeout(1000);
  }

  // NProtect 자동 제출 처리 대기
  await page.waitForTimeout(2000);
}
