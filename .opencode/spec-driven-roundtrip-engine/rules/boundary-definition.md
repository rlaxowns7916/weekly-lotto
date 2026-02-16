# 경계(Boundary) 정의

## 경계란

경계는 디렉토리 단위로 정의된다.
실행/빌드 대상 소스 구현이 존재하는 디렉토리만 경계다. 각 경계는 자신만의 `CLAUDE.md`와 `IMPLEMENT.md`로 명세된다.

## 핵심 원칙

**실행/빌드 대상 구현이 있는 디렉토리 = 문서화가 필요한 경계.**
디렉토리에 고유한 소스 구현 로직이 있다면, 그것이 모듈이든 계층이든 세부 구현이든 경계로 취급한다.
`CLAUDE.md`와 `IMPLEMENT.md`는 해당 경계의 구현 코드가 있는 동일 디렉토리(경계 루트)에 함께 위치해야 한다. 별도 문서 전용 디렉토리(`docs/` 등)로 분리하지 않는다.
문서/운영 설정 전용 디렉토리(`.github/`, `spec/`, `docs/`, `.opencode/`, `prd/` 등)는 경계 후보에서 제외한다.

## 사용자 정의 제외 경로

프로젝트별 추가 제외 경로는 프로젝트 루트 `CLAUDE.md`의 `## SRTE Boundary Excludes` 섹션에 한 줄씩 기록한다.

예시:

```markdown
## SRTE Boundary Excludes
- out/
- target/
- coverage/
- .turbo/
```

경계 판정 시 기본 제외 목록과 사용자 정의 제외 목록을 합집합으로 적용한다.

## 경계 판정 알고리즘 (결정형)

경계 판정은 아래 순서로 수행한다.

1. 디렉토리가 제외 디렉토리(기본 제외 + 사용자 정의 제외) 하위면 즉시 제외한다.
2. 디렉토리에 빌드 파일(`build.gradle.kts`, `package.json`, `Cargo.toml` 등)이 직접 있으면 경계다.
3. 디렉토리에 소스 코드 파일(`.java`, `.kt`, `.ts`, `.js`, `.py`, `.go`, `.rs` 등)이 직접 있고, 해당 파일들이 glue-only 조건만으로 구성되지 않으면 경계다.
4. 2, 3을 모두 만족하지 않으면 경계가 아니다.
5. 부모가 경계여도 자식 디렉토리는 동일 알고리즘으로 독립 판정한다.

### glue-only 판정 규칙 (결정형)

glue-only 판정은 **파일명 후보 + 파일 내용**을 함께 본다.

1. 파일명 후보 목록(언어별):
   - TypeScript/JavaScript: `index.ts`, `index.js`, `index.mjs`, `index.cjs`
   - Python: `__init__.py`, `__init__.pyi`
   - Rust: `mod.rs`
2. 파일명 후보에 속해도, 파일에 re-export/초기화 외 고유 로직(예: 함수/클래스/비즈니스 계산, 상태 변경)이 있으면 glue-only가 아니다.
3. 디렉토리의 소스 파일이 모두 파일명 후보에 속하고, 각 파일이 re-export/초기화 전용일 때만 glue-only 디렉토리로 본다.

용어를 다음처럼 고정한다:
- **탐지**: 후보 디렉토리를 찾는 단계.
- **식별**: 후보가 경계인지 판정하는 단계.
- **분류**: 식별된 경계를 문서화 상태(완전/불완전/미문서화)로 나누는 단계.

## 문서 완전성 규칙 (결정형)

모든 식별된 경계는 `CLAUDE.md`와 `IMPLEMENT.md`를 모두 가져야 한다.

1. 정상 상태는 문서화 완전(`CLAUDE.md` + `IMPLEMENT.md`) 하나뿐이다.
2. 문서화 불완전/미문서화는 허용 가능한 최종 상태가 아니라, 즉시 보정해야 하는 과도 상태다.
3. decompile은 종료 시 대상 경계를 문서화 완전 상태로 맞춰야 한다.
4. compile은 문서화 완전 경계에서만 진행한다.

## 경계 유형

### 1. 모듈 경계

빌드 단위로 구분되는 프로젝트/모듈 수준.
`build.gradle.kts`, `package.json`, `Cargo.toml` 등 빌드 파일이 있는 디렉토리.

### 2. 계층 경계

