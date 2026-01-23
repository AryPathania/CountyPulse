# Skill: Duplication + quality gates

## Duplicate code detection
Use **jscpd** and fail CI if duplication exceeds a tiny threshold.

Suggested config:
- ignore generated files (`types.ts`)
- ignore `dist/`, `.turbo/`
- start with threshold ~1% (tight), adjust if noisy

## No skipped tests
- enforce with a simple grep gate in CI:
  - fail if `it.skip` / `describe.skip` / `test.skip` exists
- same for Playwright: `test.skip`

## Naming + patch-on-patch
Add a PR checklist + validation script that flags:
- new functions that look like “oldNameV2”, “IncludingX”, “Patched”
This is not perfect, but it catches the worst habits early.
