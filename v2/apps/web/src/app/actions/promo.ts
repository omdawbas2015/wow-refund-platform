'use server';

import { Prisma, prisma } from '@wow/db';
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
/** Who may read customers' prior promo history (fraud signal preview). */
const HISTORY_ROLES = new Set(['ADMIN', 'MANAGER', 'AGENT', 'TEAM_LEAD']);
/** Who may delete AVAILABLE codes, restore allocated codes, and export CSV. */
const POOL_ADMIN_ROLES = new Set(['ADMIN', 'MANAGER', 'OPERATIONS']);

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

    // Claim-and-allocate in a single transaction so we never leave a code
    // stuck as ALLOCATED without a matching allocation row. Matches the
    // pattern used by cases.ts / batches.ts for multi-step mutations.
    type TxResult =
      | { kind: 'ok'; code: string; allocationId: string }
      | { kind: 'out_of_stock' }
      | { kind: 'race' };
    const outcome = await prisma.$transaction(async (tx): Promise<TxResult> => {
      // Pick an AVAILABLE code (oldest first = FIFO burn of inventory).
      const candidate = await tx.promoCode.findFirst({
        where: {
          configId: pool.id,
          status: 'AVAILABLE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { uploadedAt: 'asc' },
        select: { id: true, code: true },
      });
      if (!candidate) return { kind: 'out_of_stock' };

      // TOCTOU guard: only claim if still AVAILABLE.
      const claim = await tx.promoCode.updateMany({
        where: { id: candidate.id, status: 'AVAILABLE' },
        data: { status: 'ALLOCATED' },
      });
      if (claim.count === 0) return { kind: 'race' };

      const allocation = await tx.promoAllocation.create({
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

      return { kind: 'ok', code: candidate.code, allocationId: allocation.id };
    });

    if (outcome.kind === 'out_of_stock') {
      return { ok: false, error: 'This pool is out of stock. Upload more codes before allocating.' };
    }
    if (outcome.kind === 'race') {
      return { ok: false, error: 'Another allocation just claimed that code. Please retry.' };
    }

    // TODO(phase-4.2): dispatch real email via Power Automate for
    // CUSTOMER_COMPENSATION pools. For now the `emailedAt` timestamp doubles
    // as a demo marker so the UI can surface "emailed" state.

    revalidatePath('/promo');
    revalidatePath('/promo/allocate');
    revalidatePath(`/promo/pools/${pool.id}`);
    return { ok: true, data: { code: outcome.code, allocationId: outcome.allocationId } };
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

    // Do the dedupe check + inserts inside a transaction so a concurrent
    // upload can't race us between findMany and createMany. We insert
    // row-by-row (SQLite doesn't support Prisma's `skipDuplicates`), but
    // swallow individual P2002 unique-constraint violations so one racing
    // duplicate never tanks the whole batch — it just gets counted as
    // skipped.
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.promoCode.findMany({
        where: { code: { in: codes } },
        select: { code: true },
      });
      const existingSet = new Set(existing.map((e) => e.code));
      let inserted = 0;
      let skipped = 0;
      for (const code of codes) {
        if (existingSet.has(code)) {
          skipped += 1;
          continue;
        }
        try {
          await tx.promoCode.create({
            data: {
              configId: poolId,
              code,
              status: 'AVAILABLE' as const,
              expiresAt: expiresAt ? new Date(expiresAt) : null,
              uploadedById: user.id,
            },
          });
          inserted += 1;
        } catch (err: unknown) {
          // P2002 = unique constraint violation (concurrent insert of same code)
          if (
            err &&
            typeof err === 'object' &&
            'code' in err &&
            (err as { code?: string }).code === 'P2002'
          ) {
            skipped += 1;
            continue;
          }
          throw err;
        }
      }
      return { inserted, skipped };
    });

    revalidatePath('/promo');
    revalidatePath(`/promo/pools/${poolId}`);
    return { ok: true, data: result };
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

/**
 * Search + list historical promo allocations with role-based scoping.
 *
 * RBAC rules (mirrors user expectation):
 * - ADMIN / MANAGER / OPERATIONS: see every allocation, every type.
 * - AGENT / TEAM_LEAD: see every CUSTOMER_COMPENSATION allocation but only
 *   their own SERVICE_RECOVERY allocations (the 100% codes must not leak
 *   across agents — avoids fraud + misattribution).
 * - anyone else: empty list.
 *
 * Supports free-text search (email / customer name / case reference / code)
 * and an optional date range on `createdAt`.
 */
export async function listPromoAllocationsAction(input: {
  q?: string;
  type?: 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY' | 'ALL';
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<{
  items: Array<{
    id: string;
    code: string;
    type: 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY';
    brand: string;
    country: string;
    value: number;
    currency: string;
    customerEmail: string;
    customerName: string | null;
    caseId: string | null;
    reason: string | null;
    requestedBy: { id: string; name: string | null };
    emailedAt: Date | null;
    createdAt: Date;
  }>;
  total: number;
  scope: 'ALL' | 'COMPENSATION_PLUS_OWN_RECOVERY' | 'EMPTY';
}> {
  const user = await requireSession();
  const roleKey = user.role ?? '';
  // READ_ONLY gets a full view (audit) — matches what the promo landing
  // redirect into /promo/history assumes, and matches the page's VIEW_ROLES.
  const isFullView = new Set(['ADMIN', 'MANAGER', 'OPERATIONS', 'READ_ONLY']).has(roleKey);
  const isScopedView = new Set(['AGENT', 'TEAM_LEAD']).has(roleKey);
  if (!isFullView && !isScopedView) {
    return { items: [], total: 0, scope: 'EMPTY' };
  }

  const q = input.q?.trim().toLowerCase() ?? '';
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  const where: Prisma.PromoAllocationWhereInput = {};

  if (input.fromDate || input.toDate) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (input.fromDate) createdAt.gte = new Date(input.fromDate);
    if (input.toDate) {
      const end = new Date(input.toDate);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    where.createdAt = createdAt;
  }

  if (q) {
    where.OR = [
      { customerEmail: { contains: q } },
      { customerName: { contains: q } },
      { case: { caseNumber: { contains: q.toUpperCase() } } },
      { case: { externalCaseNumber: { contains: q } } },
      { code: { code: { contains: q.toUpperCase() } } },
    ];
  }

  // Type + RBAC scope
  if (input.type === 'CUSTOMER_COMPENSATION' || input.type === 'SERVICE_RECOVERY') {
    const codeFilter: Prisma.PromoCodeWhereInput = {
      config: { type: input.type },
    };
    where.code = codeFilter;
  }
  if (isScopedView) {
    const scoped: Prisma.PromoAllocationWhereInput = {
      OR: [
        { code: { config: { type: 'CUSTOMER_COMPENSATION' } } },
        {
          AND: [
            { code: { config: { type: 'SERVICE_RECOVERY' } } },
            { requestedById: user.id },
          ],
        },
      ],
    };
    where.AND = Array.isArray(where.AND)
      ? [...where.AND, scoped]
      : where.AND
        ? [where.AND, scoped]
        : [scoped];
  }

  const [rows, total] = await Promise.all([
    prisma.promoAllocation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        code: { include: { config: { include: { brand: true, country: { include: { registry: true } } } } } },
        requestedBy: { select: { id: true, name: true } },
        case: { select: { id: true, caseNumber: true, externalCaseNumber: true } },
      },
    }),
    prisma.promoAllocation.count({ where }),
  ]);

  return {
    items: rows.map((a) => ({
      id: a.id,
      code: a.code.code,
      type: a.code.config.type as 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY',
      brand: a.code.config.brand.name,
      country: a.code.config.country.registry?.nameEn ?? a.code.config.country.registryCode,
      value: a.code.config.value,
      currency: a.code.config.currency,
      customerEmail: a.customerEmail,
      customerName: a.customerName,
      caseId: a.case?.externalCaseNumber ?? a.case?.caseNumber ?? null,
      reason: a.reason,
      requestedBy: a.requestedBy,
      emailedAt: a.emailedAt,
      createdAt: a.createdAt,
    })),
    total,
    scope: isFullView ? 'ALL' : 'COMPENSATION_PLUS_OWN_RECOVERY',
  };
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
  const user = await requireSession();
  if (!HISTORY_ROLES.has(user.role ?? '')) {
    // Return an empty result rather than throwing so a restricted agent's UI
    // simply shows "no history" instead of crashing — but the action still
    // refuses to leak another customer's codes.
    return { recentCount: 0, totalCount: 0, history: [] };
  }
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

/**
 * Permanently delete a code. Only safe for codes in AVAILABLE status — we
 * never delete codes that have already been allocated (would break audit
 * history). Uses `deleteMany` with a status guard so a concurrent allocation
 * can't slip through a TOCTOU gap.
 */
export async function deletePromoCodeAction(
  codeId: string,
): Promise<ActionResult<{ poolId: string }>> {
  try {
    const user = await requireSession();
    if (!POOL_ADMIN_ROLES.has(user.role ?? '')) {
      return { ok: false, error: 'You do not have permission to delete codes.' };
    }
    const existing = await prisma.promoCode.findUnique({
      where: { id: codeId },
      select: { configId: true, status: true },
    });
    if (!existing) return { ok: false, error: 'Code not found.' };
    if (existing.status !== 'AVAILABLE') {
      return { ok: false, error: 'Only AVAILABLE codes can be deleted.' };
    }
    const result = await prisma.promoCode.deleteMany({
      where: { id: codeId, status: 'AVAILABLE' },
    });
    if (result.count === 0) {
      return { ok: false, error: 'Code was just allocated — cannot delete.' };
    }
    revalidatePath('/promo');
    revalidatePath(`/promo/pools/${existing.configId}`);
    return { ok: true, data: { poolId: existing.configId } };
  } catch (e) {
    console.error('[deletePromoCodeAction]', e);
    return { ok: false, error: 'Failed to delete code.' };
  }
}

/**
 * Restore an ALLOCATED code back to AVAILABLE. Use cases: an agent issued the
 * wrong code, or a customer was mistakenly compensated twice. Deletes the
 * linked PromoAllocation rows so the code is cleanly reusable and drops the
 * audit claim — we keep an activity log entry on the side so the admin action
 * is traceable.
 *
 * Refuses to restore codes that have already been used (USED status) to keep
 * accounting clean.
 */
export async function restorePromoCodeAction(
  codeId: string,
): Promise<ActionResult<{ poolId: string }>> {
  try {
    const user = await requireSession();
    if (!POOL_ADMIN_ROLES.has(user.role ?? '')) {
      return { ok: false, error: 'You do not have permission to restore codes.' };
    }
    const poolId = await prisma.$transaction(async (tx) => {
      const existing = await tx.promoCode.findUnique({
        where: { id: codeId },
        select: { id: true, configId: true, status: true },
      });
      if (!existing) throw new Error('NOT_FOUND');
      if (existing.status !== 'ALLOCATED') {
        throw new Error('NOT_ALLOCATED');
      }
      // Flip ALLOCATED → AVAILABLE with a status guard (TOCTOU safe).
      const flip = await tx.promoCode.updateMany({
        where: { id: codeId, status: 'ALLOCATED' },
        data: { status: 'AVAILABLE' },
      });
      if (flip.count === 0) throw new Error('RACE');
      // Drop the allocation rows so the code is cleanly reusable. The
      // activity_log row below preserves the audit trail.
      await tx.promoAllocation.deleteMany({ where: { codeId } });
      await tx.activityLog.create({
        data: {
          actorId: user.id,
          actorLabel: user.name,
          kind: 'promo.code_restored',
          message: `Restored promo code (id=${codeId}) to AVAILABLE`,
        },
      });
      return existing.configId;
    });
    revalidatePath('/promo');
    revalidatePath(`/promo/pools/${poolId}`);
    return { ok: true, data: { poolId } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'NOT_FOUND') return { ok: false, error: 'Code not found.' };
    if (msg === 'NOT_ALLOCATED') {
      return { ok: false, error: 'Only ALLOCATED codes can be restored.' };
    }
    if (msg === 'RACE') return { ok: false, error: 'Code state changed; refresh and retry.' };
    console.error('[restorePromoCodeAction]', e);
    return { ok: false, error: 'Failed to restore code.' };
  }
}

/**
 * CSV export of promo allocations for a date range. Respects the same
 * RBAC scope as `listPromoAllocationsAction` — ADMIN/MANAGER/OPERATIONS only
 * for the admin-level full export (anyone else is rejected). Returns a UTF-8
 * CSV string the client writes to disk via a Blob download.
 */
export async function exportPromoAllocationsCsvAction(input: {
  fromDate?: string;
  toDate?: string;
  type?: 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY' | 'ALL';
}): Promise<ActionResult<{ csv: string; filename: string; rowCount: number }>> {
  try {
    const user = await requireSession();
    if (!POOL_ADMIN_ROLES.has(user.role ?? '')) {
      return { ok: false, error: 'You do not have permission to export.' };
    }
    const where: Prisma.PromoAllocationWhereInput = {};
    if (input.fromDate || input.toDate) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (input.fromDate) createdAt.gte = new Date(input.fromDate);
      if (input.toDate) {
        const end = new Date(input.toDate);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }
    if (input.type === 'CUSTOMER_COMPENSATION' || input.type === 'SERVICE_RECOVERY') {
      where.code = { config: { type: input.type } };
    }
    const rows = await prisma.promoAllocation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      include: {
        code: {
          include: {
            config: {
              include: { brand: true, country: { include: { registry: true } } },
            },
          },
        },
        requestedBy: { select: { name: true, email: true } },
        case: { select: { caseNumber: true, externalCaseNumber: true } },
      },
    });

    const headers = [
      'Allocated At',
      'Type',
      'Code',
      'Value',
      'Currency',
      'Country',
      'Brand',
      'Customer Name',
      'Customer Email',
      'Case #',
      'CRM Case #',
      'Reason',
      'Allocated By',
      'Agent Email',
      'Emailed At',
    ];
    const csvEscape = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [headers.map(csvEscape).join(',')];
    for (const a of rows) {
      lines.push(
        [
          a.createdAt.toISOString(),
          a.code.config.type === 'CUSTOMER_COMPENSATION' ? 'Compensation' : 'Service recovery',
          a.code.code,
          a.code.config.value,
          a.code.config.currency,
          a.code.config.country.registry?.nameEn ?? a.code.config.country.registryCode,
          a.code.config.brand.name,
          a.customerName ?? '',
          a.customerEmail,
          a.case?.caseNumber ?? '',
          a.case?.externalCaseNumber ?? '',
          a.reason ?? '',
          a.requestedBy?.name ?? '',
          a.requestedBy?.email ?? '',
          a.emailedAt ? a.emailedAt.toISOString() : '',
        ]
          .map(csvEscape)
          .join(','),
      );
    }
    const csv = lines.join('\r\n');
    const today = new Date().toISOString().slice(0, 10);
    const filename = `promo-allocations-${today}.csv`;
    return { ok: true, data: { csv, filename, rowCount: rows.length } };
  } catch (e) {
    console.error('[exportPromoAllocationsCsvAction]', e);
    return { ok: false, error: 'Failed to export allocations.' };
  }
}
