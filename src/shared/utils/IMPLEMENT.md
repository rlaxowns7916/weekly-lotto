# shared/utils 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `retry.ts`: 재시도 옵션/지연 계산/재시도 래퍼 함수.
- `date.ts`: 발행일 파싱, 시간 범위 판정, 날짜 포맷 함수.
- `html.ts`: HTML 이스케이프 함수와 템플릿 반환 타입.

## 호출 흐름
1. 상위 경계가 네트워크/브라우저 액션을 `withRetry`로 감싼다.
2. 구매내역 파서가 발행일 문자열을 `parseSaleDate`로 변환한다.
3. 서비스 템플릿이 `escapeHtml` 및 날짜 포맷 함수를 호출한다.

## 핵심 알고리즘
- `withRetry`:
  - 최대 시도 횟수만큼 함수 실행.
  - 실패 시 재시도 가능 여부 판단.
  - 지수 백오프 + 지터 지연 후 재실행.
- `parseSaleDate`:
  - 정규식으로 날짜/시간을 추출해 `+09:00` ISO 문자열 생성.

## 데이터 모델
- `RetryOptions`: `maxRetries`, `baseDelayMs`, `maxDelayMs`, `shouldRetry`, `log`.
- `EmailTemplateResult`: `subject`, `html`, `text`.

## 외부 연동 정책
- 외부 서비스 호출 없음.
- retry/backoff는 `withRetry` 내부 정책으로 구현.
- timeout/circuit breaker/idempotency key: 해당 없음.

## 설정
- 환경 변수 직접 사용 없음.
- 함수 파라미터로 동작을 제어한다.

## 예외 처리 전략
- `withRetry`는 최종 실패 시 마지막 오류를 throw한다.
- 날짜/HTML 유틸은 예외 대신 보정값(`null`, 원문 반환)을 제공한다.

## 관측성
- `withRetry` 재시도 시 경고 로그를 출력할 수 있다(`log=true`).
- 그 외 메트릭/트레이싱 구현은 없다.

## 테스트 설계
- 단위 테스트: `retry.test.ts`, `date.test.ts`.
- 필수 케이스: 재시도 조건 분기, 지연 계산, 날짜 파싱/포맷 경계값.

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/shared/utils/retry.ts#withRetry` | `src/shared/utils/retry.test.ts::retries until success when retry condition is met` |
| SCN-002 | `src/shared/utils/date.ts#parseSaleDate` | `src/shared/utils/date.test.ts::returns null for invalid sale date string` |

## 알려진 제약
- 날짜 파싱은 동행복권 문자열 형식에 의존한다.

## 오픈 질문
- 없음
