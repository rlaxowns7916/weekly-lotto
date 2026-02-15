# pension720 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `commands/`: 구매/조회/당첨확인 CLI 진입점(`buy.ts`, `check.ts`, `check-result.ts`).
- `browser/`: 연금복권 셀렉터와 브라우저 액션(`actions/*`) 제공.
- `domain/`: 연금복권 타입/등수 판정 규칙(`ticket.ts`, `winning.ts`) 제공.
- `services/`: 당첨 집계/출력(`winning-check.service.ts`)과 이메일 템플릿(`email.templates.ts`) 제공.

## 호출 흐름
1. `package.json` script가 `commands/*.ts`의 `main()`을 실행한다.
2. 명령이 `createBrowserSession()`으로 세션을 만들고 `login()`을 수행한다.
3. 시나리오별로 `browser/actions/*`를 호출해 구매/조회/당첨번호를 수집한다.
4. `services/*`가 집계/출력/이메일 템플릿 생성을 담당한다.
5. 모든 명령은 `finally`에서 `closeBrowserSession()`을 호출한다.

## 핵심 알고리즘
- 구매 경로(`purchasePension`):
  - 최근 구매 티켓 선검증.
  - `PENSION_GROUP` 또는 요일 기반 그룹 계산 후 자동 번호 구매.
  - 구매 후 최근 티켓 재조회로 후검증.
- 당첨 확인 경로(`checkTicketsWinning`):
  - 최신 당첨번호 조회.
  - 회차별 티켓 조회.
  - 도메인 함수(`checkPensionWinning`)로 등수 계산 후 요약 생성.

## 데이터 모델
- 티켓: `PurchasedPensionTicket`(회차, 조/번호, 모드, 발행/추첨/당첨 필드).
- 당첨: `PensionWinningNumbers`(회차, 추첨일, 당첨 조/번호, 보너스).
- 결과: `PensionWinningRank`, `PensionTicketWinningResult`, `PensionWinningCheckResult`.

## 외부 연동 정책
- 브라우저 연동: Playwright `page.goto` + locator 기반 상호작용.
- 재시도: 공통 `withRetry`를 사용하는 하위 액션 경로에 한정.
- timeout: 페이지 이동 60초, 요소 대기 30초 내외.
- backoff/circuit breaker/idempotency key: circuit breaker/idempotency key는 구현되지 않았다.

## 설정
- `DRY_RUN`: `false`일 때 실구매 경로를 진행한다.
- `PENSION_GROUP`: 1~5 유효값일 때 조 선택에 반영한다.
- `HEADED`, `CI`, 로그인/이메일 설정: shared config 경계를 통해 로딩한다.

## 예외 처리 전략
- 명령 계층: `try/catch`에서 오류 출력 후 `process.exit(1)`.
- 브라우저 액션: 실패 시 예외 전파 또는 `null` 반환(조회 경로).
- 이메일: 전송 실패를 실패 결과(`success=false`)로 반환.

## 관측성
- 콘솔 로그로 단계(로그인/구매/조회/당첨/이메일) 진행 상태를 기록한다.
- 실패 시 하위 경계에서 스크린샷(`screenshots/`)을 저장한다.
- E2E 테스트에서 trace/screenshot/diagnostics attachment를 수집한다.

## 테스트 설계
- 단위 테스트: `src/pension720/domain/winning.test.ts`.
- E2E 테스트: `tests/pension720.spec.ts`.
- 시나리오-테스트 1:1 매핑:
  - `SCN-001` -> `tests/pension720.spec.ts`의 구매/조회/당첨 흐름 검증 케이스.
  - `SCN-002` -> `tests/pension720.spec.ts`의 진입 실패/셀렉터 대기 실패 진단 케이스.

## 모듈 인벤토리 (권장)
| 모듈 | 파일 | 역할 |
|---|---|---|
| commands | `commands/buy.ts`, `commands/check.ts`, `commands/check-result.ts` | CLI 오케스트레이션 |
| browser | `browser/selectors.ts`, `browser/actions/*.ts` | 모바일 페이지 자동화/파싱 |
| domain | `domain/ticket.ts`, `domain/winning.ts` | 타입/등수 계산 규칙 |
| services | `services/winning-check.service.ts`, `services/email.templates.ts` | 결과 집계/출력/메일 본문 |

## 파일 계약 (핵심 파일 상세, 권장)
| 파일 | 외부 노출 심볼 | 입력 | 출력 | 오류/제약 |
|---|---|---|---|---|
| `commands/buy.ts` | `main` | env + 브라우저 세션 | 구매 로그/선택적 이메일 | 실패 시 `process.exit(1)` |
| `browser/actions/purchase.ts` | `purchasePension` | `Page`, `dryRun`, `group?` | `PurchasedPensionTicket[]` | DOM/대기 실패 시 예외 |
| `browser/actions/check-purchase.ts` | `getTicketsByRound` 등 | `Page`, 회차 | 티켓 배열 | 파싱 실패 시 빈 배열/예외 |
| `domain/winning.ts` | `checkPensionWinning` | 구매번호/당첨번호 | 등수 | 명시적 throw 없음 |
| `services/winning-check.service.ts` | `checkTicketsWinning`, `printWinningResult` | 티켓/당첨정보 | 집계 결과/콘솔 출력 | 계산 규칙은 domain 의존 |

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/pension720/commands/buy.ts#main` | `tests/pension720.spec.ts::구매 페이지(game_mobile)에 접근할 수 있다` |
| SCN-002 | `src/pension720/commands/check-result.ts#main` | `tests/login.spec.ts::잘못된 비밀번호로 로그인에 실패한다` |

## 변경 규칙 (권장)
- MUST: `commands/*` 흐름을 변경하면 `tests/pension720.spec.ts` 관련 시나리오를 함께 갱신한다.
- MUST: `domain/winning.ts` 등수 규칙을 변경하면 `domain/winning.test.ts`를 함께 수정한다.
- MUST NOT: `DRY_RUN` 분기 또는 `PENSION_GROUP` 유효성 검사를 우회하지 않는다.
- 함께 수정할 테스트 목록: `tests/pension720.spec.ts`, `src/pension720/domain/winning.test.ts`.

## 알려진 제약
- 동행복권 모바일 DOM 구조 변경 시 브라우저 액션 파싱 안정성이 저하될 수 있다.
- 요일 기반 기본 조 선택 정책은 런타임 날짜 의존 동작이다.

## 오픈 질문
- 없음
