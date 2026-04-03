-- Fix "Database error creating new user" for admin createUser (email invite + phone):
-- During handle_new_user(), auth.uid() is NULL, so is_admin() is false and RLS blocked
-- INSERT into profiles. Allow insert when the row's id already exists in auth.users
-- (same transaction as the new auth user).

-- Prefer 027: direct EXISTS on auth.users in WITH CHECK cannot read auth.users.
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

DROP POLICY IF EXISTS "Allow profile insert when auth user exists" ON profiles;

CREATE POLICY "Allow profile insert when auth user exists"
ON profiles
FOR INSERT
WITH CHECK (public.profile_auth_user_exists(id));

-- set_user_claims is already invoked by sync_profile_role_to_jwt AFTER INSERT on profiles.
-- Calling it again here nested inside the auth.users INSERT trigger can fail on some hosts.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_role TEXT := 'user';
  profile_email TEXT;
  profile_phone TEXT;
  v_auth_email TEXT;
  digits TEXT;
BEGIN
  v_auth_email := NULLIF(BTRIM(NEW.email), '');

  profile_phone := NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'phone_e164', '')), '');

  IF profile_phone IS NULL OR profile_phone = '' THEN
    IF v_auth_email IS NOT NULL AND v_auth_email ~* '^p[0-9]+@phone-login\.invalid$' THEN
      digits := SUBSTRING(v_auth_email FROM '^p([0-9]+)@');
      IF digits IS NOT NULL AND LENGTH(digits) = 10 THEN
        profile_phone := '+1' || digits;
      ELSIF digits IS NOT NULL AND LENGTH(digits) = 11 AND SUBSTRING(digits FROM 1 FOR 1) = '1' THEN
        profile_phone := '+' || digits;
      ELSIF digits IS NOT NULL AND LENGTH(digits) >= 10 AND LENGTH(digits) <= 15 THEN
        profile_phone := '+' || digits;
      END IF;
    END IF;
  END IF;

  profile_email := v_auth_email;
  IF profile_email IS NOT NULL AND profile_email ILIKE '%@phone-login.invalid' THEN
    profile_email := NULL;
  END IF;

  INSERT INTO profiles (id, email, phone, full_name, role)
  VALUES (
    NEW.id,
    profile_email,
    profile_phone,
    NULLIF(BTRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    new_role
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Avoid referencing OLD on INSERT (clearer than relying on OR short-circuit).
CREATE OR REPLACE FUNCTION sync_user_role_to_jwt()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM set_user_claims(NEW.id, NEW.role);
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    PERFORM set_user_claims(NEW.id, NEW.role);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
ALTER FUNCTION public.set_user_claims(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.sync_user_role_to_jwt() OWNER TO postgres;
