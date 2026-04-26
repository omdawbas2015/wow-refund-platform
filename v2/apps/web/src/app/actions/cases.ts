'use server';

import { prisma } from '@wow/db';
import {
  createRefundCaseSchema,
  submitCaseSchema,
  approveCaseSchema,
  rejectCaseSchema,
  cancelCaseSchema,
  addCaseNoteSchema,
  markComponentRefundedSchema,
  customerLookupSchema,
  type CreateRefundCaseInput,
} from '@wow/validators';
import { auth } from '@/auth';
import { dispatchEmail } from '@/lib/email/dispatcher';
import { nextCaseNumber } from '@/lib/cases/case-number';
import { assertCaseTransition, isComponentTerminal } from '@/lib/cases/state-machine';
import { rollupCaseStatus } from '@/lib/cases/status-rollup';
import { revalidatePath } from 'next/cache';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session.user;
}

function jsonStringify(data: unknown): string {
  return JSON.stringify(data, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}

async function writeAudit(args: {
  actorId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: args.actorId,
      actorEmail: args.actorEmail,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      ...(args.before !== undefined ? { beforeData: jsonStringify(args.before) } : {}),
      ...(args.after !== undefined ? { afterData: jsonStringify(args.after) } : {}),
    },
  });
}

/**
 * Create a refund case in DRAFT status with initial components.
 * Performs duplicate detection on (orderNumber + brandId + countryId).
 */
