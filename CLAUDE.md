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
- **Resume Sub-Sections**: Generic editable grouping headers stored in resume content JSON (`SubSectionData`). Draggable, editable, deletable. Used for positions, education, projects. Auto-generated from positions via `groupBulletsByPosition()`, editable by users. Old `type: 'position'` items normalized to `type: 'subsection'` on read. `SubSectionData` supports an optional `textItems?: string[]` for non-bullet content (e.g., education entries, skills lists) rendered as comma-separated text.
- **Custom Sections**: All resume sections (including defaults like Experience, Education, Skills) are editable and deletable. An "Add Section" dropdown offers missing defaults, suggested sections (Projects, Certifications, etc.), and a custom-name option. Deleted defaults reappear in the menu for re-addition. Section CRUD is handled in `ResumeBuilderPage`.
- **Metric Preservation**: LLM prompts enforce an always-on rule to preserve original metrics/numbers in bullets. Applied across `bullet-quality.ts`, `resume-parse.ts` (`resume_parse_v2`), and `interview.ts` (`interview_v3`).
- **Profile Links**: Flexible `links JSONB NOT NULL DEFAULT '[]'` on `candidate_profiles`. Each entry is `{label, url}`. Max 8 enforced at app layer. Common types (LinkedIn, GitHub, Twitter, Website) offered as quick-add presets; fully custom labels supported. No fixed URL columns.
- **Profile Entries**: Generic `profile_entries` table for structured non-bullet profile data (education, certifications, awards, projects, volunteer). Category-based with `sort_order`. Extracted during interviews via `extractedEntries` in the interview response schema. Mapped to `SubSectionData` via `toSubSectionData()` in `@odie/db` for resume content injection. Managed on `/profile` page via `ProfileEntriesEditor`. Also available as a draggable bank in BulletPalette on the resume edit page.
- **Default Section Order**: `DEFAULT_SECTIONS` constant defines section order as `['Education', 'Experience', 'Skills']`. Both `createDefaultResumeContent()` and `createResumeFromDraft()` derive from this.
- **DnD Type System**: Drag items use `@dnd-kit` `data` prop with type discrimination (not string prefix parsing). Collision detection uses `closestCorners` with a distance activation constraint of 5px. Cross-section moves transfer subsection data; subsection drags move child bullets as a group.
- **Separation of Concerns (SRP)**: Edge functions are single-purpose. Parsing, matching, and refinement are separate concerns with independent testing and deployment.
- **Credibility Guardrail**: All resume content must come from the user. LLMs classify and select but never generate qualification text.

## Security

See `docs/adr/006_security_model.md` for the full security model. Summary:
- **SSRF**: `fetch-jd` edge function blocks private IPs, loopback, and AWS metadata endpoints
- **SQL injection**: Not possible — PostgREST parameterized queries throughout
- **XSS**: Not possible — React JSX escapes all dynamic content; no `dangerouslySetInnerHTML`
- **LLM prompt injection**: Limited to single-user impact; system prompts reduce susceptibility
- **Auth**: All tables have RLS; all edge functions require valid JWT
- **Beta access gating**: Dual-layer enforcement — `AccessGuard` component (UX-only, redirects to `/no-access`) + `withMiddleware` backend check (real security boundary, fail-closed). Email-based `beta_allowlist` table. See ADR 009.

## Development Process (Steering)

Every feature or bug fix follows this workflow:

1. **Plan** — Explore codebase, design approach, write plan file
2. **Refute** — Run refute-agent to stress-test the plan. **Always run refute-agent before presenting plans to the user.**
3. **Align** — Present to user, incorporate feedback, iterate
4. **Implement** — Assign agents (db/ui/pipeline/contract) with relevant skills
5. **Test** — test-agent writes meaningful tests (use git stash trick to validate usefulness)
6. **Validate** — validation-agent checks duplication (must be 0%), naming, patch-on-patch, linting
7. **Document** — docs-agent updates db_schema.md, CLAUDE.md, and records design decisions
8. **E2E** — Write Playwright E2E tests for all verifiable behavior (using `playwright-e2e` skill)
9. **CI** — `pnpm typecheck` + `pnpm test` + `pnpm lint` + `pnpm dup:check` must all pass (0% duplication threshold)

### Design Decisions
Significant architectural decisions are recorded in `docs/adr/` as Architecture Decision Records. Each ADR includes: context, decision, tradeoffs, and justification. The docs-agent is responsible for creating ADRs when design decisions are made during planning.

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
- DnD drag types: Use `@dnd-kit` `data` prop with type discrimination, never string prefix parsing
- Education title formatting: Always use `formatEducationTitle()` from `@odie/db` for consistent education titles from parsed data
- Query key invalidation: Always import from canonical key factories (e.g., `bulletKeys.all`). Never hardcode query key strings in invalidation calls.
- Access checks: Frontend guards (`AccessGuard`) are UX-only. Backend middleware (`withMiddleware`) is the real security boundary. Always fail closed on errors.

