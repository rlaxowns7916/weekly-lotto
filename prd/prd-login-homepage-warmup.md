# PRD: 로그인 전 홈페이지 선접속(warm-up) 흐름

## 목적
- 동행복권 사이트에서 로그인 페이지(`https://www.dhlottery.co.kr/login`)로 직접 진입할 때 쿠키/세션/탐지 우회 초기화가 충분히 되지 않아 로그인 실패율이 증가할 가능성이 있다.
- 모든 실행 플로우에서 로그인 전에 루트 홈페이지(`https://www.dhlottery.co.kr/`)를 먼저 방문한 뒤 로그인 페이지로 이동하도록 표준화해 로그인 안정성을 높인다.

## 요구사항

### 기능 요구사항
- REQ-001: 공통 로그인 액션은 자격증명 입력 전에 `https://www.dhlottery.co.kr/`를 먼저 방문해야 한다.
- REQ-002: 홈페이지 선접속 이후 동일 세션/컨텍스트에서 로그인 페이지 URL(`https://www.dhlottery.co.kr/login`)로 이동해야 한다.
- REQ-003: 로또/연금복권의 모든 명령 경계(`lotto:*`, `pension:*`)는 변경된 공통 로그인 순서를 그대로 따라야 한다.
- REQ-004: 로그인 성공/실패 판정 기준(로그아웃 버튼, 오류 메시지, URL 판정)은 기존 계약을 유지해야 한다.
- REQ-005: 자격증명 누락/오입력 오류 분류(`AUTH_INVALID_CREDENTIALS`)와 네트워크 타임아웃 분류(`NETWORK_NAVIGATION_TIMEOUT`)는 기존 taxonomy를 유지해야 한다.
- REQ-006: 로그인 E2E 시나리오는 선접속 흐름을 반영해 `홈페이지 -> 로그인 페이지 -> 제출` 순서를 검증 가능해야 한다.
- REQ-007: 문서 계약(루트/shared/shared/browser/actions/tests)은 로그인 순서 규칙을 Given-When-Then으로 명시해야 한다.

### 비기능 요구사항
- REQ-008: 선접속 추가로 인한 로그인 준비 지연은 `warmupNavigationLatencyMs<=10000`을 만족해야 한다.
- REQ-009: 각 네비게이션의 최대 대기 제한은 기존 정책을 유지해 `homepageGotoTimeoutMs<=60000` and `loginGotoTimeoutMs<=60000`을 만족해야 한다.
- REQ-010: 실패 로그/문서/테스트 산출물에 계정/비밀번호 평문이 노출되지 않아야 한다(`secretLeakCount=0`).
- REQ-011: 변경 후에도 기존 종료 계약(`성공=0`, `실패=1`)과 재시도 프레임은 유지되어야 한다.

## 제약
- 본 단계는 spec/문서 생성 범위이며 코드 구현은 수행하지 않는다(구현은 `/srte-compile` 단계).
- 기존 에러 코드 체계를 유지하며 불필요한 신규 코드 도입을 금지한다.
- 명령 경계에서 개별 로그인 구현을 추가하지 않고 공통 로그인 경계에서 일괄 적용한다.
- 외부 사이트 정책(쿠키, 봇 탐지, 리다이렉트)은 통제 불가이며, 관측 가능한 브라우저 이벤트 기준으로만 계약을 정의한다.

## 경계 구조

| 경계 경로 | 경계 유형 | 변경 형태 | 역할 |
|---|---|---|---|
| `.` | 모듈 | 기존 갱신 | 루트 실행 순서 계약(로그인 선행 규칙) 유지/보강 |
| `src/shared` | 계층 | 기존 갱신 | 공통 로그인 계약/오류 계약 상위 정의 |
| `src/shared/browser` | 계층 | 기존 갱신 | 로그인 셀렉터/브라우저 공통 정책 문서 반영 |
| `src/shared/browser/actions` | 구현 | 기존 갱신 | 홈페이지 선접속 후 로그인 URL 이동 규칙의 핵심 구현 경계 |
| `tests` | 계층 | 기존 갱신 | 로그인 E2E 계약 및 시나리오 문서 동기화 |

## 경계 의존성
- 호출/참조 방향:
  - `src/*/commands` -> `src/shared/browser/actions/login.ts`
  - `src/shared/browser/actions` -> `src/shared/browser/selectors.ts` + `src/shared/config` + `src/shared/utils/retry.ts`
  - `tests/login.spec.ts` -> 로그인 URL/로그인 판정 셀렉터 규칙
- 외부 의존성:
  - 동행복권 웹 루트: `https://www.dhlottery.co.kr/`
  - 동행복권 로그인: `https://www.dhlottery.co.kr/login`

