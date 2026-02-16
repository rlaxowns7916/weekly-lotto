# shared
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 도메인 경계(lotto645, pension720)가 공통으로 사용하는 브라우저/설정/이메일/유틸 계약을 정의한다.
중복 구현을 줄이고 런타임 동작을 일관되게 보장한다.

## 기능 범위/비범위
- 포함: 브라우저 세션 생성/종료 및 오류 스크린샷/HTML 스냅샷 저장 기능 제공.
- 포함: 공통 로그인/구매내역 이동 액션과 재시도 유틸 제공.
- 포함: 실패 스크린샷 OCR 추출 및 OCR 힌트 코드 정규화 기능 제공.
- 포함: Zod 기반 환경 변수 검증과 SMTP 이메일 전송 기능 제공.
- 비포함: 로또/연금복권 도메인별 구매/당첨 판정 로직.
- 비포함: 외부 비밀 저장소 연동 및 운영 인프라 보장.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - `process.env` 설정값, Playwright `Page`, 이메일 옵션(`subject`, `html`, `text`, `attachments?`).
  - 공통 함수 입력(`withRetry` 옵션, 날짜 문자열, HTML 원문 문자열).
- 필수/옵션:
  - 계정 기반 로그인 경로에서는 `LOTTO_USERNAME`, `LOTTO_PASSWORD`가 필수.
  - 이메일 전송은 SMTP 설정이 모두 있을 때만 활성화.
- 유효성 규칙:
  - 설정 로딩은 `configSchema`/`emailConfigSchema`를 따른다.
  - 이메일 설정은 `LOTTO_EMAIL_SMTP_HOST`와 `LOTTO_EMAIL_SMTP_PORT`가 있을 때만 구성된다.
  - 공통 로그인 경로는 `https://www.dhlottery.co.kr/` 선접속 후 `/login` 이동 순서를 따른다.
- 출력 타입/필드:
  - 브라우저 세션(`browser`, `context`, `page`).
  - 검증된 설정 객체(`Config`), 메일 전송 결과(`EmailResult`).
  - 로그인/내역 이동 실행 결과, 재시도/날짜/HTML 유틸 결과.
  - 실패 진단 결과(`ocr.status`, `ocr.text`, `ocr.hintCode`, `html.main.path`, `html.frames[]`).

## 행동 시나리오
- SCN-001: Given 유효 환경 변수와 정상 브라우저 상태, When shared API를 호출, Then `configLoaded=true` and `sessionCreated=true`.
- SCN-002: Given 설정 누락 또는 브라우저/SMTP 오류, When shared API가 실패를 처리, Then `error.code!=null` and (`errorThrown=true` or `result.success=false`).
- SCN-003: Given 실패 시점 스크린샷 경로가 존재, When OCR/HTML 후처리를 수행, Then `ocr.status!=null` and (`html.main.path!=null` or `html.status=FAILED`).
- SCN-004: Given 로그인 필요 시나리오, When 공통 로그인 액션을 수행, Then `visitedUrls[0]="https://www.dhlottery.co.kr/"` and `visitedUrls[1] contains "/login"`.

## 오류 계약
- 에러 코드: 공통 분류 코드를 사용한다(`AUTH_INVALID_CREDENTIALS`, `NETWORK_NAVIGATION_TIMEOUT`, `DOM_SELECTOR_NOT_VISIBLE`, `PARSE_FORMAT_INVALID`, `PURCHASE_VERIFICATION_FAILED`, `EMAIL_SEND_FAILED`, `OCR_ENGINE_UNAVAILABLE`, `OCR_TIMEOUT`, `OCR_TEXT_NOT_FOUND`, `OCR_EXTRACTION_FAILED`, `UNKNOWN_UNCLASSIFIED`).
- HTTP status(해당 시): 없음(CLI + 브라우저 자동화 + SMTP 컨텍스트).
- 재시도 가능 여부: 일부 가능(`withRetry` 사용 경로).
- 발생 조건: 설정 검증 실패, 로그인/페이지 이동 실패, SMTP 전송 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: `getConfig()`는 단일 프로세스에서 캐시된 설정 객체를 재사용한다.
- 멱등성 규칙: 동일 입력의 순수 유틸 함수는 동일 결과를 반환한다(시간 의존 함수 제외).
- 순서 보장 규칙: 브라우저 세션 종료 시 `context`와 `browser`를 순차 종료한다.
  - 로그인 액션은 `홈페이지 선접속 -> 로그인 페이지 이동 -> 자격증명 제출` 순서를 보장한다.

## 비기능 요구
- 성능(SLO): 수치형 SLO 상수는 코드에 정의되어 있지 않다.
- 보안 요구: 비밀값은 환경 변수로만 주입하며 코드/문서 하드코딩을 금지한다.
- 타임아웃: 주요 이동 60초, 요소 대기 10~30초, 스크린샷 저장 5초, OCR 처리 5초 제한 정책을 따른다.
- 동시성 요구: 공유 전역 상태는 `getConfig()` 캐시에 한정되며, 그 외 유틸은 함수 호출 단위로 동작한다.

## 의존성 계약
- 내부 경계: `src/shared/browser`, `src/shared/browser/actions`, `src/shared/config`, `src/shared/ocr`, `src/shared/services`, `src/shared/utils`.
- 외부 서비스: 동행복권 웹, SMTP 서버.
- 외부 라이브러리: Playwright, Zod, Nodemailer.

## 수용 기준
- [ ] 설정 로딩이 Zod 스키마 계약에 따라 검증된다.
- [ ] 브라우저 세션 생성/종료가 재사용 가능 API로 제공된다.
- [ ] 이메일 설정 유무에 따라 전송 시도 여부가 결정된다.
- [ ] 공통 유틸이 도메인 경계에서 재사용 가능하다.
- [ ] shared 실패 결과가 `error.code`, `error.category`, `error.retryable`를 포함한다.
- [ ] shared 실패 결과가 `ocr.status` 및 HTML 스냅샷 경로(또는 실패 사유)를 포함한다.
- [ ] shared 로그인 액션이 선접속 순서(`https://www.dhlottery.co.kr/` -> `/login`)를 유지한다.

## 오픈 질문
- 없음
