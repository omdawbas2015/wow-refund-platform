/**
 * Formatting helpers — currency + dates.
 * Currency uses locale + ISO currency code; decimals come from CurrencyRegistry in production,
 * but the Intl API handles most cases automatically.
 */

export function formatMoney(amount: number, currency: string, locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      // KWD/BHD use 3 decimals by default; Intl handles this automatically.
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatDate(d: Date | string | null | undefined, locale = 'en-US'): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export function formatDateTime(d: Date | string | null | undefined, locale = 'en-US'): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function relativeTime(d: Date | string, locale = 'en-US'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const diffMs = date.getTime() - Date.now();
  // Every unit is derived directly from `diffMs`. Chaining rounded
  // intermediates (sec → min → hr → day) causes unit promotion at the
  // boundaries — e.g. 23h 31m would round to -24 hours, fail the
  // `< 24` check, and silently bubble up to "yesterday".
  const absSec = Math.abs(diffMs) / 1000;
  const sign = diffMs < 0 ? -1 : 1;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (absSec < 60) return rtf.format(sign * Math.round(absSec), 'second');
  if (absSec < 3600) return rtf.format(sign * Math.round(absSec / 60), 'minute');
  if (absSec < 86_400) return rtf.format(sign * Math.round(absSec / 3600), 'hour');
  if (absSec < 30 * 86_400) return rtf.format(sign * Math.round(absSec / 86_400), 'day');
  if (absSec < 365 * 86_400) return rtf.format(sign * Math.round(absSec / (30 * 86_400)), 'month');
  return rtf.format(sign * Math.round(absSec / (365 * 86_400)), 'year');
}
