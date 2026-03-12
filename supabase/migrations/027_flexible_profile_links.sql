-- Add flexible links JSONB array
ALTER TABLE candidate_profiles ADD COLUMN links JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Migrate existing data from fixed URL columns to links array
UPDATE candidate_profiles
SET links = (
  SELECT COALESCE(jsonb_agg(entry ORDER BY ord), '[]'::jsonb)
  FROM (
    SELECT 1 AS ord, jsonb_build_object('label', 'LinkedIn', 'url', linkedin_url) AS entry
      WHERE linkedin_url IS NOT NULL AND linkedin_url != ''
    UNION ALL
    SELECT 2, jsonb_build_object('label', 'GitHub', 'url', github_url)
      WHERE github_url IS NOT NULL AND github_url != ''
    UNION ALL
    SELECT 3, jsonb_build_object('label', 'Website', 'url', website_url)
      WHERE website_url IS NOT NULL AND website_url != ''
  ) entries
)
WHERE linkedin_url IS NOT NULL OR github_url IS NOT NULL OR website_url IS NOT NULL;

-- Drop old fixed URL columns
ALTER TABLE candidate_profiles
  DROP COLUMN IF EXISTS linkedin_url,
  DROP COLUMN IF EXISTS github_url,
  DROP COLUMN IF EXISTS website_url;
