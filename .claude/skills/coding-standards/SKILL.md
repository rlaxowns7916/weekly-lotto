---
name: coding-standards
description: Node.js + TypeScript + Playwright 프로젝트를 위한 코딩 표준 및 베스트 프랙티스
---

# 코딩 표준 & 베스트 프랙티스

이 프로젝트(weekly-lotto)에 적용되는 코딩 표준입니다.

## 핵심 원칙

### 1. 가독성 우선
- 코드는 작성보다 읽히는 횟수가 더 많음
- 명확한 변수/함수 이름 사용
- 주석보다 자기 설명적 코드 선호
- 일관된 포매팅

### 2. KISS (Keep It Simple)
- 동작하는 가장 단순한 해결책
- 과도한 엔지니어링 지양
- 조기 최적화 금지
- 영리한 코드 < 이해하기 쉬운 코드

### 3. DRY (Don't Repeat Yourself)
- 공통 로직은 함수로 추출
- 재사용 가능한 컴포넌트 생성
- 모듈 간 유틸리티 공유
- 복사-붙여넣기 프로그래밍 금지

### 4. YAGNI (You Aren't Gonna Need It)
- 필요하기 전에 기능 만들지 않기
- 추측성 일반화 지양
- 필요할 때만 복잡성 추가
- 단순하게 시작, 필요시 리팩토링

## TypeScript 표준

### 변수 네이밍

```typescript
// ✅ 좋음: 설명적인 이름
const lottoUsername = 'user123'
const isLoggedIn = true
const ticketCount = 5

// ❌ 나쁨: 불분명한 이름
const u = 'user123'
const flag = true
const n = 5
```

### 함수 네이밍

```typescript
// ✅ 좋음: 동사-명사 패턴
async function fetchWinningNumbers(round: number) { }
function calculatePrize(rank: WinningRank) { }
function isValidTicket(numbers: number[]): boolean { }

// ❌ 나쁨: 불분명하거나 명사만
async function numbers(r: number) { }
function prize(rank) { }
function ticket(n) { }
```

### 불변성 패턴 (중요)

```typescript
// ✅ 항상 스프레드 연산자 사용
const updatedTicket = {
  ...ticket,
  numbers: [1, 2, 3, 4, 5, 6]
}

const updatedArray = [...tickets, newTicket]

// ❌ 직접 변경 금지
ticket.numbers = [1, 2, 3, 4, 5, 6]  // 나쁨
tickets.push(newTicket)              // 나쁨
```

### 에러 처리

```typescript
// ✅ 좋음: 포괄적인 에러 처리
async function login(page: Page): Promise<void> {
  try {
    await page.goto('https://dhlottery.co.kr')
    await page.fill('#userId', config.username)
    await page.click('button[type="submit"]')

    // 로그인 실패 확인
    const errorVisible = await page.locator('.error-message').isVisible()
    if (errorVisible) {
      throw new Error('로그인 실패: 아이디 또는 비밀번호 오류')
    }
  } catch (error) {
    console.error('로그인 중 오류:', error)
    await page.screenshot({ path: 'screenshots/login-error.png' })
    throw error
  }
}

// ❌ 나쁨: 에러 처리 없음
async function login(page) {
  await page.goto('https://dhlottery.co.kr')
  await page.fill('#userId', username)
  await page.click('button')
}
```

### Async/Await 베스트 프랙티스

```typescript
// ✅ 좋음: 가능하면 병렬 실행
const [winningNumbers, purchases] = await Promise.all([
  getWinningNumbers(page),
  getPurchaseHistory(page)
])

// ❌ 나쁨: 불필요한 순차 실행
const winningNumbers = await getWinningNumbers(page)
const purchases = await getPurchaseHistory(page)
```

### 타입 안전성

```typescript
// ✅ 좋음: 명확한 타입 정의
interface PurchasedTicket {
  round: number
  slot: 'A' | 'B' | 'C' | 'D' | 'E'
  numbers: number[]
  mode: 'auto' | 'manual' | 'semi-auto'
}

function checkWinning(
  ticket: PurchasedTicket,
  winning: WinningNumbers
): WinningRank {
  // 구현
}

// ❌ 나쁨: any 사용
function checkWinning(ticket: any, winning: any): any {
  // 구현
}
```

