import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  encrypt,
  decrypt,
  encryptIfPresent,
  decryptIfPresent,
  isEnabled,
} from './pii';

const VALID_KEY = randomBytes(32).toString('hex');

describe('lib/crypto/pii', () => {
  const originalEnv = process.env.PII_ENCRYPTION_KEY;

  beforeEach(() => {
    delete process.env.PII_ENCRYPTION_KEY;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.PII_ENCRYPTION_KEY;
    else process.env.PII_ENCRYPTION_KEY = originalEnv;
  });

  describe('without PII_ENCRYPTION_KEY', () => {
    it('isEnabled returns false', () => {
      expect(isEnabled()).toBe(false);
    });

    it('encrypt is pass-through for plaintext', () => {
      expect(encrypt('user@example.com')).toBe('user@example.com');
    });

    it('decrypt is pass-through for plaintext', () => {
      expect(decrypt('user@example.com')).toBe('user@example.com');
    });

    it('returns null when given null', () => {
      expect(encrypt(null)).toBeNull();
      expect(decrypt(null)).toBeNull();
      expect(encryptIfPresent(null)).toBeNull();
      expect(decryptIfPresent(undefined)).toBeNull();
    });
  });

  describe('with PII_ENCRYPTION_KEY', () => {
    beforeEach(() => {
      process.env.PII_ENCRYPTION_KEY = VALID_KEY;
    });

    it('isEnabled returns true', () => {
      expect(isEnabled()).toBe(true);
    });

    it('encrypt then decrypt round-trips', () => {
      const plaintext = 'sensitive-customer-email@wow.local';
      const ciphertext = encrypt(plaintext);
      expect(ciphertext).not.toBe(plaintext);
      expect(ciphertext).toMatch(/^v1:[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it('produces different ciphertext for the same plaintext (random IV)', () => {
      const a = encrypt('hello');
      const b = encrypt('hello');
      expect(a).not.toBe(b);
      expect(decrypt(a)).toBe('hello');
      expect(decrypt(b)).toBe('hello');
    });

    it('decrypt returns legacy plaintext rows unchanged', () => {
      // Rows from before encryption rollout don't have the v1: prefix.
      expect(decrypt('legacy-plaintext')).toBe('legacy-plaintext');
    });

    it('encryptIfPresent / decryptIfPresent honor null', () => {
      expect(encryptIfPresent(null)).toBeNull();
      const ct = encryptIfPresent('keep-me-safe');
      expect(ct).not.toBe('keep-me-safe');
      expect(decryptIfPresent(ct)).toBe('keep-me-safe');
    });

    it('decrypt returns raw ciphertext when key is wrong (no throw)', () => {
      const goodCt = encrypt('payload');
      // Switch to a different key; old ciphertext should fail to decrypt
      // and fall back to returning the raw value rather than throwing.
      process.env.PII_ENCRYPTION_KEY = randomBytes(32).toString('hex');
      expect(() => decrypt(goodCt)).not.toThrow();
      expect(decrypt(goodCt)).toBe(goodCt);
    });

    it('throws if key length is wrong', () => {
      process.env.PII_ENCRYPTION_KEY = '00'.repeat(16); // 16 bytes, not 32
      expect(() => encrypt('x')).toThrow(/32 bytes/);
    });
  });
});
