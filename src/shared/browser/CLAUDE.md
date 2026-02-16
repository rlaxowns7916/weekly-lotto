# shared/browser
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 공통 Playwright 브라우저 실행 계약을 제공한다.
모바일 에뮬레이션 세션과 공통 셀렉터를 표준화한다.

## 기능 범위/비범위
- 포함: 브라우저 세션 생성/종료(`createBrowserSession`, `closeBrowserSession`).
- 포함: 에러 스크린샷 저장(`saveErrorScreenshot`).
- 포함: 실패 시점 HTML 스냅샷 저장(메인/프레임).
- 포함: 로그인 셀렉터 상수 제공.
- 비포함: 로그인 절차 실행, 구매내역 탐색, 도메인별 액션 실행.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - `BrowserOptions`(`headed`, `slowMo`).
  - `Page`, 스크린샷/HTML 파일명 prefix.
- 필수/옵션:
  - 브라우저 생성 시 옵션은 선택.
  - 스크린샷/HTML 저장 시 `Page`와 이름은 필수.
- 유효성 규칙:
  - 기본 뷰포트/locale/timezone/userAgent는 iPhone 모바일 기준으로 고정한다.
  - 스크린샷 실패 시 `null` 반환.
  - HTML 캡처 실패 시 `html.status=FAILED`와 실패 사유를 반환한다.
- 출력 타입/필드:
  - `BrowserSession`(`browser`, `context`, `page`).
  - `string | null` 스크린샷 경로.
  - HTML 스냅샷 결과(`html.main.path`, `html.frames[]`, `html.status`).
  - `loginSelectors`.

## 행동 시나리오
- SCN-001: Given 실행 옵션, When 브라우저 세션 생성 호출, Then `session.browser!=null` and `session.page!=null`.
- SCN-002: Given 페이지 오류 상태, When 스크린샷 저장 호출, Then `screenshotPath!=null` or `returnValue=null`.
- SCN-003: Given 실패 페이지에 iframe이 존재, When HTML 스냅샷 저장 호출, Then `html.main.path!=null` and `html.frames.length>=0` and `html.status!=null`.

## 오류 계약
- 에러 코드: 없음(이 경계는 스냅샷 실패를 상태 객체/`null`로 반환하고 코드 부여는 상위 경계에서 수행한다).
- HTTP status(해당 시): 없음.
- 재시도 가능 여부: 없음(이 경계 함수 자체는 재시도 미내장).
- 발생 조건: 브라우저 실행 실패, 스크린샷 저장 타임아웃, 페이지 컨텍스트 손실로 HTML 캡처 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 세션 종료 시 `context`와 `browser`를 순차 종료한다.
- 멱등성 규칙: 동일 옵션 호출 시 동일 계약 구조(`BrowserSession`)를 반환한다.
- 순서 보장 규칙: init script는 페이지 생성 전에 컨텍스트에 등록된다.

## 비기능 요구
- 성능(SLO): 코드에 별도 수치형 SLO 상수는 없다.
- 보안 요구: 자격 증명은 이 경계에서 직접 다루지 않는다.
- 타임아웃: 스크린샷 저장 5초 제한, HTML 캡처는 실패 후처리 전체 5초 제한 내 수행.
- 동시성 요구: 브라우저 세션 객체 단위로 호출자에서 동시성을 제어한다.

## 의존성 계약
- 내부 경계: `src/shared/config`.
- 외부 서비스: 동행복권 웹(후속 액션에서 사용).
- 외부 라이브러리: Playwright.

## 수용 기준
- [ ] 브라우저 세션 생성/종료 함수가 공통 경계에서 재사용 가능하다.
- [ ] 모바일 에뮬레이션 설정이 코드와 문서에서 일치한다.
- [ ] 스크린샷 저장 실패 시 `null` 반환 계약이 유지된다.
- [ ] 실패 시 HTML 스냅샷(메인/프레임) 경로 또는 실패 사유가 기록된다.
