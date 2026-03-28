# Weekly Lotto

동행복권 로또6/45, 연금복권720+, 예치금 충전 자동화 시스템

Node.js + TypeScript + Playwright 기반, **모바일 웹** UI를 통해 자동화합니다.

## 기능

### 로또 6/45
- **자동 구매**: 매주 월~금 오전 9시에 로또 1장씩 자동 구매 (모바일 웹)
- **구매 내역 조회**: 최근 구매한 로또 번호 확인
- **당첨 확인**: 매주 토요일 추첨 후 당첨 결과 이메일 발송

### 연금복권 720+
- **자동 구매**: 매주 월~금 오전 10시에 연금복권 1장씩 자동 구매 (요일별 조 선택: 월=1조, 화=2조, 수=3조, 목=4조, 금=5조)
- **구매 내역 조회**: 최근 구매한 연금복권 번호 확인
- **당첨 확인**: 매주 목요일 추첨 후 당첨 결과 이메일 발송

### 예치금 자동충전
- **자동 충전**: 매주 일요일 오전 9시에 예치금 자동 충전 (구매 전 잔액 사전 확보)
- **NProtect NPPFS 보안 키패드 지원**: Tesseract.js OCR + Canvas 색상반전으로 랜덤 키패드 인식
- **충전 내역 검증**: 충전 완료 후 내역 조회로 성공 확인
- **DRY RUN**: 키패드 표시까지 진행 후 OCR 인식 결과 콘솔 출력 (실제 충전 없음)

### 공통
- **이메일 알림**: 구매 성공/실패, 당첨 결과, 충전 성공/실패 시 이메일 자동 발송
- **실패 진단**: 실패 시 스크린샷 + HTML 스냅샷 + OCR 진단 자동 수집 및 이메일 첨부
- **DRY RUN 모드**: 모든 커맨드에서 실제 결제/충전 없이 테스트 가능 (기본값: true)
- **자동 커밋**: 매주 일요일 자동 커밋으로 GitHub Actions 비활성화 방지

## 실행 스케줄

| 작업 | 실행 시간 | 설명 |
|------|----------|------|
| 예치금 충전 | 일요일 09:00 KST | 예치금 자동 충전 (구매 전 잔액 확보) |
| 로또 구매 | 월~금 09:00 KST | 로또 6/45 1장 자동 구매 |
| 연금복권 구매 | 월~금 10:00 KST | 연금복권 720+ 1장 자동 구매 |
| 로또 당첨 확인 | 토요일 22:00 KST | 로또 당첨 결과 확인 및 이메일 발송 |
| 연금복권 당첨 확인 | 목요일 21:00 KST | 연금복권 당첨 결과 확인 및 이메일 발송 |
| 자동 커밋 | 일요일 09:00 KST | AUTO COMMIT (Actions 비활성화 방지) |

## 환경변수 설정

Repository Settings > Secrets and variables > Actions에서 설정:

### 동행복권 계정

| 변수 | 설명 | 필수 |
|------|------|------|
| `LOTTO_USERNAME` | 동행복권 로그인 아이디 | O |
| `LOTTO_PASSWORD` | 동행복권 로그인 비밀번호 | O |
| `DRY_RUN` | 실제 구매/충전 없이 테스트 (기본값: true) | X |
| `HEADED` | 브라우저 표시 여부 (기본값: false) | X |

### 예치금 충전

| 변수 | 설명 | 필수 |
|------|------|------|
| `DEPOSIT_PASSWORD` | 예치금 충전 비밀번호 (6자리 숫자) | O (충전 시) |
| `DEPOSIT_AMOUNT` | 충전 금액 (원, 기본값: 20000) | X |

허용 금액: 5,000 / 10,000 / 20,000 / 30,000 / 50,000 / 100,000 / 150,000원
일일 최대 충전 한도: 150,000원

### 이메일 알림

