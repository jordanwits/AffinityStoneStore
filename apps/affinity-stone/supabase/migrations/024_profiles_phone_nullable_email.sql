-- Phone-based profiles: nullable email, optional phone, unique phone, handle_new_user sets phone from auth or metadata

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_email_or_phone_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_email_or_phone_check CHECK (
  COALESCE(NULLIF(BTRIM(email), ''), NULL) IS NOT NULL
  OR COALESCE(NULLIF(BTRIM(phone), ''), NULL) IS NOT NULL
);

DROP INDEX IF EXISTS idx_profiles_phone_unique;
CREATE UNIQUE INDEX idx_profiles_phone_unique ON profiles(phone) WHERE phone IS NOT NULL;

-- Do not reference NEW.phone — column/type differs across Auth versions and can break the trigger.
-- If phone_e164 metadata is missing, derive E.164 from synthetic email p{digits}@phone-login.invalid.
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

  -- Role JWT: sync_profile_role_to_jwt (after insert on profiles) calls set_user_claims.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Admin createUser runs handle_new_user with no JWT; is_admin() is false without this policy.
-- Use SECURITY DEFINER helper: plain EXISTS (SELECT … auth.users) in the policy cannot read
-- auth.users for the evaluating role, so the check stays false and signup fails.
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

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
ALTER FUNCTION public.set_user_claims(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.sync_user_role_to_jwt() OWNER TO postgres;
