import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateOtpCode,
  generateRandomToken,
} from './password';

describe('lib/password', () => {
  describe('hashPassword + verifyPassword', () => {
    it('roundtrips a correct password', async () => {
      const hash = await hashPassword('correct horse battery staple');
      expect(hash).not.toBe('correct horse battery staple');
      expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
      expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    });

    it('rejects a wrong password', async () => {
      const hash = await hashPassword('hunter2');
      expect(await verifyPassword('hunter3', hash)).toBe(false);
    });

    it('returns false when the stored hash is empty', async () => {
      // Defensive branch — never falsely authenticate a user with no hash.
      expect(await verifyPassword('anything', '')).toBe(false);
    });

    it('produces a different hash on each call (salted)', async () => {
      const a = await hashPassword('same-input');
      const b = await hashPassword('same-input');
      expect(a).not.toBe(b);
      // Both still verify.
      expect(await verifyPassword('same-input', a)).toBe(true);
      expect(await verifyPassword('same-input', b)).toBe(true);
    });
  });

  describe('generateOtpCode', () => {
    it('defaults to a 6-digit numeric string', () => {
      const code = generateOtpCode();
      expect(code).toHaveLength(6);
      expect(/^[0-9]{6}$/.test(code)).toBe(true);
    });

    it('respects a custom length', () => {
      const code = generateOtpCode(8);
      expect(code).toHaveLength(8);
      expect(/^[0-9]{8}$/.test(code)).toBe(true);
    });

    it('zero-pads small numeric values to the requested width', () => {
      // Sanity-check the padStart contract by sampling many codes — at least
      // some will fall under the 100k boundary and require padding.
      const codes = Array.from({ length: 200 }, () => generateOtpCode(6));
      for (const c of codes) {
        expect(c).toHaveLength(6);
        expect(/^[0-9]{6}$/.test(c)).toBe(true);
      }
    });
  });

  describe('generateRandomToken', () => {
    it('defaults to 32 bytes encoded as 64 lowercase hex chars', () => {
      const token = generateRandomToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it('respects a custom byte length', () => {
      const token = generateRandomToken(16);
      expect(token).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/.test(token)).toBe(true);
    });

    it('produces a different value on each call', () => {
      const a = generateRandomToken();
      const b = generateRandomToken();
      expect(a).not.toBe(b);
    });
  });
});
