-- Migration 019: Create match_bullets function for vector similarity search
-- Used to retrieve relevant bullets when tailoring a resume to a job description

CREATE OR REPLACE FUNCTION match_bullets(
    query_embedding vector(1536),
    match_user_id uuid,
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 50
)
RETURNS TABLE (
    id uuid,
    position_id uuid,
    category text,
    current_text text,
    similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        b.id,
        b.position_id,
        b.category,
        b.current_text,
        1 - (b.embedding <=> query_embedding) AS similarity
    FROM bullets b
    WHERE
        b.user_id = match_user_id
        AND b.embedding IS NOT NULL
        AND 1 - (b.embedding <=> query_embedding) > match_threshold
    ORDER BY b.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION match_bullets TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION match_bullets IS
'Finds bullets similar to a query embedding for a specific user.
Uses cosine similarity with configurable threshold and count.
Returns bullets ordered by similarity (highest first).

Parameters:
- query_embedding: The embedding vector to match against (e.g., from a JD)
- match_user_id: The user whose bullets to search (enforces data isolation)
- match_threshold: Minimum similarity score (0-1), default 0.5
- match_count: Maximum number of results, default 50

Security: SECURITY DEFINER to bypass RLS for performance,
but explicitly filters by user_id for data isolation.';
