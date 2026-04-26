import { randomBytes } from 'node:crypto';

/**
 * Generate a URL-safe token for magic-link approval pages.
 * 32 random bytes encoded as base64url ≈ 43 chars, ample entropy.
 */
export function newMagicLinkToken(): string {
  return randomBytes(32).toString('base64url');
}

export function approvalMagicLinkUrl(
  token: string,
  baseUrl: string,
  locale: 'en' | 'ar' = 'en',
): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  return `${trimmed}/${locale}/approve/${token}`;
}
