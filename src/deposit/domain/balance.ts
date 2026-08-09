/**
 * 예치금 잔액 파싱과 충전 발생 여부 판정 (순수 도메인 로직)
 *
 * 충전 완료 다이얼로그를 확인하지 못한 '알 수 없음' 상태에서도
 * 충전 전/후 잔액 대조만으로 실제 충전 발생 여부를 판정한다.
 */

export type ChargeVerdict = 'charged' | 'not_charged' | 'unknown';

export interface BalanceSnapshot {
  /** 충전 시도 직전 잔액. 읽지 못하면 null */
  before: number | null;
  /** 충전 시도 직후 잔액. 읽지 못하면 null */
  after: number | null;
}

export interface ChargeVerification {
  verdict: ChargeVerdict;
  /** after - before. 한쪽이라도 읽지 못했으면 null */
  delta: number | null;
  /** 판정 근거 (로그/이메일 진단용) */
  reason: string;
}

/**
 * 잔액 라벨 패턴. 앞쪽일수록 우선한다.
 *
 * 라벨과 금액 사이에는 공백만 허용한다. 실측(mndpChrg)에서 느슨한 간격을
 * 허용했더니 충전금액 표의 `예치금\n금액\n5,000원`을 잔액으로 잡아
 * 실제 잔액 0원을 5,000원으로 오독했다.
 *
 * 잘못 읽은 잔액은 못 읽은 것보다 위험하다. 못 읽으면 판정이 `unknown`으로
 * 멈추지만, 잘못 읽으면 충전 여부를 반대로 판정하기 때문이다.
 */
const BALANCE_PATTERNS: readonly RegExp[] = [
  /(?:현재\s*)?예치금\s*(?:잔액\s*)?([\d,]+)\s*원/,
  /보유\s*(?:금액|예치금)\s*([\d,]+)\s*원/,
  /잔액\s*([\d,]+)\s*원/,
];

/**
 * 페이지 텍스트에서 예치금 잔액을 추출한다.
 *
 * @returns 잔액(원). 라벨을 찾지 못하거나 숫자로 해석할 수 없으면 null
 */
export function parseBalanceText(text: string): number | null {
  for (const pattern of BALANCE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) {
      continue;
    }

    const amount = Number(match[1].replace(/,/g, ''));
    if (Number.isFinite(amount) && amount >= 0) {
      return amount;
    }
  }

  return null;
}

/**
 * 잔액 전용 엘리먼트의 텍스트에서 금액만 추출한다.
 *
 * 숫자가 여럿이면 어느 쪽이 잔액인지 단정할 수 없으므로 null을 반환해
 * 다음 후보 셀렉터나 본문 텍스트 스캔으로 넘긴다.
 *
 * @returns 금액(원). 숫자가 없거나 둘 이상이면 null
 */
export function parseAmountText(text: string): number | null {
  const matches = text.match(/[\d,]*\d/g);
  if (matches?.length !== 1) {
    return null;
  }

  const amount = Number(matches[0].replace(/,/g, ''));
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/**
 * 충전 전/후 잔액으로 충전 발생 여부를 판정한다.
 *
 * `not_charged`만이 재시도해도 안전한 상태다. 잔액이 그대로라는 것은
 * 충전이 확실히 일어나지 않았다는 뜻이기 때문이다. 그 외에는 중복 충전을
 * 막기 위해 재시도하지 않는다.
 */
export function verifyChargeByBalance(params: {
  before: number | null;
  after: number | null;
  amount: number;
}): ChargeVerification {
  const { before, after, amount } = params;

  if (before === null || after === null) {
    const missing = before === null ? '충전 전' : '충전 후';
    return {
      verdict: 'unknown',
      delta: null,
      reason: `${missing} 예치금 잔액을 읽지 못해 충전 발생 여부를 판정할 수 없습니다`,
    };
  }

  const delta = after - before;

  if (delta >= amount) {
    return {
      verdict: 'charged',
      delta,
      reason: `잔액이 ${delta.toLocaleString()}원 증가해 충전이 반영된 것으로 판정합니다`,
    };
  }

  if (delta === 0) {
    return {
      verdict: 'not_charged',
      delta,
      reason: '잔액이 변하지 않아 충전이 발생하지 않은 것으로 판정합니다',
    };
  }

  return {
    verdict: 'unknown',
    delta,
    reason:
      `잔액 변화(${delta.toLocaleString()}원)가 충전 금액(${amount.toLocaleString()}원)과 ` +
      '일치하지 않아 충전 발생 여부를 판정할 수 없습니다',
  };
}
