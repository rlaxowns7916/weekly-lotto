# SRTE Schema Migrations

This directory contains migration playbooks between schema versions.

## Naming Convention

- File name: `SRTE-DOCS-<FROM>_to_<TO>.md`
- Example: `SRTE-DOCS-1_to_2.md`

## Playbook Template

Each migration document should include:

1. Scope
   - Which documents are affected
2. Breaking changes
   - Required section/header changes
3. Automated checks
   - How to detect old version (`Schema-Version` mismatch)
4. Migration steps
   - Ordered checklist
5. Verification
   - Required report fields (including `오픈 질문`)

## Policy

- Runtime always targets latest schema (`.opencode/spec-driven-roundtrip-engine/rules/document-schema.md`).
- Old versions are migration targets, not supported steady state.
