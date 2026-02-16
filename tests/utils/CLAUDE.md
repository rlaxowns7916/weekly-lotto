# tests/utils
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 E2E 테스트에서 공통으로 사용하는 제어/진단 유틸리티를 제공한다.
실행 안정성을 높이고 실패 시 원인 파악 시간을 줄이는 것이 핵심 책임이다.

## 기능 범위/비범위
- 포함: 사이트 점검 감지 및 조건부 skip, 네트워크 재시도 가드, 구매내역 UI 헬퍼, 실패 진단 문자열 생성/첨부.
- 포함: 실패 진단과 OCR 힌트 코드 매핑 검증 컨텍스트 생성.
- 비포함: 비즈니스 로직 검증, 브라우저 컨텍스트 생성 자체, 도메인 값 계산.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - `Page`, `TestInfo`, 컨텍스트 문자열, 셀렉터 프로브 목록.
- 필수/옵션:
  - `Page`와 `TestInfo`는 필수.
  - 네트워크 가드 옵션(`maxRetries`, `retryDelayMs`)은 옵션.
- 유효성 규칙:
  - 프로브 셀렉터는 문자열 query를 가져야 한다.
  - 점검 문구 감지는 등록된 indicator 목록 기준으로 판단한다.
- 출력 타입/필드:
  - skip 여부 결정, locator 또는 null, bool 성공/실패 상태.
  - diagnostics 문자열(컨텍스트, URL, title, 점검 여부, selector count/visible).
  - OCR/HTML 아티팩트 검증용 상태 필드(`mappedErrorCode`, `ocrHintCode`, `attachmentStatus`).

## 행동 시나리오
- SCN-001: Given 네트워크 일시 장애, When `attachNetworkGuard`가 `page.goto`를 감싼 상태로 이동, Then `retryCount<=maxRetries+1` and `skipCalled=true` on final failure.
- SCN-002: Given 핵심 셀렉터 대기 실패, When `waitVisibleWithReason` 실행, Then `diagnosticAttachmentCount>=1` and `errorThrown=true` and `diagnostic contains "selectors="`.
- SCN-003: Given OCR 텍스트와 diagnostics가 함께 존재, When 매핑 검증 실행, Then `ocrHintCode!=null` and `mappedErrorCode!=null` and `attachmentStatus!=null`.

## 오류 계약
- 에러 코드: `E2E_NETWORK_GUARD_FAIL`, `E2E_VISIBLE_WAIT_FAIL` 및 운영 코드 매핑 후보(`NETWORK_NAVIGATION_TIMEOUT`, `DOM_SELECTOR_NOT_VISIBLE`, `OCR_TIMEOUT`, `UNKNOWN_UNCLASSIFIED`).
- HTTP status(해당 시): 없음.
- 재시도 가능 여부: 네트워크 오류는 가능, 셀렉터/DOM 불일치는 기본 불가.
- 발생 조건: navigation timeout, 연결 오류, locator visible timeout.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: diagnostics는 실패 시점의 페이지 상태를 그대로 문자열화한다.
- 멱등성 규칙: 유틸 함수는 동일 입력에서 부작용 없이 재호출 가능(attachment 추가 제외).
- 순서 보장 규칙: wait 실패 시 diagnostics attachment가 오류 throw보다 먼저 실행되어야 한다.

## 비기능 요구
- 성능(SLO): diagnostics 프로브는 실패 경로에서만 수행한다.
- 보안 요구: diagnostics에 계정 비밀번호를 포함하지 않는다.
- 타임아웃: 호출자가 전달한 timeout을 준수하고 추가 대기는 최소화한다.
- 동시성 요구: 병렬 테스트에서도 `testInfo` 단위로 attachment가 분리되어야 한다.

## 의존성 계약
- 외부 라이브러리: Playwright Test.
- 외부 서비스: 동행복권 웹(페이지 상태 감지 기준).
- 내부 의존성: 없음.

## 수용 기준
- [ ] 점검/네트워크/구매내역/진단 유틸이 테스트 코드에서 재사용 가능하다.
- [ ] 실패 시 diagnostics attachment가 생성되고 핵심 상태 필드가 포함된다.
- [ ] 민감 정보 없이 원인 분류에 필요한 정보가 충분히 제공된다.
- [ ] diagnostics 문자열이 `context`, `maintenance`, `selectors` 필드를 항상 포함한다.
- [ ] OCR 힌트/첨부 상태 매핑 필드가 diagnostics와 함께 검증 가능하게 제공된다.

## 오픈 질문
- 없음
