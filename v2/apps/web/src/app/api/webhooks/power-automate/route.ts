/**
 * Inbound webhook for Power Automate.
 *
 * Power Automate listens to Office 365 inbox → when an email arrives (manager reply,
 * Finance ARN reply, Aura confirmation, customer reply), it POSTs the payload here.
 *
 * We store the raw email in `inbound_email` table and schedule asynchronous parsing.
 * Parsing happens in a separate worker step (Phase 3+).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@wow/db';

const INBOUND_SECRET = process.env['POWER_AUTOMATE_INBOUND_SECRET'] ?? '';

interface InboundPayload {
  fromEmail: string;
  toEmail: string;
  subject: string;
  rawBody: string;
  powerAutomateRunId?: string;
}

export async function POST(req: NextRequest) {
  // Verify shared secret (skip if not configured in dev)
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

  // Parsing will be handled asynchronously in Phase 3 (approval batches, KNET ARNs, etc.).
  // For now, just log the inbound.
  console.log(
    `[inbound email] id=${record.id} from=${payload.fromEmail} subject="${payload.subject}"`,
  );

  return NextResponse.json({ ok: true, id: record.id });
}

export function GET() {
  return NextResponse.json({
    status: 'Power Automate inbound webhook is active',
    timestamp: new Date().toISOString(),
  });
}
