# Spec: Testing strategy (LLM-friendly, actually useful)

Status: Draft  
Owner: Test Agent + Validation Agent  
Date: 2026-01-10

## Goals
- Tests fail only when functionality is actually broken.
- Tests are readable enough for an LLM to fix failures.
- CI gates enforce:
  - 100% passing
  - >90% coverage
  - no skipped tests
  - no duplicate code

## Test pyramid
1) Unit (Vitest)
- pure functions (resume JSON schema, bullet diff, parsing)
2) Integration
- query functions (db layer) with MSW or test DB
3) E2E (Playwright)
- key flows: login, bullets CRUD, resume builder DnD, JD → draft

## Coverage target
- Unit+integration combined >90%
- E2E not counted for coverage

## No skip gate
Fail build if:
- `it.skip`, `describe.skip`, `test.skip`
- Playwright `test.skip`

## Visual testing (nice-to-have)
- 1–2 screenshot tests on resume preview to catch regressions
- keep them stable by using deterministic fonts and consistent viewport

## Acceptance criteria
- `pnpm test:unit` produces coverage report and passes gate
- `pnpm test:e2e` passes
- CI fails if any skipped test exists

