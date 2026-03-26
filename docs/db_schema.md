# Database Schema (Source of Truth)

This file is the human-readable source of truth for table/column names, relationships, RLS, and indexes.

**Updated by:** DB Agent only
**Updated when:** any migration changes schema
**Last updated:** 2026-03-25 (migration 031; beta_allowlist table added)

---

## Conventions

- Primary key: `id uuid default gen_random_uuid()` (or `user_id` for 1:1 tables)
- Ownership column: `user_id uuid not null` (FK to auth.users)
- Timestamps: `created_at`, `updated_at` timestamptz with auto-update trigger
- All tables have RLS enabled with user isolation

---

## Odie Resume Tables

### candidate_profiles

**Purpose:** Unified user profile — account metadata (display name, completion tracking) merged with professional resume header fields (headline, summary, contact, links). One row per user. Previously split across `user_profiles` and `candidate_profiles`; merged in migration 028.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| user_id | uuid | no | - |
| display_name | text | no | '' |
| headline | text | yes | - |
| summary | text | yes | - |
| phone | text | yes | - |
| location | text | yes | - |
| links | JSONB | no | '[]'::jsonb |
| profile_completed_at | timestamptz | yes | - |
| profile_version | integer | yes | 1 |
| created_at | timestamptz | yes | now() |
| updated_at | timestamptz | no | now() |

**Constraints:**
- PK: `user_id`
- FK: `user_id -> auth.users(id) ON DELETE CASCADE`

**Indexes:** None (PK sufficient)

**RLS:**
- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

**Notes:**
- `display_name`, `profile_completed_at`, `profile_version`, `created_at` migrated from the now-dropped `user_profiles` table (migration 028).
- Contact fields (phone, location) added in migration 026 for resume header display.
- `links` is a flexible array of `{label: string, url: string}` objects (migration 027). Replaces the three separate `linkedin_url`, `github_url`, `website_url` columns that were dropped. Max 8 links enforced at the app layer.
- `profile_completed_at` and `profile_version` are stamped on every `upsertProfile` call (not just the first save).

---

### positions

**Purpose:** Work experience entries (company, title, dates)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | no | - |
| company | text | no | - |
| title | text | no | - |
| location | text | yes | - |
| start_date | date | yes | - |
| end_date | date | yes | - |
| raw_notes | text | yes | - |
| created_at | timestamptz | no | now() |
| updated_at | timestamptz | no | now() |

**Constraints:**
- PK: `id`
- FK: `user_id -> auth.users(id) ON DELETE CASCADE`

**Indexes:**
- `positions_user_start_date_idx` on `(user_id, start_date DESC)`

**RLS:**
- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

**Note:** LLM contracts (`ResumeParseOutputSchema`) return dates as `YYYY-MM`. These must be normalized to `YYYY-MM-DD` (append `-01`) before inserting into `start_date`/`end_date` DATE columns. Use `toPostgresDate()` from `@odie/shared`.

---

### bullets

**Purpose:** STAR bullets tied to positions, with embeddings for semantic search

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | no | - |
| position_id | uuid | no | - |
| category | text | yes | - |
| hard_skills | text[] | yes | '{}' |
| soft_skills | text[] | yes | '{}' |
| original_text | text | no | - |
| current_text | text | no | - |
| was_edited | boolean | generated | original_text IS DISTINCT FROM current_text |
| is_draft | boolean | no | false |
| embedding | vector(1536) | yes | - |
| created_at | timestamptz | no | now() |
| updated_at | timestamptz | no | now() |

**Constraints:**
- PK: `id`
- FK: `user_id -> auth.users(id) ON DELETE CASCADE`
- FK: `position_id -> positions(id) ON DELETE CASCADE`

**Indexes:**
- `bullets_user_position_idx` on `(user_id, position_id)`
- `bullets_user_category_idx` on `(user_id, category)`
- `bullets_user_is_draft_idx` on `(user_id, is_draft)`
- `bullets_embedding_idx` IVFFlat on `(embedding vector_cosine_ops)` with lists=100

**RLS:**
- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

**Notes:**
- `was_edited` is a generated column that tracks if user modified the LLM output
- `is_draft` is true while bullet is being captured during interview, false after interview completes
- Embedding is populated asynchronously after bullet creation

---

### resumes

**Purpose:** Curated selection and ordering of bullets

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | no | - |
| name | text | no | - |
| template_id | text | yes | 'default' |
| content | jsonb | yes | '{}' |
| created_at | timestamptz | no | now() |
| updated_at | timestamptz | no | now() |

