import { formatStoredPhoneForDisplay } from 'core/lib/phone-format';

/** Prefer real email; otherwise format +1 E.164 phone for tables and labels. */
export function displayProfileContact(
  email: string | null | undefined,
  phone: string | null | undefined
): string {
  const e = email?.trim();
  if (e) return e;
  const p = phone?.trim();
  if (p) return formatStoredPhoneForDisplay(p);
  return '—';
}
