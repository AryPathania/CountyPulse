---
name: supabase-migrations
description: Supabase migration and type generation workflows. Use when working with database schema, migrations, or generated TypeScript types.
---

# Supabase Migrations + Generated Types

## Why
- migrations are your deploy artifact
- generated TS types prevent "column name guessing"

## Workflow (remote → repo)
1) Link local project
```bash
supabase link --project-ref <PROJECT_REF>
```

2) Pull schema changes into a migration
```bash
supabase db pull
```
This creates a new SQL file under `supabase/migrations`.

3) Generate TS types
Example CLI:
```bash
supabase gen types typescript --project-id <PROJECT_REF> > packages/db/src/types.ts
```

## Workflow (local changes → migration)
- Prefer: edit SQL in migrations, then apply.
- Or: create tables in Dashboard, then generate a diff:
```bash
supabase db diff -f <name>
```

## Hard rule
Any DB change must also update:
- `docs/db_schema.md` (human-readable)
- `packages/db/src/types.ts` (generated)
