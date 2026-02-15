# shared 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `browser/context.ts`: 브라우저 세션 생성/종료와 오류 스크린샷 저장.
- `browser/actions/login.ts`: 로그인 자동화.
- `browser/actions/purchase-history.ts`: 구매내역 페이지 이동/필터링.
- `config/index.ts`: 환경 변수 검증(`zod`)과 설정 캐시(`getConfig()`).
- `services/email.service.ts`: SMTP 트랜스포터 생성/메일 전송/결과 래핑.
- `utils/*.ts`: 재시도(`retry.ts`), 날짜(`date.ts`), HTML 이스케이프(`html.ts`) 유틸.

## 호출 흐름
1. 상위 명령 경계가 `getConfig()`로 설정을 로딩한다.
2. 상위 명령 경계가 `createBrowserSession()`과 `login()`을 호출한다.
3. 구매내역 조회 시 `navigateToPurchaseHistory()`를 통해 공통 필터를 적용한다.
4. 결과 알림이 필요할 때 `hasEmailConfig()` 확인 후 `sendEmail()`을 호출한다.
5. 보조 로직은 `withRetry()`/날짜 유틸/HTML 유틸을 공통 재사용한다.

## 핵심 알고리즘
- 설정 로딩(`loadConfig`):
  - `configSchema.safeParse(process.env)` 실행.
  - 실패 시 에러 내용을 출력하고 throw.
  - 성공 시 `emailConfigSchema`를 조건부로 파싱해 `Config` 생성.
- 재시도(`withRetry`):
  - 시도 후 실패 시 `shouldRetry` 조건 검사.
  - 지수 백오프 + 지터 지연 후 재시도.
  - 최대 시도 초과 시 마지막 오류를 throw.

## 데이터 모델
- 설정: `Config`, `EmailConfig`.
- 이메일: `EmailOptions`, `EmailResult`.
- 브라우저 세션: `BrowserSession`(`browser`, `context`, `page`).

## 외부 연동 정책
- 브라우저 연동: Playwright 사용, 모바일 에뮬레이션 컨텍스트 생성.
- 이메일 연동: Nodemailer SMTP 트랜스포터 사용.
- timeout/retry/backoff:
  - Playwright 주요 이동 60초, 요소 대기 10~30초, 스크린샷 저장 5초.
  - `withRetry`는 지수 백오프 + 지터 적용.
- circuit breaker/idempotency key: 구현되지 않았다.

## 설정
- 계정: `LOTTO_USERNAME`, `LOTTO_PASSWORD`.
- 이메일: `LOTTO_EMAIL_SMTP_HOST`, `LOTTO_EMAIL_SMTP_PORT`, `LOTTO_EMAIL_USERNAME`, `LOTTO_EMAIL_PASSWORD`, `LOTTO_EMAIL_FROM`, `LOTTO_EMAIL_TO`.
- 실행 옵션: `DRY_RUN`, `HEADED`, `CI`, `PENSION_GROUP`.

## 예외 처리 전략
- 설정: 스키마 검증 실패 시 throw.
- 브라우저/로그인: 실패 시 예외 전파, 필요 시 스크린샷 기록.
- 이메일: 전송 실패를 `EmailResult{ success: false, error }`로 반환.
- 재시도 유틸: 마지막 실패를 throw하고 호출자가 처리한다.

## 관측성
- 설정 검증 실패와 명령 단계 로그는 콘솔에 출력된다.
- 브라우저 오류 시 스크린샷 파일 경로를 기록한다.
- E2E 경계와 결합해 trace/screenshot/diagnostics attachment를 남긴다.

## 테스트 설계
- 단위 테스트: `src/shared/config/index.test.ts`, `src/shared/utils/date.test.ts`, `src/shared/utils/retry.test.ts`.
- 간접 통합 검증: `tests/*.spec.ts`에서 로그인/구매내역/공통 유틸 사용 경로 확인.
- 시나리오-테스트 1:1 매핑:
  - `SCN-001` -> `src/shared/config/index.test.ts`의 유효 설정 로딩 케이스.
  - `SCN-002` -> `src/shared/config/index.test.ts`의 스키마 위반/실패 케이스.

## 모듈 인벤토리 (권장)
| 모듈 | 파일 | 역할 |
|---|---|---|
| browser | `browser/context.ts`, `browser/selectors.ts`, `browser/actions/*.ts` | 세션/로그인/구매내역 공통 자동화 |
| config | `config/index.ts` | 환경 변수 검증/설정 캐시 |
| services | `services/email.service.ts` | SMTP 이메일 전송 |
| utils | `utils/retry.ts`, `utils/date.ts`, `utils/html.ts` | 보조 알고리즘/포맷 유틸 |

## 파일 계약 (핵심 파일 상세, 권장)
| 파일 | 외부 노출 심볼 | 입력 | 출력 | 오류/제약 |
|---|---|---|---|---|
| `config/index.ts` | `getConfig`, `loadConfig` | `process.env` | `Config` | 스키마 위반 시 throw |
| `browser/context.ts` | `createBrowserSession`, `closeBrowserSession` | 옵션/세션 | `BrowserSession`/종료 완료 | 브라우저 초기화 실패 예외 |
| `browser/actions/login.ts` | `login` | `Page` | 로그인 완료 상태 | 로그인 실패 예외 |
| `services/email.service.ts` | `hasEmailConfig`, `sendEmail` | `EmailOptions` | `EmailResult` | SMTP 실패는 `success=false` |
| `utils/retry.ts` | `withRetry` | 비동기 함수/옵션 | 함수 실행 결과 | 최대 시도 초과 시 throw |

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/shared/config/index.ts#getConfig` | `src/shared/config/index.test.ts::parses base config and boolean flags` |
| SCN-002 | `src/shared/config/index.ts#loadConfig` | `src/shared/config/index.test.ts::throws when smtp host/port exist but required email fields are missing` |

## 변경 규칙 (권장)
- MUST: `config/index.ts` 스키마를 변경하면 `config/index.test.ts`를 함께 수정한다.
- MUST: `utils/retry.ts` 정책을 변경하면 `utils/retry.test.ts`를 함께 수정한다.
- MUST NOT: 이메일 비밀값을 코드 상수로 대체하거나 로깅하지 않는다.
- 함께 수정할 테스트 목록: `src/shared/config/index.test.ts`, `src/shared/utils/date.test.ts`, `src/shared/utils/retry.test.ts`, `tests/login.spec.ts`.

## 알려진 제약
- 외부 사이트/SMTP 상태에 따라 상위 경계 관측 결과가 달라질 수 있다.
- `getConfig()` 캐시는 프로세스 수명 동안 유지되어 런타임 동적 env 변경을 즉시 반영하지 않는다.

## 오픈 질문
- 없음
