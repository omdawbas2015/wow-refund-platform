/**
 * EmailDispatcher — single abstraction for all outbound emails.
 *
 * In production: posts a payload to Power Automate webhook.
 * In development / when POWER_AUTOMATE_WEBHOOK_URL is unset:
 *   logs the email to console and records it in EmailLog.
 *
 * Every email call is persisted to EmailLog (so the audit trail is complete
 * regardless of delivery success).
 */

import { prisma } from '@wow/db';
import { renderTemplate } from './render';

export interface EmailPayload {
  templateKey: string;
  locale?: 'en' | 'ar';
  to: string;
  cc?: string;
  bcc?: string;
  /** Values to interpolate into the template's {{placeholders}} */
  variables: Record<string, string | number | undefined | null>;
  /** For audit + linking: what does this email relate to? */
  context?: {
    type: 'CASE' | 'BATCH' | 'PROMO' | 'STORE' | 'OTP' | 'AUTH' | 'SYSTEM';
    id?: string;
  };
  /** Override subject/body (skip template lookup) — used for admin notifications */
  override?: {
    subject: string;
    body: string;
  };
}

export interface EmailDispatchResult {
  logId: string;
  delivered: boolean;
  runId?: string;
  error?: string;
}

const WEBHOOK_URL = process.env['POWER_AUTOMATE_WEBHOOK_URL'] ?? '';
const SIGNING_SECRET = process.env['POWER_AUTOMATE_SIGNING_SECRET'] ?? '';

export async function dispatchEmail(payload: EmailPayload): Promise<EmailDispatchResult> {
  // Load template if no override given
  let subject: string;
  let body: string;
  let templateId: string | undefined;

  if (payload.override) {
    subject = payload.override.subject;
    body = payload.override.body;
  } else {
    const template = await prisma.emailTemplate.findUnique({
      where: {
        key_locale: { key: payload.templateKey, locale: payload.locale ?? 'en' },
      },
    });

    if (!template) {
      throw new Error(
        `Email template not found: ${payload.templateKey} (locale: ${payload.locale ?? 'en'})`,
      );
    }

    templateId = template.id;
    subject = renderTemplate(template.subject, payload.variables);
    body = renderTemplate(template.body, payload.variables);
  }

  // Persist log entry (status=PENDING)
  const log = await prisma.emailLog.create({
    data: {
      templateId,
      templateKey: payload.templateKey,
      to: payload.to,
      cc: payload.cc ?? null,
      bcc: payload.bcc ?? null,
      subject,
      body,
      contextType: payload.context?.type ?? null,
      contextId: payload.context?.id ?? null,
      status: 'PENDING',
    },
  });

  // If no webhook configured (dev), log to console and mark SENT
  if (!WEBHOOK_URL) {
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('📧 EMAIL (dev mode — no Power Automate webhook configured)');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`  Template: ${payload.templateKey} [${payload.locale ?? 'en'}]`);
    console.log(`  To:       ${payload.to}${payload.cc ? ` (cc: ${payload.cc})` : ''}`);
    console.log(`  Subject:  ${subject}`);
    console.log('──────────────────────────────────────────────────────────────');
    console.log(body.split('\n').map((line) => `  ${line}`).join('\n'));
    console.log('══════════════════════════════════════════════════════════════\n');

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'SENT', sentAt: new Date(), powerAutomateRunId: 'dev-stub' },
    });

    return { logId: log.id, delivered: true, runId: 'dev-stub' };
  }

  // Production: POST to Power Automate
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Wow-Signature': SIGNING_SECRET,
      },
      body: JSON.stringify({
        templateKey: payload.templateKey,
        to: payload.to,
        cc: payload.cc,
        bcc: payload.bcc,
        subject,
        body,
        logId: log.id,
        contextType: payload.context?.type,
        contextId: payload.context?.id,
        variables: payload.variables,
      }),
    });

    if (!res.ok) {
      throw new Error(`Power Automate returned ${res.status}`);
    }

    const data: { runId?: string } = await res.json().catch(() => ({}));
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        powerAutomateRunId: data.runId ?? null,
      },
    });

    return { logId: log.id, delivered: true, runId: data.runId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', failureReason: message },
    });
    return { logId: log.id, delivered: false, error: message };
  }
}