| 변수 | 설명 | 필수 |
|------|------|------|
| `LOTTO_EMAIL_SMTP_HOST` | SMTP 서버 주소 (예: smtp.naver.com) | X |
| `LOTTO_EMAIL_SMTP_PORT` | SMTP 포트 (예: 465) | X |
| `LOTTO_EMAIL_USERNAME` | SMTP 인증 계정 | X |
| `LOTTO_EMAIL_PASSWORD` | SMTP 인증 비밀번호 | X |
| `LOTTO_EMAIL_FROM` | 발신자 이메일 | X |
| `LOTTO_EMAIL_TO` | 수신자 이메일 (쉼표로 여러 명 가능) | X |

이메일 설정은 모두 설정된 경우에만 활성화됩니다.

## 로컬 실행

### 사전 준비

```bash
# 의존성 설치
npm install
npx playwright install chromium

# .env 파일 생성
cp .env.example .env  # 또는 직접 생성
```

`.env` 파일 예시:
```env
LOTTO_USERNAME=아이디
LOTTO_PASSWORD=비밀번호
DEPOSIT_PASSWORD=123456
DEPOSIT_AMOUNT=20000
LOTTO_EMAIL_SMTP_HOST=smtp.naver.com
LOTTO_EMAIL_SMTP_PORT=465
LOTTO_EMAIL_USERNAME=user@naver.com
LOTTO_EMAIL_PASSWORD=앱비밀번호
LOTTO_EMAIL_FROM=user@naver.com
LOTTO_EMAIL_TO=user@gmail.com
```

### 로또 6/45

```bash
# 구매 테스트 (DRY RUN - 확인 팝업에서 취소)
npm run lotto:buy
HEADED=true npm run lotto:buy          # 브라우저 표시

# 실제 구매
DRY_RUN=false npm run lotto:buy
HEADED=true DRY_RUN=false npm run lotto:buy

# 구매 내역 조회
npm run lotto:check

# 당첨 결과 확인
npm run lotto:check-result
```

### 연금복권 720+

```bash
# 구매 테스트 (DRY RUN)
npm run pension:buy
HEADED=true npm run pension:buy

# 실제 구매
DRY_RUN=false npm run pension:buy

# 구매 내역 조회
npm run pension:check

# 당첨 결과 확인
npm run pension:check-result
```

### 예치금 충전

```bash
# 충전 테스트 (DRY RUN - 키패드 OCR 확인까지만 진행)
npm run deposit:charge
HEADED=true npm run deposit:charge     # 브라우저 표시

# 실제 충전
DRY_RUN=false npm run deposit:charge
HEADED=true DRY_RUN=false npm run deposit:charge
```

DRY RUN 시 키패드 OCR 인식 결과가 콘솔에 출력됩니다:
```
키패드 OCR 완료: 10개 숫자 인식, 최저 confidence 0.95
키패드 숫자 위치 매핑:
  숫자 0: (0,592) (confidence: 0.95)
  숫자 1: (0,718) (confidence: 0.96)
  ...
```

## 프로젝트 구조

```
src/
├── lotto645/                  # 로또 6/45
│   ├── commands/              #   CLI 진입점 (buy, check, check-result)
│   ├── browser/actions/       #   구매/조회/당첨확인 브라우저 액션
│   ├── domain/                #   타입 정의 (PurchasedTicket, WinningNumbers)
│   └── services/              #   이메일 템플릿
├── pension720/                # 연금복권 720+
│   ├── commands/              #   CLI 진입점
│   ├── browser/actions/       #   구매/조회/당첨확인 브라우저 액션
│   ├── domain/                #   타입 정의
│   └── services/              #   이메일 템플릿
├── deposit/                   # 예치금 충전
│   ├── commands/              #   CLI 진입점 (charge)
│   ├── browser/actions/       #   충전 액션 + 키패드 OCR
│   │   ├── charge.ts          #     충전 플로우
│   │   └── keypad.ts          #     NProtect 키패드 OCR (Tesseract.js + Canvas 반전)
│   ├── domain/                #   타입 정의 (ChargeResult)
│   └── services/              #   이메일 템플릿
└── shared/                    # 공통 모듈
    ├── browser/               #   Playwright 세션 관리 (iPhone 14 에뮬레이션)
    │   └── actions/           #     로그인, 구매내역 이동
    ├── config/                #   Zod 기반 환경변수 검증
    ├── ocr/                   #   실패 스크린샷 OCR + HTML 스냅샷
    ├── services/              #   Nodemailer 이메일 전송
    └── utils/                 #   에러 분류, 재시도, 날짜 유틸
```

