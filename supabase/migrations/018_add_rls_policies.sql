-- Migration 018: Add RLS policies for Odie tables
-- All tables enforce user_id = auth.uid() for all operations

-- ============================================================================
-- candidate_profiles RLS
-- ============================================================================
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own candidate profile"
ON candidate_profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own candidate profile"
ON candidate_profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own candidate profile"
ON candidate_profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own candidate profile"
ON candidate_profiles
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- positions RLS
-- ============================================================================
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own positions"
ON positions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own positions"
ON positions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own positions"
ON positions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own positions"
ON positions
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- bullets RLS
-- ============================================================================
ALTER TABLE bullets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bullets"
ON bullets
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own bullets"
ON bullets
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own bullets"
ON bullets
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own bullets"
ON bullets
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- resumes RLS
-- ============================================================================
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own resumes"
ON resumes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own resumes"
ON resumes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own resumes"
ON resumes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own resumes"
ON resumes
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- job_drafts RLS
-- ============================================================================
ALTER TABLE job_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own job drafts"
ON job_drafts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own job drafts"
ON job_drafts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own job drafts"
ON job_drafts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own job drafts"
ON job_drafts
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- runs RLS
-- ============================================================================
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own runs"
ON runs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own runs"
ON runs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own runs"
ON runs
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own runs"
ON runs
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
