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
        case: {
          select: { caseNumber: true, externalCaseNumber: true },
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
  /**
   * Per-type counts across the same q + date + RBAC filter (ignoring the
   * type filter), so the UI can render tab badges that always reflect
   * the true database-wide totals — not a slice of the first `take`.
   */
  counts: { compensation: number; recovery: number };
  scope: 'ALL' | 'COMPENSATION_PLUS_OWN_RECOVERY' | 'EMPTY';
}> {
  const user = await requireSession();
  const roleKey = user.role ?? '';
  // READ_ONLY gets a full view (audit) — matches what the promo landing
  // redirect into /promo/history assumes, and matches the page's VIEW_ROLES.
  const isFullView = new Set(['ADMIN', 'MANAGER', 'OPERATIONS', 'READ_ONLY']).has(roleKey);
  const isScopedView = new Set(['AGENT', 'TEAM_LEAD']).has(roleKey);
  if (!isFullView && !isScopedView) {
    return {
      items: [],
      total: 0,
      counts: { compensation: 0, recovery: 0 },
      scope: 'EMPTY',
    };
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

  // Counts ignore the type filter so tab badges keep showing the true
  // per-type totals even when the user has selected a single type tab.
  const whereForCounts: Prisma.PromoAllocationWhereInput = { ...where };
  delete (whereForCounts as { code?: unknown }).code;

  const [rows, total, compCount, recCount] = await Promise.all([
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
    prisma.promoAllocation.count({
      where: {
        ...whereForCounts,
        code: { config: { type: 'CUSTOMER_COMPENSATION' } },
      },
    }),
    prisma.promoAllocation.count({
      where: {
        ...whereForCounts,
        code: { config: { type: 'SERVICE_RECOVERY' } },
      },
    }),
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
    counts: { compensation: compCount, recovery: recCount },
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
    caseNumber: string | null;
    reason: string | null;
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
      caseNumber:
        a.case?.externalCaseNumber ?? a.case?.caseNumber ?? null,
      reason: a.reason,
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
 * Look up a refund case by its case number (the human-readable, country-
 * prefixed identifier shown across the app, e.g. `KW-2025-00042`) or by
 * the customer-facing CRM case number stored as `externalCaseNumber`.
 *
 * Used by the promo allocate form: when the agent enters a case number we
 * resolve it to the underlying `RefundCase` and prefill customer fields
 * (name / email / phone) plus the rejection-reason hint, so a recovery
 * promo for an existing case is one auto-filled form away. The agent can
 * still override any field manually before submitting.
 *
 * Returns `data: null` (success) when no case matches — the form treats
 * that as "no autofill, but keep what the agent typed".
 */
export async function lookupCaseByNumberAction(
  caseNumber: string,
): Promise<
  ActionResult<{
    id: string;
    caseNumber: string;
    externalCaseNumber: string | null;
    customerName: string;
    customerEmail: string;
    customerPhone: string | null;
    brandId: string;
    brandName: string;
    countryId: string;
    countryName: string;
    status: string;
    rootCauseLabel: string | null;
  } | null>
> {
  try {
    const user = await requireSession();
    // Same role gate as the allocate form / promo-history actions: this
    // returns customer PII (name / email / phone) so we must refuse it
    // for roles that can't already see that data through the allocate UI.
    if (!HISTORY_ROLES.has(user.role ?? '')) {
      return { ok: true, data: null };
    }
    const trimmed = caseNumber.trim();
    if (!trimmed || trimmed.length < 3) return { ok: true, data: null };

    // Match either the internal caseNumber or the CRM-side externalCaseNumber.
    // caseNumber is canonicalized to upper-case in seeds/admin tooling so we
    // compare both raw and upper-case to catch agents typing in either case.
    const upper = trimmed.toUpperCase();
    const c = await prisma.refundCase.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { caseNumber: upper },
          { caseNumber: trimmed },
          { externalCaseNumber: trimmed },
          { externalCaseNumber: upper },
        ],
      },
      include: {
        brand: { select: { id: true, name: true } },
        country: {
          select: {
            id: true,
            registryCode: true,
            registry: { select: { nameEn: true } },
          },
        },
        rootCause: { select: { label: true } },
      },
    });
    if (!c) return { ok: true, data: null };
    return {
      ok: true,
      data: {
        id: c.id,
        caseNumber: c.caseNumber,
        externalCaseNumber: c.externalCaseNumber,
        customerName: c.customerName,
        customerEmail: c.customerEmail,
        customerPhone: c.customerPhone,
        brandId: c.brand.id,
        brandName: c.brand.name,
        countryId: c.country.id,
        countryName: c.country.registry?.nameEn ?? c.country.registryCode,
        status: c.status,
        rootCauseLabel: c.rootCause?.label ?? null,
      },
    };
  } catch (e) {
    console.error('[lookupCaseByNumberAction]', e);
    return { ok: false, error: 'Failed to look up case.' };
  }
}

