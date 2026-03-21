-- Migration 031: Add embedding column to profile_entries for unified vector search
-- Enables semantic matching of education, certifications, awards, etc. alongside bullets

ALTER TABLE profile_entries ADD COLUMN embedding vector(1536);

CREATE INDEX profile_entries_embedding_idx ON profile_entries
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
