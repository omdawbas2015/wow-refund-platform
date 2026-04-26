'use server';

import { prisma } from '@wow/db';
import { allocatePromoSchema, uploadPromoCodesSchema } from '@wow/validators';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session.user;
}

const ALLOCATE_COMP_ROLES = new Set(['ADMIN', 'MANAGER', 'AGENT', 'TEAM_LEAD']);
const ALLOCATE_RECOVERY_ROLES = new Set(['ADMIN', 'MANAGER', 'AGENT', 'TEAM_LEAD']);
const UPLOAD_ROLES = new Set(['ADMIN', 'MANAGER', 'OPERATIONS']);

/**
 * Window (days) used to detect repeat-customer fraud signals.
 * Not exported from this 'use server' module (Next.js requires all exports
 * to be async functions); re-exported via `@/lib/promo/constants`.
 */
const FRAUD_HISTORY_WINDOW_DAYS = 90;

/**
 * Atomically pull one AVAILABLE code from the pool, mark it ALLOCATED, and
 * create a PromoAllocation row. Uses `updateMany` guards so two concurrent
 * allocations never hand the same code to two customers.
 */
export async function allocatePromoAction(input: unknown): Promise<
  ActionResult<{ code: string; allocationId: string }>
> {
  try {
    const user = await requireSession();
    const parsed = allocatePromoSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: 'Please review the form.',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const data = parsed.data;

    const pool = await prisma.promoConfig.findUnique({
      where: { id: data.poolId },
      include: { brand: true, country: { include: { registry: true } } },
    });
    if (!pool || !pool.isActive) {
      return { ok: false, error: 'Promo pool is inactive or missing.' };
    }

    const roleKey = user.role ?? '';
    if (pool.type === 'CUSTOMER_COMPENSATION' && !ALLOCATE_COMP_ROLES.has(roleKey)) {
      return { ok: false, error: 'You do not have permission to allocate customer compensation promos.' };
    }
    if (pool.type === 'SERVICE_RECOVERY' && !ALLOCATE_RECOVERY_ROLES.has(roleKey)) {
      return { ok: false, error: 'You do not have permission to allocate service recovery promos.' };
    }

    // Fraud signal check — if the caller didn't acknowledge but there IS
    // recent history, reject so the UI can re-render the confirmation state.
    const recent = await getCustomerPromoHistoryRaw(data.customerEmail);
    if (recent.recentCount > 0 && !data.fraudSignalAcknowledged) {
      return {
        ok: false,
        error: `This customer received ${recent.recentCount} promo(s) in the last ${FRAUD_HISTORY_WINDOW_DAYS} days. Please review and acknowledge before proceeding.`,
      };
    }

    // Pick an AVAILABLE code (ordered by oldest first so we burn inventory FIFO)
    const candidate = await prisma.promoCode.findFirst({
      where: {
        configId: pool.id,
        status: 'AVAILABLE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { uploadedAt: 'asc' },
      select: { id: true, code: true },
    });
    if (!candidate) {
      return { ok: false, error: 'This pool is out of stock. Upload more codes before allocating.' };
    }

    // TOCTOU guard: only claim the code if it's still AVAILABLE.
    const claim = await prisma.promoCode.updateMany({
      where: { id: candidate.id, status: 'AVAILABLE' },
      data: { status: 'ALLOCATED' },
    });
    if (claim.count === 0) {
      return {
        ok: false,
        error: 'Another allocation just claimed that code. Please retry.',
      };
    }

    const allocation = await prisma.promoAllocation.create({
      data: {
        codeId: candidate.id,
        caseId: data.caseId ?? null,
        customerEmail: data.customerEmail,
        customerName: data.customerName ?? null,
        requestedById: user.id,
        reason: data.reason ?? null,
        emailedAt: pool.type === 'CUSTOMER_COMPENSATION' ? new Date() : null,
      },
    });

    // TODO(phase-4.2): dispatch real email via Power Automate for
    // CUSTOMER_COMPENSATION pools. For now the `emailedAt` timestamp doubles
    // as a demo marker so the UI can surface "emailed" state.

    revalidatePath('/promo');
    revalidatePath('/promo/allocate');
    return { ok: true, data: { code: candidate.code, allocationId: allocation.id } };
  } catch (e) {
    console.error('[allocatePromoAction]', e);
    return { ok: false, error: 'Failed to allocate promo.' };
  }
}

/**
 * Upload new codes to a pool. De-duplicates against existing codes globally
 * (PromoCode.code is unique) and returns inserted / skipped counts.
 */
export async function uploadPromoCodesAction(input: unknown): Promise<
  ActionResult<{ inserted: number; skipped: number }>
> {
  try {
    const user = await requireSession();
    const parsed = uploadPromoCodesSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: 'Please review the form.' };
    }
    if (!UPLOAD_ROLES.has(user.role ?? '')) {
      return { ok: false, error: 'You do not have permission to upload codes.' };
    }
    const { poolId, codes, expiresAt } = parsed.data;

    const pool = await prisma.promoConfig.findUnique({ where: { id: poolId } });
    if (!pool) return { ok: false, error: 'Promo pool not found.' };

    const existing = await prisma.promoCode.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });
    const existingSet = new Set(existing.map((e) => e.code));
    const toInsert = codes.filter((c) => !existingSet.has(c));

    if (toInsert.length > 0) {
      await prisma.promoCode.createMany({
        data: toInsert.map((code) => ({
          configId: poolId,
          code,
          status: 'AVAILABLE' as const,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          uploadedById: user.id,
        })),
      });
    }

    revalidatePath('/promo');
    revalidatePath(`/promo/pools/${poolId}`);
    return { ok: true, data: { inserted: toInsert.length, skipped: codes.length - toInsert.length } };
  } catch (e) {
    console.error('[uploadPromoCodesAction]', e);
    return { ok: false, error: 'Failed to upload codes.' };
  }
}

