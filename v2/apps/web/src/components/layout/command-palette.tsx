'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Gift,
  Store,
  BarChart3,
  Users,
  ClipboardList,
  Globe,
  Settings,
  Mail,
  Tag,
  AlertTriangle,
  History,
  Timer,
  ShieldAlert,
  Activity,
  CalendarClock,
  Plus,
  CheckCircle2,
  Send,
  Sparkles,
  Search as SearchIcon,
  type LucideIcon,
} from 'lucide-react';

type ActionItem = {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigate' | 'Cases' | 'Operations' | 'Promo' | 'Admin' | 'Help';
  icon: LucideIcon;
  href?: string;
  /** Roles that may see this action. Undefined = visible to everyone. */
  roles?: string[];
  keywords?: string[];
};

const ACTIONS: ActionItem[] = [
  // ---------- Navigate ----------
  { id: 'nav-dashboard', label: 'Go to Dashboard', group: 'Navigate', icon: LayoutDashboard, href: '/' },
  { id: 'nav-cases', label: 'Go to Cases', group: 'Navigate', icon: FileText, href: '/cases' },
  { id: 'nav-operations', label: 'Go to Refund Operations', group: 'Navigate', icon: ShieldCheck, href: '/operations' },
  { id: 'nav-promo', label: 'Go to Promo Codes', group: 'Navigate', icon: Gift, href: '/promo' },
  { id: 'nav-stores', label: 'Go to Stores Communication', group: 'Navigate', icon: Store, href: '/help-desk/stores' },
  { id: 'nav-reports', label: 'Go to Reports', group: 'Navigate', icon: BarChart3, href: '/reports' },
  { id: 'nav-changelog', label: 'Open Changelog', group: 'Navigate', icon: Sparkles, href: '/changelog' },

  // ---------- Cases ----------
  { id: 'case-create', label: 'Create refund case', hint: 'New case', group: 'Cases', icon: Plus, href: '/cases/new', keywords: ['new', 'case', 'refund'] },
  { id: 'case-search', label: 'Search refund cases', group: 'Cases', icon: SearchIcon, href: '/cases', keywords: ['find', 'case'] },
  { id: 'case-saved-views', label: 'Open saved case views', group: 'Cases', icon: ClipboardList, href: '/cases?savedViews=open', keywords: ['saved', 'filters'] },

  // ---------- Operations ----------
  { id: 'ops-bulk', label: 'Bulk operations on cases', hint: 'Submit / Cancel / Reassign many', group: 'Operations', icon: ClipboardList, href: '/operations/bulk-cases', roles: ['ADMIN', 'MANAGER', 'AGENT'] },
  { id: 'ops-approval-batches', label: 'Approval batches', group: 'Operations', icon: ShieldCheck, href: '/operations/approvals' },
  { id: 'ops-knet', label: 'KNET batches', group: 'Operations', icon: Send, href: '/operations/knet' },
  { id: 'ops-aura', label: 'Aura batches', group: 'Operations', icon: Send, href: '/operations/aura' },

  // ---------- Promo ----------
  { id: 'promo-allocate', label: 'Allocate promo code', group: 'Promo', icon: Gift, href: '/promo/allocate', keywords: ['promo', 'allocate'] },
  { id: 'promo-pools', label: 'Browse promo pools', group: 'Promo', icon: Gift, href: '/promo' },

  // ---------- Admin ----------
  { id: 'admin-users', label: 'Manage users', group: 'Admin', icon: Users, href: '/admin/users', roles: ['ADMIN'] },
  { id: 'admin-pending', label: 'Pending user approvals', hint: 'Review sign-up requests', group: 'Admin', icon: CheckCircle2, href: '/admin/pending-approvals', roles: ['ADMIN'] },
  { id: 'admin-countries', label: 'Manage countries', group: 'Admin', icon: Globe, href: '/admin/countries', roles: ['ADMIN'] },
  { id: 'admin-brands', label: 'Manage brands', group: 'Admin', icon: Tag, href: '/admin/brands', roles: ['ADMIN'] },
  { id: 'admin-root-causes', label: 'Manage root causes', group: 'Admin', icon: AlertTriangle, href: '/admin/root-causes', roles: ['ADMIN'] },
  { id: 'admin-store-templates', label: 'Manage store templates', group: 'Admin', icon: Store, href: '/admin/store-templates', roles: ['ADMIN'] },
  { id: 'admin-email-templates', label: 'Email templates', group: 'Admin', icon: Mail, href: '/admin/email-templates', roles: ['ADMIN'] },
  { id: 'admin-email-log', label: 'Email log · Resend FAILED', group: 'Admin', icon: Mail, href: '/admin/email-log', roles: ['ADMIN'], keywords: ['resend', 'failed'] },
  { id: 'admin-audit-log', label: 'Audit log', group: 'Admin', icon: History, href: '/admin/audit-log', roles: ['ADMIN'] },
  { id: 'admin-sla', label: 'SLA rules', group: 'Admin', icon: Timer, href: '/admin/sla-rules', roles: ['ADMIN'] },
  { id: 'admin-fraud', label: 'Fraud signals', group: 'Admin', icon: ShieldAlert, href: '/admin/fraud-signals', roles: ['ADMIN'] },
  { id: 'admin-scheduled', label: 'Scheduled reports', hint: 'Cron-driven email summaries', group: 'Admin', icon: CalendarClock, href: '/admin/scheduled-reports', roles: ['ADMIN'] },
  { id: 'admin-cron', label: 'Cron status', group: 'Admin', icon: Activity, href: '/admin/cron-status', roles: ['ADMIN'] },
  { id: 'admin-settings', label: 'System settings', group: 'Admin', icon: Settings, href: '/admin/settings', roles: ['ADMIN'] },

  // ---------- Help ----------
  { id: 'help-shortcuts', label: 'Show keyboard shortcuts', hint: 'Press ?', group: 'Help', icon: Sparkles, keywords: ['help', 'shortcut'] },
  { id: 'help-changelog', label: 'See what\'s new', group: 'Help', icon: Sparkles, href: '/changelog' },
];

