-- Add user_id column to run_feedback table
ALTER TABLE run_feedback ADD COLUMN user_id UUID DEFAULT auth.uid();

-- Update existing records to set user_id (for development, we'll set to a placeholder)
-- In a real scenario, this would be handled differently
UPDATE run_feedback SET user_id = auth.uid() WHERE user_id IS NULL;

-- Make user_id NOT NULL
ALTER TABLE run_feedback ALTER COLUMN user_id SET NOT NULL;

-- Enable RLS on run_feedback table
ALTER TABLE run_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own feedback
CREATE POLICY "Users can view their own feedback"
ON run_feedback
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own feedback
CREATE POLICY "Users can insert their own feedback"
ON run_feedback
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own feedback
CREATE POLICY "Users can update their own feedback"
ON run_feedback
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own feedback
CREATE POLICY "Users can delete their own feedback"
ON run_feedback
FOR DELETE
TO authenticated
USING (auth.uid() = user_id); 