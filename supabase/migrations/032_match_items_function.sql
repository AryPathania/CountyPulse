-- Migration 032: Replace match_bullets with unified match_items function
-- Searches both bullets AND profile_entries via vector similarity

DROP FUNCTION IF EXISTS match_bullets;

CREATE OR REPLACE FUNCTION match_items(
    query_embedding vector(1536),
    match_user_id uuid,
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 50,
    source_filter text DEFAULT 'all'  -- 'bullets', 'entries', 'all'
)
RETURNS TABLE (
    id uuid,
    source_type text,
    content_text text,
    similarity float,
    category text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    (SELECT b.id, 'bullet'::text AS source_type, b.current_text AS content_text,
            1 - (b.embedding <=> query_embedding) AS similarity, b.category
     FROM bullets b
     WHERE b.user_id = match_user_id
           AND b.embedding IS NOT NULL
           AND 1 - (b.embedding <=> query_embedding) > match_threshold
           AND (source_filter IN ('bullets', 'all')))
    UNION ALL
    (SELECT pe.id, 'entry'::text AS source_type,
            pe.title || COALESCE(' | ' || pe.subtitle, '') AS content_text,
            1 - (pe.embedding <=> query_embedding) AS similarity, pe.category
     FROM profile_entries pe
     WHERE pe.user_id = match_user_id
           AND pe.embedding IS NOT NULL
           AND 1 - (pe.embedding <=> query_embedding) > match_threshold
           AND (source_filter IN ('entries', 'all')))
    ORDER BY similarity DESC
    LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_items TO authenticated;

COMMENT ON FUNCTION match_items IS
'Unified vector similarity search across bullets and profile_entries.
Replaces match_bullets. Supports filtering by source type.

Parameters:
- query_embedding: The embedding vector to match against
- match_user_id: The user whose items to search
- match_threshold: Minimum similarity score (0-1), default 0.5
- match_count: Maximum number of results, default 50
- source_filter: Which tables to search (bullets, entries, all)

Security: SECURITY DEFINER to bypass RLS for performance,
but explicitly filters by user_id for data isolation.';
