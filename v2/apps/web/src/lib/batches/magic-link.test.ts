import { describe, it, expect } from 'vitest';
import { newMagicLinkToken, approvalMagicLinkUrl } from './magic-link';

describe('lib/batches/magic-link', () => {
  describe('newMagicLinkToken', () => {
    it('returns a base64url-encoded string of ~43 chars', () => {
      const token = newMagicLinkToken();
      // 32 bytes -> 43 chars (no padding) in base64url.
      expect(token).toHaveLength(43);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('returns a different token on each call (entropy check)', () => {
      const a = newMagicLinkToken();
      const b = newMagicLinkToken();
      const c = newMagicLinkToken();
      expect(a).not.toBe(b);
      expect(b).not.toBe(c);
      expect(a).not.toBe(c);
    });
  });

  describe('approvalMagicLinkUrl', () => {
    it('builds the URL with default locale en', () => {
      expect(
        approvalMagicLinkUrl('abc123', 'https://wow.example.com'),
      ).toBe('https://wow.example.com/en/approve/abc123');
    });

    it('uses the given locale (ar)', () => {
      expect(
        approvalMagicLinkUrl('abc123', 'https://wow.example.com', 'ar'),
      ).toBe('https://wow.example.com/ar/approve/abc123');
    });

    it('strips a trailing slash from the base URL (no double slash)', () => {
      expect(
        approvalMagicLinkUrl('xyz', 'https://wow.example.com/', 'en'),
      ).toBe('https://wow.example.com/en/approve/xyz');
    });

    it('preserves a path segment in the base URL', () => {
      expect(
        approvalMagicLinkUrl('xyz', 'https://wow.example.com/app', 'en'),
      ).toBe('https://wow.example.com/app/en/approve/xyz');
    });
  });
});
