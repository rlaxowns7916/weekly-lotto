# pension720/browser/actions
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 연금복권 720+ 브라우저 액션의 실행 계약을 제공한다.
구매, 구매내역 파싱, 당첨번호 조회를 함수 단위로 재사용 가능하게 한다.

## 기능 범위/비범위
- 포함: `purchasePension`, `checkRecentPurchase`, `verifyRecentPurchase`, `getTicketsByRound`, `getAllTicketsInWeek`, `fetchLatestPensionWinning`.
- 포함: 구매내역 모달(`Pt720TicketP`) 파싱 및 6자리 번호 추출.
- 비포함: 로그인, 브라우저 세션 생성, 이메일 전송.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - `Page`.
  - `dryRun`, `group`, `maxMinutes`, `targetRound`, `maxCount`.
- 필수/옵션:
  - `Page`는 필수.
  - `group`은 옵션(없으면 요일 기반 자동 선택).
- 유효성 규칙:
  - 조 번호는 1~5 범위만 유효하다.
  - 티켓/당첨 번호는 6자리 미충족 시 무효 처리한다.
- 출력 타입/필드:
  - `Promise<PurchasedPensionTicket[]>`, `Promise<PurchasedPensionTicket | null>`, `Promise<PensionWinningNumbers | null>`, `void`.

## 행동 시나리오
- SCN-001: Given 로그인된 세션, When `purchasePension`을 호출, Then `preCheckDone=true` and `verificationResult!=undefined`.
- SCN-002: Given 모달/슬라이더 파싱 실패, When 조회 함수가 실행, Then `errorExposed=true` and (`returnValue=null` or `exceptionRaised=true`).

## 오류 계약
- 에러 코드: 없음(명시적 에러 코드 상수 없음).
- HTTP status(해당 시): 없음(브라우저 자동화 컨텍스트).
- 재시도 가능 여부: 가능(`withRetry` 적용).
- 발생 조건: 페이지 이동 실패, 셀렉터 타임아웃, 티켓 파싱 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 회차별 조회 결과에는 동일 회차 티켓만 포함한다.
- 멱등성 규칙: `dryRun=true`에서는 실제 구매를 수행하지 않는다.
- 순서 보장 규칙: 구매 검증은 구매 실행 이후에 수행한다.

## 비기능 요구
- 성능(SLO): 코드에 별도 수치형 SLO 상수는 없다.
- 보안 요구: 민감 정보 저장 없음.
- 타임아웃: 이동 60초, 요소 대기 30초 내외.
- 동시성 요구: 단일 `Page` 기준 순차 실행 경로를 따른다.

## 의존성 계약
- 내부 경계: `src/pension720/domain`, `src/shared/browser/actions`, `src/shared/browser`, `src/shared/utils`.
- 외부 서비스: 동행복권 메인/모바일 구매/구매내역 페이지.
- 외부 라이브러리: Playwright.

## 수용 기준
- [ ] 실구매 경로가 선검증 -> 구매 -> 후검증 순서를 따른다.
- [ ] 티켓/당첨번호 파싱 함수가 타입 계약에 맞춰 값을 반환한다.
- [ ] 재시도/실패 노출 동작이 코드와 일치한다.
