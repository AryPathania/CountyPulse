-- Reset Account Data RPC Function
-- Atomically deletes all user data while preserving the auth account

CREATE OR REPLACE FUNCTION reset_account_data(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify caller is resetting their own data
    IF auth.uid() IS NULL OR auth.uid() != target_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Can only reset your own account data';
    END IF;

    -- Delete in FK-safe order
    DELETE FROM job_drafts WHERE user_id = target_user_id;
    DELETE FROM resumes WHERE user_id = target_user_id;
    DELETE FROM bullets WHERE user_id = target_user_id;
    DELETE FROM positions WHERE user_id = target_user_id;
    DELETE FROM runs WHERE user_id = target_user_id;
    DELETE FROM candidate_profiles WHERE user_id = target_user_id;
    DELETE FROM user_profiles WHERE user_id = target_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reset_account_data TO authenticated;