**Constraints:**
- PK: `id`
- FK: `user_id -> auth.users(id) ON DELETE CASCADE`

**Indexes:**
- `resumes_user_updated_idx` on `(user_id, updated_at DESC)`

**RLS:**
- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

**Notes:**
- `content` JSONB structure: `{ sections: [{ id, title, items: [{ id, type, ... }] }] }`
  - Each section has a unique `id`, a `title` (editable, deletable), and an `items` array
  - Item types: `'subsection'` (grouping header via `SubSectionData`) or `'bullet'` (reference to bullets table)
  - `SubSectionData` fields: `id`, `type: 'subsection'`, `title`, `subtitle?`, `meta?`, `textItems?: string[]`
  - `textItems` holds non-bullet content (e.g., education entries, skills lists) rendered as comma-separated text in templates
  - Sections support full CRUD: add (from defaults/suggested/custom), rename, delete. Deleted defaults reappear in the Add Section menu.
- `template_id` references template registry (MVP: only 'default')

---

### job_drafts

**Purpose:** Pasted JD + retrieval results + generated draft reference

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | no | - |
| job_title | text | yes | - |
| company | text | yes | - |
| jd_text | text | no | - |
| jd_embedding | vector(1536) | yes | - |
| retrieved_bullet_ids | uuid[] | yes | '{}' |
| selected_bullet_ids | uuid[] | yes | '{}' |
| draft_resume_id | uuid | yes | - |
| parsed_requirements | jsonb | yes | - |
| gap_analysis | jsonb | yes | - |
| created_at | timestamptz | no | now() |

**Constraints:**
- PK: `id`
- FK: `user_id -> auth.users(id) ON DELETE CASCADE`
- FK: `draft_resume_id -> resumes(id) ON DELETE SET NULL`

**Indexes:**
- `job_drafts_user_created_idx` on `(user_id, created_at DESC)`

**RLS:**
- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

**Notes:**
- `job_title` and `company` are initially null; populated from LLM extraction during gap analysis
- `retrieved_bullet_ids` stores all matched bullet IDs from gap analysis
- `selected_bullet_ids` stores final chosen set for the draft
- `parsed_requirements` stores LLM-extracted requirements from JD text (added migration 023)
- `gap_analysis` stores per-requirement match/gap results including `jobTitle`, `company`, `covered`, `gaps`, `totalRequirements`, `coveredCount`, `analyzedAt` (added migration 023)

---

### uploaded_resumes

**Purpose:** Uploaded PDF metadata, extracted text, and cached LLM parse results for resume upload feature

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | no | - |
| file_name | text | no | - |
| file_hash | text | no | - |
| storage_path | text | no | - |
| extracted_text | text | yes | - |
| parsed_data | jsonb | yes | - |
| created_at | timestamptz | no | now() |

**Constraints:**
- PK: `id`
- FK: `user_id -> auth.users(id) ON DELETE CASCADE`
- UNIQUE: `(user_id, file_hash)` (dedup same file per user)

**Indexes:**
- `uploaded_resumes_user_idx` on `(user_id)`
- `uploaded_resumes_user_hash_idx` UNIQUE on `(user_id, file_hash)`

**RLS:**
- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

**Notes:**
- `file_hash` enables deduplication: same user uploading the same file reuses the existing row
- `extracted_text` is populated after PDF text extraction
- `parsed_data` caches LLM parse results (positions, bullets, skills) to avoid re-parsing

---

### runs

**Purpose:** Telemetry for LLM invocations (interview, bullet_gen, embed, draft, export)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | no | - |
| type | text | no | - |
| prompt_id | text | yes | - |
| model | text | yes | - |
| input | jsonb | yes | '{}' |
| output | jsonb | yes | '{}' |
| success | boolean | yes | true |
| latency_ms | integer | yes | - |
| tokens_in | integer | yes | - |
| tokens_out | integer | yes | - |
| created_at | timestamptz | no | now() |

**Constraints:**
- PK: `id`
- FK: `user_id -> auth.users(id) ON DELETE CASCADE`

**Indexes:**
- `runs_user_created_idx` on `(user_id, created_at DESC)`
- `runs_type_created_idx` on `(type, created_at DESC)`

**RLS:**
- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

**Notes:**
- `type` values: 'interview', 'bullet_gen', 'embed', 'draft', 'export'
- Used for cost tracking, debugging, and evaluation

---

### profile_entries

