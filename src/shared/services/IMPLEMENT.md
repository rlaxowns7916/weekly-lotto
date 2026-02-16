# shared/services 구현 상세
Schema-Version: SRTE-DOCS-1

## 모듈 분해
- `email.service.ts`: 트랜스포터 생성, 메일 전송, 첨부 상한/부분 첨부 정책 적용, 설정 존재 여부 체크.

## 호출 흐름
1. 상위 경계가 `sendEmail(options)`를 호출한다.
2. `getConfig()`에서 이메일 설정 존재 여부를 확인한다.
3. 설정이 있으면 첨부 총량(10MB 상한)을 평가해 full/partial 목록을 결정한다.
4. nodemailer 트랜스포터를 생성해 메일을 전송한다.
5. 성공/실패 결과를 `EmailResult`로 반환한다.

## 핵심 알고리즘
- 전송 분기:
  - email 설정 없음 -> `success: false`, `error: '이메일 설정 없음'` 반환.
  - 설정 있음 -> 전송 시도 후 `messageId` 또는 오류 문자열 반환.
- 첨부 분기:
  - 첨부 총량 `<=10MB` -> 전체 첨부(`attachmentStatus=FULL`).
  - 첨부 총량 `>10MB` -> 우선순위 기준 부분 첨부(`attachmentStatus=PARTIAL`).
- secure 판단:
  - SMTP 포트가 465면 secure=true, 아니면 false.

## 데이터 모델
- `EmailOptions`: `subject`, `html`, `text?`, `attachments?`.
- `EmailResult`: `success`, `messageId?`, `error?`, `attachmentStatus?`.

## 외부 연동 정책
- SMTP 연동: Nodemailer `createTransport` + `sendMail` + 첨부 목록(`attachments`).
- retry/backoff/circuit breaker/idempotency key: 직접 구현 없음.
- timeout 정책: 명시적 nodemailer timeout 설정 없음.

## 설정
- `Config.email`이 존재할 때만 전송을 시도한다.
- SMTP 자격증명/발신자/수신자는 shared/config 파싱 결과를 사용한다.

## 예외 처리 전략
- 전송 예외는 catch에서 문자열로 변환 후 실패 결과로 반환한다.
- 예외를 상위로 throw하지 않고 결과 객체로 전달한다.

## 실패 상세 진단 구현 정책
- `EmailResult` 실패 경로는 `errorCode`, `errorCategory` 필드를 포함해 상위 경계와 형식을 맞춘다.
- SMTP 설정 누락/인증 실패/전송 실패를 `EMAIL_SEND_FAILED` 하위 원인으로 분기 기록한다.
- 문자열 메시지와 별개로 구조화 코드 필드를 우선 소비 대상으로 둔다.
- 첨부 상한 초과는 메일 전송 실패로 격상하지 않고 부분 첨부 상태로 반환한다.

## 관측성
- 전송 성공 시 `messageId`, 실패 시 오류 메시지를 콘솔에 출력한다.
- 부분 첨부 발생 시 제외 파일 수/용량을 콘솔에 출력한다.
- 별도 메트릭/트레이싱 구현은 없다.

## 테스트 설계
- 단위 테스트: `src/shared/services/email.service.test.ts`.
- 상위 커맨드 실행 및 E2E 흐름에서 간접 검증을 병행한다.

## 모듈 인벤토리 (권장)
| 모듈 | 파일 | 역할 |
|---|---|---|
| email service | `email.service.ts` | 설정 확인, SMTP 전송, 결과 표준화 |

## 파일 계약 (핵심 파일 상세, 권장)
| 파일 | 외부 노출 심볼 | 입력 | 출력 | 오류/제약 |
|---|---|---|---|---|
| `email.service.ts` | `sendEmail`, `hasEmailConfig` | `EmailOptions`, 설정 객체 | `EmailResult`, `boolean` | 설정 누락 시 실패 결과 반환, 첨부 상한 10MB |

## 시나리오 추적성 (권장)
| SCN | 구현 파일#심볼 | 테스트명 |
|---|---|---|
| SCN-001 | `src/shared/services/email.service.ts#sendEmail` | `src/shared/services/email.service.test.ts::should_apply_partial_attachment_policy_when_total_size_exceeds_limit` |
| SCN-002 | `src/shared/services/email.service.ts#sendEmail` | `src/shared/services/email.service.test.ts::returns structured EMAIL_SEND_FAILED when smtp send throws` |
| SCN-003 | `src/shared/services/email.service.ts#sendEmail` | `src/shared/services/email.service.test.ts::should_apply_partial_attachment_policy_when_total_size_exceeds_limit` |

## 변경 규칙 (권장)
- MUST: 성공/실패 반환 계약(`EmailResult.success`, `messageId`, `error`)을 유지한다.
- MUST: 설정 누락 시 예외 throw 대신 실패 결과를 반환하는 동작을 유지한다.
- MUST NOT: SMTP 비밀값 출력 또는 하드코딩을 추가하지 않는다.
- 함께 수정할 테스트 목록: `src/shared/services/email.service.test.ts`, `tests/lotto645.spec.ts`, `tests/pension720.spec.ts`, `tests/login.spec.ts`.

## 알려진 제약
- SMTP 설정 누락/인증 실패 시 메일 전송이 불가능하다.

## 오픈 질문
- 없음
