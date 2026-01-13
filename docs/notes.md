# notes.md (single shared scratchpad)

This file is the only shared scratchpad between agents.

Rules:
- Keep it short and curated.
- Remove stale notes.
- Every entry should point to a spec/ADR/test that is the real source of truth.

---

## Current status
- [x] Phase 0.5: schema inventory pulled to migrations
- [x] Odie Resume DB tables created + RLS
- [x] UI: login + home (JD input)
- [x] Interview flow (text)
- [x] Bullets library + editor
- [x] Resume builder (DnD)
- [x] Template v1 + PDF export
- [x] Retrieval + draft
- [x] Telemetry
- [x] CI quality gates (no skip, coverage, duplication)
- [x] E2E tests (Playwright)

**MVP Feature Complete** - 284 unit tests, 52 E2E tests, 92%+ coverage

---

## Decisions (keep to 1–2 lines)
- State mgmt: TanStack Query for server state, minimal React state for UI
- PDF rendering: Browser print-to-PDF via window.print() (ADR 004)
- Embeddings model/dims: text-embedding-ada-002, 1536 dimensions
- Template registry approach: Map<templateId, Template> with getTemplate() fallback (ADR 003)

---

## Resolved questions
- Per-resume bullet overrides in MVP? **No** - bullets are global
- How many templates in MVP? **1** - classic_v1 only
- JD ingestion: **Pasted text only** - no file upload in MVP

---

## Debug Workflow
- All fixes go through `debug-agent`
- 4 phases: Understand → Plan → Execute → Validate
- Quality rules: `docs/code-quality-rules.md`
- Visual validation: `playwright-screenshots` + `visual-validation` skills

