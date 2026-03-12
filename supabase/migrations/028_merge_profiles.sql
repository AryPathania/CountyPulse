-- Migration 028: Merge user_profiles into candidate_profiles
-- Adds display_name, profile_completed_at, profile_version, created_at to candidate_profiles,
-- migrates existing data, updates reset_account_data RPC, then drops user_profiles.

-- Add user_profiles fields to candidate_profiles
ALTER TABLE candidate_profiles
  ADD COLUMN display_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN profile_completed_at TIMESTAMPTZ,
  ADD COLUMN profile_version INTEGER DEFAULT 1,
  ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();

-- Migrate existing user_profiles data into candidate_profiles
INSERT INTO candidate_profiles (user_id, display_name, profile_completed_at, profile_version, created_at)
SELECT user_id, display_name, profile_completed_at, profile_version, created_at
FROM user_profiles
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  profile_completed_at = EXCLUDED.profile_completed_at,
  profile_version = EXCLUDED.profile_version,
  created_at = EXCLUDED.created_at;

-- Update reset_account_data RPC to remove user_profiles deletion
CREATE OR REPLACE FUNCTION reset_account_data(target_user_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM bullets WHERE user_id = target_user_id;
  DELETE FROM positions WHERE user_id = target_user_id;
  DELETE FROM resumes WHERE user_id = target_user_id;
  DELETE FROM job_drafts WHERE user_id = target_user_id;
  DELETE FROM uploaded_resumes WHERE user_id = target_user_id;
  DELETE FROM runs WHERE user_id = target_user_id;
  DELETE FROM candidate_profiles WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop user_profiles (CASCADE removes its RLS policies and triggers)
DROP TABLE user_profiles CASCADE;
