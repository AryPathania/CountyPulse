-- Enable RLS on watches table
ALTER TABLE watches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own watches
CREATE POLICY "Users can view their own watches"
ON watches
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own watches
CREATE POLICY "Users can insert their own watches"
ON watches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own watches
CREATE POLICY "Users can update their own watches"
ON watches
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own watches
CREATE POLICY "Users can delete their own watches"
ON watches
FOR DELETE
TO authenticated
USING (auth.uid() = user_id); 