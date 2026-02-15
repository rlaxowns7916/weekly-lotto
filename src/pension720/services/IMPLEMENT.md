# pension720/services 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `winning-check.service.ts`: 연금복권 티켓 당첨 집계와 콘솔 출력.
- `email.templates.ts`: 구매/실패/당첨 결과 이메일 템플릿 생성.

## 호출 흐름
1. 상위 커맨드가 티켓과 당첨번호를 서비스에 전달한다.
2. 집계 함수가 티켓별 등수/일치정보를 계산하고 요약 문자열을 생성한다.
3. 템플릿 함수가 결과를 subject/html/text로 변환한다.

## 핵심 알고리즘
- 집계:
  - 티켓마다 `checkPensionWinning` 결과와 `matchInfo` 계산.
  - 등수별 카운트를 합산하여 summary 생성.
- 템플릿:
  - 당첨 여부에 따라 헤더 색상/제목/subject를 분기.
  - 오류 문자열은 `escapeHtml` 처리.

## 데이터 모델
- `PensionTicketWinningResult`, `PensionWinningCheckResult`.
- 템플릿 반환 타입 `{ subject, html, text }`.

## 외부 연동 정책
- 외부 서비스 직접 연동 없음.
- timeout/retry/backoff/circuit breaker/idempotency key: 해당 없음.

## 설정
- 환경 변수 직접 읽기 없음.
- 상위 경계가 전송 여부를 결정한다.

## 예외 처리 전략
- 집계/템플릿 함수는 명시적 throw 없이 결과 객체를 반환한다.
- 예외 상황 세부 처리의 명시적 throw 경로는 없다.

## 관측성
- `printWinningResult`에서 회차/당첨번호/티켓별 결과/요약을 출력.
- 메트릭/트레이싱 구현은 없다.

## 테스트 설계
- 도메인 판정 테스트(`src/pension720/domain/winning.test.ts`)로 간접 검증.
- 서비스 단위 테스트: `src/pension720/services/winning-check.service.test.ts`.

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/pension720/services/winning-check.service.ts#checkTicketsWinning` | `src/pension720/services/winning-check.service.test.ts::returns summary with winnerCount less than or equal to totalCount` |
| SCN-002 | `src/pension720/services/email.templates.ts#winningResultTemplate` | `src/pension720/services/winning-check.service.test.ts::builds losing result template with subject containing 낙첨 and html containing summary` |

## 알려진 제약
- 메일 클라이언트별 HTML 렌더링 차이가 발생할 수 있다.

## 오픈 질문
- 없음
