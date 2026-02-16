# lotto645 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `commands/`: 구매/조회/당첨확인 CLI 진입점(`buy.ts`, `check.ts`, `check-result.ts`).
- `browser/`: 로또 모바일 셀렉터와 브라우저 액션(`actions/*`) 제공.
- `domain/`: 티켓/당첨 타입과 당첨 판정 규칙(`ticket.ts`, `winning.ts`) 제공.
- `services/`: 당첨 집계/출력(`winning-check.service.ts`)과 이메일 템플릿(`email.templates.ts`) 제공.
- 실패 후처리: shared OCR/HTML 스냅샷 결과를 수집해 명령 출력/메일 첨부로 전달.

## 호출 흐름
1. `package.json` script가 `commands/*.ts`의 `main()`을 실행한다.
2. 명령이 `createBrowserSession()`으로 세션을 만들고 `login()`을 수행한다.
3. 시나리오별로 `browser/actions/*`를 호출해 구매/조회/당첨번호를 수집한다.
4. `services/*`가 집계/출력/이메일 템플릿 생성을 담당한다.
5. 모든 명령은 `finally`에서 `closeBrowserSession()`을 호출한다.

## 핵심 알고리즘
- 구매 경로(`purchaseLotto`):
  - 최근 구매 티켓 선검증.
  - 필요 시 자동 번호 선택 + 구매 버튼/확인 팝업 처리.
  - 구매 후 최근 티켓 재조회로 후검증.
- 당첨 확인 경로(`checkTicketsWinning`):
  - 최신 당첨번호 조회.
  - 회차별 티켓 조회.
  - 도메인 함수(`checkWinning`)로 등수 계산 후 요약 생성.

## 데이터 모델
- 티켓: `PurchasedTicket`(회차, 슬롯, 번호, 모드, 발행/추첨/당첨 필드).
- 당첨: `WinningNumbers`(회차, 추첨일, 당첨번호 6개, 보너스 번호).
- 결과: `WinningRank`, `TicketWinningResult`, `WinningCheckResult`.

## 외부 연동 정책
- 브라우저 연동: Playwright `page.goto` + locator 기반 상호작용.
- 재시도: 공통 `withRetry`를 사용하는 하위 액션 경로에 한정.
- timeout: 페이지 이동 60초, 요소 대기 30초 내외.
- backoff/circuit breaker/idempotency key: circuit breaker/idempotency key는 구현되지 않았다.

## 설정
- `DRY_RUN`: `false`일 때 실구매 경로를 진행한다.
- `HEADED`, `CI`: shared 브라우저 설정에서 해석한다.
- 로그인/이메일 설정: shared config 경계를 통해 로딩한다.

## 예외 처리 전략
- 명령 계층: `try/catch`에서 오류 출력 후 `process.exit(1)`.
- 브라우저 액션: 실패 시 예외 전파 또는 `null` 반환(조회 경로).
- 이메일: 전송 실패를 실패 결과(`success=false`)로 반환.

## 실패 상세 진단 구현 정책
- 로또 경계는 shared taxonomy를 기본으로 사용하고 필요 시 `LOTTO_*` 확장 코드를 추가한다.
- 명령 실패 출력/메일 템플릿에 `error.code`, `error.category`, `diagnostic.summary`를 포함한다.
- 구매/파싱/검증 실패를 `PURCHASE_VERIFICATION_FAILED`, `DOM_SELECTOR_NOT_VISIBLE`, `PARSE_FORMAT_INVALID`로 우선 분류한다.
- 실패 시 OCR 힌트(`ocr.hintCode`)와 HTML 스냅샷(메인/프레임)을 함께 수집해 후속 분석 가능성을 높인다.

## 관측성
- 콘솔 로그로 단계(로그인/구매/조회/당첨/이메일) 진행 상태를 기록한다.
- 실패 시 하위 경계에서 스크린샷(`screenshots/`)을 저장한다.
- 실패 시 하위 경계에서 HTML 스냅샷(`artifacts/html-failures/`)과 OCR 진단을 기록한다.
- E2E 테스트에서 trace/screenshot/diagnostics attachment를 수집한다.

## 테스트 설계
- 단위 테스트: `src/lotto645/domain/winning.test.ts`.
- E2E 테스트: `tests/lotto645.spec.ts`.
- 시나리오-테스트 1:1 매핑:
  - `SCN-001` -> `tests/lotto645.spec.ts`의 구매/조회/당첨 흐름 검증 케이스.
  - `SCN-002` -> `tests/lotto645.spec.ts`의 진입 실패/셀렉터 대기 실패 진단 케이스.

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
| `browser/actions/purchase.ts` | `purchaseLotto` | `Page`, `dryRun` | `PurchasedTicket[]` | DOM/대기 실패 시 예외 |
| `browser/actions/check-purchase.ts` | `getTicketsByRound` 등 | `Page`, 회차 | 티켓 배열 | 파싱 실패 시 빈 배열/예외 |
| `domain/winning.ts` | `checkWinning`, `getMatchingNumbers` | 번호 배열, 당첨정보 | 등수/일치번호 | 명시적 throw 없음 |
| `services/winning-check.service.ts` | `checkTicketsWinning`, `printWinningResult` | 티켓/당첨정보 | 집계 결과/콘솔 출력 | 계산 규칙은 domain 의존 |

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/lotto645/commands/buy.ts#main` | `tests/lotto645.spec.ts::모바일 구매 페이지에 접근할 수 있다` |
| SCN-002 | `src/lotto645/commands/check-result.ts#main` | `tests/lotto645.spec.ts::구매하기 클릭 후 확인 팝업(#popupLayerConfirm)이 표시된다` |
| SCN-003 | `src/lotto645/commands/buy.ts#main` | `tests/lotto645.spec.ts::should_capture_ocr_and_html_artifacts_on_failure` |

## 변경 규칙 (권장)
- MUST: `commands/*` 흐름을 변경하면 `tests/lotto645.spec.ts` 관련 시나리오를 함께 갱신한다.
- MUST: `domain/winning.ts` 등수 규칙을 변경하면 `domain/winning.test.ts`를 함께 수정한다.
- MUST NOT: `DRY_RUN` 분기를 제거하거나 실구매 보호 경로를 우회하지 않는다.
- 함께 수정할 테스트 목록: `tests/lotto645.spec.ts`, `src/lotto645/domain/winning.test.ts`.

## 알려진 제약
- 동행복권 모바일 DOM 구조 변경 시 브라우저 액션 파싱 안정성이 저하될 수 있다.
- 실행 로그 문구와 실제 script 이름 표기가 일부 파일 주석에서 불일치할 수 있다.

## 오픈 질문
- 없음
