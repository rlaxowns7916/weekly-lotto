# SRTE Schema Changelog

## SRTE-DOCS-1

- Introduced explicit `Schema-Version` metadata in `CLAUDE.md` and `IMPLEMENT.md`.
- Defined governance policy: latest-only `document-schema.md` + version snapshots.
- Added golden templates:
  - `.opencode/spec-driven-roundtrip-engine/rules/examples/CLAUDE.example.md`
  - `.opencode/spec-driven-roundtrip-engine/rules/examples/IMPLEMENT.example.md`
- Added version validation hooks to compile/decompile/plan reporting rules.
- Hardened SRTE-DOCS-1 as contract-first schema (pre-release):
  - CLAUDE.md now requires scope/non-scope, interface contract, executable scenarios, error contract, invariants, non-functional requirements, dependency contract, and acceptance checklist.
  - IMPLEMENT.md now requires module decomposition, call flow, algorithm rationale, data model, external integration policy, settings, exception strategy, observability, and test design.
- Clarified verifiable-contract writing guidance within SRTE-DOCS-1 (non-breaking):
  - Added explicit rules for observable assertion values (field/operator/expected value) in scenario statements.
  - Added examples of acceptable quantified constraints and unacceptable vague wording.
  - Added compile-time remediation checklist/report expectations for quality-gate failures.
- Operational hardening updates (non-breaking):
  - Normalized command/skill include paths from `@.opencode/...` to `@plugins/...`.
  - Added `.opencode/spec-driven-roundtrip-engine/rules/schema-versions/CURRENT.md` as latest schema pointer used by validation/reporting.
  - Added quality-gate failure codes (`QG-1`~`QG-4`) for deterministic reporting.
  - Added `/srte-verify` command for pre-compile readiness verification.
- IMPLEMENT determinism hardening updates (non-breaking):
  - Added optional-but-enforceable (when present) sections: `모듈 인벤토리`, `파일 계약`, `시나리오 추적성`, `변경 규칙`.
  - Added conditional quality-gate code `QG-5` for traceability/determinism section completeness.
  - Updated compile/decompile/verify/report rules to consume and validate determinism sections.
- Unknown-handling hardening updates (non-breaking):
  - Added mandatory triad for every `확인 불가`/`오픈 질문`: `확인 불가 사유`, `확인 경로`, `해소 조건`.
  - Added quality-gate code `QG-6` for missing unknown-handling triad fields.
  - Updated compile/decompile/verify/plan/report/example docs to enforce and demonstrate deterministic resolution metadata.
- Determinism trigger + assumption safety updates (non-breaking):
  - Added explicit trigger rules for when determinism sections are mandatory (`SCN>=3`, source files>=5, or external integrations>=2).
  - Added fact-vs-interpretation classification (`F1/F2/F3`) for decompile documentation boundaries.
  - Added compile-only quality-gate code `QG-7` for assumption safety (`BLOCKING` prohibition, `NON-BLOCKING` cap).
- Plan upstream quality hardening updates (non-breaking):
  - Added PRD quality-gate set `PQG-1`~`PQG-6` for `/srte-plan` Phase 1.5.
  - Added phase transition invariant: `사용자 승인 AND PQG 전부 통과` required before Phase 2.
  - Added upstream rollback marker `UPSTREAM-PRD-DRIFT` for verify/compile failures rooted in PRD ambiguity.
- Tool prerequisite clarity updates (non-breaking):
  - Added explicit LSP prerequisite and fallback policy (`LspServers` precheck + install guidance).
  - Added missing-LSP handling rule: warn first, run alternative validation, and report degraded verification mode.
- Serena-only diagnostics path updates (non-breaking):
  - Unified SRTE analysis/diagnostics path to `serena-mcp`.
  - Removed `lsp_diagnostics` from SRTE verification path in favor of `serena-mcp` + build/test/reference checks.

## Changelog Rule

When releasing a new schema version:
1. Add a new section `## SRTE-DOCS-<N>`.
2. Record what changed and why.
3. Reference corresponding migration doc under `.opencode/spec-driven-roundtrip-engine/rules/schema-migrations/` when needed.
