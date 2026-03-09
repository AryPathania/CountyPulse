-- Migration 022: Create uploaded_resumes table for resume upload feature
-- Stores uploaded PDF metadata, extracted text, and cached LLM parse results

CREATE TABLE uploaded_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    extracted_text TEXT,
    parsed_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for user lookups
CREATE INDEX uploaded_resumes_user_idx ON uploaded_resumes(user_id);

-- Unique constraint for dedup (same user + same file hash = same file)
CREATE UNIQUE INDEX uploaded_resumes_user_hash_idx ON uploaded_resumes(user_id, file_hash);

-- Enable RLS
ALTER TABLE uploaded_resumes ENABLE ROW LEVEL SECURITY;

-- RLS policies (user isolation)
CREATE POLICY "uploaded_resumes_select" ON uploaded_resumes
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "uploaded_resumes_insert" ON uploaded_resumes
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "uploaded_resumes_update" ON uploaded_resumes
    FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "uploaded_resumes_delete" ON uploaded_resumes
    FOR DELETE TO authenticated USING (user_id = auth.uid());