/**
 * Internal helper (no "use server" — just called from the action).
 * Returns counts of prior allocations for a customer, used as a fraud signal.
 */
async function getCustomerPromoHistoryRaw(email: string) {
  const normalized = email.trim().toLowerCase();
  const since = new Date();
  since.setDate(since.getDate() - FRAUD_HISTORY_WINDOW_DAYS);

  const [recentCount, totalCount, recentAllocations] = await Promise.all([
    prisma.promoAllocation.count({
      where: { customerEmail: normalized, createdAt: { gte: since } },
    }),
    prisma.promoAllocation.count({
      where: { customerEmail: normalized },
    }),
    prisma.promoAllocation.findMany({
      where: { customerEmail: normalized },
      include: {
        code: {
          include: {
            config: { include: { brand: true, country: { include: { registry: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return { recentCount, totalCount, recentAllocations };
}

/** Public server action wrapper — form uses this via fetch(searchParam pattern). */
export async function loadCustomerPromoHistoryAction(
  email: string,
): Promise<{
  recentCount: number;
  totalCount: number;
  history: Array<{
    id: string;
    code: string;
    brand: string;
    country: string;
    type: string;
    value: number;
    currency: string;
    emailedAt: Date | null;
    createdAt: Date;
  }>;
}> {
  await requireSession();
  if (!email) return { recentCount: 0, totalCount: 0, history: [] };
  const raw = await getCustomerPromoHistoryRaw(email);
  return {
    recentCount: raw.recentCount,
    totalCount: raw.totalCount,
    history: raw.recentAllocations.map((a) => ({
      id: a.id,
      code: a.code.code,
      brand: a.code.config.brand.name,
      country: a.code.config.country.registry?.nameEn ?? a.code.config.country.registryCode,
      type: a.code.config.type,
      value: a.code.config.value,
      currency: a.code.config.currency,
      emailedAt: a.emailedAt,
      createdAt: a.createdAt,
    })),
  };
}
