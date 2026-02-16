---
description: PRD 기반으로 경계 문서(CLAUDE.md, IMPLEMENT.md)를 설계·생성하거나 갱신한다 (PRD -> spec)
---

다음 규칙을 먼저 로드하고 준수합니다.

@.opencode/spec-driven-roundtrip-engine/rules/boundary-definition.md
@.opencode/spec-driven-roundtrip-engine/rules/operational-rules.md
@.opencode/spec-driven-roundtrip-engine/rules/document-schema.md
@.opencode/spec-driven-roundtrip-engine/rules/report-template.md

요청 의도가 새 기능 설계, 기존 기능 변경, 경계 문서 작성/갱신, PRD 기반 spec 생성일 때 이 명령을 사용합니다.
코드 구현은 이 명령의 범위가 아니다. spec 생성 후 사용자가 `/srte-compile`로 구현한다.
문서 위치/경계 판정 규칙은 `boundary-definition.md`를 따른다.
문서 버전 규칙은 `document-schema.md`를 따른다.
PRD 품질 게이트와 Phase 전환/회귀 규칙은 `operational-rules.md`를 따른다.

## Phase 1: PRD 작성

1. Plan 모드로 진입한다.
2. 사용자와 협업하며 PRD 파일을 작성한다.
   - 파일 위치: 프로젝트 루트의 `prd/prd-{기능명}.md`
   - `prd/` 디렉토리가 없으면 먼저 생성한다.
   - 기능명은 사용자에게 확인하거나 요구사항에서 도출한다.
3. PRD에 다음을 포함한다:
    - **목적**: 무엇을 만드는가, 왜 필요한가.
    - **요구사항**: 기능 요구사항, 비기능 요구사항.
    - **제약**: 기술적 제약, 외부 의존성, 호환성.
    - **경계 구조**: 필요한 경계를 사용자와 협의하며 정의한다. 경계 유형(모듈/계층/구현)과 중첩 관계를 포함한다.
    - **경계 의존성**: 경계 간 호출/참조 관계와 외부 서비스 의존성을 포함한다.
    - **행동 시나리오**: Given-When-Then 형식의 정상/예외 시나리오.
    - **오류/수용 기준**: 에러 코드/상태/재시도 정책과 완료 조건 체크리스트.
    - **추적성 매핑**: `REQ-ID -> SCN-ID -> 예상 테스트명` 표를 포함한다.

## Phase 1.5: PRD 품질 게이트

1. `operational-rules.md`의 `PQG-1`~`PQG-6`을 PRD에 적용한다.
2. 각 PQG를 `통과|실패`로 판정하고 실패 사유와 최소 보강안을 기록한다.
3. 전환 조건을 점검한다.
   - `사용자 승인 AND PQG-1~PQG-6 전부 통과`이면 Phase 2로 진행한다.
   - 위 조건을 만족하지 못하면 `Phase 1`에 머물며 PRD를 보강한다.
4. `오픈 질문`이 있으면 각 항목에 `확인 불가 사유`/`확인 경로`/`해소 조건`을 반드시 포함한다.

## Phase 2: Spec 생성/갱신 (PQG 통과 후)

1. PRD의 경계 구조에 따라 각 경계의 상태를 확인한다.
   - **신규 경계**: 경계 판정 알고리즘을 만족하면 디렉토리를 생성한다.
   - **기존 경계**: 기존 `CLAUDE.md`와 `IMPLEMENT.md`를 읽는다.
   - **비경계/제외 경로**: 문서 생성 대상에서 제외하고 보고서에 이유를 기록한다.
2. 각 경계에 `CLAUDE.md`를 생성 또는 갱신한다 (`document-schema.md` 준수).
3. 각 경계에 `IMPLEMENT.md`를 생성 또는 갱신한다 (`document-schema.md` 준수).
4. 각 `CLAUDE.md`에 계약 필수 섹션(범위/인터페이스/시나리오/오류/불변식/비기능/의존성 계약/수용 기준)을 채운다.
5. 각 `IMPLEMENT.md`에 구현 필수 섹션(모듈 분해/호출 흐름/핵심 알고리즘/데이터 모델/외부 연동 정책/설정/예외 처리/관측성/테스트 설계)을 채운다.
6. 경계별로 두 문서가 모두 존재하는지 확인한다. 하나라도 누락되면 완료로 간주하지 않는다.
7. 기존 문서 갱신 시 PRD의 변경 범위만 반영하고, 기존 내용을 불필요하게 삭제하지 않는다.
8. 검증: 생성/갱신한 문서가 `document-schema.md` 필수 섹션을 갖추는지 확인한다. 불일치 시 보고서에 기록한다.
9. 검증: 생성/갱신한 문서의 `Schema-Version`이 최신인지(`.opencode/spec-driven-roundtrip-engine/rules/schema-versions/CURRENT.md` 기준) 확인한다. 누락/구버전은 보고서에 기록한다.
10. PRD/요구사항에서 확정되지 않은 항목은 경계별 `오픈 질문`으로 기록한다.
    - 각 항목에 `확인 불가 사유`, `확인 경로`, `해소 조건`을 함께 기록한다.
11. 하류 검증 결과와 PRD 추적성을 연결한다.
    - verify/compile 실패 항목이 `QG-1~QG-4`이고 PRD의 대응 `REQ-ID`/`SCN-ID`가 모호하면 `UPSTREAM-PRD-DRIFT`로 표기한다.

## Phase 3: 정리

1. 생성된 경계와 문서 목록, 경계별 `오픈 질문`(없으면 "없음")을 보고한다.
   - `오픈 질문`이 있으면 각 항목의 사유/경로/해소 조건을 함께 보고한다.
2. 사용자에게 PRD 파일(`prd/prd-{기능명}.md`) 삭제 여부를 확인한다.
3. 사용자 응답에 따라 삭제하거나 보존한다.
4. 코드 구현이 필요하면 `/srte-compile`을 안내한다.

## 피드백 루프

- verify/compile에서 `UPSTREAM-PRD-DRIFT`가 발생하면 `Phase 1`로 복귀한다.
- 복귀 시 PRD의 해당 `REQ-ID`/`SCN-ID`를 먼저 보강하고 `Phase 1.5` 게이트를 재수행한다.

Phase 간 전환:
- 각 Phase 완료 시 사용자에게 다음 Phase 진행을 확인한다.
- 사용자가 이전 Phase로 돌아가길 원하면 해당 Phase부터 재개한다.
- `Phase 1 -> Phase 2`는 사용자 확인 외에 `PQG-1~PQG-6` 통과가 필수다.
