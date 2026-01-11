# ADR 003: Resume templates — registry pattern

Date: 2026-01-10  
Status: Accepted (MVP)

## Context
We want multiple resume formats later without rewriting logic.

## Decision
- Store resume content as template-agnostic JSON
- Define a UI template registry mapping `template_id` → renderer component

## Consequences
- New templates are additive
- No DB changes required for adding templates (unless we want server-managed catalog)

