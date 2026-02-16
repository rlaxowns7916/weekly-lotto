# PRD: Playwright 실패 스크린샷 OCR 사유 추출

## 목적
- 현재 Playwright 자동화 실패 시 스크린샷은 저장되지만, 실패 원인 텍스트를 기계적으로 추출하지 않아 운영자가 수동 확인해야 한다.
- 본 기능은 실패 스크린샷에서 OCR로 텍스트를 추출하고, 기존 구조화 에러 분류(`error.code`, `error.category`)와 결합해 원인 진단 시간을 단축하는 것을 목표로 한다.

## 요구사항

### 기능 요구사항
- REQ-001: 실패 경로에서 저장된 스크린샷(`screenshots/*.png`)을 입력으로 OCR 추출 파이프라인을 실행한다.
- REQ-002: OCR 결과는 최소 `ocr.status`, `ocr.text`, `ocr.confidence`, `ocr.lang` 필드를 포함해 구조화한다.
- REQ-003: OCR 텍스트 기반 힌트 매핑을 수행해 `error.code` 보정 또는 `ocr.hintCode`를 생성한다.
- REQ-004: OCR 실패는 주 실패 원인을 덮어쓰지 않고, `ocr.status=FAILED`와 `ocr.failureReason`으로 별도 기록한다.
- REQ-005: 명령 경계(`lotto:*`, `pension:*`) 실패 출력은 기존 `processExitCode=1` 계약을 유지하면서 OCR 요약(`ocr.status`, `ocr.hintCode`)을 함께 출력한다.
- REQ-006: 실패 알림 이메일(구매 실패 경로)은 기존 에러 요약을 유지하고 OCR 텍스트 요약(최대 N자)을 추가한다.
- REQ-007: 테스트 유틸 진단(`tests/utils/failure-diagnostics.ts`)과 OCR 결과를 연계할 수 있도록 공통 매핑 키(`mappedErrorCode`, `ocr.hintCode`)를 유지한다.
- REQ-013: 실패 시점의 DOM HTML 스냅샷을 캡처해 저장한다(`html.status`, `html.path`, `html.captureTs`, `html.url`).
- REQ-014: HTML 캡처 실패는 주 실패 원인을 덮어쓰지 않고 `html.status=FAILED`와 `html.failureReason`으로 별도 기록한다.
- REQ-016: iframe이 존재하는 페이지는 프레임별 HTML(`html.frames[]`)을 함께 캡처하며, 각 항목에 `frameName`, `frameUrl`, `path`를 포함한다.
- REQ-017: 실패 알림 이메일은 스크린샷 파일과 HTML 스냅샷 파일(메인+프레임)을 첨부한다.

### 비기능 요구사항
- REQ-008: 단일 스크린샷 OCR 처리 시간은 `ocrLatencyMs<=2000`(로컬 CPU 기준)이어야 한다.
- REQ-009: OCR 처리 타임아웃은 `ocrTimeoutMs<=5000`을 적용해야 한다.
- REQ-010: 명령 실패 로그/이메일에 포함되는 OCR 텍스트 페이로드는 `ocrPayloadBytes<=12288`를 만족해야 한다.
- REQ-011: OCR 결과 출력/알림에서 비밀값(계정/SMTP/토큰)은 마스킹되며 `secretLeakCount=0`이어야 한다.
- REQ-012: CI 환경에서 외부 OCR API 의존 없이 동작 가능한 기본 경로를 제공해야 한다(`cloudDependencyRequired=false`).
- REQ-015: 단일 실패 이벤트의 HTML 스냅샷 페이로드는 `htmlPayloadBytes<=262144`를 만족해야 한다.
- REQ-018: 실패 이메일 첨부 총 용량은 `emailAttachmentBytes<=10485760`(10MB) 이하여야 하며, 초과 시 압축/요약 첨부 정책을 적용한다.

