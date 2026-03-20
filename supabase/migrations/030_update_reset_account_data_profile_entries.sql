-- Migration 030: Update reset_account_data to include profile_entries
-- Added after migration 029 introduced the profile_entries table

CREATE OR REPLACE FUNCTION reset_account_data(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Verify caller is resetting their own data
  IF auth.uid() IS NULL OR auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Can only reset your own account data';
  END IF;

  -- Delete in FK-safe order
  DELETE FROM profile_entries WHERE user_id = target_user_id;
  DELETE FROM bullets WHERE user_id = target_user_id;
  DELETE FROM positions WHERE user_id = target_user_id;
  DELETE FROM resumes WHERE user_id = target_user_id;
  DELETE FROM job_drafts WHERE user_id = target_user_id;
  DELETE FROM uploaded_resumes WHERE user_id = target_user_id;
  DELETE FROM runs WHERE user_id = target_user_id;
  DELETE FROM candidate_profiles WHERE user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
