import {
  isCompleteNanpDigits,
  stripPhoneDigits,
} from 'core/lib/phone-format';

export const PHONE_LOGIN_DOMAIN = 'phone-login.invalid';

export function isSyntheticPhoneLoginEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${PHONE_LOGIN_DOMAIN}`);
}

/**
 * Normalize digits-only input to E.164:
 * - 10 digits → +1…
 * - 11 digits starting with 1 → +…
 * - else if 10–15 digits → international +
 */
export function normalizeE164Phone(digits: string): string | null {
  const d = stripPhoneDigits(digits);
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (d.length >= 10 && d.length <= 15) return `+${d}`;
  return null;
}

export function normalizeNanpInputToE164(digits: string): string | null {
  if (!isCompleteNanpDigits(digits)) return null;
  return normalizeE164Phone(digits);
}

export function syntheticEmailFromE164(e164: string): string {
  const digits = stripPhoneDigits(e164);
  return `p${digits}@${PHONE_LOGIN_DOMAIN}`;
}

export function reservedPhoneLoginDomainMessage(): string {
  return `The domain @${PHONE_LOGIN_DOMAIN} is reserved for phone-based accounts.`;
}