## 제약
- 코드 구현은 본 단계 범위가 아니며, 문서/spec 생성까지만 수행한다(구현은 `/srte-compile`).
- 기존 실패 종료 계약(`성공=0`, `실패=1`)과 `DRY_RUN` 동작은 변경하지 않는다.
- OCR 추가로 기존 핵심 실패 분류(`AUTH_INVALID_CREDENTIALS`, `NETWORK_NAVIGATION_TIMEOUT`, `DOM_SELECTOR_NOT_VISIBLE`, `PURCHASE_VERIFICATION_FAILED`)가 손상되면 안 된다.
- 기본 전략은 로컬 OCR 엔진(오프라인 가능)이며, 클라우드 OCR은 선택적 확장으로 취급한다.
- 스크린샷 원본 저장 경로/아티팩트 정책(`screenshots/`, Playwright `test-results/`)과 충돌하지 않아야 한다.
- HTML 스냅샷은 별도 경로(`artifacts/html-failures/` 등)에 저장하고, 민감 필드(`password`, `token`, `authorization`)는 마스킹 정책을 적용해야 한다.
- 첨부 파일이 누락되더라도 메일 전송 자체 실패로 간주하지 않고, `attachment.status=PARTIAL`로 기록한다.

## 경계 구조

| 경계 경로 | 경계 유형 | 변경 형태 | 역할 |
|---|---|---|---|
| `.` | 모듈 | 기존 갱신 | 루트 실행 계약 및 운영 기준 유지 |
| `src/shared` | 계층 | 기존 갱신 | 공통 오류 진단 계약 확장 |
| `src/shared/browser` | 구현 | 기존 갱신 | 스크린샷 저장 결과를 OCR 입력으로 연결 |
| `src/shared/utils` | 구현 | 기존 갱신 | OCR 힌트-에러코드 매핑/정규화 |
| `src/shared/ocr` | 구현 | 신규 생성 | OCR 추출/타임아웃/결과 정규화 전담 |
| `src/lotto645/commands` | 구현 | 기존 갱신 | OCR 진단 출력/실패 이메일 반영 |
| `src/pension720/commands` | 구현 | 기존 갱신 | OCR 진단 출력/실패 이메일 반영 |
| `tests` | 계층 | 기존 갱신 | OCR 연계 실패 시나리오 검증 |
| `tests/utils` | 구현 | 기존 갱신 | diagnostics + OCR 힌트 매핑 검증 |

## 경계 의존성
- 호출/참조 방향:
  - `src/*/commands` -> `src/shared/browser` -> `src/shared/ocr` -> `src/shared/utils`
  - `src/*/commands` -> `src/*/services/email.templates` (OCR 요약 포함)
  - `tests` -> `tests/utils` -> `src/shared/ocr`/`src/shared/utils` (간접 검증)
- 외부 의존성:
  - Playwright screenshot 산출물(PNG)
  - 로컬 OCR 엔진(기본) 1종
  - (선택) 클라우드 OCR API는 확장 경로

