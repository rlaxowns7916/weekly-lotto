# SRTE Compile 보고서

## 대상 경계
- `.`
- `src/lotto645`
- `src/lotto645/browser`
- `src/lotto645/browser/actions`
- `src/lotto645/commands`
- `src/lotto645/domain`
- `src/lotto645/services`
- `src/pension720`
- `src/pension720/browser`
- `src/pension720/browser/actions`
- `src/pension720/commands`
- `src/pension720/domain`
- `src/pension720/services`
- `src/shared`
- `src/shared/browser`
- `src/shared/browser/actions`
- `src/shared/config`
- `src/shared/services`
- `src/shared/utils`
- `tests`
- `tests/utils`

## 경계별 결과

### 공통 판정
- **참조 문서**: 대상 경계의 `CLAUDE.md`, `IMPLEMENT.md`
- **계약 품질 게이트**:
  - 시나리오-테스트 이름 1:1 매핑 가능: 통과
  - 인터페이스/오류 계약 명확성: 통과
  - 제약/비기능 규칙 수치화: 통과
  - 구현 추적성/결정성(조건부): 통과
  - 가정 안전성(compile 전용): 통과
  - 실패 코드: 없음
- **게이트 실패 상세(실패 시 필수)**: 없음
- **문서 보강 체크리스트(실패 시 필수)**: 해당 없음
- **의존성 영향**: 없음
- **가정**: 없음
- **가정 요약**: 총 0건, BLOCKING 0건, NON-BLOCKING 0건
- **결정성 강화 상태**: 적용 완료

### 대상별 요약
| 경계 | 시나리오 수 | 매핑 수 | QG-1 | QG-2 | QG-3 | QG-4 | QG-5 | QG-6 | QG-7 | 실패 코드 |
|---|---:|---:|---|---|---|---|---|---|---|---|
| `.` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/lotto645` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/lotto645/browser` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/lotto645/browser/actions` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/lotto645/commands` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/lotto645/domain` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/lotto645/services` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/pension720` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/pension720/browser` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/pension720/browser/actions` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/pension720/commands` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/pension720/domain` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/pension720/services` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/shared` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/shared/browser` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/shared/browser/actions` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/shared/config` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/shared/services` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `src/shared/utils` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `tests` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |
| `tests/utils` | 2 | 2 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 통과 | 없음 |

### 시나리오-테스트 매핑
- `SCN-001` -> `tests/lotto645.spec.ts::메인 페이지에서 로또 6/45 당첨번호가 표시된다`
- `SCN-002` -> `tests/pension720.spec.ts::메인 페이지에서 연금복권 슬라이더가 표시된다`
- `SCN-001` -> `src/shared/config/index.test.ts::parses base config and boolean flags`
- `SCN-002` -> `src/shared/config/index.test.ts::throws when smtp host/port exist but required email fields are missing`

### 행동 변경 파일
- `IMPLEMENT.md` — 루트 SCN 매핑 테스트명을 실제 선언명으로 보정
- `src/pension720/IMPLEMENT.md` — SCN 매핑 테스트명을 실제 선언명으로 보정
- `src/pension720/browser/IMPLEMENT.md` — SCN 매핑 테스트명을 실제 선언명으로 보정
- `src/shared/IMPLEMENT.md` — SCN 매핑 테스트명을 실제 선언명으로 보정
- `src/lotto645/domain/IMPLEMENT.md` — 시나리오 추적성 섹션 추가
- `src/lotto645/services/IMPLEMENT.md` — 시나리오 추적성 섹션 추가
- `src/pension720/domain/IMPLEMENT.md` — 시나리오 추적성 섹션 추가
- `src/pension720/services/IMPLEMENT.md` — 시나리오 추적성 섹션 추가
- `src/shared/config/IMPLEMENT.md` — 시나리오 추적성 섹션 추가
- `src/shared/utils/IMPLEMENT.md` — 시나리오 추적성 섹션 추가
- `tests/IMPLEMENT.md` — 구현 파일#심볼 매핑(`openLottoPurchasePage`)으로 보정

### 구조 변경 파일
- 없음

### 생성 파일
- `src/lotto645/services/winning-check.service.test.ts` — lotto 서비스 SCN 회귀 테스트 추가
- `src/pension720/services/winning-check.service.test.ts` — pension 서비스 SCN 회귀 테스트 추가
- `src/pension720/domain/ticket.test.ts` — pension domain 형식 검증 SCN 회귀 테스트 추가

### 오픈 질문
- 내용: `package.json`의 `claude`, `update`, `upgrade` 의존성이 런타임/개발 흐름에서 실제로 사용되는지 확인 필요
- 확인 불가 사유: 저장소 코드 경로에서 직접 import/실행 근거 미확인
- 확인 경로: `package.json` scripts, CI workflow, 실제 운영 실행 로그 점검
- 해소 조건: 사용 경로 확인 또는 제거 커밋 반영 시 종료

## 검증 결과
- 테스트: `npm run test` 실행, 통과 (8 files, 30 tests)
- 빌드: `npm run typecheck` 실행, 성공
- 린트: `npm run lint` 실행, 성공
- 스키마 버전: 최신(CURRENT 기준)
- 드리프트: 없음 (SCN 매핑 대상 `구현 파일#심볼`/`테스트명` 검증 스크립트 통과)
