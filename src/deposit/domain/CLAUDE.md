# deposit/domain
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 예치금 충전 도메인 타입 계약을 정의한다.
상위 경계가 동일한 타입으로 충전 결과를 교환하도록 보장한다.

## 기능 범위/비범위
- 포함: `ChargeResult` 인터페이스 제공.
- 비포함: 브라우저 파싱, 충전 실행, 이메일 템플릿 렌더링.

## 공개 인터페이스 계약
- 입력 타입/필드: 없음(타입 정의만 제공).
- 필수/옵션: 없음.
- 유효성 규칙:
  - `ChargeResult.status`는 `'success'` 또는 `'dry_run'`만 허용.
  - `ChargeResult.keypadOcrConfidence`는 0.0~1.0 범위.
- 출력 타입/필드:
  - `ChargeResult`: `{ amount: number; status: 'success' | 'dry_run'; timestamp: Date; keypadOcrConfidence: number }`.

## 행동 시나리오
- 해당 없음(타입 정의만 제공).

## 오류 계약
- 에러 코드: 없음(순수 타입 정의).
- HTTP status(해당 시): 없음.
- 재시도 가능 여부: 해당 없음.
- 발생 조건: 없음.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 없음.
- 멱등성 규칙: 해당 없음.
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

## 오픈 질문
- 없음
