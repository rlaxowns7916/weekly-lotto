# deposit/services
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 예치금 충전 결과를 사용자 출력/알림 포맷으로 변환하는 계약을 제공한다.
충전 성공/실패 이메일 템플릿 생성 기준을 정의한다.

## 기능 범위/비범위
- 포함: `chargeSuccessTemplate`, `chargeFailureTemplate` 제공.
- 포함: 실패 템플릿은 `buildFailureEmailTemplate` 공통 빌더를 위임 사용.
- 비포함: SMTP 전송 실행, 브라우저 자동화 실행.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - `ChargeResult`, 오류 문자열.
- 필수/옵션:
  - 성공 템플릿 입력 `ChargeResult`는 필수.
  - 실패 템플릿 입력 `errorSummary`는 필수.
- 유효성 규칙:
  - 성공 템플릿은 금액과 OCR 신뢰도를 표시한다.
  - 성공 템플릿은 `result.balance`가 있을 때만 충전 전/후 예치금 행을 노출한다(DRY_RUN은 미수집).
  - 잔액으로 확인되지 않은 성공은 상태 라벨에 `잔액 미검증`을 표기한다.
  - 실패 템플릿은 오류 문자열을 `escapeHtml`로 이스케이프한다(공통 빌더 내부 처리).
- 출력 타입/필드:
  - `EmailTemplateResult`: `{ subject, html, text }`.

## 행동 시나리오
- SCN-001: Given 충전 성공 결과, When `chargeSuccessTemplate` 호출, Then `subject contains "충전 완료"` and `html contains amount`.
- SCN-002: Given 충전 실패 문맥, When `chargeFailureTemplate` 호출, Then `subject contains "충전 실패"` and `html contains errorMessage`.

## 오류 계약
- 에러 코드: 없음(순수 문자열 생성).
- HTTP status(해당 시): 없음.
- 재시도 가능 여부: 해당 없음.
- 발생 조건: 없음.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 없음.
- 멱등성 규칙: 동일 입력에서 동일 템플릿을 생성한다.
- 순서 보장 규칙: 없음.

## 비기능 요구
- 성능(SLO): 동기 문자열 생성 경계로 별도 수치형 SLO를 정의하지 않는다.
- 보안 요구: 이메일 템플릿에서 사용자 입력 오류 문자열은 이스케이프 처리한다.
- 타임아웃: 해당 없음.
- 동시성 요구: 공유 상태 없음.

## 의존성 계약
- 내부 경계: `src/deposit/domain`, `src/shared/utils/html`.
- 외부 서비스: 없음.
- 외부 라이브러리: 없음.

## 수용 기준
- [ ] 성공/실패 템플릿이 `subject`/`html`/`text`를 모두 반환한다.
- [ ] 실패 템플릿이 `buildFailureEmailTemplate` 공통 빌더를 사용한다.
- [ ] 성공 템플릿이 충전 전/후 예치금과 잔액 검증 여부를 표시한다.
