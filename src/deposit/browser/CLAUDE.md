# deposit/browser
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 예치금 충전 UI 자동화용 브라우저 계약을 제공한다.
충전 페이지 셀렉터와 키패드 OCR/충전 액션 조합의 공개 기준을 정의한다.

## 기능 범위/비범위
- 포함: 충전 페이지 URL/금액/버튼/키패드/다이얼로그 셀렉터 상수 제공.
- 포함: 충전 실행, 키패드 OCR 인식, 비밀번호 입력 액션 제공.
- 비포함: CLI 실행 오케스트레이션, 이메일 전송, 환경 변수 검증.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - `Page`.
  - `dryRun`, `depositAmount`, `depositPassword`.
- 필수/옵션:
  - `Page`는 필수.
  - `dryRun`은 옵션(기본값 `true`).
- 유효성 규칙:
  - 충전 금액은 `#EcAmt` select 요소의 허용 값(5000~150000) 범위에서 선택.
  - 키패드 OCR 인식은 10개 숫자 모두 confidence >= 0.70일 때 유효.
- 출력 타입/필드:
  - `depositSelectors` 상수.
  - `ChargeResult`.
  - `KeypadDigitMap`.

## 행동 시나리오
- SCN-001: Given 로그인된 세션, When `chargeDeposit`를 호출, Then `keypadOcrConfidence>0` and (`status='dry_run'` or `status='success'`).
- SCN-002: Given 외부 DOM 또는 네트워크 오류, When 액션 실행 중 예외 발생, Then `error.code!=null` and `exceptionRaised=true`.

## 오류 계약
- 에러 코드: `AUTH_INVALID_CREDENTIALS`, `NETWORK_NAVIGATION_TIMEOUT`, `KEYPAD_OCR_FAILED`.
- HTTP status(해당 시): 없음.
- 재시도 가능 여부: 가능(`withRetry` 적용).
- 발생 조건: 충전 페이지 이동 실패, 키패드 컨테이너 미표시, OCR 인식 실패, 비밀번호 숫자 매핑 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 키패드 인식은 0-9 각 숫자가 정확히 1회씩 존재하는 불변식을 활용한다.
- 멱등성 규칙: `dryRun=true`이면 비밀번호 입력을 건너뛴다.
- 순서 보장 규칙: 페이지 이동 → 금액 선택 → 충전 버튼 → 키패드 OCR → 비밀번호 입력 순서를 따른다.

## 비기능 요구
- 성능(SLO): 코드에 별도 수치형 SLO 상수는 없다.
- 보안 요구: 비밀번호는 `Page` 상호작용으로만 사용하며 로그/스크린샷에 노출하지 않는다.
- 타임아웃: 네비게이션 30초(withRetry), 요소 대기 30초, 충전 완료 60초.
- 동시성 요구: 단일 `Page` 기준 순차 실행 경로를 따른다.

## 의존성 계약
- 내부 경계: `src/deposit/browser/actions`, `src/deposit/domain`, `src/shared/browser`, `src/shared/utils`.
- 외부 서비스: `https://www.dhlottery.co.kr/mypage/mndpChrg`, NProtect NPPFS 키패드.
- 외부 라이브러리: Playwright, Tesseract.js.

## 수용 기준
- [ ] 충전 페이지 셀렉터 상수가 코드와 일치한다.
- [ ] 충전/OCR/비밀번호 입력 액션이 `Page` 입력으로 호출 가능하다.
- [ ] 실패 경로에서 재시도 및 명시적 실패 반환이 수행된다.
