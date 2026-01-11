# ADR 002: Vector search — pgvector in Supabase

Date: 2026-01-10  
Status: Accepted (MVP)

## Context
We need similarity search over bullets for each user.
External vector DBs add cost and operational surface area.

## Decision
Use Supabase Postgres + pgvector for embeddings:
- store bullet embeddings alongside bullet records
- run similarity search via SQL function
- index embeddings for performance

## Consequences
- No per-user vector DB setup required
- Everything stays in one datastore
- Debuggable retrieval (top 50 IDs stored)

