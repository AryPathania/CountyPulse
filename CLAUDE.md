# Odie AI Resume - Agent Context

## Project Overview
Odie AI is an AI-powered resume builder that helps candidates craft tailored resumes through conversational interviews and intelligent bullet matching.

## Tech Stack
- **Frontend**: React 19, Vite, React Router, TypeScript, TanStack Query
- **Backend**: Supabase (PostgreSQL 15, Auth, pgvector for embeddings)
- **AI/LLM**: OpenAI GPT-4
- **Testing**: Vitest, Testing Library, MSW, Playwright
- **Package Manager**: pnpm (workspace monorepo)

## Package Structure
```
packages/
├── web/     # @odie/web - React frontend
├── db/      # @odie/db - Supabase client + queries
└── shared/  # @odie/shared - Contracts, validators, pure logic
```

## Key Commands
```bash
pnpm dev              # Start dev server
pnpm build            # Build all packages
pnpm test             # Run tests
pnpm test:coverage    # Run tests with coverage
pnpm lint             # Lint all packages
pnpm typecheck        # Type check all packages
pnpm gen-types        # Generate Supabase types
```

## Quality Gates (Non-Negotiable)
1. **100% tests passing** - No failures allowed
2. **>90% coverage** - Unit and integration tests
3. **No `.skip`** - Never use `it.skip`, `describe.skip`, `test.skip`
4. **Duplication scan** - jscpd must pass
5. **No name inflation** - Keep names concise
6. **No patch-on-patch** - Fix root causes, don't layer hacks

## Architecture Decisions
- **State Management**: TanStack Query for server state, minimal client store for UI state
- **Database Access**: All Supabase calls go through `@odie/db` (UI never calls Supabase directly)
- **Embeddings**: pgvector inside Supabase (no external vector DB in MVP)
- **PDF Export**: Browser print-to-PDF (native)
- **Bullet Edits**: Global (no per-resume overrides in MVP)

## Conventions
- UI components: `packages/web/src/components/`
- Query functions: `packages/db/src/queries/`
- Contracts/schemas: `packages/shared/src/contracts/`
- Tests co-located or in `test/` directories

## Theme
- Background: black
- Text: white
- Accent: royal blue

## Documentation
- Specs: `docs/specs/`
- ADRs: `docs/adr/`
- Agent docs: `docs/agents/`
- DB schema: `docs/db_schema.md`
- Notes: `docs/notes.md`

## Current Phase
**Phase 2: Data Model + DB Migrations**
- Drop CountyPulse tables
- Create Odie tables (candidate_profiles, positions, bullets, resumes, job_drafts, runs)
- Add RLS policies
- Create match_bullets SQL function for vector search

### Completed Phases
- Phase 0.5: Schema Inventory + Repo Alignment
- Phase 1: Foundation + Quality Gates (jscpd, no-skip, GitHub Actions, theme tokens)

## Environment Variables
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
OPENAI_API_KEY=...
```