export async function createCaseAction(
  input: CreateRefundCaseInput,
): Promise<ActionResult<{ caseId: string; caseNumber: string }>> {
  try {
    const me = await requireUser();
    const parsed = createRefundCaseSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return { ok: false, error: first?.message ?? 'Invalid input' };
    }
    const data = parsed.data;

    // Duplicate detection
    const dup = await prisma.refundCase.findFirst({
      where: {
        orderNumber: data.orderNumber,
        brandId: data.brandId,
        countryId: data.countryId,
        deletedAt: null,
        status: { notIn: ['CANCELLED', 'REJECTED'] },
      },
      select: { id: true, caseNumber: true },
    });
    if (dup) {
      return {
        ok: false,
        error: `Duplicate case for this order already exists: ${dup.caseNumber}`,
      };
    }

    // Resolve payment-method ids
    const paymentMethodKeys = Array.from(
      new Set(data.components.map((c) => c.paymentMethodKey)),
    );
    const methods = await prisma.paymentMethod.findMany({
      where: { key: { in: paymentMethodKeys }, isActive: true },
      select: { id: true, key: true },
    });
    const methodByKey = new Map(methods.map((m) => [m.key, m.id]));
    const missing = paymentMethodKeys.filter((k) => !methodByKey.has(k));
    if (missing.length > 0) {
      return { ok: false, error: `Unknown payment method(s): ${missing.join(', ')}` };
    }

    const totalRefund = data.components.reduce((sum, c) => sum + c.amount, 0);
    const isPartial = totalRefund < data.orderAmount;

    const caseNumber = await nextCaseNumber(data.countryId);

    const created = await prisma.refundCase.create({
      data: {
        caseNumber,
        countryId: data.countryId,
        brandId: data.brandId,
        branchId: data.branchId || null,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone || null,
        customerNotes: data.customerNotes || null,
        orderNumber: data.orderNumber,
        orderDate: data.orderDate,
        orderAmount: data.orderAmount,
        orderCurrency: data.orderCurrency,
        totalRefundAmount: totalRefund,
        isPartial,
        auraPoints: data.auraPoints ?? null,
        auraStatus: data.auraPoints && data.auraPoints > 0 ? 'PENDING' : 'NONE',
        rootCauseId: data.rootCauseId || null,
        rootCauseNotes: data.rootCauseNotes || null,
        status: 'DRAFT',
        createdById: me.id,
        components: {
          create: data.components.map((c) => ({
            paymentMethodId: methodByKey.get(c.paymentMethodKey)!,
            amount: c.amount,
            currency: c.currency,
            authCode: c.authCode || null,
            last4: c.last4 || null,
            status: 'PENDING' as const,
          })),
        },
      },
      select: { id: true, caseNumber: true },
    });
    const result = { caseId: created.id, caseNumber: created.caseNumber };

    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'case.created',
      entityType: 'CASE',
      entityId: created.id,
      after: {
        caseNumber: created.caseNumber,
        orderNumber: data.orderNumber,
        components: data.components.length,
        total: totalRefund,
      },
    });

    revalidatePath('/cases');
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function submitCaseAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireUser();
    const parsed = submitCaseSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: 'Invalid input' };

    const c = await prisma.refundCase.findUnique({
      where: { id: parsed.data.caseId },
      select: { id: true, status: true, createdById: true },
    });
    if (!c) return { ok: false, error: 'Case not found' };
    assertCaseTransition(c.status, 'PENDING_APPROVAL');

    await prisma.refundCase.update({
      where: { id: c.id },
      data: { status: 'PENDING_APPROVAL' },
    });
    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'case.submitted',
      entityType: 'CASE',
      entityId: c.id,
      before: { status: c.status },
      after: { status: 'PENDING_APPROVAL' },
    });

    revalidatePath(`/cases/${c.id}`);
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function approveCaseAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireUser();
    if (me.role !== 'ADMIN' && me.role !== 'COUNTRY_MANAGER') {
      return { ok: false, error: 'Only managers/admins can approve cases' };
    }
    const parsed = approveCaseSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: 'Invalid input' };

    const c = await prisma.refundCase.findUnique({
      where: { id: parsed.data.caseId },
      select: {
        id: true,
        status: true,
        customerEmail: true,
        customerName: true,
        caseNumber: true,
        createdById: true,
      },
    });
    if (!c) return { ok: false, error: 'Case not found' };
    assertCaseTransition(c.status, 'APPROVED');

    await prisma.refundCase.update({
      where: { id: c.id },
      data: {
        status: 'APPROVED',
        approvedById: me.id,
        approvedAt: new Date(),
      },
    });
    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'case.approved',
      entityType: 'CASE',
      entityId: c.id,
      before: { status: c.status },
      after: { status: 'APPROVED' },
    });

    // Notify the case creator that their case was approved (in-app bell).
    // Skip self-notification when an admin approves their own case.
    if (c.createdById && c.createdById !== me.id) {
      try {
        await prisma.notification.create({
          data: {
            userId: c.createdById,
            type: 'CASE_APPROVED',
            title: `Case ${c.caseNumber} approved`,
            body: `${me.name ?? me.email} approved this case.`,
            href: `/cases/${c.id}`,
            contextType: 'CASE',
            contextId: c.id,
          },
        });
      } catch (notifErr) {
        console.error('[cases] failed to write CASE_APPROVED notification', notifErr);
      }
    }

    revalidatePath(`/cases/${c.id}`);
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function rejectCaseAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireUser();
    if (me.role !== 'ADMIN' && me.role !== 'COUNTRY_MANAGER') {
      return { ok: false, error: 'Only managers/admins can reject cases' };
    }
    const parsed = rejectCaseSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: 'Invalid input' };
    const { caseId, reason } = parsed.data;

    const c = await prisma.refundCase.findUnique({
      where: { id: caseId },
      select: { id: true, status: true, caseNumber: true, createdById: true },
    });
    if (!c) return { ok: false, error: 'Case not found' };
    assertCaseTransition(c.status, 'REJECTED');

    await prisma.refundCase.update({
      where: { id: c.id },
      data: { status: 'REJECTED', rejectedReason: reason },
    });
    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'case.rejected',
      entityType: 'CASE',
      entityId: c.id,
      before: { status: c.status },
      after: { status: 'REJECTED', reason },
    });

    if (c.createdById && c.createdById !== me.id) {
      try {
        await prisma.notification.create({
          data: {
            userId: c.createdById,
            type: 'CASE_REJECTED',
            title: `Case ${c.caseNumber} rejected`,
            body: reason.slice(0, 240),
            href: `/cases/${c.id}`,
            contextType: 'CASE',
            contextId: c.id,
          },
        });
      } catch (notifErr) {
        console.error('[cases] failed to write CASE_REJECTED notification', notifErr);
      }
    }

    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelCaseAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireUser();
    const parsed = cancelCaseSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: 'Invalid input' };
    const { caseId, reason } = parsed.data;

    const c = await prisma.refundCase.findUnique({
      where: { id: caseId },
      select: { id: true, status: true, createdById: true },
    });
    if (!c) return { ok: false, error: 'Case not found' };
    // ADMIN and COUNTRY_MANAGER can cancel any case; everyone else must be
    // the case creator. Mirrors the cases/[id]/page.tsx visibility check
    // (canManage || createdById === me.id) and the bulk-cancel privilege
    // gate so single + bulk cancel behave consistently.
    if (
      me.role !== 'ADMIN' &&
      me.role !== 'COUNTRY_MANAGER' &&
      c.createdById !== me.id
    ) {
      return { ok: false, error: 'You can only cancel cases you created' };
    }
    assertCaseTransition(c.status, 'CANCELLED');

    await prisma.refundCase.update({
      where: { id: c.id },
      data: { status: 'CANCELLED', cancelledReason: reason },
    });
    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'case.cancelled',
      entityType: 'CASE',
      entityId: c.id,
      before: { status: c.status },
      after: { status: 'CANCELLED', reason },
    });

    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function addCaseNoteAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireUser();
    // Pull the array of mentions out of the form-data correctly
    const raw = Object.fromEntries(formData.entries()) as Record<string, unknown>;
    const mentionedUserIds = formData.getAll('mentionedUserIds').map(String).filter(Boolean);
    raw['mentionedUserIds'] = mentionedUserIds;

    const parsed = addCaseNoteSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const c = await prisma.refundCase.findUnique({
      where: { id: parsed.data.caseId },
      select: { id: true, caseNumber: true },
    });
    if (!c) return { ok: false, error: 'Case not found' };

    const note = await prisma.caseNote.create({
      data: {
        caseId: c.id,
        authorId: me.id,
        body: parsed.data.body,
        mentions: {
          create: parsed.data.mentionedUserIds.map((userId) => ({ userId })),
        },
      },
      select: { id: true },
    });

    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'case.note_added',
      entityType: 'CASE',
      entityId: c.id,
      after: { noteId: note.id, mentions: parsed.data.mentionedUserIds.length },
    });

    // Notify mentioned users (in-app)
    if (parsed.data.mentionedUserIds.length > 0) {
      await prisma.notification.createMany({
        data: parsed.data.mentionedUserIds.map((userId) => ({
          userId,
          type: 'CASE_NOTE_MENTION' as const,
          title: `${me.name ?? me.email} mentioned you on ${c.caseNumber}`,
          body: parsed.data.body.slice(0, 240),
          href: `/cases/${c.id}`,
          contextType: 'CASE',
          contextId: c.id,
        })),
      });
    }

    revalidatePath(`/cases/${c.id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function markComponentRefundedAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const me = await requireUser();
    const parsed = markComponentRefundedSchema.safeParse(
      Object.fromEntries(formData.entries()),
    );
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }
    const { componentId, arn, notifyCustomer } = parsed.data;

    const comp = await prisma.refundComponent.findUnique({
      where: { id: componentId },
      select: {
        id: true,
        status: true,
        caseId: true,
        amount: true,
        currency: true,
        paymentMethod: { select: { label: true } },
        case: {
          select: {
            id: true,
            status: true,
            customerEmail: true,
            customerName: true,
            caseNumber: true,
            orderCurrency: true,
          },
        },
      },
    });
    if (!comp) return { ok: false, error: 'Component not found' };
    if (isComponentTerminal(comp.status)) {
      return { ok: false, error: `Component is already ${comp.status}` };
    }

    await prisma.refundComponent.update({
      where: { id: comp.id },
      data: {
        status: 'REFUNDED',
        arn,
        arnVerifiedAt: new Date(),
        refundedById: me.id,
        refundedAt: new Date(),
        ...(notifyCustomer ? { customerNotifiedAt: new Date() } : {}),
      },
    });

    // Roll up case status from all components
    const all = await prisma.refundComponent.findMany({
      where: { caseId: comp.caseId },
      select: { status: true },
    });
    const next = rollupCaseStatus(comp.case.status, all.map((c) => c.status));
    if (next !== comp.case.status) {
      await prisma.refundCase.update({
        where: { id: comp.caseId },
        data: { status: next },
      });
    }

    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'component.refunded',
      entityType: 'COMPONENT',
      entityId: comp.id,
      before: { status: comp.status, caseStatus: comp.case.status },
      after: { status: 'REFUNDED', arn, caseStatus: next },
    });
    // Mirror the event onto the parent case so it surfaces in the case
    // timeline (which queries `entityType: 'CASE'`). The `after` payload
    // carries the friendly fields the timeline renders inline.
    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'case.component_refunded',
      entityType: 'CASE',
      entityId: comp.caseId,
      after: {
        componentId: comp.id,
        paymentMethod: comp.paymentMethod.label,
        amount: comp.amount,
        currency: comp.currency,
        arn,
      },
    });

    if (notifyCustomer) {
      await dispatchEmail({
        templateKey: 'CUSTOMER_REFUND_COMPLETED',
        locale: 'en',
        to: comp.case.customerEmail,
        variables: {
          customerName: comp.case.customerName,
          orderNumber: comp.case.caseNumber,
          arn,
          totalAmount: '',
          componentsTable: '',
          brandName: '',
        },
        context: { type: 'CASE', id: comp.caseId },
      });
    }

    revalidatePath(`/cases/${comp.caseId}`);
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Customer lookup — returns past customers matching email or phone fragment.
 * Used by the case-create form to autofill customer details and warn about
 * recent refunds.
 */
export async function lookupCustomerAction(
  query: string,
): Promise<
  ActionResult<
    Array<{
      customerName: string;
      customerEmail: string;
      customerPhone: string | null;
      lastCaseAt: Date;
      caseCount: number;
    }>
  >
> {
  try {
    await requireUser();
    const parsed = customerLookupSchema.safeParse({ query });
    if (!parsed.success) return { ok: false, error: 'Invalid query' };
    const q = parsed.data.query.toLowerCase();

    const cases = await prisma.refundCase.findMany({
      where: {
        deletedAt: null,
        OR: [
          { customerEmail: { contains: q } },
          { customerPhone: { contains: q } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        createdAt: true,
      },
    });

    const grouped = new Map<
      string,
      {
        customerName: string;
        customerEmail: string;
        customerPhone: string | null;
        lastCaseAt: Date;
        caseCount: number;
      }
    >();
    for (const c of cases) {
      const existing = grouped.get(c.customerEmail);
      if (existing) {
        existing.caseCount += 1;
        if (c.createdAt > existing.lastCaseAt) existing.lastCaseAt = c.createdAt;
      } else {
        grouped.set(c.customerEmail, {
          customerName: c.customerName,
          customerEmail: c.customerEmail,
          customerPhone: c.customerPhone,
          lastCaseAt: c.createdAt,
          caseCount: 1,
        });
      }
    }

    return { ok: true, data: Array.from(grouped.values()).slice(0, 10) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

interface BulkResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ caseId: string; caseNumber: string; error: string }>;
}

const MAX_BULK = 100;

/**
 * Submit a batch of DRAFT cases to PENDING_APPROVAL. Cases not in DRAFT are
 * counted as failed but do not abort the rest of the batch — the operator
 * sees a per-row error breakdown in the toast/page response.
 *
 * Each transition is wrapped in its own try/catch so a single bad row can't
 * roll back the others. Audit rows are written per case so the per-case
 * timeline still reflects who/when, regardless of which entry point fired
 * the transition.
 */
export async function bulkSubmitCasesAction(
  formData: FormData,
): Promise<ActionResult<BulkResult>> {
  try {
    const me = await requireUser();
    const raw = formData.get('caseIds');
    if (typeof raw !== 'string' || !raw) return { ok: false, error: 'No cases selected' };
    const caseIds = Array.from(new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))).slice(
      0,
      MAX_BULK,
    );
    if (caseIds.length === 0) return { ok: false, error: 'No cases selected' };

    const cases = await prisma.refundCase.findMany({
      where: { id: { in: caseIds }, deletedAt: null },
      select: { id: true, caseNumber: true, status: true },
    });

    const result: BulkResult = {
      total: caseIds.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (const c of cases) {
      try {
        assertCaseTransition(c.status, 'PENDING_APPROVAL');
        await prisma.refundCase.update({
          where: { id: c.id },
          data: { status: 'PENDING_APPROVAL' },
        });
        await writeAudit({
          actorId: me.id,
          actorEmail: me.email,
          action: 'case.submitted',
          entityType: 'CASE',
          entityId: c.id,
          before: { status: c.status },
          after: { status: 'PENDING_APPROVAL', via: 'bulk' },
        });
        result.succeeded += 1;
      } catch (rowErr) {
        result.failed += 1;
        result.errors.push({
          caseId: c.id,
          caseNumber: c.caseNumber,
          error: rowErr instanceof Error ? rowErr.message : String(rowErr),
        });
      }
    }

    // Cases that vanished between selection and execution.
    const found = new Set(cases.map((c) => c.id));
    for (const id of caseIds) {
      if (!found.has(id)) {
        result.failed += 1;
        result.errors.push({ caseId: id, caseNumber: id, error: 'Case not found' });
      }
    }

    revalidatePath('/cases');
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Bulk cancel — same per-row resilience as bulkSubmit. Cancellation is
 * permitted from non-terminal statuses, so this is mainly used to clean
 * up stale drafts or revoke pending approvals before they're acted on.
 */
export async function bulkCancelCasesAction(
  formData: FormData,
): Promise<ActionResult<BulkResult>> {
  try {
    const me = await requireUser();
    const raw = formData.get('caseIds');
    const reason = (formData.get('reason') ?? '').toString().trim();
    if (!reason) return { ok: false, error: 'Reason is required' };
    if (typeof raw !== 'string' || !raw) return { ok: false, error: 'No cases selected' };
    const caseIds = Array.from(new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))).slice(
      0,
      MAX_BULK,
    );
    if (caseIds.length === 0) return { ok: false, error: 'No cases selected' };

    const isPrivileged = me.role === 'ADMIN' || me.role === 'COUNTRY_MANAGER';

    const cases = await prisma.refundCase.findMany({
      where: { id: { in: caseIds }, deletedAt: null },
      select: { id: true, caseNumber: true, status: true, createdById: true },
    });

    const result: BulkResult = {
      total: caseIds.length,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (const c of cases) {
      try {
        // Privileged users can cancel anyone's case; creators can cancel their
        // own. Mirrors the per-case action's authorization rules.
        if (!isPrivileged && c.createdById !== me.id) {
          throw new Error('Not authorized to cancel this case');
        }
        assertCaseTransition(c.status, 'CANCELLED');
        await prisma.refundCase.update({
          where: { id: c.id },
          data: { status: 'CANCELLED', cancelledReason: reason },
        });
        await writeAudit({
          actorId: me.id,
          actorEmail: me.email,
          action: 'case.cancelled',
          entityType: 'CASE',
          entityId: c.id,
          before: { status: c.status },
          after: { status: 'CANCELLED', reason, via: 'bulk' },
        });
        result.succeeded += 1;
      } catch (rowErr) {
        result.failed += 1;
        result.errors.push({
          caseId: c.id,
          caseNumber: c.caseNumber,
          error: rowErr instanceof Error ? rowErr.message : String(rowErr),
        });
      }
    }

    const found = new Set(cases.map((c) => c.id));
    for (const id of caseIds) {
      if (!found.has(id)) {
        result.failed += 1;
        result.errors.push({ caseId: id, caseNumber: id, error: 'Case not found' });
      }
    }

    revalidatePath('/cases');
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
