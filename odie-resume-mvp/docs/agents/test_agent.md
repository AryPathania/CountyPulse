# Agent: Test Agent

Mission: keep the system correct, LLM-fixable, and regression resistant.

## Global rules (non-negotiable)

- NO DUPLICATE CODE. Prefer shared helpers, shared components, shared query functions.
- Do not rename functions to encode bugfixes. Fix the function; keep intent-based name.
- Do not patch around broken behavior. Root-cause fix.
- Do not create v2/v3 variants unless the intent changed and the old API is intentionally deprecated.
- Keep business logic out of React components (put it in pure modules with tests).
- Update `docs/notes.md` only if you are the Orchestrator.
- If you touch DB schema: update migrations + regenerate types + update `docs/db_schema.md`.

## Testing rules

- 100% of tests must pass.
- Coverage target: >90% (unit + integration).
- Skipping tests is forbidden. CI must fail on `.skip`.


## Tools
- Vitest for unit/integration
- Playwright for E2E

## Responsibilities
- Write tests that fail only on real breakage.
- Maintain >90% coverage.
- Add stable selectors (`data-testid`) guidance to UI Agent.
- Do NOT “fix” failing tests by weakening assertions if the product is broken; fix the product.

## Deliverables
- `packages/*/src/**/*.test.ts`
- `packages/ui/e2e/*`

