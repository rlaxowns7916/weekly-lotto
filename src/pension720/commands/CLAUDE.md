# pension720/commands
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 연금복권 720+ CLI 명령 실행 계약을 제공한다.
로그인 후 구매/조회/당첨확인 흐름을 시나리오 단위로 조합한다.

## 기능 범위/비범위
- 포함: `buy.ts`, `check.ts`, `check-result.ts` 명령 진입점.
- 포함: `PENSION_GROUP` 해석 및 조건부 이메일 전송.
- 포함: 실패 시 스크린샷/HTML/OCR 진단 수집 및 실패 메일 첨부 구성.
- 비포함: 당첨 판정 알고리즘 구현, SMTP 전송 구현.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - 실행 인터페이스: `npm run pension:buy`, `npm run pension:check`, `npm run pension:check-result`.
  - 환경 변수: `DRY_RUN`, `PENSION_GROUP`, `LOTTO_USERNAME`, `LOTTO_PASSWORD`, `LOTTO_EMAIL_*`.
- 필수/옵션:
  - 로그인 계정은 로그인 필요 명령에서 필수.
  - `PENSION_GROUP`과 이메일 설정은 옵션.
- 유효성 규칙:
  - `PENSION_GROUP`은 1~5인 경우에만 적용한다.
  - 추첨일이 당일이 아니면 당첨확인 명령은 조기 종료한다.
- 출력 타입/필드:
  - 콘솔 로그.
  - 실패 시 `process.exit(1)`.
  - 실패 진단(`ocr.status`, `ocr.hintCode`, `html.main.path`, `html.frames[]`).
  - 선택적 이메일 전송 결과.

## 행동 시나리오
- SCN-001: Given 유효 계정과 정상 네트워크, When `pension:*` 명령을 실행, Then `processExitCode=0` and `output contains "완료"`.
- SCN-002: Given 로그인/구매/당첨조회 실패, When 커맨드가 예외를 감지, Then `processExitCode=1` and `error.code!=null` and `output contains "실패"`.
- SCN-003: Given 명령 실패와 유효 페이지 컨텍스트, When 실패 후처리 실행, Then `screenshotPath!=null` and (`html.main.path!=null` or `html.status=FAILED`) and `ocr.status!=null`.

## 오류 계약
- 에러 코드: `AUTH_INVALID_CREDENTIALS`, `NETWORK_NAVIGATION_TIMEOUT`, `DOM_SELECTOR_NOT_VISIBLE`, `PARSE_FORMAT_INVALID`, `PURCHASE_VERIFICATION_FAILED`, `EMAIL_SEND_FAILED`, `OCR_ENGINE_UNAVAILABLE`, `OCR_TIMEOUT`, `OCR_TEXT_NOT_FOUND`, `OCR_EXTRACTION_FAILED`, `UNKNOWN_UNCLASSIFIED`.
- HTTP status(해당 시): 없음.
- 재시도 가능 여부: 일부 가능(하위 액션의 재시도 유틸 사용).
- 발생 조건: 로그인 실패, 구매 검증 실패, 당첨번호 조회 실패, 이메일 전송 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 브라우저 세션은 각 명령 실행마다 생성되며 `finally`에서 종료된다.
- 멱등성 규칙: `DRY_RUN=true`에서 구매 명령은 결제를 발생시키지 않는다.
- 순서 보장 규칙: 로그인 후 구매/조회/당첨확인 순으로 하위 함수를 호출한다.

## 비기능 요구
- 성능(SLO): 코드에 별도 수치형 SLO 상수는 없다.
- 보안 요구: 계정 및 SMTP 비밀은 환경 변수로만 주입한다.
- 타임아웃: 하위 Playwright 액션 타임아웃 정책을 따른다.
- 동시성 요구: 명령 단위로 단일 브라우저 세션 순차 실행을 따른다.

## 의존성 계약
- 내부 경계: `src/pension720/browser/actions`, `src/pension720/services`, `src/shared/browser`, `src/shared/browser/actions`, `src/shared/ocr`, `src/shared/services`, `src/shared/utils`.
- 외부 서비스: 동행복권 웹, SMTP 서버.
- 외부 라이브러리: Node.js 런타임, Playwright.

## 수용 기준
- [ ] `pension:*` 명령이 문서된 흐름으로 실행된다.
- [ ] 실패 시 종료 코드 1과 오류 로그가 노출된다.
- [ ] 실패 로그에 `error.code`와 `error.category`가 포함된다.
- [ ] `PENSION_GROUP`이 유효값일 때만 조 지정에 반영된다.
- [ ] 실패 메일에 스크린샷/HTML 첨부가 포함되거나 10MB 상한 초과 시 부분 첨부 상태가 기록된다.
