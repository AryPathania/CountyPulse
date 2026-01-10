
# Odie Resume — MVP Docs (Start Here)

Date: 2026-01-10

You’re pivoting an existing repo (**CountyPulse**) into **Odie AI**.

**Be brutal with deletion.** CountyPulse’s domain logic (King County datasets, Socrata, scout pipeline, etc.) is irrelevant and should be removed. Keep only “good bones” that save time:
- pnpm workspace tooling
- Supabase wiring (auth, local dev, edge functions scaffolding)
- UI auth + onboarding scaffolding (optional, but usually worth keeping)
- DB client + “one module for DB calls” pattern
- existing test harness (Vitest / Testing Library / MSW)

**First action:** follow the pivot checklist:
- `docs/migration/COUNTYPULSE_TO_ODIE.md`

---

## How to use these docs

This docs bundle is designed for an agentic workflow:

1. Read the feature spec in `docs/specs/`
2. Confirm/extend the contracts (types + validation)
3. Implement with **zero duplicate code**
4. Add/expand tests until coverage > 90%
5. Run validation gates (duplication, naming, no-skips, lint)
6. Update `docs/notes.md` and (if DB touched) `docs/db_schema.md`

---

## Repo mapping (recommended after pivot)

### Minimal-churn structure (fastest)
- `packages/ui` → Odie web app (rename package to `@odie/web`)
- `packages/db` → Odie data access layer (rename to `@odie/db`)
- add `packages/shared` → pure logic / contracts / validators

Delete:
- `packages/pipeline`
- `packages/connectors`

### “Clean” structure (optional later)
- move UI to `apps/web`
- keep `packages/db`, `packages/shared`

Pick minimal-churn first; you can rearrange later once MVP works.

---

## Phase order

Phase 0.5 is explicit (because you’re reusing infra):
- `docs/specs/09_phase_0_5_schema_inventory.md`
- `docs/migration/COUNTYPULSE_TO_ODIE.md`

Then proceed with:
- Foundation → Data model → Interview → Bullets → Retrieval → Resume Builder → Templates/PDF → Telemetry → Testing

---

## Quality gates (non-negotiable)

- 100% tests passing
- >90% unit/integration coverage
- no `.skip` (ever)
- duplication scan must pass
- “no name inflation” and “no patch-on-patch” rules must pass validation
