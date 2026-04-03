'use client';

import { useCallback, useId } from 'react';
import {
  formatPhoneFieldDisplay,
  isCompleteNanpDigits,
  PHONE_INPUT_MAX_DIGITS,
  stripPhoneDigits,
} from '../lib/phone-format';

export interface PhoneInputProps {
  id?: string;
  label?: string;
  digits: string;
  onDigitsChange: (digits: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  autoComplete?: string;
}

export function PhoneInput({
  id: idProp,
  label = 'Phone',
  digits,
  onDigitsChange,
  disabled,
  required,
  className = '',
  inputClassName = '',
  autoComplete = 'tel-national',
}: PhoneInputProps) {
  const genId = useId();
  const id = idProp ?? `phone-${genId}`;
  const display = formatPhoneFieldDisplay(digits);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    const allowedNav = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowedNav.includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length === 1 && !/\d/.test(e.key)) {
      e.preventDefault();
    }
  }, [disabled]);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = stripPhoneDigits(e.target.value).slice(0, PHONE_INPUT_MAX_DIGITS);
      onDigitsChange(next);
    },
    [onDigitsChange]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text') || '';
      const next = stripPhoneDigits(text).slice(0, PHONE_INPUT_MAX_DIGITS);
      onDigitsChange(next);
    },
    [onDigitsChange]
  );

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required ? ' *' : ''}
        </label>
      ) : null}
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        value={display}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        disabled={disabled}
        required={required}
        placeholder="(555) 123-4567"
        aria-invalid={digits.length > 0 && !isCompleteNanpDigits(digits)}
        className={
          inputClassName ||
          'w-full px-3 py-2 border border-gray-400 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-600'
        }
      />
    </div>
  );
}