같은 모듈 안에서 아키텍처 계층으로 분리된 디렉토리.
domain, application, infrastructure 등.

### 3. 구현 경계

같은 계층 안에서 기능/도메인별로 분리된 디렉토리.
각 디렉토리가 고유한 인터페이스와 구현을 가지므로 개별 경계로 문서화한다.

### 통합 예시 (모듈 > 계층 > 구현)

```
my-marketplace/
├── backend/                             ← 모듈 경계 (build.gradle.kts)
│   ├── CLAUDE.md
│   ├── IMPLEMENT.md
│   └── src/main/.../
│       ├── domain/                      ← 계층 경계
│       │   ├── CLAUDE.md
│       │   ├── IMPLEMENT.md
│       │   └── payments/card/
│       │       ├── bc/                  ← 구현 경계
│       │       │   ├── CLAUDE.md
│       │       │   └── IMPLEMENT.md
│       │       └── master/              ← 구현 경계
│       │           ├── CLAUDE.md
│       │           └── IMPLEMENT.md
│       └── infrastructure/              ← 계층 경계
│           ├── CLAUDE.md
│           └── IMPLEMENT.md
└── frontend/                            ← 모듈 경계 (package.json)
    ├── CLAUDE.md
    └── IMPLEMENT.md
```

### 유형 간 관계

1. 모듈 > 계층 > 구현 순으로 자연스럽게 중첩된다.
2. 상위 경계의 CLAUDE.md는 하위 경계의 **존재와 역할**을 기술할 수 있으나, 하위의 내부 구현은 기술하지 않는다.
3. 같은 수준의 경계끼리는 상호 **인터페이스 계약**만 기술한다.

## 경계 상태

경계는 구현 유무로 결정되고, 문서화 수준은 상태로 구분한다.

| 상태 | 조건 | 의미 |
|------|------|------|
| 문서화 완전 | CLAUDE.md + IMPLEMENT.md 존재 | 정상 상태. compile/decompile 가능 |
| 문서화 불완전 | CLAUDE.md만 존재 | 비정상 과도 상태. decompile로 즉시 보정 필요 |
| 미문서화 | 구현은 있으나 CLAUDE.md 없음 | 비정상 과도 상태. decompile로 즉시 보정 필요 |

미문서화 경계를 식별하는 단서:
1. 빌드 파일 존재 (`build.gradle.kts`, `package.json`, `Cargo.toml` 등).
2. glue-only가 아닌 소스 코드 파일이 직접 포함된 디렉토리.
3. 상위 경계 문서에서 언급되었으나 자체 문서가 없는 디렉토리.
4. 단, 문서/운영 설정 전용 디렉토리(`.github/`, `spec/`, `docs/`, `.opencode/`, `prd/`)와 사용자 정의 제외 경로는 제외한다.

## 중첩 규칙

1. 경계는 중첩될 수 있다 (모듈 > 계층 > 구현).
2. 부모 경계 문서는 자식 경계의 **존재**를 인지할 수 있으나, 자식의 내부 구현은 기술하지 않는다.
3. 자식 경계 문서는 부모 경계의 내부 구현을 기술하지 않는다.

## 경계 생성 기준

경계를 만들어야 할 때:

1. 디렉토리에 고유한 구현 로직이 있을 때.
2. 디렉토리별로 인터페이스나 동작이 다를 때 (예: 카드사별 결제 구현).
3. 해당 구현을 이해하려면 별도 문서가 필요할 때.

경계를 만들지 않아야 할 때:

1. 소스 코드 파일/빌드 파일 없이 하위 디렉토리만 가지는 중간 경로인 경우 (예: `com/example/`).
2. 빌드 산출물, 생성 코드 등 사람이 작성하지 않은 코드.
3. 실행/빌드 대상 소스 구현이 아닌 문서/운영 설정 전용 디렉토리 (`.github/`, `spec/`, `docs/`, `.opencode/`, `prd/` 등).
4. 파일명 후보(`index.ts`, `index.js`, `index.mjs`, `index.cjs`, `__init__.py`, `__init__.pyi`, `mod.rs`)만 있고 각 파일이 re-export/초기화 전용인 glue 디렉토리.

## 제외 디렉토리

경계 탐색 시 다음 디렉토리는 무시한다:
`node_modules`, `.git`, `dist`, `build`, `.next`, `__pycache__`, `.venv`, `.github`, `spec`, `docs`, `.opencode`, `prd`
