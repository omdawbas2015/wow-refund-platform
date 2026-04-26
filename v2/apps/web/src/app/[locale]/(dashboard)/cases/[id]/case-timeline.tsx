import { prisma } from '@wow/db';
import { formatDateTime } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  FilePlus,
  Send,
  RotateCcw,
  CircleDollarSign,
  Pencil,
  Activity,
} from 'lucide-react';

const ACTION_META: Record<string, { label: string; icon: typeof Activity; tint: string }> = {
  'case.created': { label: 'Case created', icon: FilePlus, tint: 'text-muted-foreground' },
  'case.submitted': { label: 'Submitted for approval', icon: Send, tint: 'text-primary' },
  'case.approved': { label: 'Approved', icon: CheckCircle2, tint: 'text-success' },
  'case.rejected': { label: 'Rejected', icon: XCircle, tint: 'text-destructive' },
  'case.cancelled': { label: 'Cancelled', icon: XCircle, tint: 'text-muted-foreground' },
  'case.note_added': { label: 'Note added', icon: Pencil, tint: 'text-muted-foreground' },
  'case.component_refunded': {
    label: 'Component marked refunded',
    icon: CircleDollarSign,
    tint: 'text-success',
  },
  'case.reopened': { label: 'Reopened', icon: RotateCcw, tint: 'text-warning' },
};

function metaFor(action: string) {
  return ACTION_META[action] ?? { label: action, icon: Activity, tint: 'text-muted-foreground' };
}

interface Props {
  caseId: string;
  localeFmt: string;
}

/**
 * Server component that renders the audit-log timeline for a single case.
 * Reads `auditLog` rows where (entityType='CASE', entityId=caseId) and
 * additionally surfaces note-add events stored on `case.notes`. We render
 * them inline rather than asking the user to open `/reports/audit`.
 */
export async function CaseTimeline({ caseId, localeFmt }: Props) {
  const entries = await prisma.auditLog.findMany({
    where: { entityType: 'CASE', entityId: caseId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      action: true,
      actorEmail: true,
      createdAt: true,
      afterData: true,
    },
  });

  if (entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No timeline entries yet — actions on this case will appear here.
      </div>
    );
  }

  return (
    <ol className="relative space-y-3 ps-5">
      {/* Vertical rail */}
      <span
        aria-hidden
        className="pointer-events-none absolute start-2 top-1.5 bottom-1.5 w-px bg-border"
      />
      {entries.map((entry) => {
        const meta = metaFor(entry.action);
        const Icon = meta.icon;
        const detail = renderDetail(entry.action, entry.afterData);
        return (
          <li key={entry.id} className="relative">
            <span
              aria-hidden
              className={`absolute -start-[18px] top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface ${meta.tint}`}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="text-sm">
              <span className="font-medium">{meta.label}</span>
              {detail ? <span className="text-muted-foreground"> · {detail}</span> : null}
            </div>
            <div className="text-xs text-muted-foreground">
              {entry.actorEmail} · {formatDateTime(entry.createdAt, localeFmt)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Pull a short human-friendly detail string out of the JSON-encoded payload.
 * We deliberately keep this terse — full JSON inspection lives on `/reports/audit`.
 */
function renderDetail(action: string, afterData: string | null): string | null {
  const after = safeParse(afterData);
  if (!after || typeof after !== 'object') return null;
  const a = after as Record<string, unknown>;

  if ((action === 'case.rejected' || action === 'case.cancelled') && 'reason' in a) {
    return String(a.reason ?? '') || null;
  }
  if (action === 'case.component_refunded' && 'paymentMethod' in a) {
    const parts: string[] = [];
    if (a['paymentMethod']) parts.push(String(a['paymentMethod']));
    if (a['amount'] != null) {
      parts.push(
        a['currency']
          ? `${String(a['amount'])} ${String(a['currency'])}`
          : String(a['amount']),
      );
    }
    return parts.join(' · ') || null;
  }
  return null;
}

function safeParse(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
