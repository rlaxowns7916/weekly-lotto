# 코딩 에이전트 가이드라인 (Node.js + TypeScript + Playwright)
이 문서는 이 리포지토리에서 **코딩 에이전트**가 작업할 때 따라야 할 공통 규칙을 정의한다.

---

## 1. 프로젝트 개요
- 이 리포지토리는 **Node.js + TypeScript + Playwright** 기반 로또 자동화 프로젝트이다.
- 동행복권 **모바일 웹** 사이트에서 로또 구매 및 당첨 확인을 자동화한다.
- 브라우저는 **iPhone (iOS Safari)** 환경으로 에뮬레이션된다.
- GitHub Actions를 통해 스케줄 실행된다.

### 주요 커맨드
- `npm run lotto:buy` - 로또 구매 (DRY_RUN=false로 실제 구매)
- `npm run lotto:check` - 최근 1주일 구매 내역 조회
- `npm run lotto:check-result` - 당첨 확인 및 이메일 전송
- `npm run pension:buy` - 연금복권 구매
- `npm run pension:check` - 연금복권 구매 내역 조회
- `npm run pension:check-result` - 연금복권 당첨 확인

---

## 2. 기술 스택

| 기술 | 용도 |
|------|------|
| Node.js 20+ | 런타임 |
| TypeScript | 타입 안전성 |
| Playwright | 브라우저 자동화 (모바일 에뮬레이션) |
| Nodemailer | 이메일 전송 |
| ESLint | 코드 린팅 |

---

## 3. 기본 원칙

1. **TypeScript 전용**
    - 새 코드는 모두 TypeScript로 작성한다.
    - ESM 모듈 시스템을 사용한다 (`.js` 확장자로 import).

2. **스타일 가이드 준수**
    - 린트: `npx eslint .` 통과 필수.
    - 타입 체크: `npx tsc --noEmit` 통과 필수.

3. **명확성 우선**
    - 요구사항이 모호하면 질문을 남긴다.
    - 작업 범위를 가장 작은 단위로 좁힌다.

4. **작은 변경 단위**
    - 한 번에 많은 파일을 대규모로 변경하지 않는다.
    - 리팩터링과 기능 추가는 분리한다.

---

## 4. 디렉토리 구조

```
src/
├── lotto645/              # 로또 6/45
│   ├── commands/          # CLI 진입점
│   │   ├── buy.ts
│   │   ├── check.ts
│   │   └── check-result.ts
│   ├── browser/
│   │   ├── selectors.ts   # 구매 페이지 셀렉터 (모바일)
│   │   └── actions/
│   │       ├── purchase.ts
│   │       ├── check-purchase.ts
│   │       └── fetch-winning.ts
│   ├── domain/
│   │   ├── ticket.ts
│   │   └── winning.ts
│   └── services/
│       ├── email.templates.ts
│       └── winning-check.service.ts
├── pension720/            # 연금복권 720+
│   ├── commands/
│   ├── browser/
│   ├── domain/
│   └── services/
└── shared/                # 공통 모듈
    ├── browser/
    │   ├── context.ts     # 브라우저 세션 (모바일 에뮬레이션)
    │   ├── selectors.ts   # 로그인 셀렉터
    │   └── actions/
    │       ├── login.ts
    │       └── purchase-history.ts
    ├── config/
    │   └── index.ts       # 환경 변수 로더
    ├── services/
    │   └── email.service.ts
    └── utils/
        ├── retry.ts
        ├── date.ts
        └── html.ts
```

---

## 5. 절대 금지 행동

1. **시크릿/민감 정보 커밋 금지**
    - API 키, 비밀번호, 접속 토큰 등은 환경 변수로 처리한다.

2. **테스트 파일 직접 수정 금지**
    - 테스트가 잘못되었다고 판단되면 코멘트로 남긴다.

3. **비즈니스 로직 추측 금지**
    - 요구사항이 불분명하면 질문을 남긴다.

---

## 6. 환경 변수

```env
# 동행복권 로그인
LOTTO_USERNAME=아이디
LOTTO_PASSWORD=비밀번호

# 이메일 설정
LOTTO_EMAIL_SMTP_HOST=smtp.gmail.com
LOTTO_EMAIL_SMTP_PORT=587
LOTTO_EMAIL_USERNAME=이메일
LOTTO_EMAIL_PASSWORD=앱_비밀번호
LOTTO_EMAIL_FROM=발신자
LOTTO_EMAIL_TO=수신자1,수신자2

# 실행 옵션
DRY_RUN=true          # false면 실제 구매
HEADED=true           # true면 브라우저 표시
```

---

## 7. 로컬 개발

```bash
# 의존성 설치
npm install
npx playwright install chromium

# 로또 구매 테스트 (DRY RUN)
HEADED=true npm run lotto:buy

# 로또 실제 구매
HEADED=true DRY_RUN=false npm run lotto:buy

# 로또 당첨 확인
HEADED=true npm run lotto:check-result

# 연금복권 구매 테스트 (DRY RUN)
HEADED=true npm run pension:buy

# 연금복권 실제 구매
HEADED=true DRY_RUN=false npm run pension:buy
```

---

## 8. 브라우저 환경

- **모바일 에뮬레이션**: iPhone (iOS 17, Safari) 환경으로 동작
- **뷰포트**: 390x844 (iPhone 14)
- **구매 URL**: `ol.dhlottery.co.kr/olotto/game_mobile/game645.do` (모바일 전용)
- **봇 탐지 우회**: webdriver 숨김, navigator.platform = 'iPhone'

---

## 9. GitHub Actions

- **lotto-buy.yml**: 평일 09:00 KST 로또 구매
- **pension-buy.yml**: 평일 10:00 KST 연금복권 구매
- **lotto-check.yml**: 토요일 22:00 KST 로또 당첨 확인
- **pension-check.yml**: 목요일 21:00 KST 연금복권 당첨 확인
- **auto-commit.yml**: 일요일 09:00 KST 자동 커밋
