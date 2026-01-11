# Implementation plan (MVP)

Date: 2026-01-10

This plan assumes you are reusing the existing CountyPulse monorepo and Supabase project.

---

## Phase 0.5 — Schema inventory + repo alignment

Run the pivot checklist first:
- `docs/migration/COUNTYPULSE_TO_ODIE.md` (delete irrelevant packages, rebrand, prune scripts)

Spec: `docs/specs/09_phase_0_5_schema_inventory.md`

Deliverables:
- migrations pulled
- generated types updated
- `docs/db_schema.md` filled
- legacy keep/deprecate decided

---

## Phase 1 — Foundation + quality gates
Spec: `docs/specs/00_foundation.md`

Deliverables:
- CI quality gates (no skip, >90% coverage, jscpd)
- lint/typecheck/test scripts standardized
- theme tokens (black/white/royal blue)

---

## Phase 2 — Data model + DB migrations
Spec: `docs/specs/01_data_model.md`

Deliverables:
- new Odie Resume tables + RLS + indexes
- `match_bullets` SQL function
- DB integration tests for RLS

---

## Phase 3 — Bullets Library + shared editor
Spec: `docs/specs/03_bullets_library.md`

Deliverables:
- `/bullets` screen
- `BulletEditor` reusable component
- edit persistence + re-embed on save

---

## Phase 4 — Interview (text chat) → generate positions + bullets
Spec: `docs/specs/02_interview.md`

Deliverables:
- `/interview` screen
- pipeline endpoints/functions to:
  - create positions/bullets
  - log runs
- deterministic stubs for tests

---

## Phase 5 — Home (JD paste) → draft resume
Spec: `docs/specs/05_home.md` + `docs/specs/04_embeddings_and_retrieval.md`

Deliverables:
- Home screen with JD input
- job_drafts stored
- retrieve top bullets + create resume draft

---

## Phase 6 — Resume Builder (DnD) + preview
Spec: `docs/specs/06_resume_builder.md`

Deliverables:
- DnD section/bullet ordering
- save resume content JSON
- preview pane renders template

---

## Phase 7 — Templates + PDF export
Spec: `docs/specs/07_templates_and_pdf.md`

Deliverables:
- template registry (`classic_v1`)
- export action (print-to-PDF)

---

## Phase 8 — Telemetry and evaluation harness
Spec: `docs/specs/08_telemetry.md`

Deliverables:
- runs table filled for every model call
- bullet drift tracked
- baseline eval dataset + scripts

---

## Phase 9 — Hardening
Spec: `docs/specs/10_testing.md`

Deliverables:
- stable E2E suite
- >90% coverage maintained
- duplication threshold tuned and enforced