const GROUP_ORDER: ActionItem['group'][] = ['Navigate', 'Cases', 'Operations', 'Promo', 'Admin', 'Help'];

/**
 * Global ⌘K / Ctrl+K command palette. Action verbs first, navigation second.
 *
 * Mounted in the dashboard layout. Listens for the open hotkey window-wide
 * but skips opening when focus is in an editable element so people don't
 * lose their typed value mid-keystroke.
 */
export function CommandPalette({ role }: { role: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (!isCmdK) return;
      // Don't intercept when the user is mid-typing inside an input/textarea.
      const t = e.target;
      if (t instanceof HTMLElement) {
        if (t.isContentEditable) return;
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      }
      e.preventDefault();
      setOpen((v) => !v);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const visible = useMemo(
    () => ACTIONS.filter((a) => !a.roles || (role && a.roles.includes(role))),
    [role],
  );

  const grouped = useMemo(() => {
    const out = new Map<ActionItem['group'], ActionItem[]>();
    for (const g of GROUP_ORDER) out.set(g, []);
    for (const a of visible) out.get(a.group)?.push(a);
    return out;
  }, [visible]);

  function run(item: ActionItem) {
    setOpen(false);
    setSearch('');
    if (item.href) {
      router.push(item.href);
      return;
    }
    if (item.id === 'help-shortcuts') {
      // Keyboard shortcuts component listens for '?' on document.
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      >
        <Command shouldFilter className="cmdk-root">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search…"
              className="flex h-11 flex-1 bg-transparent py-3 text-sm text-heading outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded-md border border-border bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
              ESC
            </kbd>
          </div>
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matching command.
            </Command.Empty>
            {GROUP_ORDER.map((g) => {
              const items = grouped.get(g) ?? [];
              if (items.length === 0) return null;
              return (
                <Command.Group
                  key={g}
                  heading={g}
                  className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {items.map((item) => {
                    const Icon = item.icon;
                    const value = [
                      item.label,
                      item.hint ?? '',
                      (item.keywords ?? []).join(' '),
                    ]
                      .join(' ')
                      .toLowerCase();
                    return (
                      <Command.Item
                        key={item.id}
                        value={value}
                        onSelect={() => run(item)}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-heading data-[selected=true]:bg-primary/10 data-[selected=true]:text-heading"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.hint ? (
                          <span className="text-xs text-muted-foreground">{item.hint}</span>
                        ) : null}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              );
            })}
          </Command.List>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span>
              <kbd className="rounded border border-border bg-surface-subtle px-1 font-mono">↑</kbd>{' '}
              <kbd className="rounded border border-border bg-surface-subtle px-1 font-mono">↓</kbd> to
              navigate ·
              <kbd className="ms-1 rounded border border-border bg-surface-subtle px-1 font-mono">↵</kbd>{' '}
              to run
            </span>
            <span>
              <kbd className="rounded border border-border bg-surface-subtle px-1 font-mono">⌘K</kbd>
              <span className="ms-1">/</span>
              <kbd className="ms-1 rounded border border-border bg-surface-subtle px-1 font-mono">Ctrl K</kbd>
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}

