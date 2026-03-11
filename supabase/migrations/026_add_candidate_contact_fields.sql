-- Add contact information fields to candidate_profiles
ALTER TABLE candidate_profiles
  ADD COLUMN phone text,
  ADD COLUMN location text,
  ADD COLUMN linkedin_url text,
  ADD COLUMN github_url text,
  ADD COLUMN website_url text;