## Playwright 표준

### 페이지 액션 구조

```typescript
// ✅ 좋음: 명확한 대기와 검증
async function purchaseLotto(page: Page): Promise<PurchasedTicket[]> {
  // 페이지 로드 대기
  await page.waitForLoadState('networkidle')

  // 요소 대기 후 클릭
  await page.locator('#buyButton').waitFor({ state: 'visible' })
  await page.click('#buyButton')

  // 결과 확인
  await page.waitForSelector('.purchase-complete')

  // 데이터 추출
  return await extractPurchasedTickets(page)
}

// ❌ 나쁨: 하드코딩된 대기
async function purchaseLotto(page) {
  await page.waitForTimeout(3000)  // 나쁨: 고정 대기
  await page.click('#buyButton')
  await page.waitForTimeout(5000)
}
```

### 셀렉터 관리

```typescript
// ✅ 좋음: 셀렉터 중앙 관리 (src/browser/selectors.ts)
export const selectors = {
  login: {
    usernameInput: '#userId',
    passwordInput: '#password',
    submitButton: 'button[type="submit"]',
    errorMessage: '.login-error'
  },
  purchase: {
    autoModeButton: '.auto-mode',
    buyButton: '#buyLotto',
    confirmButton: '.confirm-purchase'
  }
} as const

// 사용
await page.fill(selectors.login.usernameInput, username)

// ❌ 나쁨: 매직 스트링
await page.fill('#userId', username)
```

### 스크린샷 & 디버깅

```typescript
// ✅ 좋음: 실패 시 스크린샷 저장
async function withScreenshotOnError<T>(
  page: Page,
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    const path = `screenshots/${name}-${Date.now()}.png`
    await page.screenshot({ path, fullPage: true })
    console.error(`스크린샷 저장됨: ${path}`)
    throw error
  }
}

// 사용
await withScreenshotOnError(page, 'purchase', async () => {
  await purchaseLotto(page)
})
```

## 파일 구조

### 프로젝트 구조

```
src/
├── commands/           # CLI 커맨드 (buy.ts, check.ts)
├── browser/
│   ├── context.ts     # 브라우저 컨텍스트 관리
│   ├── selectors.ts   # CSS 셀렉터 중앙 관리
│   └── actions/       # Playwright 액션
│       ├── login.ts
│       ├── purchase.ts
│       └── check-result.ts
├── domain/            # 도메인 타입
│   ├── ticket.ts
│   ├── winning.ts
│   └── check-summary.ts
├── services/          # 외부 서비스
│   ├── email.service.ts
│   └── email.templates.ts
├── config/            # 설정
│   └── index.ts
└── utils/             # 유틸리티
    ├── format.ts
    └── retry.ts
```

### 파일 네이밍

```
src/domain/ticket.ts           # kebab-case 파일명
src/browser/actions/login.ts   # 기능별 분리
src/services/email.service.ts  # .service 접미사
src/utils/format.ts            # 유틸리티
```

## 환경 변수 & 설정

### Zod 스키마 검증

```typescript
// ✅ 좋음: 런타임 검증
import { z } from 'zod'

const configSchema = z.object({
  username: z.string().min(1, 'LOTTO_USERNAME 필수'),
  password: z.string().min(1, 'LOTTO_PASSWORD 필수'),
  email: z.object({
    smtpHost: z.string(),
    smtpPort: z.coerce.number().int().positive(),
    from: z.string().email(),
    to: z.string().transform(s => s.split(',').map(e => e.trim()))
  })
})

export const config = configSchema.parse({
  username: process.env.LOTTO_USERNAME,
  password: process.env.LOTTO_PASSWORD,
  // ...
})
```

## 주석 & 문서화

### 언제 주석을 달 것인가

