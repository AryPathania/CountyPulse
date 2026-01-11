# Skill: Repo conventions (DRY-first)

## Golden rules
- If logic will be used twice, extract it **now**.
- UI never calls Supabase directly. UI calls `@county-pulse/db` query functions.
- Keep “business logic” out of React components:
  - parsing, scoring, validation, transformations belong in pure TS modules (testable)

## Where to put shared code
- UI shared components: `packages/ui/src/components/*`
- UI domain modules (no React): `packages/ui/src/domain/*`
- Cross-package shared types/contracts (recommended):
  - add `packages/shared/` (new) with Zod + TS types
  - or, if you refuse a new package: keep contracts in `packages/db/src/contracts/*` and re-export

## Testing expectation
- Domain modules: unit tests
- Query functions: integration tests with MSW or test DB
- DnD + flows: Playwright

## Style tokens (theme)
- background: black
- text: white
- accent: royal blue
Expose as CSS variables in a single file:
- `packages/ui/src/styles/theme.css`

