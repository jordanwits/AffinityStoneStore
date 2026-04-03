import type { User } from '@supabase/supabase-js';

export const MUST_CHANGE_PASSWORD_KEY = 'must_change_password' as const;

export function userMustChangePassword(user: User | null | undefined): boolean {
  if (!user?.user_metadata) return false;
  const v = (user.user_metadata as Record<string, unknown>)[MUST_CHANGE_PASSWORD_KEY];
  return v === true || v === 'true';
}
