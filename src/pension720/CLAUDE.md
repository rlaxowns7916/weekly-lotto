# pension720
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 연금복권 720+ 구매/조회/당첨확인의 도메인 통합 계약을 정의한다.
하위 경계(browser, commands, domain, services)를 조합해 조 선택 규칙과 당첨 계산 규칙을 일관되게 보장한다.

## 기능 범위/비범위
- 포함: `pension:buy`, `pension:check`, `pension:check-result` 실행 흐름 제공.
- 포함: 연금복권 조/6자리 번호 기반 구매내역 파싱 및 당첨 집계 제공.
- 포함: 결과 콘솔 출력과 조건부 이메일 템플릿 생성.
- 비포함: 공통 로그인/브라우저 세션 생성/SMTP 전송 구현.
- 비포함: 동행복권 DOM 안정성 또는 외부 네트워크 품질 보장.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - 실행 인터페이스: `package.json` scripts (`pension:buy`, `pension:check`, `pension:check-result`).
  - 런타임 입력: Playwright `Page`, `DRY_RUN`, `PENSION_GROUP`, 로그인/이메일 환경 변수.
- 필수/옵션:
  - 로그인/조회/당첨확인 흐름에서 계정 변수(`LOTTO_USERNAME`, `LOTTO_PASSWORD`)는 필수.
  - `PENSION_GROUP`은 옵션이며 1~5 범위 값일 때만 구매 그룹으로 반영된다.
  - 이메일 전송은 `hasEmailConfig()`가 `true`일 때만 활성화.
- 유효성 규칙:
  - `DRY_RUN=false`일 때만 실제 구매 버튼 경로를 진행한다.
  - 번호는 조(1~5) + 6자리 문자열 계약을 따른다.
- 출력 타입/필드:
  - 구매/조회 티켓 목록, 당첨 집계 결과, 콘솔 로그.
  - 선택적 이메일 전송 결과(`success`, `messageId` 또는 `error`).

## 행동 시나리오
- SCN-001: Given 유효 계정과 정상 페이지 상태, When `pension:*` 명령을 실행, Then `processExitCode=0` and `output contains "완료"`.
- SCN-002: Given 로그인/페이지 파싱/이메일 전송 중 오류, When 명령이 예외를 처리, Then `processExitCode=1` or `earlyReturn=true` and `output contains "실패"`.

## 오류 계약
- 에러 코드: 고정 에러 코드 상수는 없다(오류 메시지 기반 처리).
- HTTP status(해당 시): 없음(CLI + 브라우저 자동화 컨텍스트).
- 재시도 가능 여부: 일부 가능(`withRetry`가 적용된 하위 액션 경로).
- 발생 조건: 로그인 실패, 구매/조회 셀렉터 대기 실패, 당첨번호 파싱 실패, 이메일 전송 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 각 명령은 브라우저 세션 생성 후 `finally`에서 종료를 시도한다.
- 멱등성 규칙: `DRY_RUN=true` 경로는 결제 상태를 변경하지 않는다.
- 순서 보장 규칙: 로그인 선행 후 구매/조회/당첨확인 단계를 수행한다.

## 비기능 요구
- 성능(SLO): 수치형 SLO 상수는 코드에 정의되어 있지 않다.
- 보안 요구: 계정/이메일 비밀값은 환경 변수로만 주입한다.
- 타임아웃: 하위 Playwright 액션의 이동 60초, 요소 대기 30초 내외 정책을 따른다.
- 동시성 요구: 단일 명령 실행 단위에서 순차 흐름으로 동작한다.

## 의존성 계약
- 내부 경계: `src/pension720/browser`, `src/pension720/browser/actions`, `src/pension720/commands`, `src/pension720/domain`, `src/pension720/services`, `src/shared/browser`, `src/shared/browser/actions`, `src/shared/config`, `src/shared/services`, `src/shared/utils`.
- 외부 서비스: 동행복권 메인/모바일 구매/구매내역 페이지.
- 외부 라이브러리: Playwright.

## 수용 기준
- [ ] `pension:*` 명령이 로그인 선행 흐름으로 실행된다.
- [ ] `DRY_RUN` 값에 따라 실구매/테스트 경로가 분기된다.
- [ ] `PENSION_GROUP` 유효값(1~5)일 때 조 지정이 적용된다.
- [ ] 조회/당첨확인 결과가 도메인 타입 계약과 일치한다.

## 오픈 질문
- 없음
