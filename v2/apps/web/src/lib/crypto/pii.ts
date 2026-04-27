/**
 * AES-256-GCM helpers for PII at rest.
 *
 * Reads a 32-byte key from PII_ENCRYPTION_KEY (hex-encoded, 64 chars).
 * If the key is missing the helpers are pass-through: encrypt() returns
 * the plaintext unchanged and decrypt() returns whatever was passed.
 * This lets the codebase opt into encryption per-field without breaking
 * dev / preview where the key isn't provisioned.
 *
 * Storage format: `v1:<iv-hex>:<ciphertext-hex>:<authTag-hex>`. The `v1:`
 * prefix lets us rotate algorithms later without reading every column.
 *
 * Sprint F #20. Wire into Prisma via $extends (or middleware in
 * Prisma 6's classic API) once the DSN-gated rollout plan is approved.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = 'v1:';

function getKey(): Buffer | null {
  const raw = process.env.PII_ENCRYPTION_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, 'hex');
  if (buf.length !== KEY_LEN) {
    throw new Error(
      `PII_ENCRYPTION_KEY must be 32 bytes (64 hex chars). Got ${buf.length}.`,
    );
  }
  return buf;
}

export function isEnabled(): boolean {
  return !!process.env.PII_ENCRYPTION_KEY;
}

export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return plaintext ?? null;
  const key = getKey();
  if (!key) return plaintext;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`;
}

export function decrypt(value: string | null | undefined): string | null {
  if (value == null) return value ?? null;
  const key = getKey();
  if (!key) return value;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext row
  const [, ivHex, encHex, tagHex] = value.split(':');
  if (!ivHex || !encHex || !tagHex) return value;
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    if (tag.length !== TAG_LEN) return value;
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    // Bad ciphertext or wrong key — return raw so callers can surface
    // a "decryption failed" error in their own context.
    return value;
  }
}

/**
 * Convenience for fields that are sometimes null. Mirrors the shape of
 * Prisma scalars so callers can `field: encryptIfPresent(input.field)`
 * without a ternary.
 */
export function encryptIfPresent(v: string | null | undefined): string | null {
  return v == null ? null : encrypt(v);
}

export function decryptIfPresent(v: string | null | undefined): string | null {
  return v == null ? null : decrypt(v);
}
