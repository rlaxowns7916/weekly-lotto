# tests 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `login.spec.ts`: 로그인 성공/실패와 입력 검증을 담당한다.
- `lotto645.spec.ts`: 로또 메인/모바일 구매/구매내역 흐름을 검증한다.
- `pension720.spec.ts`: 연금복권 메인/구매/구매내역 흐름을 검증한다.
- `utils/failure-diagnostics.ts`: 실패 원인 문자열 생성과 attachment 기록을 담당한다.
- `utils/site-availability.ts`: 점검 감지 및 네트워크 재시도/skip 정책을 담당한다.
- `utils/purchase-history.ts`: 구매내역 상세 검색/팝업 처리 공통 동작을 담당한다.

## 호출 흐름
1. suite `beforeEach`에서 네트워크 가드 설치 및 선행 페이지 진입.
2. 로그인 필요 시 `performLogin`으로 인증 상태를 확보.
3. 시나리오 본문에서 페이지 이동/클릭/검증 수행.
4. 핵심 locator 대기는 `waitVisibleWithReason`로 감싸 실패 시 diagnostics를 첨부.
5. Playwright 리포터가 스크린샷/trace/video(실패 시)와 함께 결과를 저장.

## 핵심 알고리즘
- 실패 진단 생성:
  - 입력: `page`, `context`, `probes[]`.
  - 처리: 현재 URL/title/login 여부/점검 문구/각 셀렉터 count+visible 수집.
  - 출력: 파이프(`|`) 구분의 단일 diagnostics 문자열.
- 실패 대기 래퍼:
  - `locator.waitFor(visible)` 실행.
  - 실패 시 diagnostics attachment 기록 후 원본 오류와 함께 throw.

## 데이터 모델
- 테스트 데이터는 환경 변수 기반 자격 증명과 상수 URL/셀렉터를 사용한다.
- diagnostics 모델 필드: `context`, `url`, `title`, `isLoginPage`, `maintenance`, `selectors[]`.

## 외부 연동 정책
- 동행복권 페이지 접근은 Playwright `page.goto`를 사용한다.
- 네트워크 오류는 `attachNetworkGuard`가 최대 재시도 후 skip 처리한다.
- 별도 circuit breaker/idempotency key는 사용하지 않는다.

## 설정
- Playwright 전역 설정: `playwright.config.ts`.
- 실행 스크립트: `npm run test:e2e`, `npm run test:e2e:headed`, `npm run test:e2e:ui`.
- 계정 주입: `LOTTO_USERNAME`, `LOTTO_PASSWORD`.

## 예외 처리 전략
- 사이트 점검 감지 시 `testInfo.skip`.
- 네트워크 이동 실패 시 재시도 후 `testInfo.skip`.
- 핵심 요소 대기 실패 시 diagnostics attachment 후 실패 throw.

## 관측성
- 실패 시 Playwright screenshot/video/trace를 저장한다.
- diagnostics attachment(`*-diagnostics`)를 텍스트로 기록한다.
- 테스트 결과/아티팩트는 Playwright HTML 리포트와 `test-results/`에서 확인한다.

## 테스트 설계
- 경계: E2E 중심(실 브라우저 상호작용), 단위 테스트는 `src/**/*.test.ts`로 분리.
- 필수 케이스: 로그인 성공/실패, 로또/연금 메인 정보 추출, 구매 화면 핵심 버튼/팝업 검증.
- 시나리오-테스트 매핑 규칙:
  - SCN-001(정상 흐름) -> 각 `...에 접근할 수 있다` 및 `...이 표시된다` 테스트.
  - SCN-002(실패 진단) -> `openLottoPurchasePage` 및 `waitVisibleWithReason` 경유 실패 테스트.

## 모듈 인벤토리 (권장)
| 모듈 | 파일 | 역할 |
|---|---|---|
| login suite | `tests/login.spec.ts` | 로그인 흐름 검증 |
| lotto suite | `tests/lotto645.spec.ts` | 로또 구매/조회/당첨 E2E 검증 |
| pension suite | `tests/pension720.spec.ts` | 연금복권 구매/조회/당첨 E2E 검증 |
| test utils | `tests/utils/*.ts` | 네트워크 가드/구매내역 헬퍼/진단 attachment |

## 파일 계약 (핵심 파일 상세, 권장)
| 파일 | 외부 노출 심볼 | 입력 | 출력 | 오류/제약 |
|---|---|---|---|---|
| `tests/lotto645.spec.ts` | test cases | `Page`, `TestInfo`, env | pass/fail/skip + artifact | UI/네트워크 변동에 민감 |
| `tests/pension720.spec.ts` | test cases | `Page`, `TestInfo`, env | pass/fail/skip + artifact | UI/네트워크 변동에 민감 |
| `tests/utils/failure-diagnostics.ts` | `buildFailureReason`, `waitVisibleWithReason` | `Page`, `Locator`, probes | diagnostics attachment | locator 실패 시 예외 |
| `tests/utils/site-availability.ts` | `attachNetworkGuard`, `skipIfSiteMaintenance` | `Page`, `TestInfo` | retry/skip 제어 | 점검 문구 의존 |

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `tests/lotto645.spec.ts#openLottoPurchasePage` | `tests/lotto645.spec.ts::모바일 구매 페이지에 접근할 수 있다` |
| SCN-002 | `tests/utils/failure-diagnostics.ts#waitVisibleWithReason` | `tests/lotto645.spec.ts::"자동 1매 추가" 버튼(button.btn-green02)이 표시된다` |

## 변경 규칙 (권장)
- MUST: 핵심 셀렉터/구매 경로를 변경하면 `tests/lotto645.spec.ts`, `tests/pension720.spec.ts`를 함께 갱신한다.
- MUST: diagnostics 포맷을 변경하면 `tests/utils/failure-diagnostics.ts` 호출부 attachment 컨텍스트를 함께 맞춘다.
- MUST NOT: 실패 원인 추적을 위해 필요한 diagnostics attachment 생성을 제거하지 않는다.
- 함께 수정할 테스트 목록: `tests/login.spec.ts`, `tests/lotto645.spec.ts`, `tests/pension720.spec.ts`.

## 알려진 제약
- 외부 사이트 DOM/리다이렉트 변화에 민감하다.
- 실데이터/실사이트 의존으로 환경에 따라 flaky 가능성이 있다.

## 오픈 질문
- 없음
