# Spec: Bullets Library (CRUD + shared editor)

Status: Draft  
Owner: UI Agent + DB Agent  
Date: 2026-01-10

## Goal
Provide a single place to:
- view all bullets
- filter/search (MVP: simple text filter)
- edit bullet text + category + skills
- ensure edits persist and are reused everywhere (resume builder included)

## Key DRY requirement
There is exactly **one** bullet editor component.
See `docs/skills/shared_bullet_editor_dry.md`.

## UI
Route: `/bullets`
Layout:
- left: list (filters + bullets)
- right: editor panel (or modal)
- top: nav bar

## Data fetching
- UI uses TanStack Query hooks.
- Hooks call `packages/db` query functions only.

## Editing behavior
- Editing `current_text` updates DB
- `original_text` remains immutable (for telemetry)
- On save:
  - set `was_edited = true` if `current_text != original_text`
  - update `updated_at`
  - enqueue re-embedding (async) OR embed immediately (MVP: immediate on save is fine)

## Acceptance criteria
- CRUD works
- Editing bullet updates everywhere else (resume builder uses same bullet IDs)
- No duplicated editing logic across screens

## Test plan
- Unit:
  - diff/was_edited logic
- E2E:
  - edit bullet on Bullets screen
  - open Resume Builder, confirm bullet text updated

