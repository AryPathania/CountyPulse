# Spec: Foundation (quality gates, packages, conventions)

Status: Draft  
Owner: Orchestrator + Validation Agent  
Date: 2026-01-10

## Goals
1) Make the codebase **merge-safe** before feature work.
2) Lock in DRY conventions so agents don’t explode complexity.
3) Establish testing and duplication gates.

## Decisions (summary)

## CountyPulse pivot
- Delete `packages/pipeline` and `packages/connectors` (CountyPulse domain)
- Keep `packages/ui` (auth scaffolding + test harness) and `packages/db` (Supabase client pattern)
- Add `packages/shared` for pure logic/contracts
- Follow: `docs/migration/COUNTYPULSE_TO_ODIE.md`

- Use TanStack Query for server-state (Supabase data) and a tiny client store for ephemeral UI state.
- Keep Supabase access centralized in `packages/db`.
- Use pgvector inside Supabase Postgres for embeddings (no per-user external vector DB in MVP).
- Use Playwright for E2E flows.

## Repo changes
1) Add standard scripts at root:
- `lint`, `typecheck`, `test:unit`, `test:e2e`, `dup:check`, `quality`

2) Add CI workflow
- Run `pnpm quality` on PR
- Fail on:
  - `*.skip`
  - coverage < 90%
  - jscpd duplication threshold exceeded

3) Add jscpd config
Use jscpd to detect copy/paste and fail CI. citeturn0search3turn0search7

4) Add “no skip” linter step
A simple grep gate (fast + reliable).

## Acceptance criteria
- `pnpm quality` passes locally
- CI runs on PR and blocks merge on:
  - failing tests
  - skipped tests
  - low coverage
  - duplication threshold exceeded

## Test plan
- Ensure a sample failing test blocks CI
- Ensure adding `it.skip` blocks CI
- Ensure intentional duplication blocks CI
