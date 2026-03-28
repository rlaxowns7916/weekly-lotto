# deposit/browser/actions
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 예치금 충전 브라우저 액션 구현의 함수 계약을 제공한다.
충전 실행, 키패드 OCR 인식, 비밀번호 입력을 재사용 가능한 단위로 보장한다.

## 기능 범위/비범위
- 포함: `chargeDeposit`, `recognizeKeypad`, `inputPassword`, `TesseractKeypadRecognizer`.
- 포함: Canvas 색상반전 기반 OCR 전처리.
- 포함: 9/10 인식 시 수학적 추론(0-9 중 유일 누락값 확정).
- 비포함: 로그인 실행, 브라우저 세션 생성/종료, 이메일 발송.

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
- 출력 타입/필드:
  - `Promise<ChargeResult>` (`chargeDeposit`).
  - `Promise<KeypadDigitMap>` (`recognizeKeypad`).
  - `Promise<void>` (`inputPassword`).

## 행동 시나리오
- SCN-001: Given 로그인된 세션, When `chargeDeposit(page, true)`를 호출, Then `status='dry_run'` and `keypadOcrConfidence>0.70`.
- SCN-002: Given 로그인된 세션과 유효 비밀번호, When `chargeDeposit(page, false)`를 호출, Then `status='success'` and 충전 내역 검증 완료.
- SCN-003: Given 키패드 OCR 3회 실패, When `recognizeKeypad`를 호출, Then `error.code='KEYPAD_OCR_FAILED'`.

## 오류 계약
- 에러 코드: `AUTH_INVALID_CREDENTIALS`, `NETWORK_NAVIGATION_TIMEOUT`, `KEYPAD_OCR_FAILED`.
- HTTP status(해당 시): 없음(브라우저 자동화 컨텍스트).
- 재시도 가능 여부: 가능(네비게이션 `withRetry`, 키패드 OCR 최대 3회, 전체 충전 `withRetry` 최대 3회).
- 발생 조건: 충전 페이지 이동 실패, 키패드 컨테이너 미감지, OCR 인식 실패, 비밀번호 숫자 매핑 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 키패드는 0-9 각 숫자가 정확히 1회씩 존재한다(NProtect 불변식).
- 멱등성 규칙: `dryRun=true`이면 비밀번호 입력/충전 제출을 건너뛴다.
- 순서 보장 규칙: `prepareChargeAndRecognize` → (DRY_RUN 시 반환 / 실제 시 `inputPassword` → 완료 대기) 순서.

## 비기능 요구
- 성능(SLO): 코드에 별도 수치형 SLO 상수는 없다.
- 보안 요구: 비밀번호 자릿수/값은 로그에 노출하지 않는다.
- 타임아웃: 네비게이션 30초(withRetry 4회), 키패드 대기 30초, 충전 완료 다이얼로그 60초.
- 동시성 요구: 단일 `Page` 기준 순차 실행 경로를 따른다.

## 의존성 계약
- 내부 경계: `src/deposit/domain`, `src/deposit/browser/selectors`, `src/shared/browser/context`, `src/shared/utils/error`, `src/shared/utils/retry`, `src/shared/config`.
- 외부 서비스: 동행복권 충전 페이지, NProtect NPPFS 키패드.
- 외부 라이브러리: Playwright, Tesseract.js.

## 수용 기준
- [ ] `chargeDeposit`이 DRY_RUN/실제 충전 경로를 분기한다.
- [ ] 키패드 OCR이 10개 숫자를 모두 인식한다(9/10 시 추론 포함).
- [ ] 비밀번호 입력이 `element.tap()`으로 수행된다(모바일 에뮬레이션 호환).
- [ ] 네비게이션 재시도가 `withRetry`를 사용한다.
- [ ] `KeypadRecognizer` 인터페이스로 OCR 엔진 교체가 가능하다.
