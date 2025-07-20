-- Add profile completion tracking to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN profile_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN profile_version INTEGER DEFAULT 1;

-- Index for profile completion queries
CREATE INDEX user_profiles_completion_idx ON user_profiles(profile_completed_at, profile_version);

-- Update existing profiles to mark them as complete with version 1
UPDATE user_profiles 
SET profile_completed_at = created_at, profile_version = 1 
WHERE profile_completed_at IS NULL; 