```typescript
// ✅ 좋음: WHY를 설명
// 동행복권 사이트는 EUC-KR 인코딩을 사용하므로 변환 필요
const decodedHtml = iconv.decode(buffer, 'euc-kr')

// 구매 완료 후 3초 대기 필요 (사이트 처리 시간)
await page.waitForTimeout(3000)

// ❌ 나쁨: WHAT을 설명 (코드로 이미 알 수 있음)
// 카운트를 1 증가
count++

// 사용자 이름을 설정
username = user.name
```

### JSDoc (공개 API)

```typescript
/**
 * 구매한 로또 번호와 당첨 번호를 비교하여 등수를 반환합니다.
 *
 * @param ticket - 구매한 로또 티켓
 * @param winning - 당첨 번호 정보
 * @returns 당첨 등수 (1등~5등, 또는 낙첨)
 *
 * @example
 * ```typescript
 * const rank = checkWinning(myTicket, winningNumbers)
 * if (rank !== WinningRank.None) {
 *   console.log(`${rank}등 당첨!`)
 * }
 * ```
 */
export function checkWinning(
  ticket: PurchasedTicket,
  winning: WinningNumbers
): WinningRank {
  // 구현
}
```

## 테스트 표준

### AAA 패턴

```typescript
test('5개 번호 일치 + 보너스 번호 일치 시 2등 반환', () => {
  // Arrange (준비)
  const ticket = { numbers: [1, 2, 3, 4, 5, 7] }
  const winning = {
    numbers: [1, 2, 3, 4, 5, 6],
    bonus: 7
  }

  // Act (실행)
  const rank = checkWinning(ticket, winning)

  // Assert (검증)
  expect(rank).toBe(WinningRank.Rank2)
})
```

### 테스트 이름

```typescript
// ✅ 좋음: 설명적인 테스트 이름
test('로그인 실패 시 에러 메시지가 표시된다', () => { })
test('5개 이상 번호 입력 시 검증 에러를 던진다', () => { })
test('시스템 점검 중일 때 적절한 에러를 반환한다', () => { })

// ❌ 나쁨: 모호한 테스트 이름
test('동작함', () => { })
test('로그인 테스트', () => { })
```

## 코드 스멜 감지

### 1. 긴 함수
```typescript
// ❌ 나쁨: 50줄 이상의 함수
async function buyAndCheck() {
  // 100줄의 코드...
}

// ✅ 좋음: 작은 함수로 분리
async function buyAndCheck() {
  await login(page)
  const tickets = await purchaseTickets(page)
  const winning = await getWinningNumbers(page)
  return checkAllTickets(tickets, winning)
}
```

### 2. 깊은 중첩
```typescript
// ❌ 나쁨: 5단계 이상 중첩
if (user) {
  if (user.isActive) {
    if (balance > 0) {
      if (canPurchase) {
        // 구매
      }
    }
  }
}

// ✅ 좋음: 조기 반환
if (!user) return
if (!user.isActive) return
if (balance <= 0) return
if (!canPurchase) return

// 구매
```

### 3. 매직 넘버
```typescript
// ❌ 나쁨: 설명 없는 숫자
if (numbers.length > 6) { }
await page.waitForTimeout(5000)

// ✅ 좋음: 명명된 상수
const MAX_LOTTO_NUMBERS = 6
const PURCHASE_WAIT_MS = 5000

if (numbers.length > MAX_LOTTO_NUMBERS) { }
await page.waitForTimeout(PURCHASE_WAIT_MS)
```

## 이 프로젝트 특화 규칙

### 1. 로또 번호 검증
```typescript
// 항상 1-45 범위 확인
function isValidNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 45
}

// 중복 확인
function hasNoDuplicates(numbers: number[]): boolean {
  return new Set(numbers).size === numbers.length
}
```

### 2. 금액 포맷팅
```typescript
// 원화 포맷팅
function formatKRW(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}
// 예: 1,234,567원
```

### 3. 환경별 동작
```typescript
// CI 환경에서는 헤드리스 모드
const headless = process.env.CI === 'true' || process.env.HEADED !== 'true'

// 로컬 개발 시 브라우저 표시
// HEADED=true npm run buy
```

**기억하세요**: 코드 품질은 타협할 수 없습니다. 명확하고 유지보수 가능한 코드가 빠른 개발과 자신 있는 리팩토링을 가능하게 합니다.
