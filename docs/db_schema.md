# Database schema (source of truth)

This file is the human-readable source of truth for table/column names, relationships, RLS, and indexes.

**Updated by:** DB Agent only  
**Updated when:** any migration changes schema

---

## Conventions
- Primary key: `id uuid default gen_random_uuid()`
- Ownership column: `user_id uuid not null` (FK to profiles/user table)
- Timestamps: `created_at`, `updated_at` timestamptz

---

## Existing tables (from Phase 0.5)
> Fill in after `supabase db pull`.

### public.profiles (or equivalent)
- Purpose:
- Columns:
- RLS:
- Indexes:

---

## Odie Resume tables

### candidate_profiles
(…fill once migrations land…)

### positions

### bullets

### resumes

### job_drafts

### runs

---

## RLS policy summary
- All user-owned rows must enforce `user_id = auth.uid()` for:
  - SELECT
  - INSERT
  - UPDATE
  - DELETE

---

## Indexing summary
- bullets: (user_id, position_id), vector index on embedding
- resumes: (user_id, updated_at desc)
- job_drafts: (user_id, created_at desc)

