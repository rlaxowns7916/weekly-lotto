# Weekly Lotto

동행복권 로또6/45 및 연금복권720+ 자동 구매 및 당첨 확인 시스템

Node.js + TypeScript + Playwright 기반, **모바일 웹** UI를 통해 자동화합니다.

## 기능

### 로또 6/45
- **자동 구매**: 매주 월~금 오전 9시에 로또 1장씩 자동 구매 (모바일 웹)
- **당첨 확인**: 매주 토요일 추첨 후 당첨 결과 이메일 발송

### 연금복권 720+
- **자동 구매**: 매주 월~금 오전 10시에 연금복권 1장씩 자동 구매 (요일별 조 선택: 월=1조, 화=2조, 수=3조, 목=4조, 금=5조)
- **당첨 확인**: 매주 목요일 추첨 후 당첨 결과 이메일 발송

### 기타
- **자동 커밋**: 매주 일요일 자동 커밋으로 GitHub Actions 비활성화 방지

## 실행 스케줄

| 작업          | 실행 시간         | 설명                            |
|--------------|---------------|-------------------------------|
| 로또 구매     | 월~금 09:00 KST | 로또 6/45 1장 자동 구매            |
| 연금복권 구매 | 월~금 10:00 KST | 연금복권 720+ 1장 자동 구매         |
| 로또 당첨 확인 | 토요일 22:00 KST | 로또 당첨 결과 확인 및 이메일 발송    |
| 연금복권 당첨 확인 | 목요일 21:00 KST | 연금복권 당첨 결과 확인 및 이메일 발송 |
| 자동 커밋     | 일요일 09:00 KST | AUTO COMMIT (Actions 비활성화 방지) |

## 환경변수 설정

Repository Settings → Secrets and variables → Actions에서 설정:

### 로또 계정

- `LOTTO_USERNAME`: 동행복권 로그인 아이디
- `LOTTO_PASSWORD`: 동행복권 로그인 비밀번호

### 이메일 알림

- `LOTTO_EMAIL_SMTP_HOST`: SMTP 서버 주소 (예: smtp.gmail.com)
- `LOTTO_EMAIL_SMTP_PORT`: SMTP 포트 (예: 587)
- `LOTTO_EMAIL_USERNAME`: SMTP 인증 계정
- `LOTTO_EMAIL_PASSWORD`: SMTP 인증 비밀번호
- `LOTTO_EMAIL_FROM`: 발신자 이메일
- `LOTTO_EMAIL_TO`: 수신자 이메일

## 로컬 실행

```bash
# 의존성 설치
npm install
npx playwright install chromium

# 로또 구매 테스트 (DRY RUN - 취소 버튼까지만 진행)
HEADED=true npm run lotto:buy

# 로또 실제 구매
HEADED=true DRY_RUN=false npm run lotto:buy

# 연금복권 구매 테스트
HEADED=true npm run pension:buy

# 당첨 확인
HEADED=true npm run lotto:check-result
HEADED=true npm run pension:check-result
```

## 테스트

Playwright E2E 테스트로 주요 기능을 검증합니다.

```bash
# 테스트 목록 확인
npx playwright test --list

# 전체 테스트 실행 (모바일 뷰포트 - iPhone 14)
npm run test:e2e

# 브라우저 표시하며 실행
npm run test:e2e:headed

# 특정 테스트 파일 실행
npx playwright test tests/lotto645.spec.ts
```

### 테스트 구성

| 파일 | 설명 | 테스트 수 |
|------|------|----------|
| `lotto645.spec.ts` | 로또 6/45 당첨번호 조회, 구매, 구매내역 | 20 |
| `pension720.spec.ts` | 연금복권 720+ 당첨번호 조회, 구매, 구매내역 | 18 |
| `login.spec.ts` | 로그인 기능 | 4 |

## CI/CD

PR 및 main 브랜치 푸시 시 자동으로 CI가 실행됩니다.

- **Lint & Type Check**: ESLint + TypeScript 타입 검사
- **E2E Tests**: Playwright 전체 테스트 실행 (모바일 에뮬레이션)