## 행동 시나리오
- SCN-001: Given 실패 스크린샷에 판독 가능한 한글/영문 텍스트가 존재, When OCR 파이프라인이 실행, Then `ocr.status=SUCCESS` and `ocr.text!=""` and `ocr.confidence>=0.50`.
- SCN-002: Given OCR 텍스트에 점검/차단 키워드가 포함, When 힌트 매핑 수행, Then `ocr.hintCode=DOM_SELECTOR_NOT_VISIBLE` or `ocr.hintCode=NETWORK_NAVIGATION_TIMEOUT` and `error.code!=null`.
- SCN-003: Given OCR 엔진 실행 실패 또는 타임아웃, When 명령 경계가 실패 처리, Then `ocr.status=FAILED` and `ocr.failureReason!=null` and `processExitCode=1`.
- SCN-004: Given 기존 구조화 오류가 이미 존재, When OCR 결과 병합, Then `primaryError.code`는 유지되고 `ocr` 필드만 부가된다(`primaryError.code` overwrite 금지).
- SCN-005: Given 구매 실패 이메일 전송 경로, When 템플릿 렌더링, Then `email.body contains ocr.status` and `email.body contains ocr.hintCode` and `secretLeakCount=0`.
- SCN-006: Given CI 환경에서 실패 1건 처리, When OCR 실행, Then `cloudDependencyRequired=false` and `ocrLatencyMs<=2000` and `ocrPayloadBytes<=12288`.
- SCN-007: Given 실패 시점 페이지 컨텍스트가 유효, When HTML 스냅샷 캡처 실행, Then `html.status=SUCCESS` and `html.path contains "artifacts/html-failures"` and `html.url startsWith "http"`.
- SCN-008: Given 페이지 종료/컨텍스트 손실로 HTML 캡처 불가, When 실패 후처리 실행, Then `html.status=FAILED` and `html.failureReason!=null` and `primaryError.code!=null`.
- SCN-009: Given 실패 페이지에 iframe 2개가 존재, When HTML 캡처 실행, Then `html.frames.length>=2` and `html.frames[*].path!=null` and `html.frames[*].frameUrl startsWith "http"`.
- SCN-010: Given 실패 이메일 전송 경로, When 첨부 구성, Then `email.attachments contains screenshot` and `email.attachments contains html.main` and `email.attachments contains html.frames[*]`.
- SCN-011: Given 첨부 총 용량이 10MB 초과, When 메일 생성, Then `attachment.status=PARTIAL` and `emailAttachmentBytes<=10485760` and `processExitCode=1`.

## 오류/수용 기준

### 오류 계약

| 에러 코드 | 분류 | HTTP status | 재시도 가능 여부 | 발생 조건 |
|---|---|---|---|---|
| `OCR_ENGINE_UNAVAILABLE` | OCR | 없음 | false | OCR 엔진 초기화 실패/바이너리 불가 |
| `OCR_TIMEOUT` | OCR | 없음 | true | OCR 처리 시간이 `ocrTimeoutMs` 초과 |
| `OCR_TEXT_NOT_FOUND` | OCR | 없음 | false | OCR 실행은 성공했으나 유효 텍스트 미검출 |
| `OCR_EXTRACTION_FAILED` | OCR | 없음 | false | OCR 처리 중 내부 예외 발생 |
| `UNKNOWN_UNCLASSIFIED` | UNKNOWN | 없음 | false | OCR/기존 규칙 모두 매핑 실패 |

### 수용 기준
- [ ] 실패 경로에서 OCR 결과 구조(`ocr.status`, `ocr.text`, `ocr.confidence`, `ocr.lang`)가 생성된다.
- [ ] OCR 실패가 주 실패 원인 코드를 덮어쓰지 않는다.
- [ ] 명령 실패 로그에 `error.code/error.category`와 `ocr.status/ocr.hintCode`가 함께 노출된다.
- [ ] 실패 이메일에 OCR 요약이 포함되고 비밀 마스킹 정책을 위반하지 않는다.
- [ ] 실패 이벤트에서 HTML 스냅샷 저장 또는 실패 사유(`html.failureReason`)가 반드시 기록된다.
- [ ] 프레임이 있는 페이지에서 프레임별 HTML 스냅샷이 기록된다.
- [ ] 실패 메일에 스크린샷 + HTML(메인/프레임) 첨부가 포함되거나, 용량 초과 시 부분 첨부 상태가 기록된다.
- [ ] `SCN-001`~`SCN-011`에 대응하는 테스트 이름이 1:1로 정의된다.

## 추적성 매핑

