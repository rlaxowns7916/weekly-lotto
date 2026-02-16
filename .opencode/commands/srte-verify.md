---
description: 경계 문서(CLAUDE.md, IMPLEMENT.md)의 Source of Truth 준비 상태와 TDD 실행 가능성을 검증한다 (문서 검증)
---

다음 규칙을 먼저 로드하고 준수합니다.

@.opencode/spec-driven-roundtrip-engine/rules/boundary-definition.md
@.opencode/spec-driven-roundtrip-engine/rules/operational-rules.md
@.opencode/spec-driven-roundtrip-engine/rules/document-schema.md
@.opencode/spec-driven-roundtrip-engine/rules/report-template.md

요청 의도가 문서 품질 점검, 실행 준비도 평가, compile 전 사전 검증일 때 이 명령을 사용합니다.
코드를 생성/수정하지 않으며 문서 검증과 보강 가이드만 수행합니다.

대상 선택:
- 대상 선택 우선순위/기본 모드(`인자 없음`, `--all`, `<경로>`)는 `operational-rules.md`를 따른다.
- 인자 없음에서는 변경 파일 기반 경계만 대상으로 한다.

대상 0개 처리:
- 식별된 경계가 없으면 작업을 수행하지 않는다.
- 다음을 안내한다: "검증 대상 경계가 없습니다. 변경된 경계가 없거나 제외 경로 변경만 있었는지 확인하고, 필요하면 특정 경계를 지정하거나 `--all`을 사용하세요."

검증 절차:
1. 대상 경계를 식별하고 상태(문서화 완전/불완전/미문서화)를 분류한다.
2. 각 경계의 `CLAUDE.md`, `IMPLEMENT.md` 존재 여부를 확인한다.
3. 각 문서의 `Schema-Version`을 검증한다 (`.opencode/spec-driven-roundtrip-engine/rules/schema-versions/CURRENT.md` 기준).
4. `CLAUDE.md`의 필수 계약 섹션 존재 여부를 점검한다 (`document-schema.md` 기준).
5. `IMPLEMENT.md`의 필수 구현 섹션 존재 여부를 점검한다 (`document-schema.md` 기준).
6. `operational-rules.md`의 문서 품질 게이트를 적용하고 실패 코드(`QG-1`~`QG-6`)를 기록한다.
   - `QG-7`은 compile 전용 가정 안전성 게이트이므로 verify 단계에서는 평가하지 않는다.
7. 결정성 강화 점검:
   - 결정성 강화 섹션 포함 트리거(`SCN>=3` 또는 소스 구현 파일>=5 또는 외부 의존/연동>=2)를 계산한다.
   - 트리거 `ON`인데 `시나리오 추적성`/`파일 계약`/`변경 규칙` 섹션이 없으면 `QG-5`로 기록한다 (BLOCKED).
   - 트리거 `OFF`이고 위 섹션이 없으면 `권장 보강`으로 기록한다 (BLOCKED 사유 아님).
   - 위 섹션이 존재하는데 칼럼/매핑 누락이 있으면 `QG-5`로 기록한다 (BLOCKED).
   - `확인 불가`/`오픈 질문` 항목이 있으면 각 항목에 `확인 불가 사유`, `확인 경로`, `해소 조건`이 있는지 점검한다.
   - 위 3요소 중 하나라도 누락되면 `QG-6`로 기록한다 (BLOCKED).
8. 각 실패 항목마다 문서 보강 예시를 최소 1개 제시한다.
9. 경계별 준비 상태를 판정한다.
   - `READY`: 문서 완전성/스키마/품질 게이트 모두 통과
   - `BLOCKED`: 위 항목 중 하나라도 실패
10. 대상 경계가 많으면(예: 10개 초과) 다음 실행 단위를 제안한다.
   - `READY` 경계 중 3-5개를 우선 배치로 제안
   - `BLOCKED` 경계는 보강 후 재검증 배치로 제안

보고 형식:
- `report-template.md`의 compile 보고서 형식을 따른다.
- 검증 전용 추가 항목을 포함한다.
  - `준비 상태`: `READY|BLOCKED`
  - `결정성 강화 상태`: `{없음|권장 보강|적용 완료}`
  - `차기 배치 추천`: {없음|경계 3-5개 목록}
  - `오픈 질문`: 없으면 "없음"