## 기술 스택

| 기술 | 용도 |
|------|------|
| **Playwright** | 모바일 웹 브라우저 자동화 (iPhone 14 에뮬레이션) |
| **TypeScript** | 타입 안전성 (strict mode) |
| **Zod** | 런타임 환경변수 검증 |
| **Tesseract.js** | NProtect 보안 키패드 OCR (숫자 인식) |
| **Nodemailer** | SMTP 이메일 알림 |
| **GitHub Actions** | 스케줄 실행 (cron) 및 CI |

## 테스트

```bash
# 단위 테스트
npm test

# E2E 테스트 (모바일 뷰포트 - iPhone 14)
npm run test:e2e

# 브라우저 표시하며 E2E 실행
npm run test:e2e:headed

# Playwright UI 모드로 E2E 실행
npm run test:e2e:ui

# 특정 테스트 파일 실행
npx playwright test tests/lotto645.spec.ts

# 타입 검사
npm run typecheck

# 린트
npm run lint
```

## GitHub Actions 워크플로우

| 파일 | 이름 | 트리거 |
|------|------|--------|
| `ci.yml` | CI | PR / main 브랜치 푸시 |
| `lotto-buy.yml` | 로또645 구매 | 월~금 09:00 KST (cron) / 수동 |
| `lotto-check.yml` | 로또645 당첨 확인 | 토요일 22:00 KST (cron) / 수동 |
| `pension-buy.yml` | 연금복권720+ 구매 | 월~금 10:00 KST (cron) / 수동 |
| `pension-check.yml` | 연금복권720 당첨 확인 | 목요일 21:00 KST (cron) / 수동 |
| `deposit-charge.yml` | 예치금 충전 | 일요일 09:00 KST (cron) / 수동 |
| `auto-commit.yml` | Auto Commit | 일요일 09:00 KST (cron) / 수동 |

### CI

PR 및 main 브랜치 푸시 시 자동으로 실행됩니다.

- **Lint & Type Check**: ESLint + TypeScript 타입 검사
- **E2E Tests**: Playwright 전체 테스트 실행 (모바일 에뮬레이션, xvfb)

## 에러 코드

실패 시 구조화된 에러 코드가 출력됩니다:

| 코드 | 카테고리 | 설명 |
|------|---------|------|
| `AUTH_INVALID_CREDENTIALS` | AUTH | 로그인 실패 (아이디/비밀번호 오류) |
| `NETWORK_NAVIGATION_TIMEOUT` | NETWORK | 페이지 로딩 타임아웃 |
| `DOM_SELECTOR_NOT_VISIBLE` | DOM | UI 요소를 찾을 수 없음 |
| `PARSE_FORMAT_INVALID` | PARSE | 데이터 파싱/포맷 오류 |
| `PURCHASE_VERIFICATION_FAILED` | BUSINESS | 구매 후 검증 실패 |
| `DEPOSIT_CHARGE_FAILED` | BUSINESS | 예치금 충전 실패 |
| `DEPOSIT_VERIFICATION_FAILED` | BUSINESS | 충전 내역 검증 실패 |
| `EMAIL_SEND_FAILED` | EMAIL | 이메일 전송 실패 |
| `OCR_ENGINE_UNAVAILABLE` | OCR | Tesseract OCR 엔진 초기화 실패 |
| `OCR_TIMEOUT` | OCR | OCR 처리 타임아웃 |
| `OCR_TEXT_NOT_FOUND` | OCR | OCR 텍스트 인식 결과 없음 |
| `OCR_EXTRACTION_FAILED` | OCR | OCR 추출 실패 |
| `KEYPAD_OCR_FAILED` | OCR | 키패드 숫자 인식 실패 |
| `UNKNOWN_UNCLASSIFIED` | UNKNOWN | 미분류 오류 |