/**
 * Excel (.xlsx) export of promo allocations for a date range. Respects the
 * same RBAC scope as `listPromoAllocationsAction` — ADMIN/MANAGER/OPERATIONS
 * only. Returns a base64-encoded workbook the client decodes into a Blob and
 * triggers a save dialog with.
 *
 * We use ExcelJS so the workbook ships with proper column widths, a styled
 * header row, frozen header pane, and an autofilter — opening the file in
 * Excel/Numbers gives a usable report instead of a raw text dump.
 */
export async function exportPromoAllocationsXlsxAction(input: {
  fromDate?: string;
  toDate?: string;
  type?: 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY' | 'ALL';
}): Promise<
  ActionResult<{ base64: string; filename: string; rowCount: number }>
> {
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

    // Lazy import: ExcelJS is a heavyweight dep (~600KB) and only this
    // server action ever needs it, so we keep it out of the cold-start path
    // for the common UI-rendering routes.
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'WOW Refund Platform';
    wb.created = new Date();
    const ws = wb.addWorksheet('Promo allocations', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = [
      { header: 'Allocated At', key: 'allocatedAt', width: 22 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'Code', key: 'code', width: 26 },
      { header: 'Value', key: 'value', width: 12 },
      { header: 'Currency', key: 'currency', width: 10 },
      { header: 'Country', key: 'country', width: 16 },
      { header: 'Brand', key: 'brand', width: 22 },
      { header: 'Customer Name', key: 'customerName', width: 22 },
      { header: 'Customer Email', key: 'customerEmail', width: 28 },
      { header: 'Case #', key: 'caseNumber', width: 16 },
      { header: 'CRM Case #', key: 'externalCaseNumber', width: 18 },
      { header: 'Reason', key: 'reason', width: 30 },
      { header: 'Allocated By', key: 'allocatedBy', width: 22 },
      { header: 'Agent Email', key: 'agentEmail', width: 26 },
      { header: 'Emailed At', key: 'emailedAt', width: 22 },
    ];

    // Style the header row: bold white on dark blue, frozen + filterable.
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.alignment = { vertical: 'middle', horizontal: 'left' };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' }, // slate-800 — matches app heading color
    };
    header.height = 22;
    ws.autoFilter = { from: 'A1', to: 'O1' };

    for (const a of rows) {
      const isRecovery = a.code.config.type === 'SERVICE_RECOVERY';
      ws.addRow({
        allocatedAt: a.createdAt,
        type: isRecovery ? 'Service recovery' : 'Compensation',
        code: a.code.code,
        // Recovery values are semantically "100% off", not currency.
        // Store as a label so the spreadsheet doesn't mislead the reader.
        value: isRecovery ? '100% off' : a.code.config.value,
        currency: isRecovery ? '' : a.code.config.currency,
        country:
          a.code.config.country.registry?.nameEn ?? a.code.config.country.registryCode,
        brand: a.code.config.brand.name,
        customerName: a.customerName ?? '',
        customerEmail: a.customerEmail,
        caseNumber: a.case?.caseNumber ?? '',
        externalCaseNumber: a.case?.externalCaseNumber ?? '',
        reason: a.reason ?? '',
        allocatedBy: a.requestedBy?.name ?? '',
        agentEmail: a.requestedBy?.email ?? '',
        emailedAt: a.emailedAt ?? '',
      });
    }

    // Format date columns as a real Excel date type so users can pivot
    // / sort properly instead of getting ISO strings.
    const dateFmt = 'yyyy-mm-dd hh:mm';
    ws.getColumn('allocatedAt').numFmt = dateFmt;
    ws.getColumn('emailedAt').numFmt = dateFmt;
    // Numeric cells where applicable (compensation rows only).
    ws.getColumn('value').numFmt = '#,##0.000;-#,##0.000';

    const buffer = await wb.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const today = new Date().toISOString().slice(0, 10);
    const filename = `promo-allocations-${today}.xlsx`;
    return { ok: true, data: { base64, filename, rowCount: rows.length } };
  } catch (e) {
    console.error('[exportPromoAllocationsXlsxAction]', e);
    return { ok: false, error: 'Failed to export allocations.' };
  }
}
