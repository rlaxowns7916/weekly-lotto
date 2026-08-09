import { describe, expect, it } from 'vitest';
import { parseAmountText, parseBalanceText, verifyChargeByBalance } from './balance.js';

// 잔액 전용 엘리먼트는 라벨 없이 금액만 담고 있는 경우가 많다.
describe('deposit/domain/balance > parseAmountText', () => {
  it('reads a bare amount with a 원 suffix', () => {
    expect(parseAmountText('47,000원')).toBe(47000);
  });

  it('reads a bare amount without a suffix', () => {
    expect(parseAmountText(' 1,234,567 ')).toBe(1234567);
  });

  it('returns null when the text holds no digits', () => {
    expect(parseAmountText('예치금')).toBeNull();
  });

  // 잔액 엘리먼트에 숫자가 여럿 섞여 있으면 어느 쪽이 잔액인지 단정할 수 없다.
  it('returns null when the text holds more than one number', () => {
    expect(parseAmountText('5,000원 10,000원')).toBeNull();
  });
});

describe('deposit/domain/balance > parseBalanceText', () => {
  it('reads the balance from a "예치금" label', () => {
    expect(parseBalanceText('예치금 1,234,567원')).toBe(1234567);
  });

  it('reads the balance when the label and amount are split across lines', () => {
    expect(parseBalanceText('현재 예치금\n  20,000 원')).toBe(20000);
  });

  it('reads a zero balance', () => {
    expect(parseBalanceText('예치금 잔액 0원')).toBe(0);
  });

  // 충전 페이지에는 금액 선택 <select>의 옵션(5,000원 …)이 함께 존재한다.
  // '현재 예치금'을 우선 매칭하지 않으면 선택 옵션을 잔액으로 오독한다.
  it('prefers the current-balance label over nearby amount options', () => {
    const pageText = '충전금액 5,000원 10,000원 20,000원 현재 예치금 47,000원';
    expect(parseBalanceText(pageText)).toBe(47000);
  });

  // 실측(mndpChrg): 잔액은 라벨 바로 뒤에 숫자와 단위가 줄바꿈으로 분리돼 나온다.
  it('reads the balance when the label, number and unit are separate lines', () => {
    expect(parseBalanceText('예치금\n0\n원')).toBe(0);
  });

  // 회귀 방지: 실측에서 느슨한 패턴이 충전금액 표의 '예치금 금액 5,000원'을 잡아
  // 잔액 0원을 5,000원으로 오독했다. 라벨과 숫자 사이에 다른 낱말이 끼면 매칭하지 않는다.
  it('does not read the charge-amount table as the balance', () => {
    expect(parseBalanceText('입금내역 복권 예치금\n금액\n5,000원\n10,000원')).toBeNull();
  });

  // 잘못된 잔액은 못 읽은 것보다 위험하다. 못 읽으면 UNKNOWN으로 멈추지만,
  // 잘못 읽으면 충전 여부를 반대로 판정한다.
  it('returns null rather than guessing when a number is not adjacent to the label', () => {
    expect(parseBalanceText('예치금 충전 안내 5,000원부터 가능합니다')).toBeNull();
  });

  it('returns null when no balance label is present', () => {
    expect(parseBalanceText('예치금 충전이 완료되었습니다.')).toBeNull();
  });

  it('returns null for empty text', () => {
    expect(parseBalanceText('')).toBeNull();
  });
});

describe('deposit/domain/balance > verifyChargeByBalance', () => {
  it('reports charged when the balance grew by the charge amount', () => {
    const result = verifyChargeByBalance({ before: 10000, after: 30000, amount: 20000 });

    expect(result.verdict).toBe('charged');
    expect(result.delta).toBe(20000);
  });

  // 다른 창에서 동시에 충전됐거나 사이트가 보너스를 얹은 경우에도
  // 요청 금액 이상 늘었다면 이번 충전은 반영된 것으로 본다.
  it('reports charged when the balance grew by more than the charge amount', () => {
    expect(verifyChargeByBalance({ before: 10000, after: 40000, amount: 20000 }).verdict).toBe(
      'charged'
    );
  });

  // 재시도를 허용해도 안전한 유일한 경우: 잔액이 그대로면 충전은 확실히 미발생이다.
  it('reports not_charged when the balance is unchanged', () => {
    const result = verifyChargeByBalance({ before: 10000, after: 10000, amount: 20000 });

    expect(result.verdict).toBe('not_charged');
    expect(result.delta).toBe(0);
  });

  it('reports unknown when the before balance could not be read', () => {
    expect(verifyChargeByBalance({ before: null, after: 30000, amount: 20000 }).verdict).toBe(
      'unknown'
    );
  });

  it('reports unknown when the after balance could not be read', () => {
    expect(verifyChargeByBalance({ before: 10000, after: null, amount: 20000 }).verdict).toBe(
      'unknown'
    );
  });

  // 충전과 동시에 구매가 일어나면 증가분이 요청 금액에 못 미칠 수 있다.
  // 충전 발생 여부를 단정할 수 없으므로 재시도 금지 상태로 둔다.
  it('reports unknown when the balance grew by less than the charge amount', () => {
    const result = verifyChargeByBalance({ before: 10000, after: 15000, amount: 20000 });

    expect(result.verdict).toBe('unknown');
    expect(result.delta).toBe(5000);
  });

  it('reports unknown when the balance decreased', () => {
    expect(verifyChargeByBalance({ before: 10000, after: 4000, amount: 20000 }).verdict).toBe(
      'unknown'
    );
  });
});
