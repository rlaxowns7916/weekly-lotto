# deposit/commands
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 예치금 충전 CLI 명령 실행 계약을 제공한다.
로그인 후 충전 흐름을 CLI 단위로 오케스트레이션한다.

## 기능 범위/비범위
- 포함: `charge.ts` 실행 흐름.
- 포함: DRY_RUN 모드 분기 및 결과 콘솔 출력.
- 포함: 충전 성공/실패 조건부 이메일 전송.
- 포함: 실패 시 `handleCommandFailure` 공통 핸들러를 통한 아티팩트 수집 및 이메일 전송.
- 비포함: 키패드 OCR 구현, SMTP 전송 구현.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - 실행 인터페이스: `npm run deposit:charge`.
  - 환경 변수: `DRY_RUN`, `DEPOSIT_PASSWORD`, `DEPOSIT_AMOUNT`, `LOTTO_USERNAME`, `LOTTO_PASSWORD`, `LOTTO_EMAIL_*`.
- 필수/옵션:
  - 로그인 계정과 `DEPOSIT_PASSWORD`는 필수.
  - `DEPOSIT_AMOUNT`와 이메일 설정은 옵션.
- 유효성 규칙:
  - `DRY_RUN`이 `'false'`일 때만 실제 충전을 시도한다.
- 출력 타입/필드:
  - 콘솔 로그.
  - 실패 시 `process.exit(1)`.
  - 실패 진단(`ocr.status`, `ocr.hintCode`, `html.main.path`, `html.frames[]`).
  - 조건부 이메일 전송 결과.

## 행동 시나리오
- SCN-001: Given 유효 계정과 정상 네트워크, When `deposit:charge` 명령 실행, Then `processExitCode=0` and `output contains "완료"`.
- SCN-002: Given 로그인/충전/OCR 중 예외 발생, When 커맨드가 실패를 감지, Then `processExitCode=1` and `error.code!=null` and `output contains "실패"`.

## 오류 계약
- 에러 코드: `AUTH_INVALID_CREDENTIALS`, `NETWORK_NAVIGATION_TIMEOUT`, `KEYPAD_OCR_FAILED`, `DEPOSIT_CHARGE_FAILED`, `UNKNOWN_UNCLASSIFIED`.
- HTTP status(해당 시): 없음.
- 재시도 가능 여부: 가능(하위 액션의 재시도 유틸 사용).
- 발생 조건: 로그인 실패, 충전 실패, 키패드 OCR 실패, 이메일 전송 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 브라우저 세션은 `finally`에서 종료된다.
- 멱등성 규칙: `DRY_RUN=true`에서 충전 상태를 변경하지 않는다.
- 순서 보장 규칙: 로그인 후 충전 함수를 호출한다.

## 비기능 요구
- 성능(SLO): 코드에 별도 수치형 SLO 상수는 없다.
- 보안 요구: 계정/충전 비밀번호는 환경 변수로만 주입한다.
- 타임아웃: 하위 Playwright 액션 타임아웃 정책을 따른다.
- 동시성 요구: 명령 단위로 단일 브라우저 세션 순차 실행을 따른다.

## 의존성 계약
- 내부 경계: `src/deposit/browser/actions`, `src/deposit/services`, `src/shared/browser`, `src/shared/browser/actions`, `src/shared/services`, `src/shared/utils`.
- 외부 서비스: 동행복권 웹, SMTP 서버.
- 외부 라이브러리: Node.js 런타임, Playwright.

## 수용 기준
- [ ] `deposit:charge` 명령이 문서된 흐름대로 실행된다.
- [ ] 실패 시 `handleCommandFailure`를 통해 아티팩트 수집 및 이메일 전송된다.
- [ ] 이메일 설정이 있을 때만 메일 전송을 시도한다.
