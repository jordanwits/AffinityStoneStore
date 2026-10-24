import type { User } from '@supabase/supabase-js';

export const MUST_CHANGE_PASSWORD_KEY = 'must_change_password' as const;

/**
 * Whether the user still has to replace a temporary password an admin gave them.
 *
 * The flag is kept in app_metadata, which only the service role can write. It used to be in
 * user_metadata, which a signed-in user can change from the browser with
 * supabase.auth.updateUser({ data }), so anyone could clear it and carry on with the
 * temporary password the admin had seen. Migration 051 moved existing flags across.
 */
export function userMustChangePassword(user: User | null | undefined): boolean {
  const value = (user?.app_metadata as Record<string, unknown> | undefined)?.[MUST_CHANGE_PASSWORD_KEY];
  return value === true || value === 'true';
}
