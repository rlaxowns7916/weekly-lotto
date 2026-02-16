---
description: 현재 구현을 기준으로 경계 문서(CLAUDE.md, IMPLEMENT.md)를 생성/갱신한다 (코드 -> 문서)
---

다음 규칙을 먼저 로드하고 준수합니다.

@.opencode/spec-driven-roundtrip-engine/rules/boundary-definition.md
@.opencode/spec-driven-roundtrip-engine/rules/operational-rules.md
@.opencode/spec-driven-roundtrip-engine/rules/document-schema.md
@.opencode/spec-driven-roundtrip-engine/rules/drift-detection.md
@.opencode/spec-driven-roundtrip-engine/rules/report-template.md

요청 의도가 문서화/역문서화/동기화(코드 사실 반영)일 때 이 명령을 사용합니다.
문서 위치/경계 판정 규칙은 `boundary-definition.md`를 따른다.
문서 버전 규칙은 `document-schema.md`를 따른다.

대상 선택:
- 대상 선택 우선순위/기본 모드(`인자 없음`, `--all`, `<경로>`)는 `operational-rules.md`를 따른다.
- 인자 없음에서는 변경 경계에 더해 상위 `CLAUDE.md` 경계를 자동 포함한다 (`operational-rules.md` 기준).

경계 식별:
- 변경 파일 기반 경계 계산과 `--all` 경계 식별 규칙은 `operational-rules.md`를 따른다.

대상 0개 처리:
- 식별된 경계가 없으면 작업을 수행하지 않는다.
- 다음을 안내한다: "대상 경계가 없습니다. 변경된 경계가 없거나 제외 경로 변경만 있었는지 확인하고, 필요하면 특정 경계를 지정하거나 `--all`을 사용하세요."

경계 상태별 처리:
- 문서화 완전: 기존 문서를 갱신한다.
- 문서화 불완전: IMPLEMENT.md를 생성한다.
- 미문서화: CLAUDE.md와 IMPLEMENT.md를 모두 새로 생성한다.
- 완료 조건: 대상 경계는 작업 종료 시 모두 문서화 완전(`CLAUDE.md` + `IMPLEMENT.md`) 상태여야 한다.

부분 실패 처리:
- 대상 경계가 여러 개일 때, 일부 경계에서 실패하더라도 나머지 경계는 계속 진행한다.
- 실패한 경계는 보고서에 실패 사유와 함께 기록한다.

작업 절차:
1. 대상 경계를 식별하고 상태를 확인합니다.
2. 경계별 공개 인터페이스, 데이터 흐름, 오류 처리, 의존 계약을 점검합니다.
3. `CLAUDE.md`를 계약 중심(범위/인터페이스/시나리오/오류/불변식/비기능/수용 기준)으로 생성 또는 갱신합니다.
4. `IMPLEMENT.md`를 구현 근거 중심(모듈 분해/호출 흐름/알고리즘/연동 정책/관측성/테스트 설계)으로 생성 또는 갱신합니다.
   - 결정성 강화 섹션 포함 트리거가 `ON`이면 `모듈 인벤토리`, `파일 계약`, `시나리오 추적성`, `변경 규칙` 섹션을 필수로 작성한다.
   - 트리거가 `OFF`여도 코드에서 근거를 확보할 수 있으면 위 섹션 작성을 권장한다.
   - 근거가 부족한 칼럼은 비워두지 않고 `확인 불가`로 표시한 뒤 `오픈 질문`에 남긴다.
5. 추측은 금지하고 불명확한 항목은 오픈 질문으로 남깁니다.
   - 추출 항목을 `F1(사실-직접)`/`F2(사실-결정형)`/`F3(해석/의도)`로 분류한다.
   - `F1`, `F2`만 문서 본문에 기록하고 `F3`는 `오픈 질문`으로 기록한다.
   - `확인 불가` 또는 `오픈 질문` 항목은 아래 3가지를 함께 기록한다.
     - 확인 불가 사유: 왜 현재 증거로 판정할 수 없는지
     - 확인 경로: 어떤 파일/로그/테스트/담당자 확인으로 해소할지
     - 해소 조건: 무엇이 확인되면 항목을 닫는지
6. 검증: 생성/갱신한 문서가 `document-schema.md` 필수 섹션과 최신 스키마 버전(`.opencode/spec-driven-roundtrip-engine/rules/schema-versions/CURRENT.md` 기준)을 갖추는지 확인하고, 문서와 코드 간 드리프트를 점검한다 (`drift-detection.md` 기준). 불일치 발견 시 보고서에 기록한다.
   - 결정성 강화 섹션이 존재하면 `QG-5` 조건(시나리오 추적성/파일 계약/변경 규칙 완전성)을 함께 점검한다.
   - `확인 불가/오픈 질문` 항목이 존재하면 `QG-6` 조건(사유/경로/해소 조건)을 함께 점검한다.
7. 경계별 결과(생성/갱신 문서, 근거 파일, 계약 완전성, 의존성, 드리프트, 스키마 검증, `오픈 질문`)를 보고합니다. `오픈 질문`이 없으면 "없음"으로 명시합니다.
