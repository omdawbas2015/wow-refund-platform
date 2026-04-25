'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createCaseAction } from '@/app/actions/cases';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Check } from 'lucide-react';
import Link from 'next/link';
import { PaymentBrand } from '@/components/ui/payment-method-icons';
import { cn } from '@/lib/utils';

type Country = { id: string; code: string; name: string; flag: string; currency: string };
type Brand = { id: string; name: string };
type PaymentMethod = { id: string; key: string; label: string; requiresAuthCode: boolean };
type RootCause = { id: string; name: string };

export function NewCaseForm({
  locale,
  countries,
  brands,
  paymentMethods,
  rootCauses,
}: {
  locale: string;
  countries: Country[];
  brands: Brand[];
  paymentMethods: PaymentMethod[];
  rootCauses: RootCause[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [countryId, setCountryId] = useState(countries[0]?.id ?? '');
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [orderAmount, setOrderAmount] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [rootCauseId, setRootCauseId] = useState('');
  const [rootCauseNotes, setRootCauseNotes] = useState('');
  const [auraPoints, setAuraPoints] = useState('');

  // Single payment method per case. No card numbers — the agent only
  // records the network the customer used (Visa / Mastercard / KNET / …).
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [authCode, setAuthCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ caseNumber: string; id: string } | null>(null);

  const country = countries.find((c) => c.id === countryId);
  const currency = country?.currency ?? 'USD';

  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const refundNum = Number(refundAmount) || 0;
  const orderNum = Number(orderAmount) || 0;
  const exceedsOrder = refundNum > orderNum + 0.001;

  async function submit(acknowledgeDuplicate = false) {
    setError(null);
    // Always clear any prior duplicate alert; the server response is the
    // source of truth and will re-populate it if the conflict still stands.
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
      setError('Refund amount must be greater than zero.');
      return;
    }

    const payload = {
      countryId,
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
      auraPoints: auraPoints ? Number(auraPoints) : undefined,
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
      className="space-y-6"
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

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <select
            id="country"
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
            required
          >
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="brand">Brand</Label>
          <select
            id="brand"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
            required
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </section>

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

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h3 className="text-heading-sm text-heading">Payment method</h3>
          <p className="text-xs text-muted-foreground">
            Pick the network the customer tapped — one per case.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Payment method"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5"
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
                  'relative flex h-16 flex-col items-center justify-center gap-1.5 rounded-md border bg-surface px-3 text-xs transition-colors',
                  selected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-heading/30',
                )}
              >
                <PaymentBrand brandKey={m.key} size="md" />
                <span className="font-medium text-heading">{m.label}</span>
                {selected && (
                  <span className="absolute end-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="refundAmount">Refund amount ({currency})</Label>
            <Input
              id="refundAmount"
              type="number"
              step="0.001"
              min="0"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              required
            />
            {exceedsOrder && (
              <p className="text-xs text-destructive">Refund exceeds the order amount.</p>
            )}
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
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-heading-sm text-heading">
          Aura points{' '}
          <span className="text-sm font-normal text-muted-foreground">
            (optional sidecar, not a payment method)
          </span>
        </h3>
        <div className="space-y-1.5">
          <Label htmlFor="auraPoints">Points</Label>
          <Input
            id="auraPoints"
            type="number"
            min="0"
            step="1"
            value={auraPoints}
            onChange={(e) => setAuraPoints(e.target.value)}
            placeholder="0"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-heading-sm text-heading">Root cause</h3>
        <div className="space-y-1.5">
          <Label htmlFor="rootCause">Category</Label>
          <select
            id="rootCause"
            value={rootCauseId}
            onChange={(e) => setRootCauseId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
          >
            <option value="">Select…</option>
            {rootCauses.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rootCauseNotes">Notes</Label>
          <textarea
            id="rootCauseNotes"
            value={rootCauseNotes}
            onChange={(e) => setRootCauseNotes(e.target.value)}
            className="flex min-h-[90px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            placeholder="Anything useful for the approver…"
            maxLength={2000}
          />
        </div>
      </section>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/${locale}/cases`)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || exceedsOrder}>
          {isPending ? 'Creating…' : 'Create case'}
        </Button>
      </div>
    </form>
  );
}
