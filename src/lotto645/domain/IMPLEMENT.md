# lotto645/domain 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `ticket.ts`: 티켓 타입, 모드/슬롯 타입, 모드 라벨 함수, 날짜 유틸 re-export.
- `winning.ts`: 당첨 타입, 등수 라벨, 당첨 판정 및 일치번호 계산 함수.

## 호출 흐름
1. 상위 서비스가 티켓/당첨번호를 도메인 함수에 전달한다.
2. `checkWinning`이 일치 개수와 보너스 일치 여부를 계산한다.
3. 서비스 계층이 `getRankLabel`, `getMatchingNumbers`, `isWinning`으로 출력값을 구성한다.

## 핵심 알고리즘
- `checkWinning`:
  - `countMatches`로 일치 개수 계산.
  - 6/5+보너스/5/4/3/기타 순으로 등수 반환.
- `countMatches`:
  - 구매 번호를 `Set`으로 중복 제거 후 당첨번호 포함 여부를 필터링.

## 데이터 모델
- `PurchasedTicket`: 회차/슬롯/번호6개/모드/옵션 필드.
- `WinningNumbers`: 회차/추첨일/당첨번호6개/보너스.
- `WinningRank`: `rank1|rank2|rank3|rank4|rank5|none`.

## 외부 연동 정책
- 외부 서비스 연동 없음.
- timeout/retry/backoff/circuit breaker/idempotency key: 해당 없음.

## 설정
- 환경 변수 사용 없음.
- 파라미터 기반 순수 함수 호출.

## 예외 처리 전략
- 주요 함수에서 명시적 throw 없음.
- 입력 유효성 검사는 호출자 책임(이 경계는 계산 결과만 반환).

## 관측성
- 별도 로깅/메트릭 구현 없음.

## 테스트 설계
- 단위 테스트: `winning.test.ts`에서 등수 판정 규칙을 검증한다.
- `ticket.ts` 전용 테스트 파일은 저장소에서 확인되지 않는다.

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/lotto645/domain/winning.ts#checkWinning` | `src/lotto645/domain/winning.test.ts::returns rank1 when all six numbers match` |
| SCN-002 | `src/lotto645/domain/winning.ts#checkWinning` | `src/lotto645/domain/winning.test.ts::counts duplicate purchased numbers as one logical match` |

## 알려진 제약
- `Lotto645Mode`의 `semi-auto` 값은 타입에 존재하지만 현재 기본 구매 경로는 `auto` 중심으로 동작한다.

## 오픈 질문
- 없음
