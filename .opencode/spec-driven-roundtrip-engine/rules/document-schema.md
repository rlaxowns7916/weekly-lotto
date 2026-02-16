# 경계 문서 스키마

현재 최신 스키마 버전: `.opencode/spec-driven-roundtrip-engine/rules/schema-versions/CURRENT.md`의 값

## 스키마 관리 정책

`document-schema.md`는 항상 **최신 스키마만** 유지한다.
버전별 본문을 이 파일에 누적 append하지 않는다.

운영 파일 구조:
- 최신 스키마: `.opencode/spec-driven-roundtrip-engine/rules/document-schema.md`
- 현재 버전 포인터: `.opencode/spec-driven-roundtrip-engine/rules/schema-versions/CURRENT.md`
- 버전 스냅샷: `.opencode/spec-driven-roundtrip-engine/rules/schema-versions/SRTE-DOCS-<N>.md`
- 변경 이력: `.opencode/spec-driven-roundtrip-engine/rules/schema-changelog.md`
- 마이그레이션 가이드: `.opencode/spec-driven-roundtrip-engine/rules/schema-migrations/`

업데이트 흐름:
1. 최신 스키마를 `.opencode/spec-driven-roundtrip-engine/rules/document-schema.md`에서 갱신한다.
2. 갱신된 최신 상태를 새 버전 스냅샷으로 추가한다.
3. `.opencode/spec-driven-roundtrip-engine/rules/schema-changelog.md`에 변경 이유/영향을 기록한다.
4. 필요 시 `.opencode/spec-driven-roundtrip-engine/rules/schema-migrations/`에 버전 전환 절차를 추가한다.

버전 변경 기준:
- `SRTE-DOCS-<N>` 버전을 올려야 하는 변경:
  - 필수 섹션 추가/삭제/이름 변경
  - 공통 메타데이터 형식 변경
  - 기존 문서를 자동 실패시키는 강제 규칙 변경
- 버전 유지가 가능한 변경(비호환 아님):
  - 선택 섹션/작성 가이드/예시 보강
  - 선택 섹션이 존재할 때만 적용되는 조건부 검증 규칙 추가
  - 보고 형식 확장

## 공통 메타데이터

모든 `CLAUDE.md`, `IMPLEMENT.md`는 제목 바로 아래에 최신 스키마 버전을 기록해야 한다.

```markdown
# {문서 제목}
Schema-Version: <CURRENT_SCHEMA_VERSION>
```

버전 규칙:
1. 최신 버전(`.opencode/spec-driven-roundtrip-engine/rules/schema-versions/CURRENT.md`의 값)만 정상 상태로 간주한다.
2. 버전 누락 또는 구버전은 마이그레이션 대상이다.
3. 마이그레이션 완료 후 문서 내용과 `Schema-Version`을 함께 최신화한다.

버전 판정 절차(결정형):
1. `.opencode/spec-driven-roundtrip-engine/rules/schema-versions/CURRENT.md`를 읽고 최신 스키마 문자열을 로드한다.
2. 각 경계의 `CLAUDE.md`/`IMPLEMENT.md` 제목 바로 다음 줄에서 `Schema-Version` 값을 추출한다.
3. 다음 중 하나라도 충족하면 실패로 판정한다.
   - `Schema-Version` 헤더 누락
   - 최신 스키마 문자열과 불일치
4. 판정 결과는 보고서에 `최신(CURRENT 기준)`, `구버전`, `누락` 중 하나로 기록한다.

## CLAUDE.md

경계의 **계약(Contract)**을 기술한다. "이 경계가 무엇을 보장하는가"에 답한다.

역할 비유:
- `CLAUDE.md`는 헤더 파일(`.h`)처럼 외부에 보이는 보장(입력/출력/오류/제약)을 고정한다.
- 구현 상세(파일 내부 분기, 알고리즘 선택)는 포함하지 않는다.

### 필수 섹션

