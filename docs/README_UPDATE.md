# Proposed README update (CountyPulse → Odie Resume)

This is a *proposed* replacement for the root README once you officially pivot the repo.

---

# Odie Resume

A resume-building web app that:
- interviews you to build a comprehensive candidate profile
- generates STAR bullets tied to your positions
- retrieves relevant bullets for any job description using pgvector similarity
- lets you build resumes via drag/drop and export PDF
- logs telemetry to iteratively improve prompts and fine-tune later

## Tech
- pnpm monorepo
- React + Vite (web UI)
- Supabase (auth + Postgres + pgvector)
- TanStack Query (server-state)
- Vitest + Playwright (tests)
- jscpd (duplicate code gate)

## Repo layout
- `packages/ui` — web app
- `packages/db` — typed DB access layer (single source for table names)
- `packages/shared` — pure logic + contracts + validators (DRY hub)
- `supabase/` — migrations, functions

## Quality gates (non-negotiable)
- 100% tests passing
- >90% coverage
- no skipped tests
- duplication checked and blocked

## Docs
Start here: `docs/00_START_HERE.md`
