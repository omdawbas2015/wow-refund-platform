'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { createCaseAction } from '@/app/actions/cases';
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
import { AlertTriangle, Check, MinusCircle, Percent } from 'lucide-react';
import Link from 'next/link';
import { PaymentBrand } from '@/components/ui/payment-method-icons';
import { cn } from '@/lib/utils';

type Country = { id: string; code: string; name: string; flag: string; currency: string };
type Brand = { id: string; name: string };
type Branch = { id: string; countryId: string; name: string };
type PaymentMethod = { id: string; key: string; label: string; requiresAuthCode: boolean };
type RootCause = { id: string; name: string };

const NO_BRANCH = '__none__';

export function NewCaseForm({
  locale,
  countries,
  brands,
  branches,
  paymentMethods,
  rootCauses,
}: {
  locale: string;
  countries: Country[];
  brands: Brand[];
  branches: Branch[];
  paymentMethods: PaymentMethod[];
  rootCauses: RootCause[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [countryId, setCountryId] = useState(countries[0]?.id ?? '');
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [branchId, setBranchId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [orderAmount, setOrderAmount] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
  const [rootCauseId, setRootCauseId] = useState('');
  const [rootCauseNotes, setRootCauseNotes] = useState('');
  const [auraPoints, setAuraPoints] = useState('');
  const [includeAura, setIncludeAura] = useState(false);

  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [authCode, setAuthCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ caseNumber: string; id: string } | null>(null);

  const country = countries.find((c) => c.id === countryId);
  const currency = country?.currency ?? 'USD';

  const branchesForCountry = useMemo(
    () => branches.filter((b) => b.countryId === countryId),
    [branches, countryId],
  );

  // Reset branch when country changes (branches are scoped per-country)
  useEffect(() => {
    if (branchId && !branchesForCountry.some((b) => b.id === branchId)) {
      setBranchId('');
    }
  }, [branchesForCountry, branchId]);

  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const orderNum = Number(orderAmount) || 0;
  const refundNum = refundType === 'full' ? orderNum : (Number(refundAmount) || 0);
  const exceedsOrder = refundType === 'partial' && refundNum > orderNum + 0.001;

  async function submit(acknowledgeDuplicate = false) {
    setError(null);
    setDuplicate(null);

    if (!paymentMethodId) {
      setError('Pick the payment method the customer used.');
      return;
    }
    if (selectedMethod?.requiresAuthCode && !authCode.trim()) {
      setError(`${selectedMethod.label} requires an auth code.`);
      return;
    }
    if (refundNum <= 0) {
      setError(refundType === 'full'
        ? 'Enter the order amount first (it will be used as the refund amount).'
        : 'Refund amount must be greater than zero.');
      return;
    }

    const payload = {
      countryId,
      branchId: branchId || undefined,
      brandId,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim() || undefined,
      orderNumber: orderNumber.trim(),
      orderDate,
      orderAmount: orderNum,
      orderCurrency: currency,
      components: [
        {
          paymentMethodId,
          amount: refundNum,
          authCode: selectedMethod?.requiresAuthCode ? authCode.trim() : null,
        },
      ],
      auraPoints: includeAura ? (Number(auraPoints) || 0) : undefined,
      rootCauseId: rootCauseId || undefined,
      rootCauseNotes: rootCauseNotes.trim() || undefined,
      duplicateAcknowledged: acknowledgeDuplicate,
    };

    startTransition(async () => {
      const result = await createCaseAction(payload);
      if (result.ok) {
        router.push(`/${locale}/cases/${result.data!.id}`);
      } else if (result.duplicate) {
        setDuplicate(result.duplicate);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t create the case</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {duplicate && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>A case already exists for this order</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>
                Order <span className="font-mono">{orderNumber}</span> is already covered by case{' '}
                <Link
                  href={`/${locale}/cases/${duplicate.id}`}
                  className="font-mono font-medium text-primary hover:underline"
                >
                  {duplicate.caseNumber}
                </Link>
                .
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/${locale}/cases/${duplicate.id}`)}
                >
                  View existing case
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void submit(true)}
                >
                  Create anyway
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Country, Brand & Branch ── */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Select value={countryId} onValueChange={setCountryId}>
            <SelectTrigger id="country">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="me-1.5">{c.flag}</span>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand">Brand</Label>
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger id="brand">
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="branch">
            Branch <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Select
            value={branchId || NO_BRANCH}
            onValueChange={(v) => setBranchId(v === NO_BRANCH ? '' : v)}
            disabled={branchesForCountry.length === 0}
          >
            <SelectTrigger id="branch">
              <SelectValue
                placeholder={
                  branchesForCountry.length === 0
                    ? 'No branches configured for this country'
                    : 'Select branch'
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_BRANCH}>
                <span className="text-muted-foreground">No branch</span>
              </SelectItem>
              {branchesForCountry.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* ── Customer ── */}
      <section className="space-y-3">
        <h3 className="text-heading-sm text-heading">Customer</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="customerName">Full name</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customerEmail">Email</Label>
            <Input
              id="customerEmail"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="customerPhone">
              Phone <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="customerPhone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+965 5xxx xxxx"
            />
          </div>
        </div>
      </section>

      {/* ── Order ── */}
      <section className="space-y-3">
        <h3 className="text-heading-sm text-heading">Order</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="orderNumber">Order #</Label>
            <Input
              id="orderNumber"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              required
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="orderDate">Order date</Label>
            <Input
              id="orderDate"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="orderAmount">Order amount ({currency})</Label>
            <Input
              id="orderAmount"
              type="number"
              step="0.001"
              min="0"
              value={orderAmount}
              onChange={(e) => setOrderAmount(e.target.value)}
              required
            />
          </div>
        </div>
      </section>

      {/* ── Payment method ── */}
      <section className="space-y-4">
        <h3 className="text-heading-sm text-heading">Payment method</h3>

        <div
          role="radiogroup"
          aria-label="Payment method"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {paymentMethods.map((m) => {
            const selected = m.id === paymentMethodId;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPaymentMethodId(m.id)}
                className={cn(
                  'relative flex items-center gap-2 rounded-lg border bg-surface px-3 py-2.5 text-sm transition-all',
                  selected
                    ? 'border-primary shadow-sm ring-2 ring-primary/20'
                    : 'border-border hover:border-heading/30 hover:shadow-sm',
                )}
              >
                <PaymentBrand brandKey={m.key} size="sm" />
                <span className="font-medium text-heading">{m.label}</span>
                {selected && (
                  <span className="absolute end-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectedMethod?.requiresAuthCode && (
          <div className="space-y-1.5">
            <Label htmlFor="authCode">Auth code</Label>
            <Input
              id="authCode"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              required
              className="font-mono"
              placeholder="A12B34"
            />
            <p className="text-xs text-muted-foreground">
              Printed on the KNET receipt. Required for the batch.
            </p>
          </div>
        )}
      </section>

      {/* ── Aura Points (sidecar) ── */}
      <section className="space-y-3">
        <button
          type="button"
          onClick={() => {
            setIncludeAura(!includeAura);
            if (includeAura) setAuraPoints('');
          }}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-all',
            includeAura
              ? 'border-[#E6007E] bg-[#E6007E]/5 ring-2 ring-[#E6007E]/15'
              : 'border-border bg-surface hover:border-heading/30 hover:shadow-sm',
          )}
        >
          <PaymentBrand brandKey="AURA" size="md" />
          <div className="flex-1">
            <div className="text-sm font-medium text-heading">Aura Points</div>
            <div className="text-xs text-muted-foreground">
              Include loyalty points refund alongside the payment
            </div>
          </div>
          <div className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors',
            includeAura
              ? 'border-[#E6007E] bg-[#E6007E] text-white'
              : 'border-border',
          )}>
            {includeAura && <Check className="h-3 w-3" />}
          </div>
        </button>

        {includeAura && (
          <div className="ms-4 space-y-1.5 border-s-2 border-[#E6007E]/30 ps-4">
            <Label htmlFor="auraPoints">Points to refund</Label>
            <Input
              id="auraPoints"
              type="number"
              min="0"
              step="1"
              value={auraPoints}
              onChange={(e) => setAuraPoints(e.target.value)}
              placeholder="Enter points"
              required
            />
          </div>
        )}
      </section>

      {/* ── Refund ── */}
      <section className="space-y-3">
        <h3 className="text-heading-sm text-heading">Refund</h3>
        <div
          role="radiogroup"
          aria-label="Refund type"
          className="grid gap-3 sm:grid-cols-2"
        >
          <RefundTypeCard
            selected={refundType === 'full'}
            onClick={() => {
              setRefundType('full');
              setRefundAmount('');
            }}
            icon={<Check className="h-4 w-4" />}
            title="Full refund"
            description={
              orderNum > 0
                ? `Refund the entire order — ${orderNum.toFixed(3)} ${currency}`
                : 'Refund the entire order amount.'
            }
          />
          <RefundTypeCard
            selected={refundType === 'partial'}
            onClick={() => setRefundType('partial')}
            icon={<Percent className="h-4 w-4" />}
            title="Partial refund"
            description="Refund a specific amount up to the order total."
          />
        </div>

        {refundType === 'partial' && (
          <div className="rounded-lg border border-border bg-surface-subtle/40 p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="refundAmount">Refund amount ({currency})</Label>
                <Input
                  id="refundAmount"
                  type="number"
                  step="0.001"
                  min="0"
                  max={orderNum || undefined}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  required
                  placeholder={orderNum > 0 ? `Max ${orderNum.toFixed(3)}` : '0.000'}
                  className="bg-surface font-mono"
                />
              </div>
              {orderNum > 0 && (
                <div className="pb-2 text-xs text-muted-foreground">
                  of{' '}
                  <span className="font-mono font-medium text-heading">
                    {orderNum.toFixed(3)} {currency}
                  </span>
                </div>
              )}
            </div>
            {exceedsOrder && (
              <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
                <MinusCircle className="h-3 w-3" />
                Refund exceeds the order amount.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Root cause ── */}
      <section className="space-y-3">
        <h3 className="text-heading-sm text-heading">Root cause</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rootCause">Category</Label>
            <Select
              value={rootCauseId || '__none__'}
              onValueChange={(v) => setRootCauseId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger id="rootCause">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {rootCauses.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rootCauseNotes">Notes</Label>
            <textarea
              id="rootCauseNotes"
              value={rootCauseNotes}
              onChange={(e) => setRootCauseNotes(e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Anything useful for the approver..."
              maxLength={2000}
            />
          </div>
        </div>
      </section>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/${locale}/cases`)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || exceedsOrder}>
          {isPending ? 'Creating...' : 'Create case'}
        </Button>
      </div>
    </form>
  );
}

function RefundTypeCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'relative flex items-start gap-3 rounded-lg border bg-surface p-4 text-start transition-all',
        selected
          ? 'border-primary shadow-sm ring-2 ring-primary/20'
          : 'border-border hover:border-heading/30 hover:shadow-sm',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 items-center justify-center rounded-md',
          selected ? 'bg-primary/10 text-primary' : 'bg-surface-subtle text-muted-foreground',
        )}
      >
        {icon}
      </span>
      <div className="flex-1">
        <div className="font-medium text-heading">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      {selected && (
        <span className="absolute end-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}
    </button>
  );
}
