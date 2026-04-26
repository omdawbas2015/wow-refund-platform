'use server';

import { prisma } from '@wow/db';
import {
  sendStoreMessageSchema,
  upsertStoreMessageTemplateSchema,
  type SendStoreMessageInput,
  type UpsertStoreMessageTemplateInput,
} from '@wow/validators';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { dispatchEmail } from '@/lib/email/dispatcher';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session.user;
}

function ensureAdmin(role: string | null | undefined) {
  if (role !== 'ADMIN') throw new Error('FORBIDDEN');
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

/**
 * Render a template body with mustache-style {{var}} placeholders.
 * Missing variables are left as the literal placeholder so authors can spot them.
 */
function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ── Send to store ──────────────────────────────────────────────────────────

export async function sendStoreMessageAction(
  input: SendStoreMessageInput,
): Promise<ActionResult<{ logId: string }>> {
  try {
    const me = await requireUser();
    const parsed = sendStoreMessageSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const { templateId, storeEmail, caseNumber, note } = parsed.data;

    const template = await prisma.storeMessageTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) return { ok: false, error: 'Template not found' };
    if (!template.isActive) return { ok: false, error: 'Template is inactive' };

    const vars = {
      caseNumber,
      note: note || '',
      sender: me.email,
    };
    const renderedSubject = renderTemplate(template.subject, vars);
    const renderedBody = renderTemplate(template.body, vars);

    const log = await prisma.storeMessageLog.create({
      data: {
        caseNumber,
        storeEmail,
        templateId,
        note: note || null,
        renderedSubject,
        renderedBody,
        sentById: me.id,
      },
    });

    try {
      await dispatchEmail({
        templateKey: `STORE_${template.key}`,
        locale: 'en',
        to: storeEmail,
        // We render the subject/body off the StoreMessageTemplate row instead of
        // an EmailTemplate row, so pass them as an override.
        variables: {},
        override: { subject: renderedSubject, body: renderedBody },
        context: { type: 'STORE', id: log.id },
      });
      await prisma.storeMessageLog.update({
        where: { id: log.id },
        data: { deliveryStatus: 'SENT', deliveredAt: new Date() },
      });
    } catch (emailErr) {
      const reason = emailErr instanceof Error ? emailErr.message : String(emailErr);
      await prisma.storeMessageLog.update({
        where: { id: log.id },
        data: { deliveryStatus: 'FAILED', failureReason: reason },
      });
      return { ok: false, error: `Email dispatch failed: ${reason}` };
    }

    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'help_desk.store_message_sent',
      entityType: 'STORE_MESSAGE',
      entityId: log.id,
      metadata: { templateKey: template.key, caseNumber, storeEmail },
    });

    revalidatePath('/help-desk/stores');
    return { ok: true, data: { logId: log.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Admin: store template upsert ───────────────────────────────────────────

export async function upsertStoreMessageTemplateAction(
  input: UpsertStoreMessageTemplateInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireUser();
    ensureAdmin(me.role);
    const parsed = upsertStoreMessageTemplateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const { templateId, key, label, labelAr, subject, body, isActive, sortOrder } = parsed.data;

    const data = {
      key,
      label,
      labelAr: labelAr || null,
      subject,
      body,
      isActive,
      sortOrder,
    };

    if (templateId) {
      const before = await prisma.storeMessageTemplate.findUnique({ where: { id: templateId } });
      if (!before) return { ok: false, error: 'Template not found' };

      // Disallow renaming key to a value that already exists on a different row.
      if (before.key !== key) {
        const dup = await prisma.storeMessageTemplate.findUnique({ where: { key } });
        if (dup) return { ok: false, error: 'A template with this key already exists' };
      }

      const updated = await prisma.storeMessageTemplate.update({
        where: { id: templateId },
        data,
      });
      await audit({
        actorId: me.id,
        actorEmail: me.email,
        action: 'admin.store_message_template.updated',
        entityType: 'STORE_MESSAGE_TEMPLATE',
        entityId: updated.id,
        before,
        after: updated,
      });
      revalidatePath('/admin/store-templates');
      return { ok: true, data: { id: updated.id } };
    }

    const dup = await prisma.storeMessageTemplate.findUnique({ where: { key } });
    if (dup) return { ok: false, error: 'A template with this key already exists' };
    const created = await prisma.storeMessageTemplate.create({ data });
    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'admin.store_message_template.created',
      entityType: 'STORE_MESSAGE_TEMPLATE',
      entityId: created.id,
      after: created,
    });
    revalidatePath('/admin/store-templates');
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
