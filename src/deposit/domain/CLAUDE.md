# deposit/domain
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 예치금 충전 도메인 타입과 잔액 판정 순수 로직 계약을 정의한다.
상위 경계가 동일한 타입으로 충전 결과를 교환하고, 동일한 규칙으로 충전 발생 여부를 판정하도록 보장한다.

## 기능 범위/비범위
- 포함: `ChargeResult` 인터페이스 제공.
- 포함: `BalanceSnapshot`, `ChargeVerdict`, `ChargeVerification` 타입 제공.
- 포함: 잔액 텍스트 파싱(`parseBalanceText`, `parseAmountText`) 제공.
- 포함: 충전 전/후 잔액 대조 판정(`verifyChargeByBalance`) 제공.
- 비포함: 브라우저 DOM 조회, 충전 실행, 이메일 템플릿 렌더링.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - `parseBalanceText(text: string)`, `parseAmountText(text: string)`.
  - `verifyChargeByBalance({ before: number|null, after: number|null, amount: number })`.
- 필수/옵션: 위 함수 인자는 모두 필수.
- 유효성 규칙:
  - `ChargeResult.status`는 `'success'` 또는 `'dry_run'`만 허용.
  - `ChargeResult.keypadOcrConfidence`는 0.0~1.0 범위.
  - `ChargeResult.balance`/`verification`/`dialogConfirmed`는 실충전 경로에서만 채워진다(`dry_run`은 미수집).
  - `parseBalanceText`는 라벨과 금액 사이에 공백만 허용한다. 느슨한 간격은 충전금액 표(`예치금\n금액\n5,000원`)를 잔액으로 오독하므로 금지한다.
  - 라벨에 인접한 금액을 찾지 못하면 추측하지 않고 `null`을 반환한다. 잘못 읽은 잔액은 못 읽은 잔액보다 위험하다(판정이 반대로 뒤집힌다).
  - `parseAmountText`는 텍스트에 숫자가 정확히 1개일 때만 값을 반환한다.
  - 음수 금액은 허용하지 않는다(파싱 실패로 `null`).
- 출력 타입/필드:
  - `ChargeResult`: `{ amount, status: 'success'|'dry_run', timestamp, keypadOcrConfidence, balance?, verification?, dialogConfirmed? }`.
  - `BalanceSnapshot`: `{ before: number|null; after: number|null }`.
  - `ChargeVerification`: `{ verdict: 'charged'|'not_charged'|'unknown'; delta: number|null; reason: string }`.
  - 파싱 함수는 `number | null`.

## 행동 시나리오
- SCN-001: Given `after - before >= amount`, When `verifyChargeByBalance` 호출, Then `verdict='charged'`.
- SCN-002: Given `after == before`, When `verifyChargeByBalance` 호출, Then `verdict='not_charged'` and `delta=0`.
- SCN-003: Given `before` 또는 `after`가 `null`, When `verifyChargeByBalance` 호출, Then `verdict='unknown'` and `delta=null`.
- SCN-004: Given `0 < after - before < amount` 또는 `after < before`, When `verifyChargeByBalance` 호출, Then `verdict='unknown'`.
- SCN-005: Given 금액 선택 옵션이 함께 있는 충전 페이지 텍스트, When `parseBalanceText` 호출, Then `returnValue=현재 예치금 값` and `returnValue!=선택 옵션 값`.
- SCN-006: Given 실측 텍스트 `예치금\n0\n원`, When `parseBalanceText` 호출, Then `returnValue=0`.
- SCN-007: Given 실측 텍스트 `복권 예치금\n금액\n5,000원`, When `parseBalanceText` 호출, Then `returnValue=null`.

## 오류 계약
- 에러 코드: 없음(순수 함수 경계, 실패는 `null` 또는 `verdict='unknown'`으로 표현).
- HTTP status(해당 시): 없음.
- 재시도 가능 여부: 해당 없음.
- 발생 조건: 없음(예외를 던지지 않는다).

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: `verdict='not_charged'`는 충전이 확실히 미발생인 경우에만 부여한다. 이 값만이 상위 경계에서 재시도를 허용하는 유일한 신호다.
- 멱등성 규칙: 동일 입력에서 동일 판정을 반환한다.
- 순서 보장 규칙: 없음.

## 비기능 요구
- 성능(SLO): 해당 없음(타입 정의).
- 보안 요구: 없음.
- 타임아웃: 해당 없음.
- 동시성 요구: 없음.

## 의존성 계약
- 내부 경계: 없음.
- 외부 서비스: 없음.
- 외부 라이브러리: 없음.

## 수용 기준
- [ ] `ChargeResult` 타입이 상위 경계에서 import 가능하다.
- [ ] `verifyChargeByBalance`가 `charged`/`not_charged`/`unknown` 세 판정을 결정형으로 반환한다.
- [ ] 잔액을 한쪽이라도 읽지 못하면 `unknown`으로 판정한다.
- [ ] `parseBalanceText`가 금액 선택 옵션보다 현재 잔액 라벨을 우선 매칭한다.

## 오픈 질문
- 없음
