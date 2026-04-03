-- RLS WITH CHECK runs the EXISTS() subquery as a role that often cannot SELECT auth.users,
-- so the check is always false and signup still fails after 026.
-- This helper runs with definer (postgres) rights so auth.users is visible.

CREATE OR REPLACE FUNCTION public.profile_auth_user_exists(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id);
$$;

ALTER FUNCTION public.profile_auth_user_exists(uuid) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.profile_auth_user_exists(uuid) TO PUBLIC;

-- Replace policy to use helper (not a direct auth.users subquery in the policy).
DROP POLICY IF EXISTS "Allow profile insert when auth user exists" ON profiles;

CREATE POLICY "Allow profile insert when auth user exists"
ON profiles
FOR INSERT
WITH CHECK (public.profile_auth_user_exists(id));

-- Ensure signup triggers can update auth.users (raw_app_meta_data) if RLS affects them.
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
ALTER FUNCTION public.set_user_claims(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.sync_user_role_to_jwt() OWNER TO postgres;
