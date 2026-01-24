---
name: verification-loop
description: 코드 변경 후 빌드, 타입 체크, 린트, 테스트, 보안 스캔을 수행하는 품질 검증 스킬
---

# Verification Loop

코드 변경 후 품질 검증을 수행하는 스킬입니다.

## 트리거

다음 상황에서 이 스킬을 사용하세요:
- `/verify` 명령어 입력 시
- 기능 구현 완료 후
- PR 생성 전
- 리팩토링 후

## 실행 단계

### 1. 빌드 검증

```bash
npm run build 2>&1 | tail -20
```

빌드 실패 시 즉시 중단하고 수정하세요.

### 2. 타입 체크

```bash
npx tsc --noEmit 2>&1 | head -30
```

모든 타입 에러를 보고하고 치명적인 에러는 수정하세요.

### 3. 린트 체크

```bash
npm run lint 2>&1 | head -30
```

### 4. 테스트 실행

```bash
npm run test 2>&1 | tail -50
```

결과 보고:
- 총 테스트 수
- 통과/실패 수
- 커버리지 (목표: 80%)

### 5. 보안 스캔

```bash
# 시크릿 키 검사
grep -rn "sk-\|api_key\|password\s*=" --include="*.ts" src/ 2>/dev/null | head -10

# console.log 검사
grep -rn "console.log" --include="*.ts" src/ 2>/dev/null | head -10
```

### 6. 변경 사항 검토

```bash
git diff --stat
git diff HEAD~1 --name-only 2>/dev/null || git diff --cached --name-only
```

각 변경 파일 검토:
- 의도하지 않은 변경
- 누락된 에러 처리
- 엣지 케이스

## 출력 형식

모든 단계 완료 후 검증 리포트를 생성하세요:

```
VERIFICATION REPORT
==================

Build:     [PASS/FAIL]
Types:     [PASS/FAIL] (X errors)
Lint:      [PASS/FAIL] (X warnings)
Tests:     [PASS/FAIL] (X/Y passed)
Security:  [PASS/FAIL] (X issues)
Changes:   [X files]

Status:    [READY/NOT READY] for PR

Issues:
1. ...
2. ...
```

## Playwright 프로젝트 추가 검증

Playwright 프로젝트의 경우 추가로 실행:

```bash
# Playwright 브라우저 설치 확인
npx playwright --version

# 헤드리스 모드 테스트 (CI 환경)
CI=true npm run buy -- --dry-run 2>&1 | tail -20
```
