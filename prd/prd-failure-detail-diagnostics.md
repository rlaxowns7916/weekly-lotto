# PRD: 실패 상세 진단 고도화

## 목적
- 현재 자동화 실행 실패가 `timeout` 또는 `unknown` 중심으로 단순화되어, 운영자가 원인(인증 실패/DOM 변경/네트워크 지연/파싱 실패)을 즉시 식별하기 어렵다.
- 본 기능은 실패 원인을 구조화된 분류 체계로 표준화해 CLI 출력, 이메일 알림, 테스트 진단에서 동일한 상세 원인 정보를 제공하는 것을 목표로 한다.

## 요구사항

### 기능 요구사항
- REQ-001: 모든 실패 이벤트는 `error.code`, `error.category`, `error.message`, `error.retryable`를 포함한 구조화 결과로 표현한다.
- REQ-002: 재시도 경로(`withRetry`)는 최종 실패 시 `retry.attemptCount`, `retry.maxRetries`, `retry.lastErrorMessage`를 함께 노출한다.
- REQ-003: 명령 경계(`lotto:*`, `pension:*`) 실패 출력은 `processExitCode=1`을 유지하면서 `error.code`와 `error.category`를 콘솔에 표시한다.
- REQ-004: 구매 실패 알림 이메일 템플릿은 기존 요약 문구를 유지하되 `error.code`, `error.category`, `diagnostic.summary`를 추가 포함한다.
- REQ-005: `UNKNOWN` 계열 코드는 분류 불가능한 경우에만 허용하며, 이때 `classificationReason` 필드를 필수로 기록한다.
- REQ-006: 로또/연금복권 경계는 동일한 공통 에러 분류 체계를 사용하고, 도메인 특화 코드는 접두사(`LOTTO_`, `PENSION_`)로 확장 가능해야 한다.
- REQ-007: 테스트 유틸 진단 문자열(`tests/utils/failure-diagnostics.ts`)은 운영 에러 코드와 매핑 가능한 필드(`context`, `selectorState`, `maintenance`)를 포함한다.

### 비기능 요구사항
- REQ-008: 실패 분류 로직 추가로 인한 단일 실패 처리 오버헤드는 `classificationLatencyMs<=50`을 만족해야 한다.
- REQ-009: 실패 1건당 추가 진단 출력 길이는 `diagnosticPayloadBytes<=8192`를 만족해야 한다.
- REQ-010: 최근 100건 실패 집계에서 `UNKNOWN` 계열 비율은 `unknownRate<=0.10`을 목표로 하며 초과 시 경고 로그를 남긴다.
- REQ-011: 진단 출력/이메일에는 비밀값(`LOTTO_PASSWORD`, `LOTTO_EMAIL_PASSWORD`)이 평문으로 포함되면 안 된다(`secretLeakCount=0`).

## 제약
- 기존 CLI 종료 계약(`성공=0`, `실패=1`)은 변경하지 않는다.
- `DRY_RUN` 동작(결제 상태 미변경)은 유지해야 하며, 진단 고도화가 구매 분기 로직을 변경하면 안 된다.
- 외부 서비스(동행복권 웹, SMTP) 응답 형식은 통제 불가이므로, 분류는 클라이언트 관측 정보(예외, URL, 셀렉터 상태, 재시도 컨텍스트) 기반으로 결정한다.
- 기존 문서/코드 경계 구조(module/layer/implementation)는 유지하고, 불필요한 경계 분할을 하지 않는다.

## 경계 구조

| 경계 경로 | 경계 유형 | 변경 형태 | 역할 |
|---|---|---|---|
| `.` | 모듈 | 기존 갱신 | 루트 실행/오케스트레이션 계약 |
| `src/shared` | 계층 | 기존 갱신 | 공통 에러 분류/브라우저/설정/이메일 계약 |
| `src/shared/utils` | 구현 | 기존 갱신 | retry 및 분류 기준 핵심 로직 |
| `src/shared/browser/actions` | 구현 | 기존 갱신 | 로그인/구매내역 이동 실패 분류 |
| `src/shared/services` | 구현 | 기존 갱신 | 이메일 실패 결과 구조화 |
| `src/lotto645` | 계층 | 기존 갱신 | 로또 도메인 실패 계약 |
| `src/lotto645/browser/actions` | 구현 | 기존 갱신 | 로또 구매/파싱 실패 상세화 |
| `src/lotto645/commands` | 구현 | 기존 갱신 | CLI 실패 출력 상세화 |
| `src/pension720` | 계층 | 기존 갱신 | 연금복권 도메인 실패 계약 |
| `src/pension720/browser/actions` | 구현 | 기존 갱신 | 연금복권 구매/파싱 실패 상세화 |
| `src/pension720/commands` | 구현 | 기존 갱신 | CLI 실패 출력 상세화 |
| `tests` | 계층 | 기존 갱신 | 실패 진단 검증 시나리오 |
| `tests/utils` | 구현 | 기존 갱신 | 운영 코드와 테스트 진단 매핑 보강 |

## 경계 의존성
- 호출/참조 방향:
  - `src/*/commands` -> `src/*/browser/actions` -> `src/shared/browser/actions` + `src/shared/utils`
  - `src/*/commands` -> `src/shared/services` (실패 이메일 전송)
  - `tests` -> `tests/utils` -> `src/shared`(간접 영향)
- 공통 에러 분류 원천은 `src/shared` 하위에서 정의하고, `lotto645`, `pension720`은 이를 소비/확장한다.
- 외부 의존성:
  - 동행복권 웹(네트워크/DOM/로그인/구매 플로우 실패 원인 발생 지점)
  - SMTP 서버(알림 전송 실패 원인 발생 지점)

