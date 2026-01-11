-- Migration 017: Create Odie Resume tables
-- Core data model for bullets, resumes, job drafts, and runs

-- Ensure vector extension is available (may already exist from CountyPulse)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- candidate_profiles
-- One per user, stores headline and professional summary
-- ============================================================================
CREATE TABLE candidate_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    headline TEXT,
    summary TEXT,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_candidate_profiles_updated_at
    BEFORE UPDATE ON candidate_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- positions
-- Work experience entries for a user
-- ============================================================================
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT,
    start_date DATE,
    end_date DATE,
    raw_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for listing positions by user, ordered by recency
CREATE INDEX positions_user_start_date_idx ON positions(user_id, start_date DESC);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- bullets
-- STAR bullets tied to positions, with embeddings for semantic search
-- ============================================================================
CREATE TABLE bullets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    category TEXT,
    hard_skills TEXT[] DEFAULT '{}',
    soft_skills TEXT[] DEFAULT '{}',
    original_text TEXT NOT NULL,
    current_text TEXT NOT NULL,
    was_edited BOOLEAN GENERATED ALWAYS AS (original_text IS DISTINCT FROM current_text) STORED,
    embedding VECTOR(1536),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for listing bullets by user and position
CREATE INDEX bullets_user_position_idx ON bullets(user_id, position_id);

-- Index for filtering bullets by category
CREATE INDEX bullets_user_category_idx ON bullets(user_id, category);

-- Vector index for similarity search (IVFFlat for MVP scale)
CREATE INDEX bullets_embedding_idx ON bullets
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_bullets_updated_at
    BEFORE UPDATE ON bullets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- resumes
-- Curated selections of bullets with ordering
-- ============================================================================
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    template_id TEXT DEFAULT 'default',
    content JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for listing resumes by user, ordered by recency
CREATE INDEX resumes_user_updated_idx ON resumes(user_id, updated_at DESC);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_resumes_updated_at
    BEFORE UPDATE ON resumes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- job_drafts
-- Pasted JD + retrieval results + generated draft reference
-- ============================================================================
CREATE TABLE job_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_title TEXT,
    company TEXT,
    jd_text TEXT NOT NULL,
    jd_embedding VECTOR(1536),
    retrieved_bullet_ids UUID[] DEFAULT '{}',
    selected_bullet_ids UUID[] DEFAULT '{}',
    draft_resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for listing job drafts by user, ordered by recency
CREATE INDEX job_drafts_user_created_idx ON job_drafts(user_id, created_at DESC);

-- ============================================================================
-- runs
-- Telemetry for LLM invocations (interview, bullet gen, embed, draft, export)
-- ============================================================================
CREATE TABLE runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    prompt_id TEXT,
    model TEXT,
    input JSONB DEFAULT '{}'::jsonb,
    output JSONB DEFAULT '{}'::jsonb,
    success BOOLEAN DEFAULT true,
    latency_ms INTEGER,
    tokens_in INTEGER,
    tokens_out INTEGER,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for listing runs by user, ordered by recency
CREATE INDEX runs_user_created_idx ON runs(user_id, created_at DESC);

-- Index for filtering runs by type
CREATE INDEX runs_type_created_idx ON runs(type, created_at DESC);
