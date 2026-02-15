# lotto645/browser/actions 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `purchase.ts`: 실구매/DRY RUN 분기, 선검증/후검증 구매 흐름.
- `check-purchase.ts`: 구매내역 이동, 모달 파싱, 회차/주간 조회, 요약 출력.
- `fetch-winning.ts`: 메인 슬라이더 기반 당첨번호 조회.

## 호출 흐름
1. `purchaseLotto` 호출 시 `dryRun` 여부를 판별한다.
2. 실구매는 `checkRecentPurchase` -> `executePurchase` -> `verifyRecentPurchase` 순서로 실행한다.
3. 조회 함수는 `navigateToPurchaseHistory` 후 바코드별 `getTicketDetails`를 반복 호출한다.
4. 당첨번호 조회는 메인 페이지 이동 후 슬라이드 파싱 함수를 호출한다.

## 핵심 알고리즘
- 티켓 파싱:
  - 모달 텍스트에서 회차/발행일/추첨일 추출.
  - `.ticket-num-box`에서 슬롯/모드/번호를 읽고 6개 번호 유효성 검사.
- 회차 조회:
  - 첫 티켓으로 대상 회차를 결정하거나 입력 회차 사용.
  - 최대 `maxCount * 2` 탐색으로 동일 회차 티켓을 수집.

## 데이터 모델
- `PurchasedTicket`을 주요 반환 타입으로 사용.
- 내부 파싱 모델 `TicketDetails`는 `PurchasedTicket` 확장(`barcode?`).
- 당첨조회 출력은 `WinningNumbers`.

## 외부 연동 정책
- 구매내역 연동은 shared `navigateToPurchaseHistory(LO40)`를 사용한다.
- retry/backoff: `withRetry` 사용.
- timeout: 페이지 이동 60초, 모달/요소 대기 5~30초.
- idempotency key/circuit breaker: 구현 없음.

## 설정
- `purchaseLotto(page, dryRun = true)` 함수 파라미터 기반 분기.
- `maxMinutes`, `maxCount`는 함수 인자/기본값으로 제어.

## 예외 처리 전략
- 실구매 경로 예외 시 `saveErrorScreenshot` 후 재던짐.
- 티켓 파싱 실패는 `null` 반환으로 상위 루프에서 건너뛴다.
- 당첨번호 조회 실패는 스크린샷 저장 후 `null` 반환한다.

## 관측성
- 구매/조회 단계별 로그와 파싱 실패 경고 로그를 출력한다.
- 오류 스크린샷 파일명에 액션 컨텍스트 prefix를 사용한다.

## 테스트 설계
- E2E: `tests/lotto645.spec.ts`가 모바일 구매 페이지와 구매내역 UI를 검증한다.
- 단위 테스트: 이 경계 파일 직접 단위 테스트는 없다.

## 모듈 인벤토리 (권장)
| 모듈 | 파일 | 역할 |
|---|---|---|
| purchase | `purchase.ts` | 실구매/DRY RUN 및 검증 |
| check-purchase | `check-purchase.ts` | 구매내역 조회/모달 파싱 |
| fetch-winning | `fetch-winning.ts` | 당첨번호 슬라이더 파싱 |

## 파일 계약 (핵심 파일 상세, 권장)
| 파일 | 외부 노출 심볼 | 입력 | 출력 | 오류/제약 |
|---|---|---|---|---|
| `purchase.ts` | `purchaseLotto` | `Page`, `dryRun` | `PurchasedTicket[]` | 실패 시 예외 전파 |
| `check-purchase.ts` | `getTicketsByRound`, `getAllTicketsInWeek` | `Page`, 조건값 | 티켓 배열 | 파싱 실패 시 `null`/건너뜀 |
| `fetch-winning.ts` | `fetchLatestWinningNumbers` | `Page` | `WinningNumbers|null` | 파싱 실패 시 `null` |

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/lotto645/browser/actions/purchase.ts#purchaseLotto` | `tests/lotto645.spec.ts::자동 1매 추가 클릭 후 번호가 생성된다` |
| SCN-002 | `src/lotto645/browser/actions/check-purchase.ts#getTicketDetails` | `tests/lotto645.spec.ts::구매하기 클릭 후 확인 팝업(#popupLayerConfirm)이 표시된다` |

## 변경 규칙 (권장)
- MUST: 파싱 규칙 변경 시 `check-purchase.ts`와 `fetch-winning.ts`를 함께 검토한다.
- MUST: 구매 플로우 변경 시 `purchase.ts`의 선검증/후검증 순서를 유지한다.
- MUST NOT: 예외 처리 경로에서 오류 노출(`null` 또는 throw)을 제거하지 않는다.
- 함께 수정할 테스트 목록: `tests/lotto645.spec.ts`.

## 알려진 제약
- CSS class/text 기반 파싱으로 외부 UI 변경에 민감하다.
