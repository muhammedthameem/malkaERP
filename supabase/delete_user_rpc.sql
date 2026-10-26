-- ================================================================
-- Supabase SQL Function: delete_user
-- ================================================================
-- Description:
-- Safely deletes a user from both public.erp_users and auth.users.
--
-- How to apply:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Select your project: ksfnhngkxzogprpgqlrd
-- 3. Go to SQL Editor (on the left menu)
-- 4. Paste this script and click "Run"
-- ================================================================

CREATE OR REPLACE FUNCTION public.delete_user(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- 1. Look up user id in auth.users by email
  SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(user_email);

  -- 2. Delete user profile from public.erp_users table
  DELETE FROM public.erp_users WHERE LOWER(id) = LOWER(user_email);

  -- 3. If found in auth.users, remove authentication records
  IF v_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_user_id;
  END IF;

  RETURN true;
END;
$$;

-- Grant execution permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.delete_user(text) TO anon, authenticated, service_role;
