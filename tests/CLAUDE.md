# tests
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 Playwright 기반 E2E 시나리오로 사용자 관점의 핵심 흐름 회귀를 검증한다.
로그인, 로또 6/45, 연금복권 720+의 주요 브라우저 상호작용을 운영 환경과 유사한 조건에서 확인한다.

## 기능 범위/비범위
- 포함: 로그인/구매/구매내역/당첨번호 조회 흐름 E2E 검증.
- 포함: 실패 시 스크린샷, trace, 진단 attachment(`*-diagnostics`) 생성.
- 포함: 실패 시 OCR 힌트/HTML 스냅샷 첨부 정책 검증.
- 비포함: 도메인 순수 함수 단위 테스트(`src/**/*.test.ts`), 실제 결제 결과 보장.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - Playwright 실행 명령(`npm run test:e2e`, `npx playwright test ...`).
  - 환경 변수(`LOTTO_USERNAME`, `LOTTO_PASSWORD`, `HEADED`, `CI`).
- 필수/옵션:
  - 로그인 필요 시나리오에서 계정 변수는 필수.
  - 브라우저 표시(`HEADED`)와 재시도(`CI`)는 옵션.
- 유효성 규칙:
  - 계정 누락 시 해당 시나리오는 `test.skip`로 처리.
  - 사이트 점검/네트워크 장애 시 헬퍼 정책에 따라 재시도 또는 skip.
- 출력 타입/필드:
  - 테스트 결과(pass/fail/skip).
  - HTML 리포트/스크린샷/trace.
  - 진단 문자열 attachment(컨텍스트, URL, 타이틀, 점검 여부, 셀렉터 상태).
  - OCR/HTML 실패 아티팩트 검증 결과(`ocr.status`, `html.main.path`, `attachment.status`).

## 행동 시나리오
- SCN-001: Given 정상 네트워크와 유효 계정, When 모바일 구매/조회 시나리오 실행, Then `testStatus=passed` and `selectorVisible=true`.
- SCN-002: Given 모바일 구매 페이지 진입 또는 셀렉터 표시 실패, When 대기 조건이 타임아웃, Then `testStatus=failed` and `diagnosticAttachmentCount>=1` and `mappedErrorCode!=null`.
- SCN-003: Given 실패 케이스가 발생, When 아티팩트 검증 수행, Then `ocr.status!=null` and (`html.main.path!=null` or `html.status=FAILED`) and `attachment.status!=null`.

## 오류 계약
- 에러 코드: `E2E_PAGE_NOT_READY`, `E2E_SELECTOR_TIMEOUT` 및 운영 코드 매핑(`NETWORK_NAVIGATION_TIMEOUT`, `DOM_SELECTOR_NOT_VISIBLE`, `PARSE_FORMAT_INVALID`, `OCR_TIMEOUT`, `OCR_EXTRACTION_FAILED`).
- HTTP status(해당 시): 없음(브라우저 테스트 컨텍스트).
- 재시도 가능 여부: 네트워크 계열은 가드 정책 내 재시도 가능, DOM/셀렉터 불일치는 기본 재시도 불가.
- 발생 조건: URL 리다이렉트 불일치, 핵심 셀렉터 미노출, 비동기 로딩 지연 초과.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 로그인 필요 시나리오는 인증 성공 상태를 선행 조건으로 유지한다.
- 멱등성 규칙: DRY RUN 시나리오는 상태 변경 없이 반복 실행 가능해야 한다.
- 순서 보장 규칙: 모바일 구매 시나리오는 로그인 -> 구매 페이지 진입 -> 버튼/팝업 검증 순서를 유지한다.

## 비기능 요구
- 성능(SLO): 단일 locator 대기 기본 상한은 30초, navigation 상한은 60초.
- 보안 요구: 계정/비밀번호는 환경 변수로만 주입한다.
- 타임아웃: Playwright 전역 timeout 및 expect timeout 설정을 준수한다.
- 동시성 요구: suite별 serial/parallel 모드를 명시적으로 고정한다.

## 의존성 계약
- 내부 경계: `tests/utils`(점검 감지/네트워크 가드/진단 헬퍼), `src/shared`(실제 앱 공통 동작 간접 영향).
- 외부 서비스: 동행복권 웹.
- 외부 라이브러리: Playwright Test.

## 수용 기준
- [ ] 로그인/로또/연금복권 E2E 시나리오가 현재 UI 계약 기준으로 실행 가능하다.
- [ ] 실패 케이스에서 diagnostics attachment가 생성되고 URL/셀렉터 상태가 포함된다.
- [ ] diagnostics에서 운영 에러 코드로의 매핑 검증 케이스가 존재한다.
- [ ] 문서 내용이 실제 테스트 코드와 드리프트 없이 유지된다.
- [ ] 실패 케이스에서 OCR/HTML 아티팩트 및 첨부 정책(전체/부분 첨부) 검증 케이스가 존재한다.

## 오픈 질문
- 없음
