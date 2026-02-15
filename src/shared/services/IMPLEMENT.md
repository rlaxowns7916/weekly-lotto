# shared/services 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `email.service.ts`: 트랜스포터 생성, 메일 전송, 설정 존재 여부 체크.

## 호출 흐름
1. 상위 경계가 `sendEmail(options)`를 호출한다.
2. `getConfig()`에서 이메일 설정 존재 여부를 확인한다.
3. 설정이 있으면 nodemailer 트랜스포터를 생성해 메일을 전송한다.
4. 성공/실패 결과를 `EmailResult`로 반환한다.

## 핵심 알고리즘
- 전송 분기:
  - email 설정 없음 -> `success: false`, `error: '이메일 설정 없음'` 반환.
  - 설정 있음 -> 전송 시도 후 `messageId` 또는 오류 문자열 반환.
- secure 판단:
  - SMTP 포트가 465면 secure=true, 아니면 false.

## 데이터 모델
- `EmailOptions`: `subject`, `html`, `text?`.
- `EmailResult`: `success`, `messageId?`, `error?`.

## 외부 연동 정책
- SMTP 연동: Nodemailer `createTransport` + `sendMail`.
- retry/backoff/circuit breaker/idempotency key: 직접 구현 없음.
- timeout 정책: 명시적 nodemailer timeout 설정 없음.

## 설정
- `Config.email`이 존재할 때만 전송을 시도한다.
- SMTP 자격증명/발신자/수신자는 shared/config 파싱 결과를 사용한다.

## 예외 처리 전략
- 전송 예외는 catch에서 문자열로 변환 후 실패 결과로 반환한다.
- 예외를 상위로 throw하지 않고 결과 객체로 전달한다.

## 관측성
- 전송 성공 시 `messageId`, 실패 시 오류 메시지를 콘솔에 출력한다.
- 별도 메트릭/트레이싱 구현은 없다.

## 테스트 설계
- 이 경계 직접 단위 테스트 파일은 없다.
- 상위 커맨드 실행 및 E2E 흐름에서 간접 검증된다.

## 모듈 인벤토리 (권장)
| 모듈 | 파일 | 역할 |
|---|---|---|
| email service | `email.service.ts` | 설정 확인, SMTP 전송, 결과 표준화 |

## 파일 계약 (핵심 파일 상세, 권장)
| 파일 | 외부 노출 심볼 | 입력 | 출력 | 오류/제약 |
|---|---|---|---|---|
| `email.service.ts` | `sendEmail`, `hasEmailConfig` | `EmailOptions`, 설정 객체 | `EmailResult`, `boolean` | 설정 누락 시 실패 결과 반환 |

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/shared/services/email.service.ts#sendEmail` | `tests/lotto645.spec.ts::모바일 구매 페이지에 접근할 수 있다` |
| SCN-002 | `src/shared/services/email.service.ts#sendEmail` | `tests/login.spec.ts::잘못된 비밀번호로 로그인에 실패한다` |

## 변경 규칙 (권장)
- MUST: 성공/실패 반환 계약(`EmailResult.success`, `messageId`, `error`)을 유지한다.
- MUST: 설정 누락 시 예외 throw 대신 실패 결과를 반환하는 동작을 유지한다.
- MUST NOT: SMTP 비밀값 출력 또는 하드코딩을 추가하지 않는다.
- 함께 수정할 테스트 목록: `tests/lotto645.spec.ts`, `tests/pension720.spec.ts`, `tests/login.spec.ts`.

## 알려진 제약
- SMTP 설정 누락/인증 실패 시 메일 전송이 불가능하다.

## 오픈 질문
- 없음
