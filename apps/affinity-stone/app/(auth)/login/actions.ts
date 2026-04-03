'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeNanpInputToE164 } from '@/lib/auth/phone';
import { stripPhoneDigits } from 'core/lib/phone-format';

export type PhoneSignInResult = { success: true } | { success: false; error: string };

export async function signInWithPhonePassword(
  phoneDigits: string,
  password: string
): Promise<PhoneSignInResult> {
  const isDevMode =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  if (isDevMode) {
    return { success: false, error: 'Phone sign-in requires Supabase to be configured.' };
  }

  const trimmedPw = password?.trim();
  if (!trimmedPw) {
    return { success: false, error: 'Password is required.' };
  }

  const e164 = normalizeNanpInputToE164(stripPhoneDigits(phoneDigits));
  if (!e164) {
    return { success: false, error: 'Enter a complete US phone number (10 digits, or 11 starting with 1).' };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      success: false,
      error: 'Phone sign-in is not configured (service role key required).',
    };
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, email, active')
    .eq('phone', e164)
    .maybeSingle();

  if (profileError || !profile) {
    return { success: false, error: 'Invalid phone number or password.' };
  }

  if (!profile.active) {
    return { success: false, error: 'This account is inactive.' };
  }

  let signInEmail = profile.email?.trim() || null;
  if (!signInEmail) {
    const { data: authData, error: authLookupError } = await admin.auth.admin.getUserById(profile.id);
    if (authLookupError || !authData.user?.email) {
      return { success: false, error: 'Invalid phone number or password.' };
    }
    signInEmail = authData.user.email;
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: signInEmail,
    password: trimmedPw,
  });

  if (signInError) {
    return { success: false, error: signInError.message || 'Invalid phone number or password.' };
  }

  return { success: true };
}
