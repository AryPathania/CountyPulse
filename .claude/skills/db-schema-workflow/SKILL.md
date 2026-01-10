---
name: db-schema-workflow
description: Workflow for maintaining docs/db_schema.md as the human-readable source of truth. Use when making database changes.
---

# `docs/db_schema.md` Workflow (no guessing)

## Purpose
Humans (and agents) need a single, readable truth source for:
- table names
- column names + types
- relationships
- RLS policies (summary)
- indexes

## Rules
- DB Agent updates it in the same PR as migrations.
- Query authors consult it first; do not "guess a column name".
- Keep relationships explicit (FKs + cascade behavior).

## Format (example)
For each table:
- Purpose
- Columns (name, type, nullable, default)
- Constraints / FKs
- Indexes
- RLS (who can read/write)
- Notes (edge cases)
