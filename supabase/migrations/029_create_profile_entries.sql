-- Migration 029: Create profile_entries table
-- Generic table for structured profile data (experience, education, projects, etc.)

CREATE TABLE profile_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  start_date DATE,
  end_date DATE,
  location TEXT,
  text_items TEXT[] DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profile_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile_entries"
  ON profile_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own profile_entries"
  ON profile_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own profile_entries"
  ON profile_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete their own profile_entries"
  ON profile_entries FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_profile_entries_user_category ON profile_entries(user_id, category);

CREATE TRIGGER update_profile_entries_updated_at
  BEFORE UPDATE ON profile_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
