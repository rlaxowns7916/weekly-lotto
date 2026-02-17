# lotto645/services
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 로또 6/45 결과를 사용자 출력/알림 포맷으로 변환하는 계약을 제공한다.
당첨 집계 결과와 이메일 템플릿 생성 기준을 정의한다.

## 기능 범위/비범위
- 포함: `checkTicketsWinning`, `printWinningResult` 제공.
- 포함: 구매 성공/실패/당첨 결과 이메일 템플릿 생성.
- 비포함: SMTP 전송 실행, 브라우저 자동화 실행.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - `PurchasedTicket[]`, `WinningNumbers`, 오류 문자열.
- 필수/옵션:
  - 집계 함수 입력 티켓/당첨번호는 필수.
  - 템플릿의 `text` 필드는 구현상 항상 생성되나 계약상 선택적으로 소비 가능.
- 유효성 규칙:
  - 집계 결과는 `winnerCount <= totalCount`를 만족한다.
  - HTML 템플릿은 입력 텍스트를 `escapeHtml`로 이스케이프한다.
- 출력 타입/필드:
  - `WinningCheckResult`.
  - `{ subject, html, text }` 이메일 콘텐츠.

## 행동 시나리오
- SCN-001: Given 티켓 목록과 당첨번호, When `checkTicketsWinning` 호출, Then `winnerCount<=totalCount` and `round=winningNumbers.round`.
- SCN-002: Given 구매/당첨 실패 문맥, When 실패 템플릿 생성 함수 호출, Then `subject contains "실패"` and `html contains errorMessage`.

## 오류 계약
- 에러 코드: 없음(명시적 코드 상수 없음).
- HTTP status(해당 시): 없음.
- 재시도 가능 여부: 해당 없음(순수 계산/문자열 생성).
- 발생 조건: 명시적 throw 경로 없이 실패 템플릿/집계 결과를 반환한다.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 집계 결과 `round`는 입력 `winningNumbers.round`와 동일하다.
- 멱등성 규칙: 동일 입력에서 동일 집계/템플릿을 생성한다.
- 순서 보장 규칙: 티켓 집계는 입력 배열 순서를 유지한다.

## 비기능 요구
- 성능(SLO): 동기 집계/문자열 생성 경계로 별도 수치형 SLO를 정의하지 않는다.
- 보안 요구: 이메일 템플릿에서 사용자 입력 오류 문자열은 이스케이프 처리한다.
- 타임아웃: 해당 없음.
- 동시성 요구: 공유 상태 없음.

## 의존성 계약
- 내부 경계: `src/lotto645/domain`, `src/shared/utils/date`, `src/shared/utils/html`.
- 외부 서비스: 없음.
- 외부 라이브러리: 없음.

```mermaid
flowchart LR
    THIS["src/lotto645/services"]:::current
    THIS -->|"내부 계약 3건"| INTERNAL["내부 경계"]
    THIS -.->|"외부 연동 1건"| EXTERNAL["외부 서비스"]
    THIS -.->|"라이브러리 1건"| LIB["외부 라이브러리"]
    classDef current stroke-width:3px
```
## 수용 기준
- [ ] 당첨 집계 결과가 티켓별 판정과 요약을 포함한다.
- [ ] 콘솔 출력 함수가 집계 결과를 사람이 읽을 수 있는 형태로 출력한다.
- [ ] 구매/실패/당첨 템플릿이 subject/html/text를 모두 반환한다.
