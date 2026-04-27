'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  ShieldCheck,
  Gift,
  BarChart3,
  Sparkles,
  ArrowRight,
  X,
  type LucideIcon,
} from 'lucide-react';

type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: 'Welcome to WOW Refund',
    description:
      'A 60-second tour of the main areas. You can skip any time — we will not show this again.',
    bullets: [
      'Use Ctrl/⌘ K from any screen to jump anywhere instantly.',
      'Press ? to see all keyboard shortcuts.',
      'Top-bar banner is where new releases announce themselves.',
    ],
    ctaLabel: 'Start tour',
    ctaHref: '#',
  },
  {
    icon: FileText,
    title: 'Refund cases',
    description:
      'Where every refund lives. Create new cases, track them through approval and execution, and inspect the full audit timeline.',
    bullets: [
      'Status flow: DRAFT → PENDING_APPROVAL → APPROVED → IN_EXECUTION → REFUNDED.',
      'Saved views remember your filters across sessions.',
      'Notes accept @mentions; the full activity log is on the Activity tab.',
    ],
    ctaLabel: 'Open Cases',
    ctaHref: '/cases',
  },
  {
    icon: ShieldCheck,
    title: 'Refund operations',
    description:
      'Approval batches, KNET batches, and Aura batches. Bulk operations on cases live here too.',
    bullets: [
      'Bulk multi-select lets you submit drafts, cancel, or reassign hundreds of cases at once.',
      'KNET batches export ready-to-send files and capture line-level ARNs back.',
      'Aura sidecar tracks pending → in batch → completed state.',
    ],
    ctaLabel: 'Open Operations',
    ctaHref: '/operations',
  },
  {
    icon: Gift,
    title: 'Promo codes',
    description:
      'Country-first pools with the recently-allocated ribbon and split history. Allocate to customers in two clicks.',
    bullets: [
      'Pools are organised by country, then split by type and value.',
      'Allocation success popup respects DESIGN.md — copy + share-ready.',
      'Fraud signals on the pool detail page surface suspicious patterns early.',
    ],
    ctaLabel: 'Open Promo Codes',
    ctaHref: '/promo',
  },
  {
    icon: BarChart3,
    title: 'Reports',
    description:
      'Cases, refunds, SLA, agents, countries, audit, and emails — each with filters and Excel export.',
    bullets: [
      'Schedule recurring email summaries from /admin/scheduled-reports.',
      'Excel exports keep the same filter context as the on-screen view.',
      'KPI sparklines on the dashboard summarise the last 14 days at a glance.',
    ],
    ctaLabel: 'Open Reports',
    ctaHref: '/reports',
  },
];

const STORAGE_KEY = 'onboarding-tour-completed-v1';

/**
 * First-login guided walkthrough across the main product areas. Renders a
 * dismissible modal with one slide per area; localStorage remembers
 * completion so we don't show it again. The "open this area" CTA actually
 * navigates so the user lands somewhere useful at the end.
 *
 * To re-trigger the tour, run in the browser console:
 *   localStorage.removeItem('onboarding-tour-completed-v1')
 */
export function OnboardingTour() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) setOpen(true);
    } catch {
      // localStorage unavailable — show tour once for the session.
      setOpen(true);
    }
  }, []);

  const step = useMemo(() => STEPS[stepIndex] ?? STEPS[0]!, [stepIndex]);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const finish = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* noop */
    }
    setOpen(false);
  };

  const next = () => {
    if (isLast) {
      finish();
      router.push(step.ctaHref);
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const goCta = () => {
    finish();
    if (step.ctaHref && step.ctaHref !== '#') {
      router.push(step.ctaHref);
    }
  };

  if (!open) return null;

  const Icon = step.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-heading">Quick tour</span>
            <span className="text-muted-foreground">
              · {stepIndex + 1} of {STEPS.length}
            </span>
          </div>
          <button
            type="button"
            aria-label="Skip tour"
            onClick={finish}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-heading"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <h2 id="onboarding-title" className="text-base font-semibold text-heading">
              {step.title}
            </h2>
          </div>

          <p className="text-sm text-body">{step.description}</p>

          {step.bullets.length > 0 ? (
            <ul className="space-y-1.5 text-sm text-body">
              {step.bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 pt-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex ? 'w-6 bg-primary' : 'w-1.5 bg-border'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-surface-subtle/40 px-5 py-3">
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-heading"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {!isFirst ? (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(i - 1, 0))}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-heading transition-colors hover:bg-surface-subtle"
              >
                Back
              </button>
            ) : null}
            {!isFirst && step.ctaHref !== '#' ? (
              <button
                type="button"
                onClick={goCta}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-heading transition-colors hover:bg-surface-subtle"
              >
                {step.ctaLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {isFirst ? step.ctaLabel : isLast ? 'Finish' : 'Next'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
