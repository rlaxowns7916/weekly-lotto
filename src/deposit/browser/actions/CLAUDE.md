# deposit/browser/actions
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 예치금 충전 브라우저 액션 구현의 함수 계약을 제공한다.
충전 실행, 키패드 OCR 인식, 비밀번호 입력을 재사용 가능한 단위로 보장한다.

## 기능 범위/비범위
- 포함: `chargeDeposit`, `readDepositBalance`, `recognizeKeypad`, `inputPassword`, `TesseractKeypadRecognizer`.
- 포함: Canvas 색상반전 기반 OCR 전처리.
- 포함: 9/10 인식 시 수학적 추론(0-9 중 유일 누락값 확정).
- 포함: 충전 전/후 예치금 잔액 조회 및 잔액 대조 기반 충전 발생 판정.
- 비포함: 로그인 실행, 브라우저 세션 생성/종료, 이메일 발송.
- 비포함: 잔액 판정 규칙 자체(도메인 경계 `verifyChargeByBalance`가 담당).

## 공개 인터페이스 계약
- 입력 타입/필드:
  - `Page`.
  - `dryRun: boolean` (기본값 `true`).
  - `password: string` (6자리 숫자).
  - `KeypadRecognizer` 인터페이스 (OCR 엔진 교체 가능).
- 필수/옵션:
  - `Page`는 필수.
  - `dryRun`은 옵션(기본값 `true`).
  - `recognizer`는 `recognizeKeypad` 함수에서 옵션(기본값 `TesseractKeypadRecognizer`). `chargeDeposit`는 내부에서 직접 생성.
- 유효성 규칙:
  - 키패드 인식 결과는 10개 숫자 모두 confidence >= 0.70일 때 유효.
  - 비밀번호의 각 숫자가 `KeypadDigitMap`에 존재해야 입력 가능.
  - `readDepositBalance`는 후보 셀렉터(`depositSelectors.balanceCandidates`)를 순서대로 시도하고, 모두 실패하면 본문 텍스트를 스캔한다.
  - `readDepositBalance`는 어떤 경우에도 예외를 던지지 않고 실패 시 `null`을 반환한다.
  - 충전 성공 판정은 완료 다이얼로그가 아니라 충전 전/후 잔액 대조를 1순위 근거로 사용한다.
- 출력 타입/필드:
  - `Promise<ChargeResult>` (`chargeDeposit`) — `balance`, `verification`, `dialogConfirmed` 포함.
  - `Promise<number | null>` (`readDepositBalance`).
  - `Promise<KeypadDigitMap>` (`recognizeKeypad`).
  - `Promise<void>` (`inputPassword`).

## 행동 시나리오
- SCN-001: Given 로그인된 세션, When `chargeDeposit(page, true)`를 호출, Then `status='dry_run'` and `keypadOcrConfidence>0.70`.
- SCN-002: Given 로그인된 세션과 유효 비밀번호, When `chargeDeposit(page, false)`를 호출, Then `status='success'` and `verification.verdict='charged'`.
- SCN-003: Given 키패드 OCR 3회 실패, When `recognizeKeypad`를 호출, Then `error.code='KEYPAD_OCR_FAILED'`.
- SCN-007: Given 완료 다이얼로그 타임아웃이지만 잔액이 충전 금액 이상 증가, When `chargeDeposit(page, false)`를 호출, Then `status='success'` and `dialogConfirmed=false` and `inputPasswordCallCount=1`.
- SCN-008: Given 완료 다이얼로그 타임아웃이고 잔액이 그대로, When `chargeDeposit(page, false)`를 호출, Then `error.code='DEPOSIT_CHARGE_FAILED'` and `error.retryable=true`.
- SCN-009: Given 잔액을 읽지 못하고 완료 다이얼로그도 확인 못 함, When `chargeDeposit(page, false)`를 호출, Then `error.code='DEPOSIT_VERIFICATION_FAILED'` and `error.retryable=false` and `inputPasswordCallCount=1`.
- SCN-010: Given 완료 다이얼로그는 확인됐지만 잔액을 읽지 못함, When `chargeDeposit(page, false)`를 호출, Then `status='success'` and `verification.verdict='unknown'`.
- SCN-011: Given 완료 다이얼로그는 확인됐는데 잔액이 그대로, When `chargeDeposit(page, false)`를 호출, Then `error.code='DEPOSIT_VERIFICATION_FAILED'` and `error.retryable=false`.
- SCN-012: Given `inputPassword`가 예외를 던졌지만 잔액이 충전 금액 이상 증가(마지막 탭에서 자동 제출됨), When `chargeDeposit(page, false)`를 호출, Then `status='success'` and `inputPasswordCallCount=1`.
- SCN-013: Given `inputPassword`가 예외를 던졌고 잔액이 그대로, When `chargeDeposit(page, false)`를 호출, Then `error.code='DEPOSIT_CHARGE_FAILED'` and `error.message contains 원본 입력 오류`.
- SCN-014: Given DRY_RUN 모드, When `chargeDeposit(page, true)`를 호출, Then `balance.before`가 수집되고 `balance.after=null` and 비밀번호 미제출. (실충전 전 잔액 조회 경로를 무료로 검증하기 위함)

