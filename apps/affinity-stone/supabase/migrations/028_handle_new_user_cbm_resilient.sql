-- Match working CBMPlasticsMerchShop migration 023 + phone metadata (026):
-- https://supabase.com/docs/guides/troubleshooting/database-error-saving-new-user-RU_EwB
-- - SECURITY DEFINER SET search_path = ''
-- - Fully qualify public.profiles / auth.users
-- - Wrap raw_app_meta_data UPDATE in EXCEPTION so JWT sync failures do not roll back signup
-- - Phone: phone_e164 from metadata + synthetic email fallback; strip @phone-login.invalid from profile email

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_role TEXT := 'user';
  v_email TEXT;
  v_phone TEXT;
  digits TEXT;
BEGIN
  v_email := NULLIF(trim(COALESCE(NEW.email, '')), '');
  IF v_email IS NOT NULL AND v_email ILIKE '%@phone-login.invalid' THEN
    v_email := NULL;
  END IF;

  v_phone := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone_e164', '')), '');
  IF v_phone IS NULL OR length(v_phone) = 0 THEN
    IF NEW.email IS NOT NULL AND NEW.email ~* '^p[0-9]+@phone-login\.invalid$' THEN
      digits := SUBSTRING(NEW.email FROM '^p([0-9]+)@');
      IF digits IS NOT NULL AND length(digits) = 10 THEN
        v_phone := '+1' || digits;
      ELSIF digits IS NOT NULL AND length(digits) = 11 AND substring(digits FROM 1 FOR 1) = '1' THEN
        v_phone := '+' || digits;
      ELSIF digits IS NOT NULL AND length(digits) >= 10 AND length(digits) <= 15 THEN
        v_phone := '+' || digits;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, phone, full_name, role)
  VALUES (
    NEW.id,
    v_email,
    v_phone,
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    new_role
  );

  BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role)
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_user_role_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role)) THEN
    BEGIN
      UPDATE auth.users
      SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
      WHERE id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
ALTER FUNCTION public.sync_user_role_to_jwt() OWNER TO postgres;
