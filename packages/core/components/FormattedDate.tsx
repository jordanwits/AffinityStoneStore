'use client';

import React, { useEffect, useState } from 'react';

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
 *
 * A server-rendered page formats in the server's timezone (UTC on Vercel), and with
 * suppressHydrationWarning React kept that text rather than patching it, so a full page
 * load showed UTC (an 8pm order read as the next day) and only client-side navigation
 * showed local time. Now the first render, on the server and while hydrating alike, uses
 * UTC so the two agree, and once mounted it re-renders in the viewer's timezone.
 *
 * A plain calendar date ("2026-10-23", from a date filter) is a day, not an instant, so it
 * is always shown as written rather than shifted into the day before west of UTC.
 */
export function FormattedDate({ date, format = 'datetimeShort', className = '' }: FormattedDateProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isCalendarDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
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

  const formatted = d.toLocaleDateString(
    'en-US',
    mounted && !isCalendarDate ? options : { ...options, timeZone: 'UTC' }
  );

  return (
    <time dateTime={d.toISOString()} className={className}>
      {formatted}
    </time>
  );
}
