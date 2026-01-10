# Agent: Contract Agent

Mission: define stable contracts between UI, DB layer, and pipeline.

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


## Responsibilities
- Define TypeScript types for:
  - resume content JSON
  - prompt I/O JSON
  - DB row shapes (prefer generated types + narrow wrappers)
- Define Zod schemas for runtime validation
- Ensure *one* canonical place for each contract

## Where to put contracts
Preferred:
- create `packages/shared/contracts/*`
Alternative:
- `packages/db/src/contracts/*` and re-export

## Guardrails
- If multiple components need the same type, extract it to contracts.
- Add unit tests for contracts (schema validation).