```markdown
# {경계 이름}
Schema-Version: <CURRENT_SCHEMA_VERSION>

## 목적
이 경계가 존재하는 이유와 핵심 책임. 1-3문장.

## 기능 범위/비범위
- 포함: 이 경계가 반드시 수행하는 기능
- 비포함: 이 경계가 의도적으로 수행하지 않는 기능

## 공개 인터페이스 계약
각 공개 인터페이스(함수/API/메시지)에 대해 아래를 명시한다.
- 입력 타입/필드
- 필수/옵션
- 유효성 규칙
- 출력 타입/필드

## 행동 시나리오
Given-When-Then 형식으로 정상/예외 흐름을 모두 명시한다.
- SCN-001: 정상 시나리오
- SCN-002: 예외 시나리오

## 오류 계약
각 오류에 대해 아래를 명시한다.
- 에러 코드
- HTTP status(해당 시)
- 재시도 가능 여부
- 발생 조건

## 불변식/제약
- 트랜잭션 경계
- 정합성 규칙
- 멱등성 규칙
- 순서 보장 규칙

## 비기능 요구
- 성능(SLO)
- 보안 요구
- 타임아웃
- 동시성 요구

## 의존성 계약
이 경계가 의존하는 외부 경계/서비스에 대해 기대하는 보장을 명시한다.
운영 규칙상 섹션을 생략하지 않으며, 의존성이 없으면 `없음`으로 기록한다.

## 수용 기준
완료 판정 체크리스트를 명시한다.
- [ ] 기준 1
- [ ] 기준 2
```

### 선택 섹션

```markdown
## 오픈 질문
아직 확정되지 않은 사항.
```

### 작성 원칙

1. 구현 상세(파일명, 함수명, 알고리즘)를 포함하지 않는다.
2. 테스트를 작성할 수 있는 계약 수준의 정보(입력/출력/오류/제약)를 수치 또는 규칙으로 명시한다.
3. 각 `행동 시나리오`는 테스트 이름으로 바로 환원 가능해야 한다.
4. `## 의존성 계약` 섹션은 항상 포함하고, 값이 없으면 `없음`으로 기록한다.

### 검증 가능한 계약값 작성 규칙

행동 시나리오와 계약 문장은 아래 형태를 만족해야 한다.

1. 관측 대상 필드를 명시한다. (`status`, `errorCode`, `retryable`, `latencyMs` 등)
2. 비교 규칙을 명시한다. (`=`, `!=`, `<=`, `>=`, `contains`)
3. 기대값을 명시한다. (`APPROVED`, `E_TIMEOUT`, `<=1500ms`)
4. 조건을 명시한다. (입력/사전상태/예외상황)

권장 표현:
- `Then PaymentResult.status=APPROVED`
- `Then errorCode=E_DUPLICATE_PAYMENT and retryable=false`
- `Then authorize p95<=800ms`

비권장 표현:
- `Then 정상적으로 처리된다`
- `Then 적절한 오류를 반환한다`
- `Then 성능이 충분히 빠르다`

---

## IMPLEMENT.md

경계의 **설계/구현**을 기술한다. "이 경계가 계약을 어떻게 만족시키는가"에 답한다.

역할 비유:
- `IMPLEMENT.md`는 소스 파일(`.c`)처럼 보장을 만족시키는 내부 경로(호출 흐름/정책/테스트 설계)를 추적 가능하게 기록한다.
- 계약 자체를 재정의하지 않고 CLAUDE.md를 구현 근거로 연결한다.

### 필수 섹션

```markdown
# {경계 이름} 구현 상세
Schema-Version: <CURRENT_SCHEMA_VERSION>

## 모듈 분해
파일/클래스 책임과 경계 내부의 역할 분리를 명시한다.

## 호출 흐름
요청 시작부터 종료까지의 호출 순서와 분기 지점을 명시한다.

## 핵심 알고리즘
의사코드, 시간/공간 복잡도, 선택 근거를 명시한다.

## 데이터 모델
스키마/필드 의미/인덱스/마이그레이션 전략을 명시한다.

## 외부 연동 정책
timeout/retry/backoff/circuit breaker/idempotency key 정책을 명시한다.

## 설정
환경 변수 키, 기본값, 환경별 차이를 명시한다.

## 예외 처리 전략
오류를 어디서 변환/랩핑/로깅하는지 명시한다.

## 관측성
로그 포맷, 메트릭, 트레이싱 포인트를 명시한다.

## 테스트 설계
단위/통합 테스트 경계, 픽스처, 필수 케이스 목록, 시나리오-테스트 매핑 규칙을 명시한다.
최소한 모든 `SCN-xxx`에 대해 테스트 이름 1:1 목록을 포함한다.
```

### 선택 섹션