## Key Shared Components
- `ProfileForm` (`packages/ui/src/components/ProfileForm.tsx`) — shared form for editing name, contact, links; used by CompleteProfile, ProfilePage, PersonalInfoPanel
- `useProfileSave` (`packages/ui/src/hooks/useProfileSave.ts`) — shared hook wrapping `upsertCandidateProfile` (single table since migration 028)
- `mapProfileToFormData` (`packages/ui/src/services/profile.ts`) — maps a `candidate_profiles` row to ProfileForm initial values
- `PersonalInfoPanel` — collapsible panel in `ResumeBuilderPage` for inline profile editing with live preview sync
- `StartInterviewButton` (`packages/ui/src/components/interview/StartInterviewButton.tsx`) — reusable button that navigates to `/interview` with the correct `interviewContext`; used by ResumeUploadPage and DraftResumePage
- `buildSectionEntries()` / `buildEducationEntries()` / `buildSkillsEntries()` (`packages/db/src/queries/resumes.ts`) — pure helpers that construct resume content sections from parsed data (positions, education, skills)
- `SubSectionEditForm` (`packages/ui/src/components/resume/SubSectionEditForm.tsx`) — extracted reusable form for editing subsection fields (title, subtitle, meta, textItems); used by SortableSubSection and ProfileEntriesEditor
- `formatEducationTitle` (`packages/db/src/queries/profile-entries.ts`) — formats education titles consistently from parsed degree/field/institution data; used by `buildEducationEntries` and resume upload
- `ProfileEntriesEditor` (`packages/ui/src/components/ProfileEntriesEditor.tsx`) — Profile page component for managing profile_entries (education, certifications, awards, projects, volunteer)
- `AccessGuard` (`packages/ui/src/components/auth/AccessGuard.tsx`) — UX-only access gate; wraps protected routes inside AuthGuard, redirects to `/no-access` if not on beta list
- `useAccess` (`packages/ui/src/hooks/useAccess.ts`) — TanStack Query hook calling `checkBetaAccess()` RPC; 5-min staleTime, query key factory at `accessKeys.byUser(userId)`

## Routes
- `/` — Home (JD paste + quick actions)
- `/interview` — Interview chat (accepts `interviewContext` in route state)
- `/bullets` — Experience Bullets library
- `/resumes` — Resumes list (drafts + uploaded)
- `/resumes/:id` — Draft resume page (gap analysis, matched bullets)
- `/resumes/:id/edit` — Resume builder (drag-and-drop sections, bullet palette, live preview)
- `/upload-resume` — PDF resume upload
- `/telemetry` — Runs dashboard
- `/profile` — Profile Info (ProfileForm + ProfileEntriesEditor for education, certifications, etc.)
- `/settings` — Account settings (danger zone, sign out; accessed via Settings button in nav bar)
- `/no-access` — No Access page (beta gate; auth-required, access-exempt)

## Edge Functions
- `interview` — Conversational interview (context-aware: blank/resume/gaps; auto-start supported via `StartInterviewButton`)
- `embed` — Batch text embeddings (`texts: string[]` → `embeddings: number[][]`)
- `parse-resume` — LLM resume parsing (positions, bullets with quality classification)
- `parse-jd` — JD requirement extraction (structured requirements with importance)
- `extract-pdf` — Server-side PDF text extraction (fallback)
- `speak` — OpenAI TTS for voice interview
- `refine-analysis` — Intelligence layer: reviews vector match results via o4-mini reasoning model, reclassifies covered/partial/gap, recommends additional bullets
- `transcribe` — OpenAI Whisper STT for voice interview

**Note:** All edge functions use `withMiddleware` which includes a `requireAccess` option (default `true`). After JWT auth, it checks the `beta_allowlist` table via service role. Functions can opt out with `requireAccess: false`.

## DB Tables (Odie)
- `candidate_profiles` — Unified user profile: display_name, headline, summary, phone, location, links JSONB [{label, url}], profile_completed_at, profile_version, created_at. One row per user (merged from user_profiles in migration 028).
- `positions` — Work experience entries
- `bullets` — STAR bullets with embeddings
- `resumes` — Curated bullet selections (content JSON has sections with `SubSectionData[]` and items of type `subsection` | `bullet`)
- `job_drafts` — JD + retrieval + gap analysis (`parsed_requirements`, `gap_analysis`)
- `uploaded_resumes` — PDF uploads with cached parse results
- `profile_entries` — Generic structured profile data (education, certification, award, project, volunteer). Category-based with sort_order. Mapped to `SubSectionData` via `toSubSectionData()`.
- `runs` — LLM telemetry
- `beta_allowlist` — Email allowlist for beta testers (email TEXT PK, created_at). RLS enabled, service-role only. Checked by `check_beta_access()` RPC and `withMiddleware`.

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
- **957+ unit/integration tests** (Vitest + Testing Library)
- **134+ E2E tests** (Playwright)
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
- **Navigation**: Transparent background, bottom border only, full width. Nav order: Home, Interview, Resumes, [Edit Resume (conditional)], Experience Bullets, Profile Info, Telemetry. Account area: email (plain text) + Settings button (links to `/settings`).
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

## Plan Review
Use `refute-agent` as a devil's advocate before implementing new features or schema changes.
- Stress-tests plans for edge cases, over-engineering, security gaps, and missed alternatives
- See `.claude/agents/refute-agent.md` for full workflow

## Environment Variables
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
OPENAI_API_KEY=...
```
