# Spec: Core data model (bullets, resumes, job drafts, runs)

Status: Draft  
Owner: Contract Agent + DB Agent  
Date: 2026-01-10

## Overview
Odie Resume needs durable, reusable “atoms” (bullets) that can be assembled into resumes.

### Key objects
- Candidate Profile (one per user)
- Position (work experience entries)
- Bullet (STAR bullet tied to a position)
- Resume (a curated selection and ordering of bullets)
- Job Draft (a paste of a JD + retrieval results + generated draft)
- Runs (interview run, generation run, embedding run) for telemetry + evaluation

## MVP constraints
- No per-resume bullet overrides (a bullet edit updates it globally).
- One resume template in MVP, but template registry supports more.

---

## Tables (proposed; final names confirmed in Phase 0.5)

### `profiles` (existing)
We reuse the existing `profiles` table (or equivalent) from CountyPulse.

### `candidate_profiles`
- `user_id uuid` PK, FK → profiles.user_id
- `headline text`
- `summary text`
- `updated_at timestamptz`

### `positions`
- `id uuid` PK
- `user_id uuid` FK → profiles.user_id
- `company text`
- `title text`
- `location text`
- `start_date date`
- `end_date date null`
- `raw_notes text` (optional)
- `created_at timestamptz`
- `updated_at timestamptz`

Index:
- `(user_id, start_date desc)`

### `bullets`
- `id uuid` PK
- `user_id uuid` FK
- `position_id uuid` FK → positions.id
- `category text` (enum later; MVP string)
- `hard_skills text[]`
- `soft_skills text[]`
- `original_text text` (LLM output)
- `current_text text` (user-edited)
- `was_edited boolean generated/maintained`
- `embedding vector(1536)` (pgvector)
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:
- `(user_id, position_id)`
- `(user_id, category)`
- pgvector index on `embedding` (see embeddings spec)

### `resumes`
- `id uuid` PK
- `user_id uuid` FK
- `name text`
- `template_id text` (matches template registry)
- `content jsonb` (sections + bullet IDs + ordering)
- `created_at timestamptz`
- `updated_at timestamptz`

Index:
- `(user_id, updated_at desc)`

### `job_drafts`
- `id uuid` PK
- `user_id uuid` FK
- `job_title text null`
- `company text null`
- `jd_text text` (pasted)
- `jd_embedding vector(1536)` (optional; can compute on demand)
- `retrieved_bullet_ids uuid[]` (top 50 for debugging)
- `selected_bullet_ids uuid[]` (final chosen set)
- `draft_resume_id uuid null` FK → resumes.id
- `created_at timestamptz`

Index:
- `(user_id, created_at desc)`

### `runs`
- `id uuid` PK
- `user_id uuid` FK
- `type text` (interview|bullet_gen|embed|draft|export)
- `prompt_id text`
- `model text`
- `input jsonb`
- `output jsonb`
- `success boolean`
- `latency_ms int`
- `tokens_in int null`
- `tokens_out int null`
- `created_at timestamptz`

Index:
- `(user_id, created_at desc)`
- `(type, created_at desc)`

---

## RLS (high level)
For all new tables:
- `SELECT/INSERT/UPDATE/DELETE` only allowed where `user_id = auth.uid()`
- For tables keyed by `user_id` PK, enforce `user_id = auth.uid()` at insert

## Acceptance criteria
- DB migrations implemented
- `docs/db_schema.md` updated
- Generated types updated
- RLS verified with tests (attempt cross-user read/write fails)

## Test plan
- Integration tests:
  - can create/read/update/delete bullets for self
  - cannot read another user’s bullets
- Unit tests:
  - JSON schema validation for `resumes.content`