**Purpose:** Generic structured profile data entries (experience, education, projects, certifications, skills, etc.). Each row represents one entry within a category, ordered by `sort_order`.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | no | - |
| category | text | no | - |
| title | text | no | - |
| subtitle | text | yes | - |
| start_date | date | yes | - |
| end_date | date | yes | - |
| location | text | yes | - |
| text_items | text[] | yes | '{}' |
| sort_order | int | no | 0 |
| created_at | timestamptz | yes | now() |
| updated_at | timestamptz | yes | now() |

**Constraints:**
- PK: `id`
- FK: `user_id -> auth.users(id) ON DELETE CASCADE`

**Indexes:**
- `idx_profile_entries_user_category` on `(user_id, category)`

**RLS:**
- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

**Notes:**
- `category` values: 'education', 'certification', 'award', 'project', 'volunteer' (defined by `ProfileEntryCategorySchema` in `@odie/shared`)
- `text_items` holds sub-items (e.g., bullet points, skill lists) as a text array
- `sort_order` controls display ordering within a category
- `updated_at` auto-updates via `update_updated_at_column` trigger
- Can be mapped to `SubSectionData` for resume content via `toSubSectionData()` helper in `@odie/db`
- Education titles formatted via `formatEducationTitle()` in `@odie/db` for consistent display
- Managed on `/profile` page via `ProfileEntriesEditor`; also available as draggable entries in resume edit BulletPalette

---

### beta_allowlist

**Purpose:** Email-based allowlist for beta testers. Controls access to the application before subscription billing is set up. Managed via Supabase dashboard (service role only).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| email | text | no | - |
| created_at | timestamptz | yes | now() |

**Constraints:**
- PK: `email`

**Indexes:** None (PK sufficient)

**RLS:**
- Enabled, but no user-facing policies. Only accessible via service role or `SECURITY DEFINER` functions.

**Notes:**
- No `user_id` column — keyed on email for simplicity during beta phase.
- Access checked via `check_beta_access()` RPC (frontend) or direct service-role query (backend middleware).
- Will be superseded by `subscriptions` table when Stripe billing is added, but retained as a free-access override.

---

## Functions

### match_bullets

**Purpose:** Vector similarity search for bullet retrieval

```sql
match_bullets(
    query_embedding vector(1536),
    match_user_id uuid,
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 50
) RETURNS TABLE (
    id uuid,
    position_id uuid,
    category text,
    current_text text,
    similarity float
)
```

**Security:** SECURITY DEFINER (bypasses RLS but filters by user_id)

**Notes:**
- Uses cosine similarity (1 - cosine distance)
- Returns bullets ordered by similarity (highest first)
- Threshold default 0.5 filters low-quality matches

### check_beta_access

**Purpose:** Check if the current authenticated user's email is on the beta allowlist

```sql
check_beta_access() RETURNS boolean
```

**Security:** SECURITY DEFINER (bypasses RLS to read `beta_allowlist`)

**Notes:**
- Takes no parameters — reads email from `auth.jwt()` to prevent email enumeration
- Returns `true` if email is in `beta_allowlist`, `false` otherwise
- Called by `useAccess` hook on the frontend via Supabase RPC

### reset_account_data

**Purpose:** Wipe all user data for account reset (testing/dev)

Deletes from: `profile_entries`, `bullets`, `positions`, `resumes`, `job_drafts`, `uploaded_resumes`, `runs`, `candidate_profiles` (in order, respecting FK constraints).

**Security:** Only callable by the owning user (`auth.uid() = target_user_id`)

**Updated:** Migration 024 added `uploaded_resumes` deletion. Migration 025 added storage bucket RLS policies for `resumes` bucket. Migration 028 removed `user_profiles` deletion (table dropped). Migration 030 added `profile_entries` deletion.

---

## RLS Policy Summary

All Odie tables enforce row-level security with identical policies:

| Operation | Policy |
|-----------|--------|
| SELECT | `user_id = auth.uid()` |
| INSERT | `user_id = auth.uid()` |
| UPDATE | `user_id = auth.uid()` (USING and WITH CHECK) |
| DELETE | `user_id = auth.uid()` |

Policies are applied to the `authenticated` role only.

---

## Dropped Tables

### CountyPulse tables (migration 016)

- sources
- raw_items
- normalized_items
- prompt_templates
- prompt_versions
- agent_runs
- categories
- watches
- item_tags
- summaries
- run_feedback
- scout_feedback
- item_events

The `vector` extension was retained for bullet embeddings.

### user_profiles (migration 028)

Dropped after merging into `candidate_profiles`. All columns (`display_name`, `profile_completed_at`, `profile_version`, `created_at`) were added to `candidate_profiles`. Existing data was migrated. The `id` surrogate key was dropped (table now uses `user_id` as PK, consistent with `candidate_profiles`).
