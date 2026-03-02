'use client';

import React from 'react';

export type FormattedDateFormat =
  | 'date'       // Jan 15, 2025
  | 'dateLong'   // January 15, 2025 (date only, no time)
  | 'datetime'   // Jan 15, 2025, 10:30 AM
  | 'datetimeShort' // Jan 15, 2025, 10:30 AM
  | 'long';     // January 15, 2025, 10:30 AM

export interface FormattedDateProps {
  /** ISO date string or Date object */
  date: string | Date;
  /** Display format - uses user's local timezone */
  format?: FormattedDateFormat;
  className?: string;
}

/**
 * Renders a date in the user's local timezone.
 * Client component - server would use server timezone, so we use suppressHydrationWarning
 * to avoid mismatch when client hydrates with user's actual timezone.
 */
export function FormattedDate({ date, format = 'datetimeShort', className = '' }: FormattedDateProps) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const isValid = !isNaN(d.getTime());

  if (!isValid) {
    return <span className={className}>—</span>;
  }

  const options: Intl.DateTimeFormatOptions =
    format === 'date'
      ? { month: 'short', day: 'numeric', year: 'numeric' }
      : format === 'dateLong'
        ? { month: 'long', day: 'numeric', year: 'numeric' }
        : format === 'long'
          ? { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
          : format === 'datetime' || format === 'datetimeShort'
            ? {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }
            : {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              };

  const formatted = d.toLocaleDateString('en-US', options);

  return (
    <time dateTime={d.toISOString()} suppressHydrationWarning className={className}>
      {formatted}
    </time>
  );
}