## 행동 시나리오
- SCN-001: Given 유효 계정과 정상 네트워크, When `lotto:buy` 또는 `pension:buy`가 완료, Then `processExitCode=0` and `output contains "완료"` and `error.code=null`.
- SCN-002: Given 로그인 자격 증명이 잘못됨, When `login` 실패가 명령 경계로 전파, Then `error.code=AUTH_INVALID_CREDENTIALS` and `error.retryable=false` and `processExitCode=1`.
- SCN-003: Given 구매 페이지 이동 중 타임아웃 발생, When 재시도 후 최종 실패, Then `error.code=NETWORK_NAVIGATION_TIMEOUT` and `retry.attemptCount<=retry.maxRetries+1` and `error.retryable=true`.
- SCN-004: Given 핵심 셀렉터 미노출로 파싱 실패, When 구매내역/당첨번호 파싱 함수가 종료, Then `error.code=DOM_SELECTOR_NOT_VISIBLE` or `error.code=PARSE_FORMAT_INVALID` and `diagnostic.selectorState contains "visible=false"`.
- SCN-005: Given 분류 규칙 미매칭 예외, When fallback 분류가 실행, Then `error.code=UNKNOWN_UNCLASSIFIED` and `classificationReason!=null` and `classificationReason!=""`.
- SCN-006: Given 구매 실패 알림 메일 전송 경로, When 실패 템플릿 생성, Then `email.body contains error.code` and `email.body contains error.category` and `secretLeakCount=0`.

## 오류/수용 기준

### 오류 계약

| 에러 코드 | 분류 | HTTP status | 재시도 가능 여부 | 발생 조건 |
|---|---|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | AUTH | 없음 | false | 로그인 에러 메시지/상태로 인증 실패 확정 |
| `NETWORK_NAVIGATION_TIMEOUT` | NETWORK | 없음 | true | `page.goto`/`waitFor*` 타임아웃 계열 |
| `DOM_SELECTOR_NOT_VISIBLE` | DOM | 없음 | 조건부 | 핵심 셀렉터 대기 실패 |
| `PARSE_FORMAT_INVALID` | PARSE | 없음 | false | 회차/번호 형식 검증 실패 |
| `PURCHASE_VERIFICATION_FAILED` | BUSINESS | 없음 | false | 구매 후 검증 윈도우 내 티켓 미탐지 |
| `EMAIL_SEND_FAILED` | EMAIL | 없음 | false | SMTP 전송/인증 실패 |
| `UNKNOWN_UNCLASSIFIED` | UNKNOWN | 없음 | false | 규칙 미매칭 예외, 사유 필수 기록 |

### 수용 기준
- [ ] 모든 실패 응답/로그/템플릿이 `error.code`, `error.category`, `error.message`, `error.retryable`를 포함한다.
- [ ] 명령 경계 실패 시 기존 `processExitCode=1` 계약을 유지한다.
- [ ] retry 기반 실패는 시도 횟수/최종 에러 요약을 포함한다.
- [ ] `UNKNOWN_UNCLASSIFIED` 발생 시 `classificationReason` 누락이 없다.
- [ ] 테스트 경계에서 `SCN-002`~`SCN-006`에 대한 검증 케이스가 존재한다.

## 추적성 매핑

| REQ-ID | SCN-ID | 예상 테스트명 |
|---|---|---|
| REQ-001 | SCN-002 | `should_emit_structured_error_for_auth_failure` |
| REQ-002 | SCN-003 | `should_include_retry_metadata_on_navigation_timeout` |
| REQ-003 | SCN-002 | `should_print_error_code_and_exit_1_on_command_failure` |
| REQ-004 | SCN-006 | `should_include_error_code_and_category_in_failure_email` |
| REQ-005 | SCN-005 | `should_require_classification_reason_for_unknown_code` |
| REQ-006 | SCN-003 | `should_share_error_taxonomy_between_lotto_and_pension` |
| REQ-007 | SCN-004 | `should_map_selector_diagnostics_to_dom_error_code` |
| REQ-008 | SCN-003 | `should_keep_classification_latency_within_50ms` |
| REQ-009 | SCN-006 | `should_limit_diagnostic_payload_size_to_8kb` |
| REQ-010 | SCN-005 | `should_warn_when_unknown_rate_exceeds_ten_percent` |
| REQ-011 | SCN-006 | `should_not_leak_secrets_in_error_outputs` |

## 오픈 질문
- 없음

## Phase 1.5: PRD 품질 게이트
- `PQG-1` 목적/요구사항 명확성: 통과
  - 근거: 모든 요구사항이 `REQ-ID`로 식별되고 검증 가능한 문장으로 작성됨.
- `PQG-2` 경계 구조/의존성 결정성: 통과
  - 근거: 변경 대상 경계, 경계 유형, 호출 방향, 외부 의존성 명시.
- `PQG-3` 시나리오 실행 가능성: 통과
  - 근거: 모든 SCN이 Given-When-Then + 관측 필드/연산자/기대값 포함.
- `PQG-4` 오류/수용 기준 테스트 환원성: 통과
  - 근거: 에러 코드, 재시도 가능 여부, 발생 조건, 수용 체크리스트 및 테스트명 매핑 제공.
- `PQG-5` 비기능 수치화: 통과
  - 근거: `classificationLatencyMs<=50`, `diagnosticPayloadBytes<=8192`, `unknownRate<=0.10`, `secretLeakCount=0` 명시.
- `PQG-6` 미확정 항목 관리: 통과
  - 근거: `오픈 질문: 없음`.
- 실패 코드: 없음
- Phase 전환 판정: Phase 2 진입 가능(사용자 승인 대기)
- 보강 항목: 없음
