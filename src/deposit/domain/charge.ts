export interface ChargeResult {
  amount: number;
  status: 'success' | 'dry_run';
  timestamp: Date;
  keypadOcrConfidence: number; // 전체 셀 중 최저 confidence
}
