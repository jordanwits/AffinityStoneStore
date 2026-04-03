-- Fix phone user signup: avoid NEW.phone (not reliable on all Auth DB versions) and
-- derive E.164 from raw_user_meta_data or from synthetic email p{digits}@phone-login.invalid
-- so profiles never violate profiles_email_or_phone_check.

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

  PERFORM set_user_claims(NEW.id, new_role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
