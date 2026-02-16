# weekly-lotto
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 동행복권 모바일 웹 자동화 프로젝트의 루트 계약을 정의한다.
로또 6/45와 연금복권 720+의 구매/조회/당첨확인 CLI 실행, 공통 설정, CI 및 스케줄 운영의 공통 기준을 보장한다.

## 기능 범위/비범위
- 포함: `npm run lotto:*`, `npm run pension:*` 스크립트 기반 실행 경로 제공.
- 포함: shared 경계 재사용을 통한 로그인/브라우저 세션/이메일 전송 공통화.
- 포함: GitHub Actions 기반 정기 실행 및 CI(린트/타입체크/E2E) 워크플로우 제공.
- 비포함: 동행복권 사이트 내부 정책/DOM 안정성 자체 보장.
- 비포함: SMTP 서버 가용성 및 외부 네트워크 품질 보장.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - 환경 변수: `LOTTO_USERNAME`, `LOTTO_PASSWORD`, `DRY_RUN`, `HEADED`, `CI`, `PENSION_GROUP`, `LOTTO_EMAIL_*`.
  - 실행 인터페이스: `package.json` scripts, GitHub Actions `schedule`/`workflow_dispatch`.
- 필수/옵션:
  - 로그인 필요 시나리오에서 계정 변수는 필수.
  - 이메일 전송은 `LOTTO_EMAIL_*`가 모두 설정된 경우에만 활성화.
- 유효성 규칙:
  - 설정 유효성은 `src/shared/config/index.ts`의 Zod 스키마를 따른다.
  - `DRY_RUN=false`일 때만 실제 구매가 진행된다.
- 출력 타입/필드:
  - 콘솔 로그, 스크린샷, HTML 스냅샷(메인+프레임), OCR 진단 결과, 티켓/당첨 결과 데이터, 선택적 이메일 전송 결과, 테스트 아티팩트.

## 행동 시나리오
- SCN-001: Given 유효 환경 변수와 외부 서비스 정상 상태, When `lotto:*`/`pension:*` 명령 실행, Then `processExitCode=0` and `output contains "완료"`.
- SCN-002: Given 로그인/구매/메일 전송 중 오류, When 각 커맨드가 예외를 처리, Then `processExitCode=1` or `earlyReturn=true` and `error.code!=null` and `output contains "실패"`.
- SCN-003: Given 커맨드 실패 시점 페이지 컨텍스트가 유효, When 실패 후처리 실행, Then `screenshotPath!=null` and `html.main.path!=null` and `ocr.status!=null`.

## 오류 계약
- 에러 코드: 공통 분류 코드를 사용한다(`AUTH_INVALID_CREDENTIALS`, `NETWORK_NAVIGATION_TIMEOUT`, `DOM_SELECTOR_NOT_VISIBLE`, `PARSE_FORMAT_INVALID`, `PURCHASE_VERIFICATION_FAILED`, `EMAIL_SEND_FAILED`, `OCR_ENGINE_UNAVAILABLE`, `OCR_TIMEOUT`, `OCR_TEXT_NOT_FOUND`, `OCR_EXTRACTION_FAILED`, `UNKNOWN_UNCLASSIFIED`).
- HTTP status(해당 시): CLI 중심 경계로 HTTP status 계약을 두지 않는다.
- 재시도 가능 여부: 네트워크/브라우저 액션 일부는 하위 경계 재시도 유틸로 재시도 가능.
- 발생 조건: 환경 변수 검증 실패, 외부 사이트 DOM/네트워크 장애, SMTP 인증 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 공통 설정 파싱 결과는 단일 `getConfig()` 캐시를 통해 일관되게 재사용한다.
- 멱등성 규칙: `DRY_RUN=true` 시 구매 커맨드는 결제 상태를 변경하지 않는다.
- 순서 보장 규칙: 명령 실행은 로그인 선행 후 구매/조회/당첨확인 단계를 따른다.

## 비기능 요구
- 성능(SLO): 코드/설정에 수치형 SLO 정의가 없다.
- 보안 요구: 민감 정보는 코드/문서에 하드코딩하지 않고 환경 변수/Secrets로만 주입한다.
- 타임아웃: Playwright 호출 타임아웃(주요 이동 60초, 요소 대기 30초 내외), OCR 처리 타임아웃(`ocrTimeoutMs<=5000`)을 준수한다.
- 동시성 요구: 테스트 스위트는 serial/parallel 모드를 명시적으로 사용한다.

## 의존성 계약
- 내부 경계: `src/lotto645/browser`, `src/lotto645/browser/actions`, `src/lotto645/commands`, `src/lotto645/domain`, `src/lotto645/services`, `src/pension720/browser`, `src/pension720/browser/actions`, `src/pension720/commands`, `src/pension720/domain`, `src/pension720/services`, `src/shared/browser`, `src/shared/browser/actions`, `src/shared/config`, `src/shared/ocr`, `src/shared/services`, `src/shared/utils`, `tests`, `tests/utils`.
- 외부 서비스: 동행복권 웹, SMTP 서버.
- 외부 라이브러리: Playwright, Zod, Nodemailer, ESLint, TypeScript.

## 수용 기준
- [ ] 루트 스크립트로 로또/연금복권 구매/조회/당첨확인 명령을 실행할 수 있다.
- [ ] shared 설정/브라우저/이메일 의존 경로가 문서와 코드에서 일치한다.
- [ ] CI 및 스케줄 워크플로우가 문서된 계약과 모순되지 않는다.
- [ ] 실패 출력/알림에 `error.code`와 `error.category`가 포함된다.
- [ ] 실패 경로에서 스크린샷/HTML/OCR 진단이 수집되고, 실패 메일 첨부 정책(10MB 상한, 초과 시 부분 첨부)이 유지된다.

## 오픈 질문
- 내용: `package.json`의 `claude`, `update`, `upgrade` 의존성이 런타임/개발 흐름에서 실제로 사용되는지 확인이 필요하다.
- 확인 불가 사유: 저장소 코드 경로에서 해당 패키지를 직접 import/실행하는 근거를 확인하지 못했다.
- 확인 경로: `package.json` scripts, CI workflow, 실제 배포/운영 실행 로그에서 패키지 호출 여부를 점검한다.
- 해소 조건: 세 패키지의 사용 경로가 코드/워크플로우에서 확인되거나 제거 커밋으로 정리되면 항목을 닫는다.
