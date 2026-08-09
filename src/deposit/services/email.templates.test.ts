import { describe, expect, it } from 'vitest';
import { chargeSuccessTemplate } from './email.templates.js';
import type { ChargeResult } from '../domain/charge.js';

const baseResult: ChargeResult = {
  amount: 20000,
  status: 'success',
  timestamp: new Date('2026-08-09T00:00:00Z'),
  keypadOcrConfidence: 0.93,
};

describe('deposit/services/email.templates > chargeSuccessTemplate', () => {
  it('shows the before and after balance when they were verified', () => {
    const { html, text } = chargeSuccessTemplate({
      ...baseResult,
      balance: { before: 10000, after: 30000 },
      verification: { verdict: 'charged', delta: 20000, reason: '잔액이 20,000원 증가' },
      dialogConfirmed: true,
    });

    expect(html).toContain('10,000원');
    expect(html).toContain('30,000원');
    expect(text).toContain('10,000원');
    expect(text).toContain('30,000원');
  });

  // 다이얼로그만 보고 성공 처리된 경우, 잔액으로 확인되지 않았다는 사실을
  // 메일에서 감추면 사용자가 직접 확인할 기회를 잃는다.
  it('flags the charge as balance-unverified when the balance could not be read', () => {
    const { html, text } = chargeSuccessTemplate({
      ...baseResult,
      balance: { before: null, after: null },
      verification: { verdict: 'unknown', delta: null, reason: '잔액을 읽지 못했습니다' },
      dialogConfirmed: true,
    });

    expect(html).toContain('잔액 미검증');
    expect(text).toContain('잔액 미검증');
  });

  it('omits the balance rows for a dry run that collected no balance', () => {
    const { text } = chargeSuccessTemplate({ ...baseResult, status: 'dry_run' });

    expect(text).not.toContain('충전 전 예치금');
  });
});
