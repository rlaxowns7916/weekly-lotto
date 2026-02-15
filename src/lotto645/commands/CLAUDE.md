# lotto645/commands
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 로또 6/45 실행 커맨드의 진입 계약을 제공한다.
로그인 이후 구매/조회/당첨확인 흐름을 CLI 단위로 오케스트레이션한다.

## 기능 범위/비범위
- 포함: `buy.ts`, `check.ts`, `check-result.ts` 실행 흐름.
- 포함: 구매/당첨 확인 결과 콘솔 출력 및 조건부 이메일 전송.
- 비포함: 도메인 등수 계산 로직 구현, SMTP 전송 구현.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - 실행 인터페이스: `npm run lotto:buy`, `npm run lotto:check`, `npm run lotto:check-result`.
  - 환경 변수: `DRY_RUN`, `LOTTO_USERNAME`, `LOTTO_PASSWORD`, `LOTTO_EMAIL_*`.
- 필수/옵션:
  - 로그인 계정은 로그인 필요 명령에서 필수.
  - 이메일 설정은 옵션이며 없으면 전송을 건너뛴다.
- 유효성 규칙:
  - `DRY_RUN`이 `'false'`일 때만 실제 구매를 시도한다.
  - 당첨 확인은 추첨일이 당일이 아니면 조기 종료한다.
- 출력 타입/필드:
  - 콘솔 로그.
  - 실패 시 `process.exit(1)`.
  - 조건부 이메일 전송 결과.

## 행동 시나리오
- SCN-001: Given 유효 계정과 정상 네트워크, When `lotto:*` 명령 실행, Then `processExitCode=0` and `output contains "완료"`.
- SCN-002: Given 로그인/구매/당첨조회 중 예외 발생, When 커맨드가 실패를 감지, Then `processExitCode=1` and `output contains "실패"`.

## 오류 계약
- 에러 코드: 없음(명시적 에러 코드 상수 없음).
- HTTP status(해당 시): 없음.
- 재시도 가능 여부: 일부 가능(하위 액션의 재시도 유틸 사용).
- 발생 조건: 로그인 실패, 구매 검증 실패, 당첨번호 조회 실패, 이메일 전송 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 각 커맨드는 브라우저 세션 생성 후 `finally`에서 종료를 시도한다.
- 멱등성 규칙: `lotto:buy`는 `DRY_RUN=true`에서 결제 상태를 변경하지 않는다.
- 순서 보장 규칙: 커맨드는 로그인 후 도메인 액션을 호출한다.

## 비기능 요구
- 성능(SLO): 코드에 별도 수치형 SLO 상수는 없다.
- 보안 요구: 계정/SMTP 비밀은 환경 변수로만 주입한다.
- 타임아웃: 하위 Playwright 액션 타임아웃 정책을 따른다.
- 동시성 요구: 명령 단위로 단일 브라우저 세션 순차 실행을 따른다.

## 의존성 계약
- 내부 경계: `src/lotto645/browser/actions`, `src/lotto645/services`, `src/shared/browser`, `src/shared/browser/actions`, `src/shared/services`, `src/shared/utils`.
- 외부 서비스: 동행복권 웹, SMTP 서버.
- 외부 라이브러리: Node.js 런타임, Playwright.

## 수용 기준
- [ ] `lotto:*` 명령이 코드에 정의된 흐름대로 실행된다.
- [ ] 실패 시 종료 코드 1과 오류 로그가 노출된다.
- [ ] 이메일 설정이 있을 때만 메일 전송을 시도한다.
