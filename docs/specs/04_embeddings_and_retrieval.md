# Spec: Embeddings + matching bullets to a job (simple RAG)

Status: Draft  
Owner: Pipeline Agent + DB Agent  
Date: 2026-01-10

## MVP pipeline
Input: user pastes JD text.

1) Create embedding for JD text.
2) Retrieve top 50 bullets for this user via cosine similarity (pgvector).
3) Optional re-rank using an LLM to pick “best bullets per section”.
4) Generate a Resume Draft (structured JSON) by assembling bullet IDs.

## Why this approach (vs “LLM decides queries”)
- Deterministic + debuggable
- Lets you inspect “retrieved top 50” and improve embeddings/indexing
- Keeps cost predictable

LLM “query planning” can be layered later, but should not replace similarity search.

## DB
- `bullets.embedding vector(1536)` required
- optionally `job_drafts.jd_embedding vector(1536)`

Add SQL function:
- `match_bullets(p_user_id uuid, p_embedding vector(1536), p_limit int)`
Returns bullets ordered by similarity.

Indexes:
- add pgvector index on `bullets.embedding` (ivfflat/hnsw depending on support)

## Re-ranking (optional in MVP)
Given:
- JD text
- top 50 bullets with metadata
LLM returns:
- selected bullet IDs grouped by suggested section labels

## Acceptance criteria
- Pasting JD yields a “Draft Resume” with selected bullets
- Top-50 retrieved IDs stored on `job_drafts` for debugging

## Test plan
- Unit:
  - deterministic stub for re-ranker
- Integration:
  - create bullets with known embeddings and confirm ordering
- E2E:
  - paste JD → draft resume appears

