# payments/card
Schema-Version: SRTE-DOCS-1

## 목적
카드 결제 경계는 카드 승인/취소와 같은 결제 흐름을 표준 계약으로 처리한다.
도메인 계층이 카드사별 구현 상세를 직접 알지 않도록 인터페이스를 제공한다.

## 기능 범위/비범위
- 포함: 카드 승인, 카드 취소, 외부 게이트웨이 오류 표준화
- 비포함: 정산 배치, 환율 계산, 정산서 발행

## 공개 인터페이스 계약
- `authorize(PaymentCommand) -> PaymentResult`
  - 필수 입력: `paymentId`, `amount`, `currency`, `cardToken`
  - 옵션 입력: `idempotencyKey`
  - 유효성 규칙: `amount > 0`, `currency`는 ISO-4217 코드
- `cancel(CancelCommand) -> CancelResult`
  - 필수 입력: `paymentId`, `reason`
  - 유효성 규칙: 승인 완료 거래만 취소 가능

## 행동 시나리오
- SCN-001 (정상 승인)
  - Given 유효한 `PaymentCommand`
  - When `authorize`를 호출
  - Then `PaymentResult.status=APPROVED`를 반환
- SCN-002 (중복 승인 요청)
  - Given 동일 `paymentId`에 대해 이미 승인 완료
  - When `authorize`를 재호출
  - Then `E_DUPLICATE_PAYMENT` 오류를 반환
- SCN-003 (외부 타임아웃)
  - Given 게이트웨이 응답 지연
  - When `authorize`를 호출
  - Then 재시도 후 `E_GATEWAY_TIMEOUT` 오류를 반환

## 오류 계약
- `E_DUPLICATE_PAYMENT`: HTTP 409, 재시도 불가, 중복 승인 요청 시 발생
- `E_GATEWAY_TIMEOUT`: HTTP 504, 재시도 가능, 외부 타임아웃 시 발생
- `E_INVALID_INPUT`: HTTP 400, 재시도 불가, 유효성 검증 실패 시 발생

## 불변식/제약
- 같은 `paymentId`는 승인 성공 상태가 1회만 존재해야 한다.
- 승인/취소는 동일 트랜잭션 경계에서 상태와 이력 기록이 함께 커밋되어야 한다.
- `idempotencyKey`가 동일하면 동일 결과를 반환해야 한다.
- 승인 후 취소 순서는 역전될 수 없다.

## 비기능 요구
- `authorize` p95 응답시간 <= 800ms
- 외부 연동 타임아웃 1500ms
- 카드 토큰/민감정보는 로그에 평문 저장 금지
- 동일 `paymentId` 동시 요청 시 직렬화 보장

## 의존성 계약
- 외부 결제 게이트웨이 API: 승인/취소 결과를 동기 응답으로 제공해야 한다.
- 공통 에러 매핑 경계: 외부 오류를 표준 에러 코드로 변환해야 한다.

## 수용 기준
- [ ] SCN-001, SCN-002, SCN-003에 대응하는 테스트가 모두 존재한다.
- [ ] 오류 계약의 코드/HTTP status/재시도 가능 여부가 구현과 일치한다.
- [ ] 불변식(중복 승인 금지, 멱등성)이 테스트로 검증된다.

## 오픈 질문
- 내용: 카드사별 타임아웃 정책을 경계 내부에서 분기할지 상위에서 주입할지 확정 필요.
- 확인 불가 사유: PRD에 카드사별 정책 소유 경계(상위/하위)가 명시되지 않음.
- 확인 경로: `prd/prd-card-payment.md`의 비기능 요구 섹션 보강 후 Product Owner 승인 확인.
- 해소 조건: 타임아웃 정책 소유 경계가 PRD에 명시되고 CLAUDE.md의 비기능 요구에 수치로 반영됨.
