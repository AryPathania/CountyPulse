# Agent: Telemetry/Eval Agent

Mission: design telemetry that enables better prompts and future fine-tunes without high cost.

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
- Supabase MCP: only if implementing schema / writing telemetry code

## Responsibilities
- Ensure every LLM call logs a run row.
- Ensure bullets preserve original + edited texts.
- Define “outcome” signals (optional) and how they relate to drafts/resumes.
- Provide a minimal offline evaluation harness.

