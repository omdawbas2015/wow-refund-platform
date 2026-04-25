import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  amount: number,
  currency: string,
  locale: string = 'en-US',
  decimals?: number,
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `${amount.toFixed(decimals ?? 2)} ${currency}`;
  }
}

export function formatDate(date: Date | string, locale: string = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(date: Date | string, locale: string = 'en-US'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = Math.min(2, local.length);
  return `${local.slice(0, visible)}${'*'.repeat(Math.max(0, local.length - visible))}@${domain}`;
}

export function generateCaseNumber(countryCode: string, year: number, sequence: number): string {
  return `REF-${countryCode}-${year}-${String(sequence).padStart(6, '0')}`;
}
