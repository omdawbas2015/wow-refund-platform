'use server';

import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

const LOCALES = new Set(['en', 'ar']);
const THEMES = new Set(['light', 'dark', 'system']);

interface UpdateProfileInput {
  name: string;
  nameAr?: string;
  phone?: string;
  preferredLocale: string;
  preferredCurrency?: string;
  preferredTheme: string;
}

function normalize(input: Record<string, FormDataEntryValue>): UpdateProfileInput | null {
  const name = String(input['name'] ?? '').trim();
  if (!name || name.length > 120) return null;
  const nameAr = String(input['nameAr'] ?? '').trim();
  const phone = String(input['phone'] ?? '').trim();
  const preferredLocale = String(input['preferredLocale'] ?? '').trim();
  if (!LOCALES.has(preferredLocale)) return null;
  const preferredCurrency = String(input['preferredCurrency'] ?? '').trim().toUpperCase();
  // Currency is optional; when provided we only allow up to 6 ASCII letters
  // (covers ISO 4217 + a small safety margin) to avoid junk input.
  if (preferredCurrency && !/^[A-Z]{1,6}$/.test(preferredCurrency)) return null;
  const preferredTheme = String(input['preferredTheme'] ?? '').trim();
  if (!THEMES.has(preferredTheme)) return null;

  return {
    name,
    nameAr: nameAr || undefined,
    phone: phone || undefined,
    preferredLocale,
    preferredCurrency: preferredCurrency || undefined,
    preferredTheme,
  };
}

/**
 * Self-service profile update. The signed-in user can modify their own
 * `name`, `nameAr`, `phone`, and display preferences (locale, currency,
 * theme). Email, role, country assignments, and deputy relationships are
 * intentionally NOT settable here — those go through admin tools so the
 * audit trail stays clean.
 *
 * Logs the diff to AuditLog under entity type `USER`, action
 * `user.profile.updated`. The `before` blob is whatever changed; if
 * nothing changed we still return `{ ok: true }` and skip the audit row
 * to avoid noise.
 */
export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: 'UNAUTHENTICATED' };
    const meId = session.user.id;

    const data = normalize(Object.fromEntries(formData.entries()));
    if (!data) return { ok: false, error: 'Invalid input' };

    const current = await prisma.user.findUnique({
      where: { id: meId },
      select: {
        name: true,
        nameAr: true,
        phone: true,
        preferredLocale: true,
        preferredCurrency: true,
        preferredTheme: true,
      },
    });
    if (!current) return { ok: false, error: 'User not found' };

    const next = {
      name: data.name,
      nameAr: data.nameAr ?? null,
      phone: data.phone ?? null,
      preferredLocale: data.preferredLocale,
      preferredCurrency: data.preferredCurrency ?? null,
      preferredTheme: data.preferredTheme,
    };

    // Build a changed-fields diff for the audit log. We only persist + audit
    // if at least one tracked field actually changed; this keeps the audit
    // log signal-rich and avoids spamming when a user opens the form and
    // saves it unchanged.
    const changed: Record<string, { from: unknown; to: unknown }> = {};
    (Object.keys(next) as (keyof typeof next)[]).forEach((k) => {
      const before = current[k] ?? null;
      const after = next[k] ?? null;
      if (before !== after) changed[k] = { from: before, to: after };
    });
    if (Object.keys(changed).length === 0) return { ok: true };

    await prisma.$transaction([
      prisma.user.update({ where: { id: meId }, data: next }),
      prisma.auditLog.create({
        data: {
          actorId: meId,
          actorEmail: session.user.email,
          action: 'user.profile.updated',
          entityType: 'USER',
          entityId: meId,
          afterData: JSON.stringify(changed),
        },
      }),
    ]);

    // Locale-prefixed paths revalidate from the layout — re-rendering the
    // profile page is enough to show the saved values, and the topbar /
    // dashboard pull session info on next navigation.
    revalidatePath('/profile');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
