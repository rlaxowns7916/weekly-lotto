# lotto645/commands 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `buy.ts`: 구매 실행 및 구매 성공/실패 이메일 전송.
- `check.ts`: 최근 1주일 구매내역 조회 및 요약 출력.
- `check-result.ts`: 최신 당첨번호 조회, 회차별 티켓 조회, 당첨집계/알림.

```mermaid
flowchart TD
    M1["buy.ts"] -->|호출| M2["check.ts"]
```
## 호출 흐름
1. 커맨드가 브라우저 세션을 생성한다.
2. 공통 로그인 액션을 수행한다.
3. 명령 목적별 하위 액션/서비스를 호출한다.
4. 실패 시 스크린샷/HTML/OCR 진단을 수집하고 첨부 메일을 구성한다.
5. 오류를 출력하고 `process.exit(1)`로 종료한다.
6. `finally`에서 브라우저 세션을 종료한다.

```mermaid
sequenceDiagram
    participant Caller as 상위 경계
    participant This as 현재 경계
    Caller->>This: 요청 전달
    This-->>Caller: 결과 반환
```
## 핵심 알고리즘
- `buy.ts`:
  - `DRY_RUN !== 'false'`이면 DRY RUN으로 실행.
  - 실구매 시 반환 티켓 1건 기준으로 출력/메일 템플릿 생성.
- `check-result.ts`:
  - 당첨번호 미조회 또는 비추첨일이면 조기 종료.
  - 해당 회차 티켓이 있으면 등수 집계 후 결과 출력 및 메일 전송.

## 데이터 모델
- 입력: 환경 변수(`DRY_RUN`, 계정, 이메일).
- 출력: 콘솔 로그, `WinningCheckResult`, 이메일 템플릿 데이터.

```mermaid
erDiagram
    DRY_RUN ||--o{ WINNINGCHECKRESULT : "uses"
```
## 외부 연동 정책
- 브라우저 연동은 하위 browser/actions에 위임한다.
- 이메일 전송은 shared email service에 위임한다.
- retry/backoff 정책은 하위 경계 구현을 따른다.
- circuit breaker/idempotency key: 명시적 구현 없음.

## 설정
- `DRY_RUN` 문자열로 실제 구매 여부를 제어한다.
- 이메일 전송은 `hasEmailConfig()` 결과가 true일 때만 수행한다.

## 예외 처리 전략
- 각 명령은 최상위 `try/catch`에서 오류를 출력하고 종료 코드 1을 반환한다.
- 구매 명령 실패 시 실패 템플릿 메일 전송을 추가 시도한다.

## 실패 상세 진단 구현 정책
- 최상위 catch는 기존 `process.exit(1)` 계약을 유지하면서 구조화 에러(`error.code`, `error.category`)를 로그에 포함한다.
- 실패 알림 메일 생성 시 단순 메시지 외 코드/카테고리/요약 진단을 함께 전달한다.
- 분류 미확정 실패는 `UNKNOWN_UNCLASSIFIED`와 `classificationReason`을 함께 출력한다.
- 실패 후처리에서 OCR 힌트(`ocr.hintCode`)와 HTML 스냅샷(메인/프레임)을 수집해 메일 첨부에 전달한다.
- 첨부 총량이 10MB를 넘으면 부분 첨부 상태를 출력/기록한다.

## 관측성
- 단계 번호 기반 로그(`1. 로그인`, `2. ...`)를 출력한다.
- 실패 시 에러 객체를 콘솔에 기록한다.
- 실패 시 `ocr.status`, `ocr.hintCode`, `html.main.path` 또는 `html.failureReason`을 로그에 기록한다.

## 테스트 설계
- 간접 검증: `tests/lotto645.spec.ts`에서 구매/조회 플로우를 검증한다.
- 커맨드 파일 직접 단위 테스트는 없다.

## 모듈 인벤토리 (권장)
| 모듈 | 파일 | 역할 |
|---|---|---|
| buy command | `buy.ts` | 구매 실행 및 결과 알림 |
| check command | `check.ts` | 주간 구매내역 조회 |
| check-result command | `check-result.ts` | 당첨 조회/집계/알림 |

## 파일 계약 (핵심 파일 상세, 권장)
| 파일 | 외부 노출 심볼 | 입력 | 출력 | 오류/제약 |
|---|---|---|---|---|
| `buy.ts` | `main` | env + 브라우저 세션 | 구매 결과 로그/메일 | 실패 시 `process.exit(1)` |
| `check.ts` | `main` | env + 브라우저 세션 | 구매내역 요약 로그 | 실패 시 `process.exit(1)` |
| `check-result.ts` | `main` | env + 브라우저 세션 | 당첨 집계 로그/메일 | 비추첨일 조기 종료 |

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/lotto645/commands/buy.ts#main` | `tests/lotto645.spec.ts::모바일 구매 페이지에 접근할 수 있다` |
| SCN-002 | `src/lotto645/commands/check-result.ts#main` | `tests/lotto645.spec.ts::구매하기 클릭 후 확인 팝업(#popupLayerConfirm)이 표시된다` |
| SCN-003 | `src/lotto645/commands/buy.ts#main` | `tests/lotto645.spec.ts::should_emit_ocr_and_html_artifacts_on_failure` |

## 변경 규칙 (권장)
- MUST: 명령 종료 코드/조기 종료 조건 변경 시 해당 시나리오 테스트를 갱신한다.
- MUST: `DRY_RUN` 분기 변경 시 실구매 보호 경로를 유지한다.
- MUST NOT: 최상위 예외 처리(`process.exit(1)`)를 제거하지 않는다.
- 함께 수정할 테스트 목록: `tests/lotto645.spec.ts`.

## 알려진 제약
- 외부 사이트 상태/추첨일 조건에 따라 조기 종료가 발생할 수 있다.

## 오픈 질문
- 없음