## 행동 시나리오
- SCN-001: Given 유효 계정과 정상 네트워크, When 공통 로그인 액션이 실행, Then `visitedUrls[0]="https://www.dhlottery.co.kr/"` and `visitedUrls[1] contains "/login"` and `loginSuccess=true`.
- SCN-002: Given 홈페이지 선접속은 성공했으나 로그인 자격증명이 유효하지 않음, When 로그인 제출 후 판정, Then `error.code=AUTH_INVALID_CREDENTIALS` and `retryable=false`.
- SCN-003: Given 홈페이지 또는 로그인 페이지 네비게이션이 시간 제한 초과, When 재시도 종료, Then `error.code=NETWORK_NAVIGATION_TIMEOUT` and `retryable=true` and `attemptCount<=maxRetries+1`.
- SCN-004: Given 로또/연금복권 임의 명령 실행, When 로그인 단계가 수행됨, Then `sharedLoginFlowUsed=true` and `preWarmupVisited=true`.
- SCN-005: Given 로그인 E2E 테스트 실행, When beforeEach 로그인 준비 단계 수행, Then `homepageVisited=true` and `loginPageReady=true`.

## 오류/수용 기준

### 오류 계약

| 에러 코드 | 분류 | HTTP status | 재시도 가능 여부 | 발생 조건 |
|---|---|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | AUTH | 없음 | false | 계정 누락 또는 로그인 실패 메시지로 자격증명 오류 확정 |
| `NETWORK_NAVIGATION_TIMEOUT` | NETWORK | 없음 | true | 홈페이지/로그인 페이지 이동 또는 대기 타임아웃 |
| `UNKNOWN_UNCLASSIFIED` | UNKNOWN | 없음 | false | 규칙 매핑 불가 예외 |

### 수용 기준
- [ ] 공통 로그인 계약에 `홈페이지 선접속 -> 로그인 페이지 이동` 순서가 명시된다.
- [ ] 루트/shared/tests 경계 문서가 로그인 순서 변경과 모순되지 않는다.
- [ ] 기존 로그인 성공/실패 판정 및 에러 코드 계약이 유지된다.
- [ ] 로그인 테스트 시나리오가 변경된 순서를 검증 가능하도록 매핑된다.
- [ ] 비기능 수치(`warmupNavigationLatencyMs`, timeout 제한, `secretLeakCount`)가 문서에 명시된다.

## 추적성 매핑

| REQ-ID | SCN-ID | 예상 테스트명 |
|---|---|---|
| REQ-001 | SCN-001 | `should_visit_homepage_before_login_page_in_shared_login_flow` |
| REQ-002 | SCN-001 | `should_navigate_to_login_page_after_homepage_warmup` |
| REQ-003 | SCN-004 | `should_apply_warmup_login_flow_to_all_lotto_and_pension_commands` |
| REQ-004 | SCN-002 | `should_preserve_login_success_failure_judgement_after_warmup` |
| REQ-005 | SCN-002 | `should_keep_auth_invalid_credentials_error_contract` |
| REQ-006 | SCN-005 | `should_prepare_login_e2e_with_homepage_then_login_page_sequence` |
| REQ-007 | SCN-004 | `should_sync_boundary_docs_for_warmup_login_contract` |
| REQ-008 | SCN-001 | `should_keep_warmup_navigation_latency_under_10s` |
| REQ-009 | SCN-003 | `should_keep_home_and_login_navigation_timeout_within_60s` |
| REQ-010 | SCN-005 | `should_not_expose_plain_credentials_in_logs_or_artifacts` |
| REQ-011 | SCN-004 | `should_preserve_process_exit_contract_after_login_flow_change` |

## 오픈 질문
- 내용: 홈페이지 선접속 직후 사이트가 국가/모바일 분기 리다이렉트를 수행할 때, 로그인 페이지 이동 전에 추가 대기 상태(`domcontentloaded` vs `networkidle`)를 고정해야 하는지 확정 필요.
  - 확인 불가 사유: 저장소에는 운영 시간대별 리다이렉트 편차 데이터가 없다.
  - 확인 경로: CI/로컬 실행 로그에서 `homepage->login` 전환 구간의 URL 전이/대기시간 샘플 수집.
  - 해소 조건: 샘플 50건에서 실패 유형별 재현률을 비교해 고정 대기 정책이 확정되면 종료.

## Phase 1.5: PRD 품질 게이트
- `PQG-1` 목적/요구사항 명확성: 통과
  - 근거: 요구사항이 `REQ-ID`로 식별되고 관측 필드/기대 결과를 포함한다.
- `PQG-2` 경계 구조/의존성 결정성: 통과
  - 근거: 경계 목록, 경계 유형, 호출 방향, 외부 URL 의존성이 명시되어 있다.
- `PQG-3` 시나리오 실행 가능성: 통과
  - 근거: 모든 SCN이 Given-When-Then과 단정값(`=`, `contains`, `<=`)을 포함한다.
- `PQG-4` 오류/수용 기준 테스트 환원성: 통과
  - 근거: 오류 코드/재시도/발생 조건과 체크리스트 및 테스트명 매핑이 존재한다.
- `PQG-5` 비기능 수치화: 통과
  - 근거: `warmupNavigationLatencyMs<=10000`, `*GotoTimeoutMs<=60000`, `secretLeakCount=0` 수치가 명시되어 있다.
- `PQG-6` 미확정 항목 관리: 통과
  - 근거: 오픈 질문 항목에 `확인 불가 사유/확인 경로/해소 조건`이 포함된다.
- 실패 코드: 없음
- Phase 전환 판정: Phase 2 진입 가능(사용자 승인 대기)
- 보강 항목: 없음
