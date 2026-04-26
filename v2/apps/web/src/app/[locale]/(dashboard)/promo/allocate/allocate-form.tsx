'use client';

/**
 * Promo allocation form — agent-facing flow for issuing a customer
 * compensation code or a service-recovery code against a refund case.
 *
 * Design priorities:
 *   1. Case number is the most important input in the entire system, so it
 *      lives at the very top. Typing it triggers a debounced server lookup
 *      that resolves the underlying RefundCase and prefills the customer
 *      fields (name / email / phone) plus a reason hint. Every prefilled
 *      field stays editable so the agent can override before submitting if
 *      the case data is wrong or incomplete.
 *   2. Service-recovery never asks the agent to pick a tier — there's
 *      always exactly one pool per brand × country at 100% off.
 *   3. The post-allocation success state lives in a centered Dialog popup
 *      so it's clearly distinct from the form itself, surfaces the issued
 *      code prominently, and shows whether the code was emailed (compensation)
 *      or kept internal (recovery).
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  allocatePromoAction,
  loadCustomerPromoHistoryAction,
  lookupCaseByNumberAction,
} from '@/app/actions/promo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  Check,
  History,
  Gift,
  Shield,
  Mail,
  Copy,
  Sparkles,
  FileSearch,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPromoValue } from '@/lib/promo/format';

export type PoolOption = {
  id: string;
  brandId: string;
  brandName: string;
  countryId: string;
  countryName: string;
  countryFlag: string;
  type: 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY';
  value: number;
  currency: string;
  available: number;
};

type HistoryEntry = {
  id: string;
  code: string;
  brand: string;
  country: string;
  type: string;
  value: number;
  currency: string;
  emailedAt: Date | string | null;
  createdAt: Date | string;
};

type LookupState = {
  loading: boolean;
  email: string | null;
  recentCount: number;
  totalCount: number;
  history: HistoryEntry[];
};

type CaseMatch = {
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
};

type CaseLookupState =
  | { state: 'idle' }
  | { state: 'loading'; query: string }
  | { state: 'found'; query: string; match: CaseMatch }
  | { state: 'not_found'; query: string }
  | { state: 'error'; query: string };

function formatDateTime(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function AllocatePromoForm({ pools }: { pools: PoolOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY'>(
    'CUSTOMER_COMPENSATION',
  );
  const [countryId, setCountryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [poolId, setPoolId] = useState('');

  const [caseQuery, setCaseQuery] = useState('');
  const [caseLookup, setCaseLookup] = useState<CaseLookupState>({ state: 'idle' });
  const caseLookupGenRef = useRef(0);

  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [reason, setReason] = useState('');
  const [fraudAck, setFraudAck] = useState(false);

  const [error, setError] = useState<string | null>(null);
  // Capture the type at allocation time — the selector is still interactive
  // while the success dialog is visible, so reading the live `type` state
  // would flip the "emailed" vs "internal only" copy if the user clicked the
  // other card after a successful allocation.
  const [success, setSuccess] = useState<
    | {
        code: string;
        type: 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY';
        customerEmail: string;
        customerName: string | null;
        caseNumber: string | null;
      }
    | null
  >(null);
  const [lookup, setLookup] = useState<LookupState>({
    loading: false,
    email: null,
    recentCount: 0,
    totalCount: 0,
    history: [],
  });
  const lookupGenRef = useRef(0);

  const countries = useMemo(() => {
    const map = new Map<string, { id: string; name: string; flag: string }>();
    for (const p of pools) {
      if (!map.has(p.countryId))
        map.set(p.countryId, { id: p.countryId, name: p.countryName, flag: p.countryFlag });
    }
    return Array.from(map.values());
  }, [pools]);

  const brandsForCountry = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const p of pools) {
      if (p.countryId !== countryId) continue;
      if (!map.has(p.brandId)) map.set(p.brandId, { id: p.brandId, name: p.brandName });
    }
    return Array.from(map.values());
  }, [pools, countryId]);

  const matchingPools = useMemo(
    () =>
      pools
        .filter(
          (p) => p.countryId === countryId && p.brandId === brandId && p.type === type,
        )
        .sort((a, b) => a.value - b.value),
    [pools, countryId, brandId, type],
  );

  // Reset brand when country changes; reset pool when brand/country/type change.
  useEffect(() => {
    if (brandId && !brandsForCountry.some((b) => b.id === brandId)) {
      setBrandId('');
    }
  }, [brandsForCountry, brandId]);
  useEffect(() => {
    if (poolId && !matchingPools.some((p) => p.id === poolId)) {
      setPoolId('');
    }
  }, [matchingPools, poolId]);

  // Service-recovery has exactly one pool per brand×country (always 100% off),
  // so it's never useful to ask the user to pick a tier.
  useEffect(() => {
    if (type === 'SERVICE_RECOVERY' && matchingPools.length === 1 && !poolId) {
      setPoolId(matchingPools[0]!.id);
    }
  }, [type, matchingPools, poolId]);

  // Debounced case-number lookup. Resolves to a RefundCase, then prefills
  // customer fields. We only OVERWRITE fields the agent left empty (or that
  // still match the previous case's values) so a manual edit is never
  // silently wiped by a stale lookup.
  const lastAutoFilledRef = useRef<{
    email: string;
    name: string;
    phone: string;
    reason: string;
  } | null>(null);
  useEffect(() => {
    const trimmed = caseQuery.trim();
    if (trimmed.length < 3) {
      caseLookupGenRef.current += 1;
      setCaseLookup({ state: 'idle' });
      return;
    }
    const gen = ++caseLookupGenRef.current;
    setCaseLookup({ state: 'loading', query: trimmed });
    const handle = setTimeout(async () => {
      const res = await lookupCaseByNumberAction(trimmed);
      if (caseLookupGenRef.current !== gen) return;
      if (!res.ok) {
        setCaseLookup({ state: 'error', query: trimmed });
        return;
      }
      if (!res.data) {
        setCaseLookup({ state: 'not_found', query: trimmed });
        return;
      }
      const m = res.data;
      setCaseLookup({ state: 'found', query: trimmed, match: m });

      // Autofill: only overwrite a field if it's empty OR was filled by a
      // previous auto-fill (so the agent's manual edits are sticky).
      const prev = lastAutoFilledRef.current;
      setCustomerEmail((cur) => (!cur || cur === prev?.email ? m.customerEmail : cur));
      setCustomerName((cur) => (!cur || cur === prev?.name ? m.customerName : cur));
      setCustomerPhone((cur) =>
        !cur || cur === prev?.phone ? (m.customerPhone ?? '') : cur,
      );
      const suggestedReason = m.rootCauseLabel ?? '';
      setReason((cur) =>
        !cur || cur === prev?.reason ? suggestedReason : cur,
      );
      // Auto-set country/brand to the case's so the pool list narrows down.
      setCountryId((cur) => (cur === '' ? m.countryId : cur));
      setBrandId((cur) => (cur === '' ? m.brandId : cur));

      lastAutoFilledRef.current = {
        email: m.customerEmail,
        name: m.customerName,
        phone: m.customerPhone ?? '',
        reason: suggestedReason,
      };
    }, 350);
    return () => clearTimeout(handle);
  }, [caseQuery]);

  // Debounced fraud-history lookup whenever the customer email changes.
  useEffect(() => {
    const trimmed = customerEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      lookupGenRef.current += 1;
      setLookup({ loading: false, email: null, recentCount: 0, totalCount: 0, history: [] });
      return;
    }
    if (lookup.email === trimmed) return;

    const gen = ++lookupGenRef.current;
    setFraudAck(false);
    setLookup({ loading: true, email: null, recentCount: 0, totalCount: 0, history: [] });
    const handle = setTimeout(async () => {
      try {
        const res = await loadCustomerPromoHistoryAction(trimmed);
        if (lookupGenRef.current !== gen) return;
        setLookup({
          loading: false,
          email: trimmed,
          recentCount: res.recentCount,
          totalCount: res.totalCount,
          history: res.history,
        });
      } catch {
        if (lookupGenRef.current !== gen) return;
        setLookup((s) => ({ ...s, loading: false }));
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [customerEmail, lookup.email]);

  const selectedPool = matchingPools.find((p) => p.id === poolId);
  const needsAck = lookup.recentCount > 0;
  const resolvedCaseId =
    caseLookup.state === 'found' ? caseLookup.match.id : undefined;
  const canSubmit =
    !!poolId &&
    !!customerEmail.trim() &&
    (selectedPool?.available ?? 0) > 0 &&
    (!needsAck || fraudAck) &&
    !isPending;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await allocatePromoAction({
        poolId,
        customerEmail: customerEmail.trim(),
        customerName: customerName.trim() || undefined,
        caseId: resolvedCaseId,
        reason: reason.trim() || undefined,
        fraudSignalAcknowledged: fraudAck,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const caseNumber =
        caseLookup.state === 'found'
          ? caseLookup.match.caseNumber
          : caseQuery.trim() || null;
      setSuccess({
        code: result.data!.code,
        type,
        customerEmail: customerEmail.trim(),
        customerName: customerName.trim() || null,
        caseNumber,
      });
      // Reset transient state but keep type/country/brand so the agent can
      // quickly issue another for the same brand-country with one click.
      setCaseQuery('');
      setCaseLookup({ state: 'idle' });
      setCustomerEmail('');
      setCustomerName('');
      setCustomerPhone('');
      setReason('');
      setFraudAck(false);
      setLookup({ loading: false, email: null, recentCount: 0, totalCount: 0, history: [] });
      lastAutoFilledRef.current = null;
      router.refresh();
    });
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-border bg-card p-5">
        {/* Case number is the single most important field — it's the link
            between this allocation and the originating refund case, and
            typing it auto-fills everything else. So it sits at the very
            top, in its own visually distinct panel. */}
        <CaseLookupPanel
          query={caseQuery}
          onQueryChange={setCaseQuery}
          state={caseLookup}
          onClear={() => {
            setCaseQuery('');
            setCaseLookup({ state: 'idle' });
            lastAutoFilledRef.current = null;
          }}
        />

        {/* Type toggle */}
        <div className="space-y-2">
          <Label>Promo type</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <TypeCard
              active={type === 'CUSTOMER_COMPENSATION'}
              onClick={() => setType('CUSTOMER_COMPENSATION')}
              Icon={Gift}
              label="Customer compensation"
              hint="Fixed value · emailed to customer"
              tone="blue"
            />
            <TypeCard
              active={type === 'SERVICE_RECOVERY'}
              onClick={() => setType('SERVICE_RECOVERY')}
              Icon={Shield}
              label="Service recovery"
              hint="Internal use only · never emailed"
              tone="emerald"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="country">Country</Label>
            <Select value={countryId} onValueChange={setCountryId}>
              <SelectTrigger id="country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="mr-2" aria-hidden>
                      {c.flag || '🌐'}
                    </span>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand">Brand</Label>
            <Select value={brandId} onValueChange={setBrandId} disabled={!countryId}>
              <SelectTrigger id="brand">
                <SelectValue placeholder={countryId ? 'Select brand' : 'Pick a country first'} />
              </SelectTrigger>
              <SelectContent>
                {brandsForCountry.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pool selection. Service-recovery is always 100% off and has a single
            pool per brand×country, so we render an auto-selected confirmation
            row instead of an unnecessary tier picker. */}
        {brandId && type === 'CUSTOMER_COMPENSATION' && (
          <div className="space-y-2">
            <Label>Promo value</Label>
            {matchingPools.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pools configured for this combination.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-3">
                {matchingPools.map((p) => {
                  const out = p.available === 0;
                  const low = p.available <= 3 && !out;
                  const selected = p.id === poolId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={out}
                      onClick={() => setPoolId(p.id)}
                      className={cn(
                        'group relative flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition',
                        selected
                          ? 'border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20'
                          : 'border-border bg-background hover:border-foreground/20',
                        out && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <span className="font-mono text-base font-semibold tabular-nums text-heading">
                        {formatPromoValue(p.type, p.value, p.currency)}
                      </span>
                      <span
                        className={cn(
                          'text-[11px] font-medium tabular-nums',
                          out
                            ? 'text-red-600 dark:text-red-400'
                            : low
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground',
                        )}
                      >
                        {out
                          ? 'Out of stock'
                          : low
                            ? `Low · ${p.available} left`
                            : `${p.available} available`}
                      </span>
                      {selected && (
                        <Check className="absolute right-2 top-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {brandId && type === 'SERVICE_RECOVERY' && matchingPools.length > 0 && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-4 py-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium text-heading">100% off recovery code</span>
                <span className="text-xs text-muted-foreground">· internal use only</span>
              </div>
              <span
                className={cn(
                  'rounded px-2 py-0.5 text-xs tabular-nums',
                  matchingPools[0]!.available === 0
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : matchingPools[0]!.available <= 3
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                )}
              >
                {matchingPools[0]!.available === 0
                  ? 'Out of stock'
                  : `${matchingPools[0]!.available} available`}
              </span>
            </div>
          </div>
        )}
        {brandId && type === 'SERVICE_RECOVERY' && matchingPools.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No service-recovery pool configured for this brand and country.
          </p>
        )}

        {/* Customer details — auto-filled from the case lookup when one
            resolves, but every field stays editable. */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <Label>Customer details</Label>
            {caseLookup.state === 'found' && (
              <span className="text-xs text-muted-foreground">
                Auto-filled from case ·{' '}
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => {
                    setCustomerEmail('');
                    setCustomerName('');
                    setCustomerPhone('');
                    setReason('');
                    lastAutoFilledRef.current = null;
                  }}
                >
                  reset
                </button>
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">
                Customer email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs text-muted-foreground">
                Customer name
              </Label>
              <Input
                id="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ahmed Al-Sabah"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs text-muted-foreground">
                Customer phone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+965 9999 9999"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason" className="text-xs text-muted-foreground">
                Reason / complaint
              </Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Delayed order goodwill"
              />
            </div>
          </div>
        </div>

        {/* Fraud signal panel */}
        {(lookup.loading || (lookup.email && lookup.totalCount > 0)) && (
          <FraudPanel
            lookup={lookup}
            acknowledged={fraudAck}
            onAcknowledge={setFraudAck}
            needsAck={needsAck}
          />
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Could not allocate</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {selectedPool
              ? `Pool selected · ${selectedPool.available} code(s) available`
              : 'Pick a pool to continue'}
          </p>
          <Button type="submit" disabled={!canSubmit} size="lg">
            {type === 'SERVICE_RECOVERY' ? (
              <Shield className="mr-2 h-4 w-4" />
            ) : (
              <Gift className="mr-2 h-4 w-4" />
            )}
            {isPending
              ? 'Allocating…'
              : type === 'SERVICE_RECOVERY'
                ? 'Issue recovery code'
                : 'Allocate promo'}
          </Button>
        </div>
      </form>

      {/* Success popup — distinct from the form so it's unmissable. */}
      <SuccessDialog
        success={success}
        onClose={() => setSuccess(null)}
      />
    </>
  );
}

/**
 * Top-of-form case-number lookup panel. When a match resolves, shows a
 * compact summary card with the case's customer + status so the agent can
 * confirm at a glance they're allocating against the right case.
 */
function CaseLookupPanel({
  query,
  onQueryChange,
  state,
  onClear,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  state: CaseLookupState;
  onClear: () => void;
}) {
  const accent =
    state.state === 'found'
      ? 'before:bg-emerald-500'
      : state.state === 'error'
        ? 'before:bg-red-500'
        : 'before:bg-blue-500';
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-blue-500/[0.04] via-card to-card p-4 shadow-sm sm:p-5',
        "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
        accent,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="hidden h-9 w-9 flex-none items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 sm:flex">
          <FileSearch className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <Label
                htmlFor="case-number"
                className="text-sm font-semibold text-heading"
              >
                Case number
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Auto-fills customer name, email, phone, and complaint reason.
              </p>
            </div>
            <InlineLookupStatus state={state} />
          </div>
          <div className="relative">
            <Input
              id="case-number"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="e.g. KW-2025-00042 or CRM-12345"
              className="h-11 pr-10 font-mono text-base tracking-wide"
              autoComplete="off"
              spellCheck={false}
            />
            {query && state.state !== 'loading' && (
              <button
                type="button"
                onClick={onClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-heading"
                aria-label="Clear case number"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {state.state === 'found' && <CaseFoundCard match={state.match} />}
          {state.state === 'error' && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Couldn't look up that case — try again in a moment.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Tiny chip on the right of the panel header that mirrors the lookup state.
 * Replaces the bulky 'not found' message block — a chip is enough signal,
 * and the customer fields below are obviously empty if there's no match.
 */
function InlineLookupStatus({ state }: { state: CaseLookupState }) {
  if (state.state === 'idle') return null;
  if (state.state === 'loading')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Searching…
      </span>
    );
  if (state.state === 'found')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="h-3 w-3" />
        Match found
      </span>
    );
  if (state.state === 'not_found')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
        No match
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Lookup failed
    </span>
  );
}

/** Compact "found case" summary card shown beneath the case-number input. */
function CaseFoundCard({ match }: { match: CaseMatch }) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-sm font-semibold text-heading">
          {match.caseNumber}
        </span>
        {match.externalCaseNumber && (
          <span className="text-xs text-muted-foreground">
            CRM <span className="font-mono">{match.externalCaseNumber}</span>
          </span>
        )}
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {match.status.replace(/_/g, ' ')}
        </span>
      </div>
      <div className="mt-1.5 text-sm font-medium text-heading">
        {match.customerName}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>{match.customerEmail}</span>
        {match.customerPhone && (
          <>
            <span aria-hidden>·</span>
            <span>{match.customerPhone}</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>
          {match.brandName} · {match.countryName}
        </span>
        {match.rootCauseLabel && (
          <>
            <span aria-hidden>·</span>
            <span className="italic">“{match.rootCauseLabel}”</span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Centered popup shown after a successful allocation. Highlights:
 *   - The issued code in a large mono block with a copy button
 *   - Whether the code was emailed to the customer (compensation) or kept
 *     internal (service recovery)
 *   - The linked case # and customer if present
 */
function SuccessDialog({
  success,
  onClose,
}: {
  success:
    | {
        code: string;
        type: 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY';
        customerEmail: string;
        customerName: string | null;
        caseNumber: string | null;
      }
    | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!success) setCopied(false);
  }, [success]);

  if (!success) return null;

  const isRecovery = success.type === 'SERVICE_RECOVERY';

  async function copy() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable in insecure contexts — code is still visible */
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        {/* Top accent banner */}
        <div
          className={cn(
            'flex items-center gap-3 px-6 pb-4 pt-6',
            isRecovery
              ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5'
              : 'bg-gradient-to-br from-blue-500/10 to-blue-500/5',
          )}
        >
          <div
            className={cn(
              'flex h-12 w-12 flex-none items-center justify-center rounded-full text-white shadow-lg',
              isRecovery
                ? 'bg-emerald-500 shadow-emerald-500/30'
                : 'bg-blue-500 shadow-blue-500/30',
            )}
          >
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogHeader className="flex-1 space-y-0.5">
            <DialogTitle>
              {isRecovery ? 'Recovery code issued' : 'Promo allocated'}
            </DialogTitle>
            <DialogDescription>
              {isRecovery ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                  <Shield className="h-3.5 w-3.5" /> Internal only — share this
                  code manually with the customer.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300">
                  <Mail className="h-3.5 w-3.5" /> Queued for email delivery to{' '}
                  <span className="font-medium">{success.customerEmail}</span>.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 pb-6">
          {/* The code itself */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Promo code</Label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <span className="flex-1 select-all font-mono text-base font-semibold tracking-wider text-heading">
                {success.code}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={copy}>
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-4 w-4" /> Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Allocation context */}
          <dl className="space-y-1.5 text-xs">
            {success.caseNumber && (
              <div className="flex items-center gap-2">
                <dt className="w-24 text-muted-foreground">Case #</dt>
                <dd className="font-mono text-heading">{success.caseNumber}</dd>
              </div>
            )}
            <div className="flex items-center gap-2">
              <dt className="w-24 text-muted-foreground">Customer</dt>
              <dd className="text-heading">
                {success.customerName ? `${success.customerName} · ` : ''}
                {success.customerEmail}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="w-24 text-muted-foreground">Delivery</dt>
              <dd>
                {isRecovery ? (
                  <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                    Not emailed (internal)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                    <Mail className="h-3 w-3" /> Email queued
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <DialogFooter className="border-t border-border bg-muted/20 px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onClose}>Allocate another</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeCard({
  active,
  onClick,
  label,
  hint,
  Icon,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone: 'blue' | 'emerald';
}) {
  const toneActive =
    tone === 'blue'
      ? 'border-blue-500/60 bg-blue-500/10 ring-1 ring-blue-500/20'
      : 'border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/20';
  const toneIconActive =
    tone === 'blue'
      ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30'
      : 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30';
  const toneIconIdle =
    tone === 'blue'
      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex items-start gap-3 rounded-lg border p-4 text-left transition',
        active
          ? toneActive
          : 'border-border bg-background hover:border-foreground/20',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 flex-none items-center justify-center rounded-md transition',
          active ? toneIconActive : toneIconIdle,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-0.5">
        <div className="text-sm font-semibold text-heading">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      {active && (
        <Check
          className={cn(
            'ml-auto h-4 w-4 flex-none',
            tone === 'blue'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-emerald-600 dark:text-emerald-400',
          )}
        />
      )}
    </button>
  );
}

function FraudPanel({
  lookup,
  acknowledged,
  onAcknowledge,
  needsAck,
}: {
  lookup: LookupState;
  acknowledged: boolean;
  onAcknowledge: (v: boolean) => void;
  needsAck: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 text-sm',
        needsAck ? 'border-amber-500/40 bg-amber-500/5' : 'border-border bg-muted/30',
      )}
    >
      <div className="flex items-center gap-2 text-heading">
        <History className="h-4 w-4" />
        <span className="font-medium">Promo history for this customer</span>
        {lookup.loading && (
          <span className="text-xs text-muted-foreground">loading…</span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {lookup.totalCount === 0
          ? 'No previous promos.'
          : `${lookup.totalCount} total promo(s) ever · ${lookup.recentCount} in the last 90 days.`}
      </p>
      {lookup.history.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {lookup.history.map((h) => (
            <li
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
            >
              <span>
                <span className="text-heading">{h.brand}</span> · {h.country} ·{' '}
                {formatPromoValue(
                  h.type as 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY',
                  h.value,
                  h.currency,
                )}
                <span className="ml-1 text-[10px] uppercase tracking-wide">
                  {h.type === 'CUSTOMER_COMPENSATION' ? 'compensation' : 'recovery'}
                </span>
              </span>
              <span className="font-mono tabular-nums">
                {formatDateTime(h.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {needsAck && (
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-heading">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledge(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I reviewed this customer's recent promo history and confirm this allocation is
            warranted.
          </span>
        </label>
      )}
    </div>
  );
}
