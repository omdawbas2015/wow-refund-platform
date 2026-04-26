'use server';

import { prisma } from '@wow/db';
import {
  createPromoConfigSchema,
  togglePromoConfigSchema,
  uploadPromoCodesSchema,
  allocatePromoSchema,
  markPromoUsedSchema,
  type CreatePromoConfigInput,
  type TogglePromoConfigInput,
  type UploadPromoCodesInput,
  type AllocatePromoInput,
  type MarkPromoUsedInput,
} from '@wow/validators';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { dispatchEmail } from '@/lib/email/dispatcher';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireAuthed() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session.user;
}

function ensureAdminOrOps(role: string | null | undefined) {
  if (role !== 'ADMIN' && role !== 'OPS_LEAD') {
    throw new Error('FORBIDDEN');
  }
}

async function audit(args: {
  actorId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: args.actorId,
      actorEmail: args.actorEmail,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      ...(args.before !== undefined ? { beforeData: JSON.stringify(args.before) } : {}),
      ...(args.after !== undefined ? { afterData: JSON.stringify(args.after) } : {}),
      ...(args.metadata !== undefined ? { metadata: JSON.stringify(args.metadata) } : {}),
    },
  });
}

// ── Promo configs ─────────────────────────────────────────────────────────

export async function createPromoConfigAction(
  input: CreatePromoConfigInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireAuthed();
    ensureAdminOrOps(me.role);
    const parsed = createPromoConfigSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const { brandId, countryId, type, value, currency, label } = parsed.data;

    const dup = await prisma.promoConfig.findUnique({
      where: {
        brandId_countryId_type_value: { brandId, countryId, type, value },
      },
    });
    if (dup) return { ok: false, error: 'A promo config with these parameters already exists' };

    const created = await prisma.promoConfig.create({
      data: {
        brandId,
        countryId,
        type,
        value,
        currency,
        label: label || null,
      },
    });

    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'promo.config.created',
      entityType: 'PROMO_CONFIG',
      entityId: created.id,
      after: created,
    });

    revalidatePath('/promo');
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function togglePromoConfigAction(
  input: TogglePromoConfigInput,
): Promise<ActionResult> {
  try {
    const me = await requireAuthed();
    ensureAdminOrOps(me.role);
    const parsed = togglePromoConfigSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

    const { configId, isActive } = parsed.data;
    const before = await prisma.promoConfig.findUnique({ where: { id: configId } });
    if (!before) return { ok: false, error: 'Config not found' };

    const updated = await prisma.promoConfig.update({
      where: { id: configId },
      data: { isActive },
    });

    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'promo.config.toggled',
      entityType: 'PROMO_CONFIG',
      entityId: configId,
      before,
      after: updated,
    });

    revalidatePath('/promo');
    revalidatePath(`/promo/configs/${configId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Promo codes ───────────────────────────────────────────────────────────

/**
 * Parse a free-text upload (one code per line; comma- or whitespace-separated)
 * into a deduplicated, trimmed array of codes.
 */
function parseCodesText(raw: string): string[] {
  const tokens = raw.split(/[\s,;]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    const code = t.trim();
    if (!code) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export async function uploadPromoCodesAction(
  input: UploadPromoCodesInput,
): Promise<ActionResult<{ created: number; skipped: number }>> {
  try {
    const me = await requireAuthed();
    ensureAdminOrOps(me.role);
    const parsed = uploadPromoCodesSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const { configId, codesRaw, expiresAt } = parsed.data;

    const config = await prisma.promoConfig.findUnique({ where: { id: configId } });
    if (!config) return { ok: false, error: 'Config not found' };

    const codes = parseCodesText(codesRaw);
    if (codes.length === 0) return { ok: false, error: 'No codes parsed from input' };

    // PromoCode.code is @unique — Prisma's SQLite createMany does not support
    // skipDuplicates in our installed Prisma version. To keep the upload
    // idempotent we pre-filter existing codes (cheap thanks to the unique
    // index), then createMany the survivors in chunks. BOTH the findMany IN
    // clause and the createMany payload must be chunked to stay within
    // SQLite's SQLITE_MAX_VARIABLE_NUMBER (default 999 on older builds).
    const CHUNK = 500;
    const existingSet = new Set<string>();
    for (let i = 0; i < codes.length; i += CHUNK) {
      const slice = codes.slice(i, i + CHUNK);
      const rows = await prisma.promoCode.findMany({
        where: { code: { in: slice } },
        select: { code: true },
      });
      for (const r of rows) existingSet.add(r.code);
    }
    const fresh = codes.filter((c) => !existingSet.has(c));

    let created = 0;
    for (let i = 0; i < fresh.length; i += CHUNK) {
      const slice = fresh.slice(i, i + CHUNK);
      const result = await prisma.promoCode.createMany({
        data: slice.map((code) => ({
          configId,
          code,
          uploadedById: me.id,
          ...(expiresAt ? { expiresAt } : {}),
        })),
      });
      created += result.count;
    }
    const skipped = codes.length - created;

    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'promo.codes.uploaded',
      entityType: 'PROMO_CONFIG',
      entityId: configId,
      metadata: { attempted: codes.length, created, skipped },
    });

    revalidatePath('/promo');
    revalidatePath(`/promo/configs/${configId}`);
    return { ok: true, data: { created, skipped } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Allocations ───────────────────────────────────────────────────────────

export async function allocatePromoAction(
  input: AllocatePromoInput,
): Promise<ActionResult<{ allocationId: string; code: string }>> {
  try {
    const me = await requireAuthed();
    ensureAdminOrOps(me.role);
    const parsed = allocatePromoSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const { configId, customerEmail, customerName, caseId, reason } = parsed.data;

    const config = await prisma.promoConfig.findUnique({
      where: { id: configId },
      include: { brand: { select: { name: true } } },
    });
    if (!config) return { ok: false, error: 'Config not found' };
    if (!config.isActive) return { ok: false, error: 'Config is inactive' };

    if (caseId) {
      const c = await prisma.refundCase.findUnique({ where: { id: caseId } });
      if (!c) return { ok: false, error: 'Case not found' };
    }

    // Pick the first AVAILABLE code; flip it to ALLOCATED and create the
    // allocation in a single transaction so we never double-allocate.
    const result = await prisma.$transaction(async (tx) => {
      const code = await tx.promoCode.findFirst({
        where: { configId, status: 'AVAILABLE' },
        orderBy: { uploadedAt: 'asc' },
      });
      if (!code) return null;

      const updated = await tx.promoCode.updateMany({
        where: { id: code.id, status: 'AVAILABLE' },
        data: { status: 'ALLOCATED' },
      });
      if (updated.count !== 1) return null;

      const allocation = await tx.promoAllocation.create({
        data: {
          codeId: code.id,
          ...(caseId ? { caseId } : {}),
          customerEmail,
          customerName: customerName || null,
          requestedById: me.id,
          reason: reason || null,
        },
      });
      return { code: code.code, allocationId: allocation.id };
    });

    if (!result) return { ok: false, error: 'No available codes in this config' };

    if (config.type === 'CUSTOMER_COMPENSATION') {
      try {
        await dispatchEmail({
          templateKey: 'CUSTOMER_PROMO_COMPENSATION',
          locale: 'en',
          to: customerEmail,
          variables: {
            customerName: customerName || customerEmail,
            brandName: config.brand.name,
            promoCode: result.code,
            value: String(config.value),
            currency: config.currency,
            expiresAt: '',
          },
          context: { type: 'PROMO', id: result.allocationId },
        });
        await prisma.promoAllocation.update({
          where: { id: result.allocationId },
          data: { emailedAt: new Date() },
        });
      } catch (emailErr) {
        // Email failure is non-fatal — the allocation stands; ops can resend.
        console.error('[promo] email dispatch failed', emailErr);
      }
    }

    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'promo.allocated',
      entityType: 'PROMO_ALLOCATION',
      entityId: result.allocationId,
      metadata: { configId, code: result.code, customerEmail, caseId },
    });

    revalidatePath('/promo');
    revalidatePath(`/promo/configs/${configId}`);
    if (caseId) revalidatePath(`/cases/${caseId}`);
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function markPromoUsedAction(
  input: MarkPromoUsedInput,
): Promise<ActionResult> {
  try {
    const me = await requireAuthed();
    ensureAdminOrOps(me.role);
    const parsed = markPromoUsedSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const { allocationId } = parsed.data;

    const allocation = await prisma.promoAllocation.findUnique({
      where: { id: allocationId },
      include: { code: true },
    });
    if (!allocation) return { ok: false, error: 'Allocation not found' };
    // ALLOCATED → USED is the only valid state transition here; reject all
    // others (USED already, EXPIRED, DISABLED, AVAILABLE — which would mean
    // the code was never allocated in the first place).
    if (allocation.code.status !== 'ALLOCATED') {
      return {
        ok: false,
        error: `Code is ${allocation.code.status}, expected ALLOCATED`,
      };
    }

    // Compare-and-set: only flip to USED if status is still ALLOCATED, so a
    // concurrent EXPIRED/DISABLED change cannot be silently overwritten.
    const flipped = await prisma.promoCode.updateMany({
      where: { id: allocation.codeId, status: 'ALLOCATED' },
      data: { status: 'USED' },
    });
    if (flipped.count !== 1) {
      return { ok: false, error: 'Code state changed concurrently; refusing to overwrite' };
    }

    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'promo.marked_used',
      entityType: 'PROMO_ALLOCATION',
      entityId: allocationId,
    });

    revalidatePath('/promo');
    revalidatePath(`/promo/configs/${allocation.code.configId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
