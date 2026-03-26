-- Beta allowlist: gates access to pre-approved email addresses.
-- Frontend checks via check_beta_access() RPC; backend checks via direct query with service role.

CREATE TABLE beta_allowlist (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE beta_allowlist ENABLE ROW LEVEL SECURITY;
-- No user-facing RLS policies. Only service role can read/write.
-- This prevents users from discovering who's on the beta list.

-- RPC function: lets authenticated users check their own access without exposing the table.
-- No email parameter — reads from JWT to prevent email enumeration.
CREATE OR REPLACE FUNCTION check_beta_access()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM beta_allowlist
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Only authenticated users can call this function
REVOKE EXECUTE ON FUNCTION check_beta_access() FROM anon;
GRANT EXECUTE ON FUNCTION check_beta_access() TO authenticated;
