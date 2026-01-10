# Skill: pgvector embeddings + simple retrieval

## Core idea (MVP)
1) Embed job description text
2) Similarity search against bullet embeddings (filtered by user_id)
3) Optional LLM re-rank
4) Assemble into resume sections

## Where to store embeddings
Use Supabase Postgres + pgvector.
This repo already mentions vector usage in its current schema docs/README.

Tables to add:
- `bullets.embedding vector(1536)` (or chosen dim)
- `job_drafts.embedding vector(1536)` (optional)

## Query pattern
- Create a SQL function `match_bullets(user_id, job_embedding, limit)`
- Use cosine distance or inner product
- Add an IVFFlat or HNSW index depending on pgvector support/version

## Optional: “LLM decides search terms?”
Avoid in MVP.
It makes retrieval less deterministic and harder to debug.
Do re-ranking instead: retrieve top 50 by cosine, then have LLM pick top N.
