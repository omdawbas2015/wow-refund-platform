/**
 * Inbound webhook for Power Automate.
 *
 * Power Automate listens to Office 365 inbox → when an email arrives (manager
 * reply, Finance ARN reply, Aura confirmation, customer reply), it POSTs the
 * payload here.
 *
 * We persist the raw email in `inbound_email`, then immediately classify it
 * and route it to the right handler. Parsing failures are non-fatal — they
 * leave the row in `parseStatus = 'FAILED'` for human review.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@wow/db';
import { processInboundReply } from '@/lib/batches/process-inbound';

const INBOUND_SECRET = process.env['POWER_AUTOMATE_INBOUND_SECRET'] ?? '';

interface InboundPayload {
  fromEmail: string;
  toEmail: string;
  subject: string;
  rawBody: string;
  powerAutomateRunId?: string;
}

export async function POST(req: NextRequest) {
  if (INBOUND_SECRET) {
    const header = req.headers.get('x-wow-signature');
    if (header !== INBOUND_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let payload: InboundPayload;
  try {
    payload = (await req.json()) as InboundPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const required: Array<keyof InboundPayload> = ['fromEmail', 'toEmail', 'subject', 'rawBody'];
  for (const field of required) {
    if (!payload[field]) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  const record = await prisma.inboundEmail.create({
    data: {
      fromEmail: payload.fromEmail,
      toEmail: payload.toEmail,
      subject: payload.subject,
      rawBody: payload.rawBody,
      powerAutomateRunId: payload.powerAutomateRunId ?? null,
      parseStatus: 'PENDING',
    },
  });

  try {
    const outcome = await processInboundReply({
      fromEmail: payload.fromEmail,
      subject: payload.subject,
      rawBody: payload.rawBody,
    });

    await prisma.inboundEmail.update({
      where: { id: record.id },
      data: {
        parseStatus: outcome.intent === 'IGNORED' ? 'IGNORED' : 'PARSED',
        parsedIntent: outcome.intent,
        parsedPayload: outcome.payload ? JSON.stringify(outcome.payload) : null,
        parsedAt: new Date(),
        linkedBatchId: outcome.linkedBatchId ?? null,
        linkedCaseId: outcome.linkedCaseId ?? null,
        linkedComponentId: outcome.linkedComponentId ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      id: record.id,
      intent: outcome.intent,
      payload: outcome.payload ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.inboundEmail.update({
      where: { id: record.id },
      data: {
        parseStatus: 'FAILED',
        parseError: message.slice(0, 1000),
        parsedAt: new Date(),
      },
    });
    console.error('[inbound email] parse failed', record.id, message);
    return NextResponse.json({ ok: false, id: record.id, error: message }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({
    status: 'Power Automate inbound webhook is active',
    timestamp: new Date().toISOString(),
  });
}
