# MCP policy (minimize context cost)

MCPs are expensive. Only equip agents that truly need them.

## Allowed MCPs for this repo

### Supabase MCP
**Who gets it:**
- DB Agent (required)
- Pipeline Agent (often required for writing runs/telemetry server-side)
- DB/API Test Agent (required for RLS and query verification)

**Who does NOT get it:**
- UI agents (should never need it)
- Spec/ADR agents
- Duplication/Refactor agent
- UX mockup agent

### GitHub MCP (optional)
**Who gets it:**
- Orchestrator (issues/PR coordination)
- CI agent (workflow updates)

### Browser / Playwright tooling
**Who gets it:**
- Test Agent only

### “Scraping” MCPs
Not needed for MVP.
MVP accepts pasted JD text. URL ingestion is a later feature.

---

## Guardrails

- If an agent does not have the MCP, it must not request secrets, tokens, or “just try it”.
- Supabase writes go through:
  - migrations + edge functions + `packages/db` queries
- UI should call typed query functions rather than ad-hoc Supabase calls.
