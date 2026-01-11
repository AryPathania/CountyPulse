# CI quality gates

## Gates
1) Lint
2) Typecheck
3) Unit+integration tests with coverage > 90%
4) E2E tests (Playwright)
5) Duplicate code check (jscpd)
6) No skipped tests

## No skipped tests enforcement
Fail if any of these patterns exist:
- `it.skip(`
- `describe.skip(`
- `test.skip(`
- Playwright `test.skip(`

## Duplicate code
- Use jscpd
- Ignore:
  - generated types
  - build outputs

