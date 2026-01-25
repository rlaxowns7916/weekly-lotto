/**
 * 로또 구매 API 클라이언트
 *
 * 브라우저 페이지 이동 없이 API 직접 호출로 구매
 * Go 코드 기반으로 포팅
 */

import type { BrowserContext } from 'playwright';
import type { PurchasedTicket } from '../domain/ticket.js';

const READY_SOCKET_URL = 'https://ol.dhlottery.co.kr/olotto/game/egovUserReadySocket.json';
const BUY_LOTTO_URL = 'https://ol.dhlottery.co.kr/olotto/game/execBuy.do';

interface BuyResponse {
  result: {
    resultCode: string;
    resultMsg: string;
    arrGameChoiceNum?: string[];
  };
}

/**
 * 브라우저 컨텍스트에서 쿠키 추출
 */
async function getCookiesAsString(context: BrowserContext): Promise<string> {
  const cookies = await context.cookies();
  return cookies
    .filter(c => c.domain.includes('dhlottery.co.kr'))
    .map(c => `${c.name}=${c.value}`)
    .join('; ');
}

const PURCHASE_PAGE_URL = 'https://ol.dhlottery.co.kr/olotto/game/game645.do';

/**
 * 현재 판매 중인 회차 번호 조회 (구매 페이지에서 직접 추출)
 * 구매 페이지에 표시된 "제XXXX회"가 판매 중인 회차
 */
export async function getCurrentRound(context: BrowserContext): Promise<number> {
  const pages = context.pages();
  const page = pages[0];

  if (!page) {
    throw new Error('브라우저 페이지가 없습니다');
  }

  // 구매 페이지로 이동 (이미 구매 페이지면 스킵)
  if (!page.url().includes('ol.dhlottery.co.kr')) {
    await page.goto(PURCHASE_PAGE_URL, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
  }

  // 구매 페이지에서 현재 판매 회차 추출 ("제1209회" 형식)
  const currentRound = await page.evaluate((): number => {
    // @ts-expect-error - document is available in browser context
    const text = document.body.innerText;
    // "제XXXX회" 패턴이 판매 중인 회차 (첫 번째 매칭)
    const match = text.match(/제\s*(\d{4})\s*회/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 0;
  });

  if (!currentRound) {
    throw new Error('회차 번호를 찾을 수 없습니다');
  }

  return currentRound;
}

/**
 * Ready IP 획득 (구매 전 필수)
 */
async function getReadySocket(context: BrowserContext): Promise<string> {
  const cookieString = await getCookiesAsString(context);

  const response = await fetch(READY_SOCKET_URL, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Cookie': cookieString,
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'Referer': 'https://ol.dhlottery.co.kr/olotto/game/game645.do',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  const data = await response.json() as { ready_ip?: string };

  if (!data.ready_ip) {
    throw new Error('ready_ip를 획득할 수 없습니다');
  }

  return data.ready_ip;
}

/**
 * 구매 파라미터 생성
 */
function makeBuyParam(count: number): string {
  const slots = ['A', 'B', 'C', 'D', 'E'];
  const params = [];

  for (let i = 0; i < count && i < 5; i++) {
    params.push({
      genType: '0', // 0 = 자동
      arrGameChoiceNum: null,
      alpabet: slots[i],
    });
  }

  return JSON.stringify(params);
}

/**
 * 구매 결과 파싱
 * Format: ["A|01|02|04|27|39|443", "B|11|23|25|27|28|452"]
 * 마지막 숫자의 마지막 자리: 1=수동, 2=반자동, 3=자동
 */
function parsePurchasedNumbers(lines: string[], round: number): PurchasedTicket[] {
  const modeMap: Record<string, 'auto' | 'manual' | 'semi-auto'> = {
    '1': 'manual',
    '2': 'semi-auto',
    '3': 'auto',
  };

  return lines.map(line => {
    // "A|01|02|04|27|39|443" -> slot=A, numbers=[1,2,4,27,39,44], mode=3(auto)
    const parts = line.split('|');
    const slot = parts[0] as 'A' | 'B' | 'C' | 'D' | 'E';
    const lastPart = parts[parts.length - 1];
    const modeCode = lastPart.slice(-1); // 마지막 숫자의 마지막 자리
    const lastNumber = parseInt(lastPart.slice(0, -1), 10);

    const numbers = parts.slice(1, -1).map(n => parseInt(n, 10));
    numbers.push(lastNumber);

    return {
      round,
      slot,
      numbers,
      mode: modeMap[modeCode] || 'auto',
    };
  });
}

/**
 * 로또 6/45 구매 (API 직접 호출)
 *
 * @param context 로그인된 브라우저 컨텍스트
 * @param count 구매할 게임 수 (1-5)
 * @returns 구매된 티켓 목록
 */
export async function buyLottoViaApi(
  context: BrowserContext,
  count: number = 1
): Promise<PurchasedTicket[]> {
  if (count < 1 || count > 5) {
    throw new Error('구매 수량은 1-5 사이여야 합니다');
  }

  const cookieString = await getCookiesAsString(context);

  // 1. Ready IP 획득
  console.log('Ready IP 획득 중...');
  const readyIP = await getReadySocket(context);
  console.log(`Ready IP: ${readyIP}`);

  // 2. 현재 회차 조회
  console.log('회차 정보 조회 중...');
  const round = await getCurrentRound(context);
  console.log(`현재 회차: ${round}회`);

  // 3. 구매 파라미터 생성
  const param = makeBuyParam(count);
  const buyAmount = 1000 * count;

  // 4. 구매 요청
  console.log(`로또 ${count}장 구매 요청 중...`);

  const formData = new URLSearchParams();
  formData.set('round', round.toString());
  formData.set('direct', readyIP);
  formData.set('nBuyAmount', buyAmount.toString());
  formData.set('param', param);
  formData.set('gameCnt', count.toString());

  const response = await fetch(BUY_LOTTO_URL, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Cookie': cookieString,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'Referer': 'https://ol.dhlottery.co.kr/olotto/game/game645.do',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://ol.dhlottery.co.kr',
    },
    body: formData.toString(),
  });

  const result = await response.json() as BuyResponse;

  // 5. 결과 확인
  if (result.result.resultCode !== '100') {
    throw new Error(`구매 실패: ${result.result.resultMsg}`);
  }

  // 6. 구매된 번호 파싱
  const tickets = parsePurchasedNumbers(result.result.arrGameChoiceNum || [], round);

  console.log(`구매 성공: ${tickets.length}장`);
  for (const ticket of tickets) {
    console.log(`  ${ticket.slot}: [${ticket.numbers.join(', ')}] (${ticket.mode})`);
  }

  return tickets;
}
