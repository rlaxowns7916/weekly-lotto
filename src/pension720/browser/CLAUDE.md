# pension720/browser
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 연금복권 720+ 브라우저 자동화 계약을 제공한다.
구매 셀렉터, 조 선택 규칙, 액션 사용 기준을 정의한다.

## 기능 범위/비범위
- 포함: 구매 URL/텍스트 셀렉터 및 요일별 조 선택 규칙 제공.
- 포함: 구매/구매내역/당첨번호 액션 제공.
- 비포함: CLI 오케스트레이션, 이메일 전송, 설정 스키마 검증.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - `Page`.
  - 조 번호(`PensionGroup`), 조회 조건(`targetRound`, `maxCount`, `maxMinutes`).
- 필수/옵션:
  - `Page`는 필수.
  - 조 번호는 옵션(미지정 시 요일별 계산).
- 유효성 규칙:
  - 조 번호는 1~5만 유효.
  - 당첨번호/티켓 번호 파싱은 6자리 규칙을 만족해야 유효.
- 출력 타입/필드:
  - `purchaseSelectors`, `getGroupByDayOfWeek`, `getDayName`.
  - `PurchasedPensionTicket` 목록/단건.
  - `PensionWinningNumbers | null`.

## 행동 시나리오
- SCN-001: Given 로그인된 세션, When 구매/조회/당첨번호 액션을 호출, Then `ticketsCount>=0` and `winningNumbersParsed=true`.
- SCN-002: Given DOM 또는 네트워크 문제가 발생, When 액션이 실패, Then `errorExposed=true` and (`returnValue=null` or `exceptionRaised=true`).

## 오류 계약
- 에러 코드: 없음(명시적 에러 코드 상수 없음).
- HTTP status(해당 시): 없음(브라우저 자동화 컨텍스트).
- 재시도 가능 여부: 가능(`withRetry` 적용 경로).
- 발생 조건: 페이지 진입 실패, 로케이터 대기 실패, 6자리 파싱 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 구매내역 조회는 LP72 필터를 기준으로 동작한다.
- 멱등성 규칙: `dryRun=true`인 구매 호출은 실제 구매 버튼 클릭 직전에 종료한다.
- 순서 보장 규칙: 구매 액션은 번호 선택 -> 조 선택 -> 자동번호 -> 선택완료 -> 구매 순서를 따른다.

## 비기능 요구
- 성능(SLO): 코드에 별도 수치형 SLO 상수는 없다.
- 보안 요구: 계정 정보는 상위 로그인 경계에서만 처리한다.
- 타임아웃: 이동 60초, 요소 대기 30초 내외.
- 동시성 요구: 단일 `Page` 호출 단위로 순차 실행을 가정한다.

## 의존성 계약
- 내부 경계: `src/pension720/browser/actions`, `src/shared/browser/actions`, `src/shared/browser`, `src/shared/utils`.
- 외부 서비스: `https://el.dhlottery.co.kr`, `https://www.dhlottery.co.kr`.
- 외부 라이브러리: Playwright.

## 수용 기준
- [ ] 구매 셀렉터/요일별 조 규칙이 코드와 일치한다.
- [ ] 연금복권 구매/조회/당첨번호 액션이 호출 가능하다.
- [ ] 실패 경로에서 재시도 및 실패 노출 정책이 일관된다.
