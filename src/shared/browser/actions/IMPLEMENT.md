# shared/browser/actions 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `login.ts`: 로그인 페이지 진입, 계정 입력, 성공/실패 판정, 재시도, 오류 스크린샷.
- `purchase-history.ts`: 구매내역 페이지 진입, 기간/상품 필터 적용, 바코드 locator 제공.

## 호출 흐름
1. 상위 커맨드/액션이 `login(page)`를 호출한다.
2. 로그인 성공 후 도메인 액션이 `navigateToPurchaseHistory(page, code)`를 호출한다.
3. 결과 페이지에서 도메인별 파서가 바코드/모달을 후속 처리한다.

## 핵심 알고리즘
- 로그인 알고리즘:
  - role selector로 아이디/비밀번호 입력 후 Enter 제출.
  - 로그아웃 버튼/오류 메시지/URL 상태를 `Promise.race`로 판정.
  - 재시도 대상 에러만 `withRetry`로 반복.
- 구매내역 이동 알고리즘:
  - 상세 검색 펼치기 -> 최근 1주일 -> 상품코드 선택 -> 검색 API 응답 대기.

## 데이터 모델
- `LotteryProductCode`: `LO40 | LP72`.
- `LOTTERY_PRODUCTS`: 상품코드/이름/모달ID/티켓 셀렉터 매핑.

## 외부 연동 정책
- 대상 URL: `/login`, `/mypage/mylotteryledger`.
- retry/backoff: `withRetry` 사용.
- timeout: 이동 60초, 요소 대기 10~60초.
- circuit breaker/idempotency key: 명시적 구현 없음.

## 설정
- `LOTTO_USERNAME`, `LOTTO_PASSWORD`가 없으면 로그인 실패 예외를 throw한다.
- 상품 필터는 함수 인자로 받은 `LotteryProductCode`를 사용한다.

## 예외 처리 전략
- 로그인 실패는 메시지 분기(자격증명 오류/타임아웃) 후 예외 전파.
- 구매내역 이동 실패는 스크린샷 저장 후 예외 전파.

## 관측성
- 로그인 성공 URL, 재시도, 구매내역 이동 완료 로그를 출력한다.
- 스크린샷 파일명을 컨텍스트별 prefix로 저장한다.

## 테스트 설계
- 간접 검증: `tests/login.spec.ts`, `tests/*645*.spec.ts`, `tests/pension720.spec.ts`.
- 직접 단위 테스트는 없다.

## 모듈 인벤토리 (권장)
| 모듈 | 파일 | 역할 |
|---|---|---|
| login action | `login.ts` | 로그인 성공/실패 판정 및 재시도 |
| purchase-history action | `purchase-history.ts` | 구매내역 이동/필터 적용/바코드 노출 |

## 파일 계약 (핵심 파일 상세, 권장)
| 파일 | 외부 노출 심볼 | 입력 | 출력 | 오류/제약 |
|---|---|---|---|---|
| `login.ts` | `login` | `Page` | `Promise<void>` | 계정 누락/실패 시 예외 전파 |
| `purchase-history.ts` | `navigateToPurchaseHistory`, `getBarcodeElements` | `Page`, `LotteryProductCode` | `Promise<void>`, `Locator` | 이동 실패 시 예외 전파 |

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/shared/browser/actions/login.ts#login` | `tests/login.spec.ts::유효한 자격 증명으로 로그인에 성공한다` |
| SCN-002 | `src/shared/browser/actions/login.ts#login` | `tests/login.spec.ts::잘못된 비밀번호로 로그인에 실패한다` |

## 변경 규칙 (권장)
- MUST: 로그인 판정 기준(로그아웃 버튼/오류 메시지/URL) 변경 시 성공/실패 테스트를 함께 갱신한다.
- MUST: 구매내역 이동 순서(상세검색 -> 최근1주일 -> 상품선택 -> 검색대기)를 유지한다.
- MUST NOT: 실패 경로의 스크린샷 저장 및 예외 전파를 제거하지 않는다.
- 함께 수정할 테스트 목록: `tests/login.spec.ts`, `tests/lotto645.spec.ts`, `tests/pension720.spec.ts`.

## 알려진 제약
- 로그인/구매내역 페이지 텍스트 및 role 기반 셀렉터 변경 시 동작이 깨질 수 있다.

## 오픈 질문
- 없음
