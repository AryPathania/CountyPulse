# Spec: Phase 0.5 — Schema inventory + repo reuse

Status: Draft  
Owner: DB Agent  
Date: 2026-01-10

## Why this exists
This repo is already linked to a Supabase project and includes working auth/onboarding.
Before adding new tables for Odie Resume, we need a **truthful** view of:
- current tables + columns
- existing RLS policies
- existing functions/triggers
- existing vector usage (if any)

## Repo pivot cleanup
Before schema work, remove CountyPulse domain packages and rebrand the repo:
- Follow: `docs/migration/COUNTYPULSE_TO_ODIE.md`

## Goals
1) Pull current remote schema into versioned migrations.
2) Generate TypeScript DB types.
3) Produce `docs/db_schema.md` (human-readable).
4) Identify “keep vs deprecate” for legacy CountyPulse entities.

## Non-goals
- No new product features in Phase 0.5.
- No schema redesign besides cleanup decisions.

---

## Deliverables

### D1 — migrations synced
Run:
- `supabase link --project-ref cgpgnoixxghrwmfhmmqc`
- `supabase db pull` (creates migration) citeturn0search2

Commit:
- `supabase/migrations/*`

### D2 — generated DB types
Generate TS types from the linked project. citeturn0search6  
Commit to:
- `packages/db/src/types.ts` (or existing equivalent)

### D3 — db schema doc
Create/overwrite:
- `docs/db_schema.md`

Must include:
- every table in public schema
- columns + types + constraints
- FKs and cascades
- indexes
- RLS summary (who can read/write)
- notes for “legacy keep/deprecate”

### D4 — keep/deprecate decision log
Create:
- `docs/migration/legacy_keep_deprecate.md`

Format:
- Table name
- Keep? (yes/no/unknown)
- If no: replacement plan + timeline

---

## Acceptance criteria
- CountyPulse domain packages removed (`packages/pipeline`, `packages/connectors`) and workspace scripts/aliases updated.
- `supabase db pull` has been run and committed.
- `packages/db/src/types.ts` matches current remote schema.
- `docs/db_schema.md` exists and matches migrations/types.
- CI passes.

---

## Test plan
- Unit: none
- Integration:
  - A small DB smoke test can query `profiles` and any kept tables.
- Manual:
  - Supabase dashboard shows no drift relative to migrations.
