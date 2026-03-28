# deposit
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 예치금 충전의 도메인 통합 계약을 정의한다.
하위 경계(browser, commands, domain, services)를 조합해 NProtect 키패드 OCR 기반 충전 흐름과 결과 형식을 보장한다.

## 기능 범위/비범위
- 포함: `deposit:charge` 실행 흐름 제공.
- 포함: NProtect NPPFS 보안 키패드 OCR 인식 및 비밀번호 입력 제공.
- 포함: DRY_RUN 모드(OCR 검증까지만)와 실제 충전 모드 분기 제공.
- 포함: 충전 결과 콘솔 출력과 조건부 이메일 템플릿 생성.
- 비포함: 공통 로그인/브라우저 세션 생성/SMTP 전송 구현.
- 비포함: 동행복권 DOM 안정성 또는 외부 네트워크 품질 보장.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - 실행 인터페이스: `package.json` scripts (`deposit:charge`).
  - 런타임 입력: Playwright `Page`, `DRY_RUN`, 로그인/이메일 환경 변수.
  - 충전 전용: `DEPOSIT_PASSWORD` (6자리 숫자), `DEPOSIT_AMOUNT` (옵션, 기본 20000).
- 필수/옵션:
  - 로그인 계정(`LOTTO_USERNAME`, `LOTTO_PASSWORD`)은 필수.
  - `DEPOSIT_PASSWORD`는 충전 실행 시 필수.
  - `DEPOSIT_AMOUNT`는 옵션(기본값 20000원).
  - 이메일 전송은 `hasEmailConfig()`가 `true`일 때만 활성화.
- 유효성 규칙:
  - `DEPOSIT_PASSWORD`는 정규식 `/^\d{6}$/`를 충족해야 한다.
  - `DRY_RUN=false`일 때만 실제 충전이 진행된다.
- 출력 타입/필드:
  - 충전 결과(`ChargeResult`: amount, status, timestamp, keypadOcrConfidence).
  - 실패 진단 결과(`ocr.status`, `ocr.hintCode`, `html.main.path`, `html.frames[]`).
  - 선택적 이메일 전송 결과(`success`, `messageId` 또는 `error`).

## 행동 시나리오
- SCN-001: Given 유효 계정과 정상 페이지 상태, When `deposit:charge` 명령을 실행, Then `processExitCode=0` and `output contains "완료"`.
- SCN-002: Given 로그인/충전/키패드 인식 중 오류, When 명령이 예외를 처리, Then `processExitCode=1` and `error.code!=null` and `output contains "실패"`.
- SCN-003: Given DRY_RUN 모드, When 충전 명령을 실행, Then `keypadOcrConfidence>0` and `status='dry_run'` and 실제 충전 미발생.

## 오류 계약
- 에러 코드: `AUTH_INVALID_CREDENTIALS`, `NETWORK_NAVIGATION_TIMEOUT`, `KEYPAD_OCR_FAILED`, `DEPOSIT_CHARGE_FAILED`, `DEPOSIT_VERIFICATION_FAILED`, `UNKNOWN_UNCLASSIFIED`.
- HTTP status(해당 시): 없음(CLI + 브라우저 자동화 컨텍스트).
- 재시도 가능 여부: 가능(`withRetry`가 적용된 충전 플로우, 키패드 OCR 재시도).
- 발생 조건: 로그인 실패, 충전 페이지 이동 실패, 키패드 OCR 인식 실패, 비밀번호 입력 실패, 이메일 전송 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 각 명령은 브라우저 세션 생성 후 `finally`에서 종료를 시도한다.
- 멱등성 규칙: `DRY_RUN=true` 경로는 충전 상태를 변경하지 않는다.
- 순서 보장 규칙: 로그인 선행 후 충전 페이지 이동 → 금액 선택 → 키패드 인식 → 비밀번호 입력 순으로 수행한다.

## 비기능 요구
- 성능(SLO): 수치형 SLO 상수는 코드에 정의되어 있지 않다.
- 보안 요구: 충전 비밀번호/계정 비밀값은 환경 변수로만 주입한다.
- 타임아웃: 네비게이션 30초(withRetry 포함), 키패드 요소 대기 30초, 충전 완료 대기 60초.
- 동시성 요구: 단일 명령 실행 단위에서 순차 흐름으로 동작한다.

## 의존성 계약
- 내부 경계: `src/deposit/browser`, `src/deposit/browser/actions`, `src/deposit/commands`, `src/deposit/domain`, `src/deposit/services`, `src/shared/browser`, `src/shared/browser/actions`, `src/shared/config`, `src/shared/ocr`, `src/shared/services`, `src/shared/utils`.
- 외부 서비스: 동행복권 웹(충전 페이지, NProtect 키패드).
- 외부 라이브러리: Playwright, Tesseract.js.

## 수용 기준
- [ ] `deposit:charge` 명령이 로그인 선행 흐름으로 실행된다.
- [ ] `DRY_RUN` 값에 따라 실충전/OCR 테스트 경로가 분기된다.
- [ ] 키패드 OCR이 10개 숫자를 모두 인식한다(9/10 시 추론 포함).
- [ ] 이메일 설정이 있을 때만 전송을 시도한다.
- [ ] 실패 메일에 스크린샷/HTML 첨부가 포함된다.

## 오픈 질문
- 없음
