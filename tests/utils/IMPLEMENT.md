# tests/utils 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `site-availability.ts`: 점검 문구 감지(`skipIfSiteMaintenance`)와 네트워크 가드(`attachNetworkGuard`)를 제공한다.
- `purchase-history.ts`: 구매내역 상세 검색 열기, 최근 1주일 버튼 확보, 팝업 dismiss, 접근 가능성 검증을 제공한다.
- `failure-diagnostics.ts`: 실패 시점 진단 정보 생성(`buildFailureReason`), OCR 힌트 매핑, attachment 상태 검증 컨텍스트 생성을 제공한다.

## 호출 흐름
1. 테스트 코드가 `attachNetworkGuard`로 페이지 이동을 래핑한다.
2. 시나리오 중 점검 문구/구매내역 접근 여부를 헬퍼로 판단한다.
3. 핵심 locator 대기 시 `waitVisibleWithReason` 호출.
4. 실패하면 `buildFailureReason`으로 상태 문자열 생성 후 `testInfo.attach`로 기록하고 throw.
5. OCR/HTML 아티팩트 검증이 필요한 케이스는 diagnostics와 함께 힌트/첨부 상태 필드를 기록한다.

## 핵심 알고리즘
- 네트워크 가드:
  - `page.goto`를 monkey patch한다.
  - 네트워크 계열 에러를 분류해 최대 `maxRetries`까지 재시도.
  - 최종 실패 시 URL 포함 메시지로 skip.
- 진단 문자열 생성:
  - 프로브 목록 순회 -> selector `count`/`visible` 수집.
  - URL/title/login 여부/점검 문구를 합성해 단일 문자열 생성.
- OCR/첨부 상태 생성:
  - OCR 힌트 코드와 diagnostics 매핑 코드를 함께 생성.
  - 첨부 용량 정책 검증용 `attachmentStatus` 필드를 포함.

## 데이터 모델
- `NetworkGuardOptions`: `maxRetries`, `retryDelayMs`.
- `SelectorProbe`: `label`, `query`.
- `SelectorProbeResult`: `label`, `count`, `visible`.
- `ArtifactDiagnostic`: `ocrHintCode`, `mappedErrorCode`, `attachmentStatus`.

## 외부 연동 정책
- 동행복권 웹 접근 실패는 재시도 후 skip으로 처리한다.
- timeout/retry/backoff는 고정 지연 재시도(`retryDelayMs`)를 사용한다.
- circuit breaker/idempotency key는 적용하지 않는다.

## 설정
- `attachNetworkGuard` 기본값: `maxRetries=2`, `retryDelayMs=2000`.
- 점검 감지 indicator는 `maintenanceIndicators` 상수로 관리한다.
- diagnostics 프로브 목록은 호출자(test file)에서 전달한다.

## 예외 처리 전략
- 네트워크 오류 분류 불가 시 원본 에러를 재던진다.
- visible 대기 실패 시 diagnostics를 남긴 뒤 컨텍스트 포함 에러를 던진다.
- 구매내역 헬퍼에서 전제조건 불충족은 skip 또는 null 반환으로 처리한다.

## 실패 상세 진단 구현 정책
- `buildFailureReason` 출력은 운영 분류 매핑에 필요한 `context`, `maintenance`, `selectors`를 항상 포함한다.
- `waitVisibleWithReason` 실패 메시지는 원본 오류와 진단 문자열을 함께 보존해 코드 분류 회귀 테스트에 사용한다.
- 민감정보 마스킹 규칙(`secretLeakCount=0`) 검증을 위한 필드 제약을 유지한다.
- OCR/첨부 검증 케이스는 `ocrHintCode`와 `attachmentStatus`를 동시에 기록해 상관관계 회귀를 보장한다.

## 관측성
- diagnostics attachment 이름: `${context}-diagnostics`.
- diagnostics 필드: `context`, `url`, `title`, `isLoginPage`, `maintenance`, `selectors`.
- 네트워크 실패 skip 메시지에 대상 URL과 원본 메시지를 포함한다.
- OCR/첨부 검증 필드: `ocrHintCode`, `mappedErrorCode`, `attachmentStatus`.

## 테스트 설계
- 이 경계는 독립 테스트 파일보다는 E2E 시나리오에서 간접 검증된다.
- 필수 검증 포인트:
  - 네트워크 장애 시 재시도 후 skip.
  - 점검 문구 노출 시 skip.
  - locator 대기 실패 시 diagnostics attachment 생성.
- 시나리오-테스트 매핑 규칙:
  - SCN-001 -> 로그인/구매내역 시나리오의 helper 통합 동작.
  - SCN-002 -> 모바일 구매 버튼/팝업 visible 실패 케이스 진단.

## 모듈 인벤토리 (권장)
| 모듈 | 파일 | 역할 |
|---|---|---|
| site availability | `site-availability.ts` | 점검 감지/네트워크 가드 |
| purchase history helper | `purchase-history.ts` | 구매내역 UI 접근 보조 |
| failure diagnostics | `failure-diagnostics.ts` | 실패 진단 문자열/대기 래퍼 |

## 파일 계약 (핵심 파일 상세, 권장)
| 파일 | 외부 노출 심볼 | 입력 | 출력 | 오류/제약 |
|---|---|---|---|---|
| `site-availability.ts` | `attachNetworkGuard`, `skipIfSiteMaintenance` | `Page`, 옵션 | skip 처리/래핑된 이동 | 재시도 초과 시 skip |
| `purchase-history.ts` | `openPurchaseHistoryPanel`, `getRecentWeekButton`, `dismissAlertIfPresent`, `ensurePurchaseHistoryAccessible` | `Page`, `TestInfo` | `Locator | null`, `boolean` | 전제조건 미충족 시 skip 또는 `null` |
| `failure-diagnostics.ts` | `buildFailureReason`, `waitVisibleWithReason` | `Page`, `Locator`, `TestInfo`, probe 목록 | 진단 문자열, `void` | 대기 실패 시 diagnostics 후 예외 throw |

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `tests/utils/site-availability.ts#attachNetworkGuard` | `tests/lotto645.spec.ts::모바일 구매 페이지에 접근할 수 있다` |
| SCN-002 | `tests/utils/failure-diagnostics.ts#waitVisibleWithReason` | `tests/lotto645.spec.ts::구매하기 클릭 후 확인 팝업(#popupLayerConfirm)이 표시된다` |
| SCN-003 | `tests/utils/failure-diagnostics.ts#buildFailureReason` | `tests/lotto645.spec.ts::should_map_ocr_hint_and_attachment_status_in_failure_diagnostics` |

## 변경 규칙 (권장)
- MUST: diagnostics attachment 필드(`context`, `url`, `title`, `maintenance`, `selectors`)를 유지한다.
- MUST: 네트워크 가드 재시도 정책 변경 시 skip 메시지와 최대 시도 계산을 함께 갱신한다.
- MUST NOT: 실패 시 diagnostics attach 전에 예외를 먼저 던지지 않는다.
- 함께 수정할 테스트 목록: `tests/lotto645.spec.ts`, `tests/pension720.spec.ts`, `tests/login.spec.ts`.

## 알려진 제약
- diagnostics는 실패 시점 snapshot이므로 지연 렌더링/iframe 내부 상태를 완전 반영하지 못할 수 있다.
- 셀렉터 변경 시 프로브 정확도가 떨어진다.

## 오픈 질문
- 없음