```markdown
## 모듈 인벤토리 (권장)
경계의 전체 파일/모듈 목록과 역할을 표로 요약한다.

## 파일 계약 (핵심 파일 상세, 권장)
핵심 파일별로 역할/외부 노출 심볼/의존성/사이드이펙트를 명시하고,
메서드 단위 입력/출력/오류/제약 계약을 표로 기록한다.

## 시나리오 추적성 (권장)
`SCN-xxx -> 구현 파일#심볼 -> 테스트명` 1:1 매핑을 기록한다.

## 변경 규칙 (권장)
MUST/MUST NOT/함께 수정할 테스트 목록을 기록해 compile 변경 범위를 결정형으로 제한한다.

## 알려진 제약
현재 구현의 한계, 기술 부채, 주의사항.

## 오픈 질문
코드에서 확인할 수 없거나 불명확한 사항.
```

### 작성 원칙

용도에 따라 기술 근거가 다르다.

**decompile (코드 -> 문서):**
1. 사실만 기술한다. 추측으로 채우지 않는다.
2. 코드에서 직접 확인 가능한 내용만 포함한다.
3. 불명확한 항목은 `## 오픈 질문`에 기록한다.
4. 계약 충족에 필요한 구현 근거가 부족하면 빈칸 없이 "확인 불가"로 명시한다.
5. `확인 불가` 또는 `오픈 질문` 항목은 아래 3가지를 반드시 함께 기록한다.
   - 확인 불가 사유(왜 현재 증거로 판정할 수 없는지)
   - 확인 경로(어떤 파일/로그/테스트/담당자 확인으로 해소할지)
   - 해소 조건(무엇이 확인되면 항목을 닫는지)

사실/해석 분류 규칙:
- `F1(사실-직접)`: 코드/설정 리터럴/상수/정적 선언에서 직접 확인된 값
- `F2(사실-결정형)`: 코드 흐름 + 설정 키/기본값으로 결정 가능한 값
- `F3(해석/의도)`: 코드에서 직접 증명되지 않는 설계 의도/정책 추론
- 문서 본문에는 `F1`, `F2`만 기록한다. `F3`는 `오픈 질문`으로만 기록한다.

**plan (PRD -> 문서):**
1. PRD의 요구사항과 설계 의도를 근거로 기술한다.
2. 아직 구현이 없으므로 설계 시점의 결정을 기록한다.
3. 확정되지 않은 사항은 `## 오픈 질문`에 기록한다.
4. 테스트 설계 섹션은 CLAUDE.md의 시나리오/수용 기준과 추적 가능해야 한다.
5. `오픈 질문` 항목은 `확인 불가 사유`/`확인 경로`/`해소 조건`을 함께 기록한다.

### 결정성 강화 규칙 (선택 섹션을 사용하는 경우)

1. 아래 트리거 중 하나라도 충족하면 결정성 강화 섹션을 필수로 포함한다.
   - CLAUDE.md의 `SCN-xxx` 개수 >= 3
   - 대상 경계의 소스 구현 파일 수 >= 5 (테스트/문서/생성 산출물 제외)
   - 외부 의존/연동 대상 수 >= 2
2. `## 시나리오 추적성` 섹션이 존재하면 CLAUDE.md의 모든 `SCN-xxx`를 누락 없이 포함해야 한다.
3. 각 `SCN-xxx`는 `구현 파일#심볼` 1개와 `테스트명` 1개에 1:1로 매핑되어야 한다.
4. `## 파일 계약` 섹션이 존재하면 각 메서드 행의 입력/출력/오류/제약 칼럼을 비우지 않는다.
5. `## 변경 규칙` 섹션이 존재하면 MUST/MUST NOT/함께 수정할 테스트 목록을 비우지 않는다.
6. 문서에 `확인 불가` 또는 `오픈 질문` 항목이 존재하면 각 항목에 `사유/확인 경로/해소 조건`을 함께 기록한다.
7. 1~5 규칙을 충족하지 못하면 문서 품질 게이트 `QG-5` 대상으로 처리한다.
8. 6 규칙을 충족하지 못하면 문서 품질 게이트 `QG-6` 대상으로 처리한다.

## 골든 템플릿

아래 예시는 최신 스키마(`.opencode/spec-driven-roundtrip-engine/rules/schema-versions/CURRENT.md` 기준) 권장 템플릿이다.

- `.opencode/spec-driven-roundtrip-engine/rules/examples/CLAUDE.example.md`
- `.opencode/spec-driven-roundtrip-engine/rules/examples/IMPLEMENT.example.md`
