# shared/browser 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `context.ts`: 브라우저 실행/종료, 모바일 컨텍스트 설정, 스크린샷 저장.
- `selectors.ts`: 로그인 URL/role 기반 입력 셀렉터 상수.
- `actions/`: 로그인/구매내역 이동 공통 액션.

## 호출 흐름
1. 상위 커맨드가 `createBrowserSession`으로 세션을 생성한다.
2. 상위/하위 액션이 `page`를 사용해 로그인/구매내역/구매를 수행한다.
3. 오류 시 `saveErrorScreenshot`를 호출한다.
4. 종료 시 `closeBrowserSession`으로 context/browser를 닫는다.

## 핵심 알고리즘
- 브라우저 초기화:
  - `chromium.launch` + iPhone 모바일 userAgent/viewport 설정.
  - context init script로 webdriver/platform/plugins/languages 우회 값을 주입.
- 스크린샷 저장:
  - `screenshots/{name}-{timestamp}.png` 규칙으로 저장.
  - 실패 시 `null` 반환.

## 데이터 모델
- `BrowserOptions`: `headed?`, `slowMo?`.
- `BrowserSession`: `browser`, `context`, `page`.

## 외부 연동 정책
- Playwright Chromium 사용.
- timeout: 스크린샷 저장 timeout 5초.
- retry/backoff/circuit breaker/idempotency key: 이 경계 직접 구현 없음.

## 설정
- `getConfig().headed` 값으로 headless/headed 기본 동작을 제어.

## 예외 처리 전략
- 브라우저 생성/종료 오류는 호출자로 전파된다.
- 스크린샷 실패는 내부에서 처리하고 `null` 반환한다.

## 관측성
- 스크린샷 저장 성공/실패를 콘솔에 출력.
- 별도 메트릭/트레이싱 구현은 없다.

## 테스트 설계
- 간접 검증: E2E 테스트에서 공통 브라우저 세션과 셀렉터를 사용한다.
- context/selectors 직접 단위 테스트는 없다.

## 모듈 인벤토리 (권장)
| 모듈 | 파일 | 역할 |
|---|---|---|
| browser context | `context.ts` | 세션 생성/종료, 스크린샷 저장 |
| selector constants | `selectors.ts` | 로그인 URL/입력 셀렉터 상수 |

## 파일 계약 (핵심 파일 상세, 권장)
| 파일 | 외부 노출 심볼 | 입력 | 출력 | 오류/제약 |
|---|---|---|---|---|
| `context.ts` | `createBrowserSession`, `closeBrowserSession`, `saveErrorScreenshot` | `BrowserOptions`, `BrowserSession`, `Page` | 세션 객체, 경로 문자열 또는 `null` | 생성/종료 실패 시 예외 전파 |
| `selectors.ts` | `loginSelectors` | 없음 | 셀렉터 상수 객체 | DOM 계약 변경 시 수정 필요 |

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/shared/browser/context.ts#createBrowserSession` | `tests/login.spec.ts::로그인 페이지가 정상적으로 로드된다` |
| SCN-002 | `src/shared/browser/context.ts#saveErrorScreenshot` | `tests/lotto645.spec.ts::구매하기 클릭 후 확인 팝업(#popupLayerConfirm)이 표시된다` |

## 변경 규칙 (권장)
- MUST: 모바일 컨텍스트 기본값(userAgent/viewport/locale/timezone) 변경 시 로그인/구매 E2E를 함께 검증한다.
- MUST: 세션 종료 순서(`context` -> `browser`)를 유지한다.
- MUST NOT: 스크린샷 실패 시 `null` 반환 계약을 예외 throw로 변경하지 않는다.
- 함께 수정할 테스트 목록: `tests/login.spec.ts`, `tests/lotto645.spec.ts`, `tests/pension720.spec.ts`.

## 알려진 제약
- 외부 사이트 DOM/접근성 속성 변화에 따라 셀렉터/우회 설정 조정이 필요할 수 있다.
