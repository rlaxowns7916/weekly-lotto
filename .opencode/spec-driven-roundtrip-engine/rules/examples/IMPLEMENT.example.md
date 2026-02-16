# payments/card 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `application/CardPaymentService`: 승인/취소 유스케이스 오케스트레이션
- `infra/CardGatewayAdapter`: 외부 게이트웨이 HTTP 연동
- `infra/CardCircuitBreaker`: 서킷 브레이커 정책
- `model/*`: 명령/결과/오류 모델
- `support/IdempotencyStore`: 멱등성 키 저장/조회

## 모듈 인벤토리
| file/module | role | change-frequency | risk |
|---|---|---|---|
| `application/CardPaymentService` | 승인 흐름 오케스트레이션 | 높음 | 높음 |
| `infra/CardGatewayAdapter` | 외부 게이트웨이 연동 | 중간 | 높음 |
| `support/IdempotencyStore` | 중복 요청 제어 | 중간 | 중간 |

## 호출 흐름
1. `CardPaymentService.authorize`가 입력 유효성을 검증한다.
2. `IdempotencyStore`로 중복 요청 여부를 확인한다.
3. `CardGatewayAdapter`를 통해 외부 API를 호출한다.
4. 응답/오류를 `CardErrorMapper`로 표준화한다.
5. 상태/이력을 저장하고 `PaymentResult`를 반환한다.

## 핵심 알고리즘
- 승인 알고리즘(요약 의사코드):
  - validate(command)
  - if duplicate(paymentId, idempotencyKey) then return previousResult
  - call gateway with timeout/retry policy
  - map response/error to domain result
  - persist status/history atomically
- 복잡도:
  - 시간: O(1) + 외부 호출
  - 공간: O(1)
- 선택 근거: 외부 호출 실패를 회복하기 위해 retry + circuit breaker를 조합한다.

## 데이터 모델
- `payment_transaction`
  - PK: `payment_id`
  - Fields: `status`, `amount`, `currency`, `gateway_tx_id`, `updated_at`
  - Index: `(status, updated_at)`
- `payment_idempotency`
  - PK: `idempotency_key`
  - Fields: `payment_id`, `result_hash`, `created_at`
- 마이그레이션 전략:
  - 신규 인덱스는 온라인 인덱싱으로 추가
  - backward-compatible 컬럼 추가 후 롤링 배포

## 외부 연동 정책
- timeout: 1500ms
- retry: 최대 2회, exponential backoff(100ms, 300ms)
- circuit breaker: 최근 20요청 중 실패율 50% 초과 시 30초 open
- idempotency key: 요청 헤더 `Idempotency-Key` 사용

## 설정
- `CARD_API_BASE_URL` (required)
- `CARD_API_TIMEOUT_MS` (default: 1500)
- `CARD_API_RETRY_COUNT` (default: 2)
- `CARD_CB_FAILURE_RATE_THRESHOLD` (default: 50)
- 환경 차이:
  - dev: retry 0
  - staging/prod: retry 2

## 예외 처리 전략
- infra 레이어에서 외부 예외를 `GatewayException`으로 랩핑한다.
- application 레이어에서 `CardErrorMapper`로 경계 표준 오류로 변환한다.
- 에러 로그는 `errorCode`, `paymentId`, `correlationId`를 필수로 남긴다.

## 관측성
- 로그: JSON 포맷, 필수 키(`event`, `paymentId`, `latencyMs`, `errorCode`)
- 메트릭:
  - `card_authorize_total{status}`
  - `card_authorize_latency_ms`
  - `card_gateway_timeout_total`
- 트레이싱: `authorize` 시작/외부 호출/저장소 커밋 지점에 span 기록

## 파일 계약 (핵심 파일 상세)
### `application/CardPaymentService`
- 역할: 승인 유스케이스를 오케스트레이션하고 결과를 표준 도메인 모델로 반환한다.
- 외부 노출 심볼: `authorize(command: PaymentCommand): PaymentResult`
- 의존성: `CardGatewayAdapter`, `IdempotencyStore`, `CardErrorMapper`
- 사이드이펙트: `payment_transaction` 업데이트, `payment_idempotency` 조회/저장

| method | input(type/validation) | output | error(code/status/retry) | invariant/constraint |
|---|---|---|---|---|
| `authorize` | `PaymentCommand`; `amount>0`, `currency in ISO-4217` | `PaymentResult` | `E_DUPLICATE_PAYMENT/409/false`, `E_GATEWAY_TIMEOUT/504/true` | 동일 `idempotencyKey`는 동일 결과 반환 |

## 테스트 설계
- 단위 테스트 경계:
  - `CardPaymentService` (유효성/흐름/오류 변환)
  - `CardErrorMapper` (오류 코드 매핑)
- 통합 테스트 경계:
  - DB + Adapter + CircuitBreaker 연동
- 픽스처:
  - 승인 성공 응답
  - 게이트웨이 타임아웃
  - 중복 요청 데이터셋
- 필수 케이스:
  - SCN-001 -> `shouldApprovePaymentWhenCommandIsValid`
  - SCN-002 -> `shouldReturnDuplicateErrorForDuplicatedPayment`
  - SCN-003 -> `shouldReturnGatewayTimeoutAfterRetries`

## 시나리오 추적성
| SCN | implementation(file#symbol) | test | status |
|---|---|---|---|
| `SCN-001` | `application/CardPaymentService#authorize` | `shouldApprovePaymentWhenCommandIsValid` | ready |
| `SCN-002` | `application/CardPaymentService#authorize` | `shouldReturnDuplicateErrorForDuplicatedPayment` | ready |
| `SCN-003` | `application/CardPaymentService#authorize` | `shouldReturnGatewayTimeoutAfterRetries` | ready |

## 변경 규칙
- MUST:
  - `authorize`의 입력 유효성 규칙 변경 시 `SCN-001` 관련 테스트를 같이 수정한다.
  - 오류 매핑 변경 시 `SCN-002`, `SCN-003` 테스트를 같이 수정한다.
- MUST NOT:
  - `IdempotencyStore` 동작을 제거하거나 우회하지 않는다.
  - `E_DUPLICATE_PAYMENT`의 의미/HTTP status를 임의로 변경하지 않는다.
- 함께 수정할 테스트:
  - `shouldApprovePaymentWhenCommandIsValid`
  - `shouldReturnDuplicateErrorForDuplicatedPayment`
  - `shouldReturnGatewayTimeoutAfterRetries`

## 알려진 제약
- 일부 카드사는 취소 API가 비동기로 동작해 즉시 최종 상태를 보장하지 않는다.

## 오픈 질문
- 내용: 재시도 정책을 경계 내부 고정값으로 둘지, 상위 설정으로 완전 위임할지 확정 필요.
- 확인 불가 사유: 현재 코드에 정책 주입 경로(설정 소스/우선순위)가 구현되어 있지 않음.
- 확인 경로: `application/CardPaymentService`와 환경 설정 로더 구현 점검 + 아키텍트 결정 확인.
- 해소 조건: 정책 소유 방식이 결정되어 `외부 연동 정책`/`설정` 섹션과 테스트(`SCN-003`)에 반영됨.
