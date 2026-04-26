'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { allocatePromoAction, loadCustomerPromoHistoryAction } from '@/app/actions/promo';
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
import { AlertTriangle, Check, History, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

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

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

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

  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [reason, setReason] = useState('');
  const [fraudAck, setFraudAck] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ code: string } | null>(null);
  const [lookup, setLookup] = useState<LookupState>({
    loading: false,
    email: null,
    recentCount: 0,
    totalCount: 0,
    history: [],
  });
  // Monotonic counter so a stale in-flight history request (e.g. from a
  // previous email) can never overwrite the current customer's data.
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

  // Debounced history lookup when the email changes. Uses a generation
  // counter so stale in-flight responses for a previous email can never
  // overwrite the current lookup state.
  useEffect(() => {
    const trimmed = customerEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      lookupGenRef.current += 1;
      setLookup({ loading: false, email: null, recentCount: 0, totalCount: 0, history: [] });
      setFraudAck(false);
      return;
    }
    if (lookup.email === trimmed) return;

    const gen = ++lookupGenRef.current;
    // Any change of email invalidates a previous acknowledgment + any
    // stale history data. Clear fully rather than spreading so the panel
    // can't briefly show the previous customer's fraud flags.
    setFraudAck(false);
    setLookup({ loading: true, email: null, recentCount: 0, totalCount: 0, history: [] });
    const handle = setTimeout(async () => {
      try {
        const res = await loadCustomerPromoHistoryAction(trimmed);
        // Discard the response if the user typed another email in the meantime.
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
        reason: reason.trim() || undefined,
        fraudSignalAcknowledged: fraudAck,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess({ code: result.data!.code });
      // Reset transient form state but keep pool + type for quick repeats
      setCustomerEmail('');
      setCustomerName('');
      setReason('');
      setFraudAck(false);
      setLookup({ loading: false, email: null, recentCount: 0, totalCount: 0, history: [] });
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-border bg-card p-5">
      {/* Type toggle */}
      <div className="space-y-1.5">
        <Label>Promo type</Label>
        <div className="flex gap-2">
          <TypeChip
            active={type === 'CUSTOMER_COMPENSATION'}
            onClick={() => setType('CUSTOMER_COMPENSATION')}
            label="Customer compensation"
            hint="Fixed value · emailed to customer"
          />
          <TypeChip
            active={type === 'SERVICE_RECOVERY'}
            onClick={() => setType('SERVICE_RECOVERY')}
            label="Service recovery"
            hint="Internal only · never emailed"
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

      {/* Pool selection */}
      {brandId && (
        <div className="space-y-2">
          <Label>
            Pool <span className="text-muted-foreground">(value · stock)</span>
          </Label>
          {matchingPools.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pools configured for this combination.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
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
                      'flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition',
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-foreground/20',
                      out && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    <span className="font-mono text-heading">{formatMoney(p.value, p.currency)}</span>
                    <span
                      className={cn(
                        'text-xs tabular-nums',
                        out
                          ? 'text-red-600 dark:text-red-400'
                          : low
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground',
                      )}
                    >
                      {out ? 'Out of stock' : low ? `Low · ${p.available}` : `${p.available} left`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="email">Customer email</Label>
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
          <Label htmlFor="name">
            Customer name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Ahmed Al-Sabah"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">
          Reason / notes <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Delayed order goodwill"
        />
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
      {success && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertTitle>Promo allocated</AlertTitle>
          <AlertDescription>
            Code <span className="font-mono font-medium">{success.code}</span> has been assigned
            {type === 'CUSTOMER_COMPENSATION'
              ? ' and queued for email delivery.'
              : ' for internal use.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {selectedPool
            ? `Selected pool · ${selectedPool.available} code(s) available`
            : 'Pick a pool to continue'}
        </p>
        <Button type="submit" disabled={!canSubmit}>
          <Gift className="mr-2 h-4 w-4" />
          {isPending ? 'Allocating…' : 'Allocate promo'}
        </Button>
      </div>
    </form>
  );
}

function TypeChip({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-md border px-3 py-2 text-left text-sm transition',
        active
          ? 'border-primary bg-primary/5 text-heading'
          : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-heading',
      )}
    >
      <div className="font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{hint}</div>
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
        needsAck
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-border bg-muted/30',
      )}
    >
      <div className="flex items-center gap-2 text-heading">
        <History className="h-4 w-4" />
        <span className="font-medium">Promo history for this customer</span>
        {lookup.loading && <span className="text-xs text-muted-foreground">loading…</span>}
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
                {formatMoney(h.value, h.currency)}
                <span className="ml-1 text-[10px] uppercase tracking-wide">
                  {h.type === 'CUSTOMER_COMPENSATION' ? 'compensation' : 'recovery'}
                </span>
              </span>
              <span className="font-mono tabular-nums">{formatDateTime(h.createdAt)}</span>
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
