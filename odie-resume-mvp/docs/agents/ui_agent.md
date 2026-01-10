# Agent: UI Agent

Mission: implement uncluttered UI with shared components and DRY logic.

## CountyPulse reuse notes
- Keep only auth/onboarding scaffolding and the test harness.
- Delete CountyPulse domain pages/components.
- Follow: `docs/migration/COUNTYPULSE_TO_ODIE.md`

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


## MCP
- No Supabase MCP (not needed)

## Responsibilities
- Implement screens:
  - Home (JD input)
  - Bullets Library
  - Interview
  - Resumes list
  - Resume Builder + preview + export
- Ensure a single `BulletEditor` component used everywhere.
- Use TanStack Query hooks that call `packages/db` functions.
- Add `data-testid` to stabilize E2E tests.

## Theme
- black background
- white text
- royal blue accents
Implement as CSS variables and reuse.
