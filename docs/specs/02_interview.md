# Spec: Interview flow (comprehensive profile → positions → bullets)

Status: Draft  
Owner: Pipeline Agent + UI Agent  
Date: 2026-01-10

## Goal
Collect a comprehensive candidate profile (not JD-specific) and produce:
- normalized positions
- STAR bullets per position
- categories/tags per bullet

MVP interview is **text chat**.

## UI
Screen: `Interview`
- Chat thread
- Text input
- “End interview” button
- Progress indicator (optional)

## Pipeline (Odie)
Odie behavior:
1) Ask about positions (company/title/dates) first.
2) For each position:
   - ask for 3–6 impact stories
   - extract metrics (latency, scale, money, adoption)
   - turn each story into 1 bullet in STAR form

3) After bullets are created:
   - categorize them (frontend/backend/leadership/etc.)
   - extract skills lists

## Output contract
The pipeline writes:
- positions
- bullets (original_text + current_text initially same)
- tags/skills
- a `run` record with prompt version + output

## Prompt requirements
- produce strict JSON
- never invent metrics; ask follow-ups when missing
- prefer “numbers with units”
- include assumptions field when user is vague
- end each position when enough stories collected

## Acceptance criteria
- User can complete interview and see:
  - positions created
  - bullets created and editable in Bullets Library
- All new bullets have embeddings queued/created

## Test plan
- Unit:
  - contract validation for prompt output (Zod)
- Integration:
  - end-to-end: create positions + bullets in DB, visible in UI
- E2E:
  - complete interview with stubbed LLM response (deterministic)

