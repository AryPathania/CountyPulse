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
2. **>95% coverage** - Unit and integration tests
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
- **PDF Import**: Client-side pdfjs-dist with server-side Deno fallback (`extract-pdf` edge function)
- **Interview Context**: Discriminated union (`blank` | `resume` | `gaps`) parameterizes interview prompt
- **Bullet Quality Rules**: Shared prompt section in `supabase/functions/_shared/prompts/bullet-quality.ts`
- **Resume Dedup**: SHA-256 file hash with unique index on `(user_id, file_hash)`
- **Resume Sub-Sections**: Generic editable grouping headers stored in resume content JSON (`SubSectionData`). Draggable, editable, deletable. Used for positions, education, projects. Auto-generated from positions via `groupBulletsByPosition()`, editable by users. Old `type: 'position'` items normalized to `type: 'subsection'` on read.
- **Profile Links**: Flexible `links JSONB NOT NULL DEFAULT '[]'` on `candidate_profiles`. Each entry is `{label, url}`. Max 8 enforced at app layer. Common types (LinkedIn, GitHub, Twitter, Website) offered as quick-add presets; fully custom labels supported. No fixed URL columns.

## Conventions
- UI components: `packages/ui/src/components/`
- UI hooks: `packages/ui/src/hooks/`
- Query functions: `packages/db/src/queries/`
- Contracts/schemas: `packages/shared/src/contracts/`
- Tests co-located or in `test/` directories
- Edge functions: `supabase/functions/`
- Shared prompts: `supabase/functions/_shared/prompts/`
- UI services: `packages/ui/src/services/`
- DnD block registry: `packages/ui/src/components/dnd/README.md`

## Key Shared Components
- `ProfileForm` (`packages/ui/src/components/ProfileForm.tsx`) — shared form for editing name, contact, links; used by CompleteProfile, SettingsPage, PersonalInfoPanel
- `useProfileSave` (`packages/ui/src/hooks/useProfileSave.ts`) — shared hook wrapping `upsertCandidateProfile` (single table since migration 028)
- `mapProfileToFormData` (`packages/ui/src/services/profile.ts`) — maps a `candidate_profiles` row to ProfileForm initial values
- `PersonalInfoPanel` — collapsible panel in `ResumeBuilderPage` for inline profile editing with live preview sync

## Routes
- `/` — Home (JD paste + quick actions)
- `/interview` — Interview chat (accepts `interviewContext` in route state)
- `/bullets` — Bullets library
- `/resumes` — Resumes list (drafts + uploaded)
- `/resumes/:id` — Draft resume page (gap analysis, matched bullets)
- `/resumes/:id/edit` — Resume builder (drag-and-drop sections, bullet palette, live preview)
- `/upload-resume` — PDF resume upload
- `/telemetry` — Runs dashboard
- `/settings` — Profile & Settings (edit name, contact info, links; danger zone)

## Edge Functions
- `interview` — Conversational interview (context-aware: blank/resume/gaps)
- `embed` — Batch text embeddings (`texts: string[]` → `embeddings: number[][]`)
- `parse-resume` — LLM resume parsing (positions, bullets with quality classification)
- `parse-jd` — JD requirement extraction (structured requirements with importance)
- `extract-pdf` — Server-side PDF text extraction (fallback)
- `speak` — OpenAI TTS for voice interview
- `transcribe` — OpenAI Whisper STT for voice interview

## DB Tables (Odie)
- `candidate_profiles` — Unified user profile: display_name, headline, summary, phone, location, links JSONB [{label, url}], profile_completed_at, profile_version, created_at. One row per user (merged from user_profiles in migration 028).
- `positions` — Work experience entries
- `bullets` — STAR bullets with embeddings
- `resumes` — Curated bullet selections (content JSON has sections with `SubSectionData[]` and items of type `subsection` | `bullet`)
- `job_drafts` — JD + retrieval + gap analysis (`parsed_requirements`, `gap_analysis`)
- `uploaded_resumes` — PDF uploads with cached parse results
- `runs` — LLM telemetry

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
**MVP Feature Complete** - All phases implemented + UI polish + resume upload + gap analysis

### Test Coverage
- **761 unit/integration tests** (Vitest + Testing Library)
- **95+ E2E tests** (Playwright)
- **96%+ code coverage** (>95% quality gate)

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
- Phase 11: Resume Upload ("Start with Resume" — PDF upload, parse, interview with context)
- Phase 12: Gap Analysis ("What's Missing" — JD requirement parsing, per-requirement matching, gap interview)

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
