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
├── ui/      # @odie/ui - React frontend
├── db/      # @odie/db - Supabase client + queries
└── shared/  # @odie/shared - Contracts, validators, pure logic
```

## Key Commands
```bash
pnpm dev              # Start dev server
pnpm build            # Build all packages
pnpm test             # Run unit/integration tests
pnpm test:coverage    # Run tests with coverage report
pnpm test:e2e         # Run Playwright E2E tests
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
- UI components: `packages/ui/src/components/`
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

## Current Status
**MVP Feature Complete** - All phases implemented + UI polish

### Test Coverage
- **397 unit/integration tests** (Vitest + Testing Library)
- **73 E2E tests** (Playwright)
- **91%+ code coverage**

### Completed Phases
- Phase 0.5: Schema Inventory + Repo Alignment
- Phase 1: Foundation + Quality Gates (jscpd, no-skip, GitHub Actions, theme tokens)
- Phase 2: Data Model + DB Migrations (6 Odie tables, RLS, match_bullets function)
- Phase 3: Bullets Library + Shared Editor (BulletEditor, TanStack Query)
- Phase 4: Interview Flow (InterviewChat, interview edge function)
- Phase 5: Home + JD Paste + Draft Resume
- Phase 6: Resume Builder (DnD sections/bullets, live preview)
- Phase 7: Templates + PDF Export (template registry, browser print)
- Phase 8: Telemetry + Continuous Improvement (runs dashboard, bullet evolution)
- Phase 9: Testing (Playwright E2E, screenshot on failure)
- Phase 10: Voice Interview (Whisper STT, OpenAI TTS, voice controls)
- UI Polish: Login centering, nav styling, bullets page navigation

## UI/UX Conventions
- **Navigation**: Transparent background, bottom border only, full width
- **Login**: Vertically + horizontally centered, minimal design (no container box)
- **Buttons**: Global `.btn-primary` and `.btn-secondary` classes in App.css
- **Add actions**: Circular "+" buttons next to filter inputs (e.g., BulletsPage)

## Skills
- `playwright-screenshots`: Capture screenshots for visual UI verification
- `visual-validation`: Before/after screenshot comparison for UX validation
- `voice-interview`: Voice input/output patterns for interview feature

## Debugging Workflow
Use `debug-agent` for all bug fixes and feedback implementation.
- 4 phases: Understand → Plan → Execute → Validate
- See `.claude/agents/debug-agent.md` for full workflow
- See `docs/code-quality-rules.md` for quality standards

## Environment Variables
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
OPENAI_API_KEY=...
```
