# Database Schema (Source of Truth)

This file is the human-readable source of truth for table/column names, relationships, RLS, and indexes.

**Updated by:** DB Agent only
**Updated when:** any migration changes schema
**Last updated:** 2026-01-10 (migrations 016-019)

---

## Conventions

- Primary key: `id uuid default gen_random_uuid()` (or `user_id` for 1:1 tables)
- Ownership column: `user_id uuid not null` (FK to auth.users)
- Timestamps: `created_at`, `updated_at` timestamptz with auto-update trigger
- All tables have RLS enabled with user isolation

---

## Retained Tables

### user_profiles

**Purpose:** User account metadata from onboarding (retained from CountyPulse)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | no | - |
| display_name | text | no | - |
| profile_completed_at | timestamptz | yes | - |
| profile_version | integer | yes | - |
| created_at | timestamptz | yes | now() |
| updated_at | timestamptz | yes | now() |

**Constraints:**
- PK: `id`
- UNIQUE: `user_id`
- FK: `user_id -> auth.users(id) ON DELETE CASCADE`

**Indexes:**
- `user_profiles_user_id_idx` on `(user_id)`

**RLS:**
- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

---

## Odie Resume Tables

### candidate_profiles

**Purpose:** Professional headline and summary for resume header (one per user)

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| user_id | uuid | no | - |
| headline | text | yes | - |
| summary | text | yes | - |
| updated_at | timestamptz | no | now() |

**Constraints:**
- PK: `user_id`
- FK: `user_id -> auth.users(id) ON DELETE CASCADE`

**Indexes:** None (PK sufficient)

**RLS:**
- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

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
- `bullets_embedding_idx` IVFFlat on `(embedding vector_cosine_ops)` with lists=100

**RLS:**
- SELECT/INSERT/UPDATE/DELETE: `user_id = auth.uid()`

**Notes:**
- `was_edited` is a generated column that tracks if user modified the LLM output
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
- `content` JSONB structure: `{ sections: [{ title, bullet_ids: [] }] }`
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
- `retrieved_bullet_ids` stores top 50 matches for debugging/audit
- `selected_bullet_ids` stores final chosen set for the draft

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

## Dropped Tables (CountyPulse)

The following tables were dropped in migration 016:

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
