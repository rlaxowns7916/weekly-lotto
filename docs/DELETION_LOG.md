# Code Deletion Log

## [2026-01-26] Refactor Session: lotto645/pension720 Common Logic Extraction

### Summary
로또6/45와 연금복권720+ 코드에서 중복 로직을 추출하여 `shared` 모듈로 공통화함.

### New Shared Modules Created

#### 1. `src/shared/utils/date.ts`
날짜 관련 유틸리티 함수 통합
- `parseSaleDate()`: 동행복권 발행일 문자열 파싱
- `isWithinMinutes()`: 시간 범위 내 확인
- `formatDateKorean()`: ISO -> 한국어 날짜 형식
- `isToday()`: 오늘 날짜 확인
- `formatDateDot()`: YYYY.MM.DD 형식 변환

#### 2. `src/shared/utils/html.ts`
HTML 관련 유틸리티 함수 통합
- `escapeHtml()`: HTML 특수문자 이스케이프
- `EmailTemplateResult`: 이메일 템플릿 결과 타입

#### 3. `src/shared/browser/actions/purchase-history.ts`
구매 내역 조회 페이지 네비게이션 공통화
- `navigateToPurchaseHistory()`: 상품코드별 구매 내역 조회
- `getBarcodeElements()`: 바코드 요소 조회
- `LOTTERY_PRODUCTS`: 복권 상품 정보 상수

### Duplicate Code Removed

#### From `src/lotto645/domain/ticket.ts`
- `parseSaleDate()` 함수 삭제 -> `shared/utils/date.ts`에서 re-export
- `isWithinMinutes()` 함수 삭제 -> `shared/utils/date.ts`에서 re-export

#### From `src/pension720/browser/actions/check-purchase.ts`
- `parseSaleDate()` 로컬 함수 삭제 (중복)
- `isWithinMinutes()` 로컬 함수 삭제 (중복)
- `navigateToPurchaseHistory()` 전체 로직 삭제 -> 공통 모듈 호출로 대체
- `PRODUCT_CODE`, `MODAL_ID` 상수 삭제 -> `LOTTERY_PRODUCTS` 사용

#### From `src/lotto645/browser/actions/check-purchase.ts`
- `navigateToPurchaseHistory()` 전체 로직 삭제 -> 공통 모듈 호출로 대체

#### From `src/lotto645/services/email.templates.ts`
- `formatDate()` 함수 삭제 -> `formatDateKorean()` alias 사용
- `escapeHtml()` 함수 삭제 -> `shared/utils/html.ts` import

#### From `src/pension720/services/email.templates.ts`
- `formatDate()` 함수 삭제 -> `formatDateKorean()` alias 사용
- `escapeHtml()` 함수 삭제 -> `shared/utils/html.ts` import

#### From `src/lotto645/commands/check-result.ts`
- 인라인 `isToday` 로직 삭제 -> `shared/utils/date.ts` 함수 사용
- 인라인 날짜 포맷 로직 삭제 -> `formatDateDot()` 사용

#### From `src/pension720/commands/check-result.ts`
- 인라인 `isToday` 로직 삭제 -> `shared/utils/date.ts` 함수 사용
- 인라인 날짜 포맷 로직 삭제 -> `formatDateDot()` 사용

### Impact
- Files created: 3 (`date.ts`, `html.ts`, `purchase-history.ts`)
- Lines of duplicate code removed: ~150 lines
- Improved maintainability: 단일 진실 공급원 (Single Source of Truth)

### Testing
- [x] TypeScript build passing: `npx tsc --noEmit`
- [x] ESLint passing: `npx eslint src/`
- [ ] Manual testing required: `HEADED=true npm run check`

### Notes
- 하위 호환성 유지: `lotto645/domain/ticket.ts`에서 `parseSaleDate`, `isWithinMinutes` re-export
- `formatDate` 함수는 기존 코드 호환성을 위해 내부 alias로 유지
- 브라우저 자동화 로직(셀렉터, 파싱)은 복권 종류별로 다르므로 공통화하지 않음

---

## Future Refactoring Candidates

### 1. Commands 공통화 (Medium Priority)
`check.ts`, `check-result.ts` 커맨드가 거의 동일한 구조.
공통 커맨드 팩토리 패턴 적용 가능.

### 2. winning-check.service.ts 공통화 (Low Priority)
`checkTicketsWinning()`, `printWinningResult()` 구조가 유사하지만,
타입이 다르고 당첨 로직이 복잡하여 공통화 시 오히려 복잡도 증가 우려.

### 3. email.templates.ts HTML 구조 공통화 (Low Priority)
HTML 템플릿 구조는 유사하나, 복권 종류별 커스텀 스타일이 필요하여
현재 수준의 분리가 적절함.