| REQ-ID | SCN-ID | 예상 테스트명 |
|---|---|---|
| REQ-001 | SCN-001 | `should_extract_text_from_failure_screenshot` |
| REQ-002 | SCN-001 | `should_emit_structured_ocr_result_fields` |
| REQ-003 | SCN-002 | `should_map_ocr_keywords_to_hint_code` |
| REQ-004 | SCN-004 | `should_not_override_primary_error_code_when_ocr_attached` |
| REQ-005 | SCN-003 | `should_print_ocr_status_in_command_failure_output` |
| REQ-006 | SCN-005 | `should_include_ocr_summary_in_failure_email` |
| REQ-007 | SCN-002 | `should_align_diagnostics_mapped_error_code_with_ocr_hint_code` |
| REQ-008 | SCN-006 | `should_keep_ocr_latency_under_2s` |
| REQ-009 | SCN-003 | `should_timeout_ocr_within_5s` |
| REQ-010 | SCN-006 | `should_limit_ocr_payload_size_to_12kb` |
| REQ-011 | SCN-005 | `should_mask_secrets_in_ocr_outputs` |
| REQ-012 | SCN-006 | `should_run_ocr_without_cloud_dependency_in_ci` |
| REQ-013 | SCN-007 | `should_capture_html_snapshot_on_failure` |
| REQ-014 | SCN-008 | `should_not_override_primary_error_when_html_capture_fails` |
| REQ-015 | SCN-007 | `should_limit_html_snapshot_payload_to_256kb` |
| REQ-016 | SCN-009 | `should_capture_html_for_each_frame_on_failure` |
| REQ-017 | SCN-010 | `should_attach_screenshot_and_html_files_to_failure_email` |
| REQ-018 | SCN-011 | `should_apply_partial_attachment_policy_when_email_size_exceeds_10mb` |

## 오픈 질문
- 내용: 기본 OCR 언어 세트를 `kor+eng`로 고정할지, 실행 환경별 가변으로 둘지 결정 필요.
  - 확인 불가 사유: 운영 실패 이미지의 실제 언어 분포 통계가 현재 저장소에 없다.
  - 확인 경로: 최근 4주 실패 스크린샷 샘플(artifact) 기반 언어 빈도 분석.
  - 해소 조건: 샘플 100건 기준 `kor-only`/`kor+eng` 정확도 비교 결과가 문서화되면 확정.
- 내용: 클라우드 OCR fallback(예: Vision/Textract) 허용 여부 정책 확인 필요.
  - 확인 불가 사유: 현재 보안/비용 정책 문서에서 실패 스크린샷 외부 전송 허용 여부가 명시되지 않았다.
  - 확인 경로: 운영 정책 문서 + 저장소 관리자 의사결정 기록 확인.
  - 해소 조건: 외부 전송 허용/불가가 정책으로 확정되고, 허용 시 비용 한도(`monthlyOcrBudget`)가 정의되면 종료.

## Phase 1.5: PRD 품질 게이트
- `PQG-1` 목적/요구사항 명확성: 통과
  - 근거: 모든 요구사항이 `REQ-ID`로 식별되며 검증 가능한 필드/조건을 포함한다.
- `PQG-2` 경계 구조/의존성 결정성: 통과
  - 근거: 변경 경계 목록, 경계 유형, 호출 방향, 외부 의존 대상을 명시했다.
- `PQG-3` 시나리오 실행 가능성: 통과
  - 근거: 모든 `SCN`이 Given-When-Then과 관측 가능한 단정값(`=`, `!=`, `<=`, `>=`)을 포함한다.
- `PQG-4` 오류/수용 기준 테스트 환원성: 통과
  - 근거: 오류 코드/재시도/발생 조건 및 수용 기준 체크리스트, 테스트명 1:1 매핑을 제시했다.
- `PQG-5` 비기능 수치화: 통과
  - 근거: `ocrLatencyMs<=2000`, `ocrTimeoutMs<=5000`, `ocrPayloadBytes<=12288`, `secretLeakCount=0`를 명시했다.
- `PQG-6` 미확정 항목 관리: 통과
  - 근거: 오픈 질문 각 항목에 `확인 불가 사유/확인 경로/해소 조건`을 포함했다.
- 실패 코드: 없음
- Phase 전환 판정: Phase 2 진입 가능(사용자 승인 대기)
- 보강 항목: 없음
