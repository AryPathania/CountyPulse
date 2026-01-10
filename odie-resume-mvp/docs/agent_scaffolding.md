# Agent scaffolding (who talks to who)

## Topology: hub-and-spoke

**Orchestrator is the only “manager”.**

Agents do NOT coordinate by chatting with each other.
They coordinate by producing and consuming **artifacts** (markdown docs + code + tests).

### Shared artifacts (the only shared memory)
1) `docs/specs/*` — implementable specs + acceptance criteria  
2) `docs/adr/*` — durable architecture decisions  
3) `docs/db_schema.md` — table/column/RLS/index source of truth  
4) `docs/notes.md` — single curated scratchpad  
5) Tests — executable truth

---

## Reporting chain

### Orchestrator
- assigns tasks to specialized agents
- ensures spec + contracts exist before implementation
- merges only when quality gates pass
- curates `docs/notes.md`

### Spec Agent
- writes/updates specs (PRD → acceptance criteria → test plan)
- updates ADRs when a decision is made
- asks the user only when a product decision affects architecture

### Contract Agent
- defines payload shapes and invariants:
  - TypeScript types
  - Zod schemas
- produces a “contract surface area” that both UI and backend share

### DB Agent
- migrations
- RLS policies
- indexes
- updates `docs/db_schema.md`
- updates generated types pipeline

### Pipeline/LLM Agent
- implements Odie workflows (interview → bullets → embeddings → draft)
- owns prompt versioning + evaluation harness

### UI Agents
- build UI slices following specs
- must keep shared editor DRY:
  - one BulletEditor component used across screens
- must add `data-testid` for Playwright stability

### Test Agent
- unit/integration tests (Vitest)
- E2E tests (Playwright)
- coverage gate (>90%)
- enforces “no skip”

### Validation Agent (non-negotiable)
Runs after each implementation slice and can block merges.

Responsibilities:
1) Duplicate code gate (jscpd)  
2) Name inflation gate (diff review checklist)  
3) Patch-on-patch gate (root cause enforcement)  
4) Dead code + unused exports scan (optional but recommended)

---

## Standard feature slice workflow

1) Spec Agent: update `docs/specs/<feature>.md`
2) Contract Agent: update `packages/shared/contracts` (or closest equivalent)
3) DB Agent: migrations + `docs/db_schema.md`
4) Implementation Agent(s): UI/DB/Edge Functions code
5) Test Agent: add tests; no skips; coverage
6) Validation Agent: duplication + naming + patch-on-patch
7) Orchestrator: merge + update `docs/notes.md`



## Pivot note (CountyPulse → Odie)

If the repo still contains CountyPulse packages, run the pivot plan first: `docs/migration/COUNTYPULSE_TO_ODIE.md`.
