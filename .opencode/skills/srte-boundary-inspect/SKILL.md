---
name: srte-boundary-inspect
description: >
  프로젝트의 경계(Boundary) 구조를 탐색하고 시각화한다.
  문서화된 경계뿐 아니라 미문서화 경계(코드는 있으나 CLAUDE.md 없음)도 탐지한다.
  "경계 구조 보여줘", "경계 목록", "바운더리 확인", "경계 트리",
  "프로젝트 구조 파악", "미문서화 경계 찾아줘" 등의 요청 시 사용한다.
  읽기 전용 작업으로 파일을 변경하지 않는다.
---

# Boundary Inspect

프로젝트의 경계 구조를 탐색하고 시각화한다.
문서 위치/경계 판정/제외 규칙은 `boundary-definition.md`를 따른다.
경계 식별은 `boundary-definition.md`의 경계 판정 알고리즘(탐지 -> 식별 -> 분류)을 그대로 따른다.

다음 규칙을 먼저 읽고 준수한다.

@.opencode/spec-driven-roundtrip-engine/rules/boundary-definition.md

## 탐색 절차

### 1단계: 문서화된 경계 탐색

1. 프로젝트 루트부터 재귀적으로 `CLAUDE.md` 파일을 탐색한다.
2. 각 발견 위치에서 `IMPLEMENT.md` 존재 여부를 확인한다.
3. 상태를 분류한다:
    - **문서화 완전**: CLAUDE.md + IMPLEMENT.md 모두 존재
    - **문서화 불완전**: CLAUDE.md만 존재 (정책 위반. decompile로 즉시 보정 대상)

### 2단계: 미문서화 경계 탐지

1. 빌드 파일(`build.gradle.kts`, `package.json`, `Cargo.toml` 등)이 있는 디렉토리를 탐색한다.
2. 소스 코드 파일(`.java`, `.kt`, `.ts`, `.js`, `.py`, `.go`, `.rs` 등)이 **직접** 포함되고, glue-only(파일명 후보: `index.ts`, `index.js`, `index.mjs`, `index.cjs`, `__init__.py`, `__init__.pyi`, `mod.rs`; 내용은 re-export/초기화 전용) 조건이 아닌 디렉토리 중 `CLAUDE.md`가 없는 것을 탐지한다.
3. 탐지한 디렉토리를 경계로 식별하고, `CLAUDE.md` 유무로 **미문서화** 경계로 분류한다.

경계 후보에서 **제외**하는 디렉토리:
- 소스 파일 없이 하위 디렉토리만 포함하는 중간 패키지 경로 (예: `com/example/`).
- 리소스 디렉토리 (`resources/`, `static/`, `public/` 등 코드가 아닌 자원).
- 문서/운영 설정 전용 기본 제외 경로와 사용자 정의 제외 경로(`boundary-definition.md` 기준).

### 3단계: 트리 구성

1. 문서화된 경계와 미문서화 경계를 합쳐 중첩 관계를 파악한다.
2. 트리 형태로 출력한다.
3. 문서화 불완전/미문서화 경계가 있으면 "문서 완전성 위반"으로 요약에 표시한다.

## 출력 형식

```
경계 구조:
├── boundary-a/          (문서화 완전)
│   ├── CLAUDE.md
│   ├── IMPLEMENT.md
│   └── sub-boundary/    (문서화 불완전 — IMPLEMENT.md 없음)
│       └── CLAUDE.md
├── boundary-b/          (미문서화 — CLAUDE.md 없음, build.gradle.kts 감지)
│   └── src/main/.../
│       ├── domain/      (미문서화)
│       └── infra/       (미문서화)
└── 요약:
    - 문서화 완전: {X}개
    - 문서화 불완전: {Y}개
    - 미문서화: {Z}개 (decompile 권장)
    - 문서 완전성 위반: {Y+Z}개
```

## 제약

1. 파일을 생성/수정/삭제하지 않는다.
2. 제외 디렉토리와 사용자 정의 제외 경로는 `boundary-definition.md` 기준으로 탐색하지 않는다.
