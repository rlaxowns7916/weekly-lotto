---
description: 경계 문서를 기준으로 코드를 구현/작성/갱신한다 (문서 -> 코드)
---

다음 규칙을 먼저 로드하고 준수합니다.

@.opencode/spec-driven-roundtrip-engine/rules/boundary-definition.md
@.opencode/spec-driven-roundtrip-engine/rules/operational-rules.md
@.opencode/spec-driven-roundtrip-engine/rules/document-schema.md
@.opencode/spec-driven-roundtrip-engine/rules/drift-detection.md
@.opencode/spec-driven-roundtrip-engine/rules/report-template.md
@.opencode/spec-driven-roundtrip-engine/rules/tdd-methodology.md

요청 의도가 구현/작성/개발(코드 변경)일 때 이 명령을 사용합니다.
문서 위치/경계 판정 규칙은 `boundary-definition.md`를 따른다.
문서 버전 규칙은 `document-schema.md`를 따른다.

대상 선택:
- 대상 선택 우선순위와 공통 규칙은 `operational-rules.md`를 따른다.
- 인자 없음에서는 변경 파일 기반 경계만 대상으로 한다 (`operational-rules.md` 기준).

경계 매핑:
- 변경 파일 기반 경계 매핑 규칙은 `operational-rules.md`를 따른다.

대상 0개 처리:
- 변경된 경계가 없으면 작업을 수행하지 않는다.
- 다음을 안내한다: "변경된 경계가 없습니다. 제외 디렉토리 변경만 있었는지 확인하거나, 특정 경계를 지정하거나 `--all`을 사용하세요."

경계 상태별 처리:
- 문서화 완전 (CLAUDE.md + IMPLEMENT.md): 정상 진행.
- 문서화 불완전 (CLAUDE.md만 존재): compile 불가. "먼저 `/srte-decompile`로 IMPLEMENT.md를 생성해 문서화 완전 상태로 맞추세요."를 안내.
- 미문서화 (CLAUDE.md 없음): compile 불가. "먼저 `/srte-decompile`로 경계 문서를 생성해 문서화 완전 상태로 맞추세요."를 안내.
- 문서 버전 불일치 (`Schema-Version` 누락/구버전): compile 불가. "먼저 `/srte-decompile`로 문서를 최신 스키마 버전(`.opencode/spec-driven-roundtrip-engine/rules/schema-versions/CURRENT.md` 기준)으로 마이그레이션하세요."를 안내.
- 계약 품질 게이트 미충족(시나리오/인터페이스/오류/제약/구현 추적성/확인 불가 관리/가정 안전성 부족): compile 불가. "먼저 CLAUDE.md/IMPLEMENT.md를 스키마 필수 계약 섹션으로 보강하세요."를 안내.

대량 대상 실행 권장:
- 대상 경계가 많고(예: 10개 초과) 계약 품질 게이트 실패가 발생하면, 경계를 3-5개 배치로 나눠 진행한다.
- 우선순위는 "문서가 이미 구체적인 경계" -> "변경과 직접 연관된 경계" 순으로 잡는다.
- 각 배치 종료 시 실패 경계의 보강 항목을 문서에 반영한 뒤 다음 배치로 넘어간다.

부분 실패 처리:
- 대상 경계가 여러 개일 때, 일부 경계에서 실패하더라도 나머지 경계는 계속 진행한다.
- 실패한 경계는 보고서에 실패 사유와 함께 기록한다.

작업 절차:
1. 대상 경계를 식별하고 상태를 확인합니다.
2. 각 경계의 `CLAUDE.md`와 `IMPLEMENT.md`를 읽습니다 (존재하는 것만).
3. 각 경계 문서의 `Schema-Version`이 최신인지 확인한다 (`.opencode/spec-driven-roundtrip-engine/rules/schema-versions/CURRENT.md` 기준).
4. `operational-rules.md`의 문서 품질 게이트를 점검한다. 불충족 시 compile을 중단하고 보강 항목을 보고한다.
   - 실패 항목을 아래 형식으로 경계별로 기록한다 (`operational-rules.md`의 `QG-1`~`QG-7` 코드 포함).
     - `SCN-xxx`: 누락된 관측값(필드/연산자/기대값)
     - 인터페이스 계약: 누락된 타입/필수성/유효성 규칙
     - 오류 계약: 누락된 코드/status/retry/발생 조건
     - 제약/비기능: 누락된 수치/결정형 규칙
     - 구현 추적성(`QG-5`): 결정성 강화 트리거 `ON`인데 `시나리오 추적성`/`파일 계약`/`변경 규칙` 섹션 누락, 또는 칼럼 누락
     - 확인 불가 관리(`QG-6`): `확인 불가/오픈 질문`의 사유/경로/해소 조건 누락
     - 가정 안전성(`QG-7`): `BLOCKING` 가정 존재 또는 `NON-BLOCKING` 가정 3개 이상
   - 각 실패 항목에 대해 "문서 보강 예시 1개"를 함께 제시한다.
5. `CLAUDE.md`의 행동 시나리오/오류 계약/수용 기준에서 필요한 테스트 케이스를 도출하고, 기존 테스트와 비교하여 누락 케이스를 식별한다.
6. `IMPLEMENT.md`에 `시나리오 추적성` 섹션이 있으면 해당 매핑(`SCN -> 구현 파일#심볼 -> 테스트명`)을 우선 사용한다.
   - `시나리오 추적성`이 존재하는데 CLAUDE.md의 일부 `SCN`가 누락되면 `QG-5`로 중단한다.
7. 각 시나리오에 대해 테스트 이름을 1:1로 매핑한다 (예: `SCN-001 -> shouldApprovePaymentWhenCommandIsValid`).
8. 레거시 경계에서 기존 테스트가 0개이면 초기 진입 전략을 적용한다:
   - 변경 범위 동작 우선으로 테스트를 작성한다.
   - 변경과 직접 연관된 핵심 동작에 최소 1개의 회귀 테스트를 추가한다.
   - 수용 기준의 체크 항목마다 최소 1개 테스트를 연결한다.
   - 경계 전체 동작을 한 번에 테스트 대상으로 확장하지 않는다 (요청/리스크 근거가 있을 때만 확장).
9. 누락된 테스트 케이스에 대해 TDD 사이클(`tdd-methodology.md` 준수)로 구현한다:
    - 실패하는 테스트를 작성한다 (Red).
    - 테스트를 통과하는 최소한의 코드를 구현한다 (Green).
    - 구조를 개선한다 (Refactor).
    - 모든 누락 케이스가 완료될 때까지 반복한다.
10. `IMPLEMENT.md`에 `변경 규칙` 섹션이 있으면 MUST/MUST NOT/함께 수정할 테스트 목록을 우선 적용한다.
11. 가정 안전성을 점검한다 (`operational-rules.md`의 `QG-7` 기준).
    - 가정은 `BLOCKING`/`NON-BLOCKING`으로 분류한다.
    - `BLOCKING` 가정이 1개 이상이거나 `NON-BLOCKING` 가정이 3개 이상이면 중단하고 보강한다.
12. 검증: 생성/수정한 코드와 경계 문서 간 드리프트를 점검한다 (`drift-detection.md` 기준). 드리프트 발견 시 보고서에 기록한다.
13. 경계별 결과(구조/행동 변경 파일, 시나리오-테스트 매핑, 의존성 영향, 가정, `오픈 질문`, 드리프트)를 보고합니다. `오픈 질문`이 없으면 "없음"으로 명시합니다.
