import type { BalanceSnapshot, ChargeVerification } from './balance.js';

export interface ChargeResult {
  amount: number;
  status: 'success' | 'dry_run';
  timestamp: Date;
  keypadOcrConfidence: number; // 전체 셀 중 최저 confidence
  /** 충전 전/후 예치금 잔액. 읽지 못한 값은 null (dry_run에서는 미수집) */
  balance?: BalanceSnapshot;
  /** 잔액 대조 기반 충전 발생 판정 (dry_run에서는 미수집) */
  verification?: ChargeVerification;
  /** 충전 완료 다이얼로그를 확인했는지 여부 (dry_run에서는 미수집) */
  dialogConfirmed?: boolean;
}
