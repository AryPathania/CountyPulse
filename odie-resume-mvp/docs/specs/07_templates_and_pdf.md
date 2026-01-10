# Spec: Templates + PDF export (scalable)

Status: Draft  
Owner: UI Agent + Pipeline Agent  
Date: 2026-01-10

## Goal
Start with 1 resume template, but make it trivial to add more.

## Template architecture
- Template registry in UI:
  - `template_id` → React renderer component
- Resume data is template-agnostic JSON.

## MVP template
`classic_v1`
- single-column
- standard headings
- consistent typography

## PDF export
MVP:
- render preview HTML
- use browser print-to-PDF OR programmatic export via Playwright in an API route (later)
Keep it simple.

## Adding templates later
- Add new folder under templates
- Add registry entry
- No changes to core resume content schema

## Acceptance criteria
- Can export PDF for one template
- Can switch template_id on a resume and preview changes

## Test plan
- E2E:
  - create resume, export PDF (or verify export action)
- Visual snapshot (optional):
  - snapshot preview DOM

