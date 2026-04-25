'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addCaseNoteAction, updateCaseStatusAction, deleteCaseAction } from '@/app/actions/cases';
import { Button } from '@/components/ui/button';
import { ComponentStatusBadge } from '@/components/ui/case-status-badge';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime, formatMoney, relativeTime } from '@/lib/format';
import {
  User as UserIcon,
  Package,
  MessageSquare,
  Activity as ActivityIcon,
  Send,
  AtSign,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { CustomerHistory } from './customer-history';
import { CaseStatusStepper, type CaseStatus } from '@/components/ui/case-status-stepper';
import { PaymentMethodIcons } from '@/components/ui/payment-method-icons';

type CaseData = {
  id: string;
  caseNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  customerNotes: string | null;
  orderNumber: string;
  orderDate: string;
  orderAmount: number;
  orderCurrency: string;
  totalRefundAmount: number;
  isPartial: boolean;
  auraPoints: number | null;
  auraStatus: string;
  rootCause: string | null;
  rootCauseNotes: string | null;
  brandName: string;
  countryName: string;
  countryFlag: string;
  branchName: string | null;
  createdBy: { id: string; name: string } | null;
  assignedTo: { id: string; name: string } | null;
  approvedBy: { id: string; name: string } | null;
  approvedAt: string | null;
};

type Component = {
  id: string;
  paymentMethodKey: string;
  paymentMethodLabel: string;
  amount: number;
  currency: string;
  authCode: string | null;
  last4: string | null;
  arn: string | null;
  status: string;
};

type Note = {
  id: string;
  body: string;
  authorName: string;
  authorId: string;
  createdAt: string;
  mentionNames: string[];
};

type Activity = {
  id: string;
  kind: string;
  message: string;
  actorLabel: string | null;
  createdAt: string;
};

type Mentionable = { id: string; name: string; email: string };

const TABS = [
  { key: 'overview', label: 'Overview', icon: UserIcon },
  { key: 'components', label: 'Components', icon: Package },
  { key: 'notes', label: 'Notes', icon: MessageSquare },
  { key: 'activity', label: 'Activity', icon: ActivityIcon },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function CaseTabs({
  locale,
  caseData,
  components,
  notes,
  activity,
  mentionableUsers,
  currentUserId,
  canApprove: canUserApprove,
  isDeleted = false,
}: {
  locale: string;
  caseData: CaseData;
  components: Component[];
  notes: Note[];
  activity: Activity[];
  mentionableUsers: Mentionable[];
  currentUserId: string;
  canApprove: boolean;
  isDeleted?: boolean;
}) {
  const [active, setActive] = useState<TabKey>('overview');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Notification deep-links point at `/cases/{id}#note-{noteId}`. The anchor
  // target only exists once the Notes tab is active, so on mount (and on
  // hash changes) switch to Notes if the hash is a note anchor, then let
  // the browser scroll once the element is painted.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function syncTabFromHash() {
      const hash = window.location.hash;
      if (hash.startsWith('#note-')) {
        setActive('notes');
        // Defer the scroll until after the tab content is rendered.
        requestAnimationFrame(() => {
          const el = document.getElementById(hash.slice(1));
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    }
    syncTabFromHash();
    window.addEventListener('hashchange', syncTabFromHash);
    return () => window.removeEventListener('hashchange', syncTabFromHash);
  }, []);

  function transitionStatus(target: string, reason?: string) {
    startTransition(async () => {
      const result = await updateCaseStatusAction({
        caseId: caseData.id,
        target,
        reason,
      });
      if (result.ok) {
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  function deleteCase() {
    const reason = window.prompt('Reason for deleting this case?');
    if (!reason || reason.trim().length < 3) return;
    startTransition(async () => {
      const result = await deleteCaseAction({ caseId: caseData.id, reason: reason.trim() });
      if (result.ok) {
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  const canSubmit = !isDeleted && caseData.status === 'DRAFT';
  const isPendingApproval = !isDeleted && caseData.status === 'PENDING_APPROVAL';
  const canStartExecution = !isDeleted && caseData.status === 'APPROVED';
  const canMarkRefunded =
    !isDeleted &&
    (caseData.status === 'IN_EXECUTION' || caseData.status === 'PARTIALLY_REFUNDED');
  const canDelete =
    !isDeleted &&
    caseData.status !== 'REFUNDED' &&
    caseData.status !== 'PARTIALLY_REFUNDED' &&
    caseData.status !== 'REJECTED' &&
    caseData.status !== 'CANCELLED';

  const showActionBar =
    canSubmit || isPendingApproval || canStartExecution || canMarkRefunded || canDelete;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
      <div className="space-y-4 lg:order-1 lg:col-start-1">
        {/* Action bar */}
        {showActionBar && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2.5 shadow-sm">
            {canSubmit && (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => transitionStatus('PENDING_APPROVAL')}
              >
                <Send className="h-4 w-4" />
                Submit for approval
              </Button>
            )}
            {isPendingApproval && canUserApprove && (
              <Button
                size="sm"
                variant="success"
                disabled={isPending}
                onClick={() => transitionStatus('APPROVED')}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
            )}
            {isPendingApproval && !canUserApprove && (
              <span className="rounded-md bg-surface-subtle/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                Waiting for country manager approval
              </span>
            )}
            {canStartExecution && (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => transitionStatus('IN_EXECUTION')}
              >
                Start execution
              </Button>
            )}
            {canMarkRefunded && (
              <Button
                size="sm"
                variant="success"
                disabled={isPending}
                onClick={() => transitionStatus('REFUNDED')}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark refunded
              </Button>
            )}
            <div className="ms-auto" />
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={deleteCase}
                className="text-destructive hover:bg-destructive/5 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete case
              </Button>
            )}
          </div>
        )}
        {isDeleted && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Trash2 className="h-4 w-4" />
            This case has been deleted. It is read-only and preserved for audit.
          </div>
        )}

        {/* Tab bar */}
        <div className="flex border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.key === 'notes' && notes.length > 0 && (
                <span className="rounded-full bg-surface-subtle px-1.5 py-0.5 text-xs">
                  {notes.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

        {active === 'overview' && (
          <OverviewTab caseData={caseData} components={components} locale={locale} />
        )}
        {active === 'components' && <ComponentsTab components={components} />}
        {active === 'notes' && (
          <NotesTab
            caseId={caseData.id}
            notes={notes}
            mentionableUsers={mentionableUsers}
            currentUserId={currentUserId}
            isDeleted={isDeleted}
          />
        )}
        {active === 'activity' && <ActivityTab activity={activity} />}
      </div>

      {/* Right rail: vertical status stepper */}
      <aside className="lg:order-2 lg:col-start-2">
        <div className="lg:sticky lg:top-24">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Progress
          </div>
          <CaseStatusStepper
            status={caseData.status as CaseStatus}
            locale={locale}
            deleted={isDeleted}
          />
        </div>
      </aside>
    </div>
  );
}

function OverviewTab({
  caseData,
  components,
  locale,
}: {
  caseData: CaseData;
  components: Component[];
  locale: string;
}) {
  const paymentMethods = components.map((c) => ({
    key: c.paymentMethodKey,
    label: c.paymentMethodLabel,
  }));
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <Section title="Customer">
          <Field label="Name" value={caseData.customerName} />
          <Field label="Email" value={caseData.customerEmail} />
          <Field label="Phone" value={caseData.customerPhone ?? '—'} />
          {caseData.customerNotes && <Field label="Notes" value={caseData.customerNotes} />}
        </Section>

        <Section title="Order">
          <Field label="Order #" value={<span className="font-mono">{caseData.orderNumber}</span>} />
          <Field label="Order date" value={formatDate(caseData.orderDate)} />
          <Field
            label="Order amount"
            value={<span className="font-mono">{formatMoney(caseData.orderAmount, caseData.orderCurrency)}</span>}
          />
          <Field
            label="Refund amount"
            value={
              <span className="font-mono">
                {formatMoney(caseData.totalRefundAmount, caseData.orderCurrency)}
                {caseData.isPartial && (
                  <span className="ms-2 text-xs font-normal text-muted-foreground">(partial)</span>
                )}
              </span>
            }
          />
          {paymentMethods.length > 0 && (
            <Field
              label="Payment"
              value={<PaymentMethodIcons methods={paymentMethods} size="sm" />}
            />
          )}
          <Field label="Brand · Country" value={`${caseData.brandName} · ${caseData.countryFlag} ${caseData.countryName}`} />
          {caseData.branchName && <Field label="Branch" value={caseData.branchName} />}
        </Section>

        {caseData.auraPoints ? (
          <Section title="Aura points (sidecar)">
            <Field label="Points" value={caseData.auraPoints.toLocaleString()} />
            <Field label="Aura status" value={caseData.auraStatus} />
          </Section>
        ) : null}

        {(caseData.rootCause || caseData.rootCauseNotes) && (
          <Section title="Root cause">
            {caseData.rootCause && <Field label="Category" value={caseData.rootCause} />}
            {caseData.rootCauseNotes && <Field label="Notes" value={caseData.rootCauseNotes} />}
          </Section>
        )}
      </div>

      <div className="space-y-4">
        <Section title="People">
          <Field label="Created by" value={caseData.createdBy?.name ?? '—'} />
          <Field label="Assigned to" value={caseData.assignedTo?.name ?? 'Unassigned'} />
          <Field label="Approved by" value={caseData.approvedBy?.name ?? '—'} />
          {caseData.approvedAt && <Field label="Approved at" value={formatDateTime(caseData.approvedAt)} />}
        </Section>

        <CustomerHistory
          locale={locale}
          customerEmail={caseData.customerEmail}
          excludeCaseId={caseData.id}
        />
      </div>
    </div>
  );
}

function ComponentsTab({ components }: { components: Component[] }) {
  if (components.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No payment components on this case.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-subtle text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-start font-medium">Payment method</th>
            <th className="px-4 py-2 text-end font-medium">Amount</th>
            <th className="px-4 py-2 text-start font-medium">Auth code</th>
            <th className="px-4 py-2 text-start font-medium">Last 4</th>
            <th className="px-4 py-2 text-start font-medium">ARN</th>
            <th className="px-4 py-2 text-start font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {components.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <PaymentMethodIcons
                    methods={[{ key: c.paymentMethodKey, label: c.paymentMethodLabel }]}
                    size="md"
                  />
                  <span className="text-sm font-medium">{c.paymentMethodLabel}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-end font-mono">
                {formatMoney(c.amount, c.currency)}
              </td>
              <td className="px-4 py-3 font-mono text-xs">{c.authCode ?? '—'}</td>
              <td className="px-4 py-3 font-mono text-xs">{c.last4 ? `•••• ${c.last4}` : '—'}</td>
              <td className="px-4 py-3 font-mono text-xs">{c.arn ?? '—'}</td>
              <td className="px-4 py-3">
                <ComponentStatusBadge status={c.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesTab({
  caseId,
  notes,
  mentionableUsers,
  currentUserId,
  isDeleted = false,
}: {
  caseId: string;
  notes: Note[];
  mentionableUsers: Mentionable[];
  currentUserId: string;
  isDeleted?: boolean;
}) {
  const [body, setBody] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const mentionedUsers = mentionableUsers.filter((u) => mentionIds.includes(u.id));

  function toggleMention(userId: string) {
    setMentionIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await addCaseNoteAction({
        caseId,
        body: body.trim(),
        mentionedUserIds: mentionIds,
      });
      if (result.ok) {
        setBody('');
        setMentionIds([]);
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {!isDeleted && (
      <form
        onSubmit={submit}
        className="rounded-md border border-border bg-surface p-3 space-y-2"
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[96px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Write a note… use @ to mention teammates"
          maxLength={4000}
        />

        {mentionedUsers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mentionedUsers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
              >
                @{u.name}
                <button
                  type="button"
                  onClick={() => toggleMention(u.id)}
                  className="ms-1 text-primary/60 hover:text-primary"
                  aria-label="Remove mention"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPicker((v) => !v)}
            >
              <AtSign className="h-4 w-4" />
              Mention
            </Button>
            {showPicker && (
              <div className="absolute bottom-full start-0 z-10 mb-2 max-h-64 w-72 overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-lg">
                {mentionableUsers.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No active users.</div>
                ) : (
                  mentionableUsers.map((u) => {
                    const selected = mentionIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleMention(u.id)}
                        className={cn(
                          'flex w-full items-center justify-between rounded px-2 py-1.5 text-start text-sm hover:bg-surface-subtle',
                          selected && 'bg-primary/10 text-primary',
                        )}
                      >
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                        {selected && <CheckCircle2 className="h-4 w-4" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
            <Send className="h-4 w-4" />
            {isPending ? 'Posting…' : 'Post note'}
          </Button>
        </div>
      </form>
      )}

      {notes.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No notes yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li
              key={n.id}
              id={`note-${n.id}`}
              className="rounded-md border border-border bg-surface p-3"
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <div className="font-medium text-foreground">
                  {n.authorName}
                  {n.authorId === currentUserId && (
                    <span className="ms-1 text-muted-foreground">(you)</span>
                  )}
                </div>
                <span className="text-muted-foreground" title={formatDateTime(n.createdAt)}>
                  {relativeTime(n.createdAt)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{n.body}</p>
              {n.mentionNames.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
                  <span>Mentioned:</span>
                  {n.mentionNames.map((m) => (
                    <span key={m} className="text-primary">
                      @{m}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityTab({ activity }: { activity: Activity[] }) {
  if (activity.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {activity.map((a) => (
        <li key={a.id} className="flex gap-3">
          <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary/50" />
          <div className="flex-1 rounded-md border border-border bg-surface p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted-foreground">{a.kind}</span>
              <span className="text-muted-foreground" title={formatDateTime(a.createdAt)}>
                {relativeTime(a.createdAt)}
              </span>
            </div>
            <div className="mt-1 text-sm">
              {a.actorLabel && <span className="font-medium">{a.actorLabel} </span>}
              <span>{a.message}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <dl className="divide-y divide-border">{children}</dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 px-4 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
