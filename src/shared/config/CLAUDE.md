# shared/config
Schema-Version: SRTE-DOCS-1

## 목적
이 경계는 런타임 환경 변수의 검증/파싱 계약을 제공한다.
설정 로딩 실패를 초기 단계에서 감지하고 캐시된 설정 접근을 보장한다.

## 기능 범위/비범위
- 포함: Zod 기반 설정 파싱/검증.
- 포함: 이메일 설정의 조건부 활성화(`LOTTO_EMAIL_SMTP_HOST/PORT` 존재 시).
- 포함: `getConfig()` 싱글톤 캐시.
- 비포함: 설정 파일 쓰기, 원격 비밀 저장소 연동.

## 공개 인터페이스 계약
- 입력 타입/필드:
  - `process.env`.
  - 계정/이메일/실행 옵션 문자열.
- 필수/옵션:
  - `username/password`는 스키마상 optional이나 로그인 경계에서 필수로 해석될 수 있다.
  - 이메일 설정은 optional.
- 유효성 규칙:
  - `smtpPort`는 양의 정수여야 한다.
  - `to`는 쉼표 구분 문자열을 배열로 변환한다.
  - `HEADED`, `CI`는 `'true'`/boolean `true`를 true로 전처리한다.
- 출력 타입/필드:
  - `Config`, `EmailConfig` 타입.
  - `getConfig()`.

## 행동 시나리오
- SCN-001: Given 유효 환경 변수, When `getConfig()` 최초 호출, Then `config!=null` and `cacheInitialized=true`.
- SCN-002: Given 스키마 위반 환경 변수, When 설정 로딩 시도, Then `zodErrorThrown=true` and `output contains "환경 변수 설정 오류"`.

## 오류 계약
- 에러 코드: 없음(명시적 코드 상수 없음).
- HTTP status(해당 시): 없음.
- 재시도 가능 여부: 없음(검증 실패는 즉시 예외 반환).
- 발생 조건: 환경 변수 타입/형식 검증 실패.

## 불변식/제약
- 트랜잭션 경계: 없음.
- 정합성 규칙: 단일 프로세스에서 `getConfig()`는 동일 객체를 재사용한다.
- 멱등성 규칙: 환경이 동일하면 같은 파싱 결과를 반환한다.
- 순서 보장 규칙: `loadConfig()` 성공 후에만 `_config`가 설정된다.

## 비기능 요구
- 성능(SLO): 프로세스당 단일 캐시 로딩 경계로 별도 수치형 SLO를 정의하지 않는다.
- 보안 요구: 비밀값은 환경 변수에서만 읽는다.
- 타임아웃: 해당 없음.
- 동시성 요구: 단일 프로세스에서 `_config` 캐시 공유를 사용한다.

## 의존성 계약
- 내부 경계: 없음.
- 외부 서비스: 없음.
- 외부 라이브러리: Zod.

## 수용 기준
- [ ] 설정 파싱이 Zod 스키마 규칙을 따른다.
- [ ] 이메일 설정은 조건부로만 활성화된다.
- [ ] `getConfig()`가 캐시된 설정을 반환한다.
