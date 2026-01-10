
# CountyPulse → Odie AI migration plan (brutal + time-saving)

This document is the *repo-level* pivot plan: turn the existing `CountyPulse/` monorepo into **Odie AI** as fast as possible, while keeping only what is immediately useful.

> Principle: **delete first**, keep only proven “accelerators” (auth flow, Supabase wiring, workspace tooling, testing harness). CountyPulse’s product/domain logic is irrelevant and should not survive the pivot.

---

## What we keep (time-savers)

### Root workspace tooling
Keep as-is:
- `pnpm-workspace.yaml`
- `tsconfig.base.json` (but update paths + aliases)
- root `package.json` scripts (but rewrite to target new apps/packages)
- shared lint/format config (if any)
- `.vscode/` (optional)

### Supabase plumbing
Keep:
- `/supabase/config.toml`
- `/supabase/functions/` **only** as scaffolding (delete county-specific functions; keep the shell for new Odie functions)
- any existing auth/email setup you like (Resend OTP flow), **but** rewrite the table dependencies

### Frontend “shell” + auth components
From `packages/ui` (or wherever your UI app lives), keep:
- Supabase client init wiring
- AuthProvider/AuthGuard/LoginForm/LogoutButton
- Profile completion pattern (route gating)
- test harness (Vitest + Testing Library + MSW) — *great reuse*

Everything else gets deleted or rewritten.

### DB client wiring
From `packages/db`, keep:
- `client.ts` (Supabase client creation)
- “query module” pattern (one place for all DB calls)
- “generated types” workflow

Delete *all* CountyPulse query functions (sources/items/scout/etc) and replace with Odie queries.

---

## What we delete (immediately)

### Entire packages to remove
Delete these packages completely:
- `packages/pipeline/` (all scout/fetch/normalize/orchestrator code)
- `packages/connectors/` (all Socrata / King County specifics)

### Database schema: delete or deprecate CountyPulse domain tables
After you pull remote schema into migrations (Phase 0.5), you will drop *everything* that is CountyPulse-domain specific.

Expect to remove tables like:
- `sources`, `raw_items`, `normalized_items`, `categories`, `watches`, `agent_runs` (CountyPulse version), `scout_feedback`, `item_tags`, etc.

Keep only:
- `auth.*` (Supabase auth)
- (optionally) a single user profile table if it’s already powering onboarding — but rename it to match Odie (`profiles` or `candidate_profiles`) and migrate the columns.

---

## Rename plan (minimal churn)

### Option A: minimal churn (recommended)
Keep the current workspace structure and repurpose it:

- `packages/ui` becomes the Odie web app (rename package to `@odie/web`)
- `packages/db` becomes Odie data access layer (rename package to `@odie/db`)
- Add `packages/shared` for *pure* logic, contracts, validators
- Add `packages/renderer` later if you want separation for templates/PDF

Pros: fewer moves; fastest pivot.
Cons: UI app lives in `packages/` rather than `apps/` (fine).

### Option B: clean structure (slightly more churn)
- Move `packages/ui` → `apps/web`
- Keep `packages/db`, add `packages/shared`
- Update all TS path aliases + pnpm filters

Pros: matches modern “apps/packages” layouts.
Cons: renames + path alias churn early.

Pick **A** unless you feel strongly.

---

## Step-by-step execution checklist

### Step 0: create a “migration branch”
- Create a branch: `pivot-odie-ai`
- Goal: get to a compiling repo that boots into a minimal Odie shell (auth + empty home screen)

### Step 1: delete irrelevant packages
- Delete `packages/pipeline`
- Delete `packages/connectors`
- Remove their references from:
  - `pnpm-workspace.yaml`
  - root `package.json` scripts
  - `tsconfig.base.json` path aliases

### Step 2: rebrand packages + scripts
- Rename packages:
  - `@county-pulse/ui` → `@odie/web`
  - `@county-pulse/db` → `@odie/db`
- Replace “CountyPulse” strings in:
  - `README.md`
  - app title/meta tags
  - env var names (keep Supabase vars, replace the rest)

### Step 3: gut UI routes and rebuild minimal Odie UX
Keep auth + route protection. Replace product pages with:
- `/` Home: centered input (“Paste your job posting here”) + simple nav header
- `/bullets` Bullet library
- `/resumes` Resume list
- `/resume/:id` Resume builder (DnD)
- `/interview` Interview flow (text chat MVP)

### Step 4: Phase 0.5 (DB inventory) + then “drop old domain”
- `supabase db pull` → capture current schema into migrations
- Write `docs/db_schema.md` snapshot
- Decide keep/deprecate list
- Create migration(s) that drop CountyPulse tables and create Odie tables

### Step 5: regenerate types + update queries
- regenerate TS types from DB
- rewrite `@odie/db` queries to only expose Odie domain operations
- ensure UI only uses `@odie/db` query functions (no raw SQL sprinkled around)

### Step 6: quality gates from day 1
Turn on merge gates immediately:
- `pnpm test` must pass
- >90% unit/integration coverage
- forbid `.skip`
- duplication detection gate
- lint gate

---

## Guardrails (required during migration)

- **No duplicate code.** If a calculation/transform appears twice, it must become a shared util (usually in `packages/shared`).
- **No name inflation.** If intent is unchanged, keep the original function name (fix the function).
- **No patch-on-patch.** Fix root causes; prefer replacing/deleting code over adding wrappers.
- **No skipped tests.** A skipped test is a failed gate.

---

## Deliverable for “migration done”
Migration is “done” when:
- repo boots to Odie UI shell on localhost
- auth works end-to-end
- all CountyPulse packages are removed
- DB schema has Odie tables (even if mostly empty)
- tests + gates are running in CI
