/**
 * US-focused phone input helpers and E.164-oriented normalization.
 */

export const PHONE_INPUT_MAX_DIGITS = 11;

export function stripPhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * NANP display: (555) 123-4567 or +1 (555) 123-4567 style for 11 digits starting with 1.
 */
export function formatPhoneFieldDisplay(digits: string): string {
  const d = stripPhoneDigits(digits).slice(0, PHONE_INPUT_MAX_DIGITS);
  if (d.length === 0) return '';

  if (d.length <= 3) {
    return d.length === 1 && d === '1' ? `+${d}` : `(${d}`;
  }

  if (d.length <= 6) {
    if (d.startsWith('1')) {
      const rest = d.slice(1);
      if (rest.length <= 3) return `+1 (${rest}`;
      return `+1 (${rest.slice(0, 3)}) ${rest.slice(3)}`;
    }
    return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  }

  if (d.startsWith('1')) {
    const rest = d.slice(1);
    if (rest.length <= 6) {
      return `+1 (${rest.slice(0, 3)}) ${rest.slice(3)}`;
    }
    return `+1 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
  }

  if (d.length <= 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

/** True when digits are a full US NANP number (10 digits, or 11 with leading 1). */
export function isCompleteNanpDigits(digits: string): boolean {
  const d = stripPhoneDigits(digits);
  if (d.length === 10) return true;
  if (d.length === 11 && d.startsWith('1')) return true;
  return false;
}

/**
 * Format stored E.164 for +1 numbers as (555) 123-4567; otherwise return raw.
 */
export function formatStoredPhoneForDisplay(e164: string | null | undefined): string {
  if (!e164 || !e164.startsWith('+')) return e164 || '';
  const rest = e164.slice(1);
  if (rest.length === 11 && rest.startsWith('1')) {
    const n = rest.slice(1);
    return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  }
  if (rest.length === 10 && !rest.startsWith('0')) {
    return `(${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
  }
  return e164;
}
