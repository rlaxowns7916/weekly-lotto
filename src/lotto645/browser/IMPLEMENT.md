# lotto645/browser 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `selectors.ts`: 로또 모바일 구매 URL 및 버튼/팝업 셀렉터 상수.
- `actions/purchase.ts`: 구매 실행/DRY RUN/구매 검증 조합.
- `actions/check-purchase.ts`: 구매내역 조회 및 티켓 파싱.
- `actions/fetch-winning.ts`: 메인 슬라이더 당첨번호 파싱.

## 호출 흐름
1. 상위 커맨드가 액션 함수를 호출한다.
2. 구매 계열은 `purchase.ts`에서 필요 시 `check-purchase.ts` 검증 함수를 호출한다.
3. 조회 계열은 구매내역 페이지 이동 후 모달 파싱으로 티켓 데이터를 생성한다.
4. 당첨번호 조회는 메인 페이지 이동 후 슬라이더 파싱을 수행한다.

## 핵심 알고리즘
- 구매 알고리즘:
  - 최근 구매 존재 여부 확인.
  - 없으면 구매 클릭 플로우 실행.
  - 구매 후 최근 N분 내 티켓 존재 여부로 검증.
- 당첨번호 파싱 알고리즘:
  - active 슬라이드를 우선 선택.
  - 없으면 마지막 슬라이드를 fallback으로 사용.
  - 숫자 7개(보너스 포함) 파싱 후 결과 생성.

## 데이터 모델
- 출력 모델: `PurchasedTicket`, `WinningNumbers`.
- 입력/중간 데이터: 로케이터 텍스트, 회차/발행일/번호 배열.

## 외부 연동 정책
- 대상 URL: `https://ol.dhlottery.co.kr/.../game645.do`, `https://www.dhlottery.co.kr/main`.
- timeout: 이동 60초, 요소 대기 10~30초.
- retry/backoff: `withRetry` 사용.
- circuit breaker/idempotency key: 구현 없음.

## 설정
- 직접 읽는 환경 변수는 없고 상위 경계에서 전달된 인자를 사용한다.
- `dryRun`은 함수 파라미터로 전달된다.

## 예외 처리 전략
- 주요 액션은 실패 시 스크린샷 저장 후 예외를 전파한다.
- 파싱 보조 함수는 실패 시 `null` 반환 경로를 제공한다.

## 관측성
- 단계별 `console.log`/`console.warn`/`console.error`를 출력한다.
- 오류 스크린샷은 `screenshots/` 경로에 저장한다.

## 테스트 설계
- 간접 검증: `tests/lotto645.spec.ts`에서 모바일 구매/구매내역/당첨번호 조회를 검증.
- 단위 검증: 경계 내 직접 테스트 파일은 없다.

## 모듈 인벤토리 (권장)
| 모듈 | 파일 | 역할 |
|---|---|---|
| selectors | `selectors.ts` | 구매 셀렉터/URL 상수 |
| purchase actions | `actions/purchase.ts` | 구매 실행/검증 |
| check actions | `actions/check-purchase.ts` | 구매내역 조회/모달 파싱 |
| winning actions | `actions/fetch-winning.ts` | 당첨번호 슬라이더 파싱 |

## 파일 계약 (핵심 파일 상세, 권장)
| 파일 | 외부 노출 심볼 | 입력 | 출력 | 오류/제약 |
|---|---|---|---|---|
| `selectors.ts` | `purchaseSelectors` | 없음 | 셀렉터 상수 | DOM 변경 시 갱신 필요 |
| `actions/purchase.ts` | `purchaseLotto` | `Page`, `dryRun` | `PurchasedTicket[]` | 실패 시 예외 전파 |
| `actions/check-purchase.ts` | `getTicketsByRound` 등 | `Page`, 회차/개수 | 티켓 배열 | 파싱 실패 시 빈 결과/예외 |
| `actions/fetch-winning.ts` | `fetchLatestWinningNumbers` | `Page` | `WinningNumbers|null` | 슬라이더 파싱 실패 시 `null` |

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/lotto645/browser/actions/purchase.ts#purchaseLotto` | `tests/lotto645.spec.ts::모바일 구매 페이지에 접근할 수 있다` |
| SCN-002 | `src/lotto645/browser/actions/fetch-winning.ts#fetchLatestWinningNumbers` | `tests/lotto645.spec.ts::구매하기 클릭 후 확인 팝업(#popupLayerConfirm)이 표시된다` |

## 변경 규칙 (권장)
- MUST: 셀렉터/파싱 로직 변경 시 `tests/lotto645.spec.ts`를 함께 갱신한다.
- MUST: 구매 검증 흐름 변경 시 `actions/purchase.ts`와 `actions/check-purchase.ts`를 함께 점검한다.
- MUST NOT: `dryRun=true` 경로에서 실구매 클릭을 수행하지 않는다.
- 함께 수정할 테스트 목록: `tests/lotto645.spec.ts`.

## 알려진 제약
- 외부 DOM 구조/텍스트 변경 시 셀렉터 및 파싱 로직 수정이 필요하다.