## 오류 계약
- 에러 코드: `AUTH_INVALID_CREDENTIALS`, `NETWORK_NAVIGATION_TIMEOUT`, `KEYPAD_OCR_FAILED`, `DEPOSIT_CHARGE_FAILED`, `DEPOSIT_VERIFICATION_FAILED`.
- HTTP status(해당 시): 없음(브라우저 자동화 컨텍스트).
- 재시도 가능 여부: 조건부. `chargeDeposit`의 `shouldRetry`는 `AppError.retryable`만 신뢰하며 메시지 기반 기본 판별을 사용하지 않는다.
  - 비밀번호 제출 이전 오류(네비게이션/키패드): 재시도 가능.
  - 비밀번호 제출 이후: 잔액이 그대로(`DEPOSIT_CHARGE_FAILED`)일 때만 재시도 가능.
  - 판정 불가(`DEPOSIT_VERIFICATION_FAILED`): 재시도 불가(중복 충전 방지).
- 발생 조건: 충전 페이지 이동 실패, 키패드 컨테이너 미감지, OCR 인식 실패, 비밀번호 숫자 매핑 실패, 충전 미발생, 충전 결과 판정 불가.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 키패드는 0-9 각 숫자가 정확히 1회씩 존재한다(NProtect 불변식).
- 멱등성 규칙: `dryRun=true`이면 비밀번호 입력/충전 제출을 건너뛴다.
- 멱등성 규칙: 단일 `chargeDeposit` 호출에서 실제 충전 제출(`inputPassword`)은 잔액이 변하지 않은 것으로 확인된 경우에만 반복된다.
- 순서 보장 규칙: `prepareChargeAndRecognize` → (DRY_RUN 시 반환 / 실제 시 `충전 전 잔액 조회` → `inputPassword` → `완료 다이얼로그 대기` → `충전 후 잔액 조회` → `잔액 대조 판정`) 순서.
- 제약: `inputPassword` 호출 이후 코드는 예외를 밖으로 던지지 않는다. raw 오류가 새어 나가면 상위 `withRetry`가 충전 전체를 재실행해 중복 충전이 발생한다.

## 비기능 요구
- 성능(SLO): 코드에 별도 수치형 SLO 상수는 없다.
- 보안 요구: 비밀번호 자릿수/값은 로그에 노출하지 않는다.
- 타임아웃: 네비게이션 30초(withRetry 4회), 키패드 대기 30초, 충전 완료 다이얼로그 60초.
- 동시성 요구: 단일 `Page` 기준 순차 실행 경로를 따른다.

## 의존성 계약
- 내부 경계: `src/deposit/domain`, `src/deposit/domain/balance`, `src/deposit/browser/selectors`, `src/shared/browser/context`, `src/shared/utils/error`, `src/shared/utils/retry`, `src/shared/config`.
- 외부 서비스: 동행복권 충전 페이지, NProtect NPPFS 키패드.
- 외부 라이브러리: Playwright, Tesseract.js.

## 수용 기준
- [ ] `chargeDeposit`이 DRY_RUN/실제 충전 경로를 분기한다.
- [ ] 완료 다이얼로그 타임아웃만으로 충전 실패를 단정하지 않는다.
- [ ] 잔액이 충전 금액 이상 증가하면 다이얼로그 확인 없이도 성공으로 판정한다.
- [ ] 잔액이 그대로일 때만 충전 제출을 재시도한다.
- [ ] 판정 불가 상태에서는 재시도 없이 `DEPOSIT_VERIFICATION_FAILED`로 종료한다.
- [ ] `readDepositBalance`가 실패해도 예외를 던지지 않고 `null`을 반환한다.
- [ ] 키패드 OCR이 10개 숫자를 모두 인식한다(9/10 시 추론 포함).
- [ ] 비밀번호 입력이 `element.tap()`으로 수행된다(모바일 에뮬레이션 호환).
- [ ] 네비게이션 재시도가 `withRetry`를 사용한다.
- [ ] `KeypadRecognizer` 인터페이스로 OCR 엔진 교체가 가능하다.
