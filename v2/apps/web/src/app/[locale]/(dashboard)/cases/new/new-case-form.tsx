'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createCaseAction } from '@/app/actions/cases';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

type Country = { id: string; code: string; name: string; flag: string; currency: string };
type Brand = { id: string; name: string };
type PaymentMethod = { id: string; label: string; requiresAuthCode: boolean };
type RootCause = { id: string; name: string };

type ComponentRow = {
  paymentMethodId: string;
  amount: string;
  authCode: string;
  last4: string;
};

const empty: ComponentRow = { paymentMethodId: '', amount: '', authCode: '', last4: '' };

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
  const [rootCauseId, setRootCauseId] = useState('');
  const [rootCauseNotes, setRootCauseNotes] = useState('');
  const [auraPoints, setAuraPoints] = useState('');

  const [components, setComponents] = useState<ComponentRow[]>([{ ...empty }]);

  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ caseNumber: string; id: string } | null>(null);

  const country = countries.find((c) => c.id === countryId);
  const currency = country?.currency ?? 'USD';

  const totalRefund = components.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const orderAmountNum = Number(orderAmount) || 0;
  const exceedsOrder = totalRefund > orderAmountNum + 0.001;

  function updateComponent(idx: number, patch: Partial<ComponentRow>) {
    setComponents((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  async function submit(acknowledgeDuplicate = false) {
    setError(null);
    if (!acknowledgeDuplicate) setDuplicate(null);

    const payload = {
      countryId,
      brandId,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim() || undefined,
      orderNumber: orderNumber.trim(),
      orderDate,
      orderAmount: Number(orderAmount),
      orderCurrency: currency,
      components: components
        .filter((c) => c.paymentMethodId && Number(c.amount) > 0)
        .map((c) => ({
          paymentMethodId: c.paymentMethodId,
          amount: Number(c.amount),
          authCode: c.authCode.trim() || null,
          last4: c.last4.trim() || null,
        })),
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
            <Label htmlFor="orderAmount">
              Order amount ({currency})
            </Label>
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
        <div className="flex items-center justify-between">
          <h3 className="text-heading-sm text-heading">Refund components</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setComponents((prev) => [...prev, { ...empty }])}
          >
            <Plus className="h-4 w-4" />
            Add component
          </Button>
        </div>

        <div className="space-y-3">
          {components.map((c, idx) => {
            const pm = paymentMethods.find((p) => p.id === c.paymentMethodId);
            return (
              <div
                key={idx}
                className="grid gap-3 rounded-md border border-border bg-surface-subtle/30 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <div className="space-y-1.5">
                  <Label>Payment method</Label>
                  <select
                    value={c.paymentMethodId}
                    onChange={(e) => updateComponent(idx, { paymentMethodId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                    required
                  >
                    <option value="">Select…</option>
                    {paymentMethods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                        {p.requiresAuthCode ? ' · needs auth code' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Amount ({currency})</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={c.amount}
                    onChange={(e) => updateComponent(idx, { amount: e.target.value })}
                    required
                  />
                </div>

                {pm?.requiresAuthCode ? (
                  <div className="space-y-1.5">
                    <Label>Auth code</Label>
                    <Input
                      value={c.authCode}
                      onChange={(e) => updateComponent(idx, { authCode: e.target.value })}
                      required
                      className="font-mono"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>
                      Card last 4 <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      value={c.last4}
                      onChange={(e) => updateComponent(idx, { last4: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      className="font-mono"
                      maxLength={4}
                    />
                  </div>
                )}

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setComponents((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
                    }
                    disabled={components.length === 1}
                    aria-label="Remove component"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-md bg-surface-subtle/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Total refund</span>
          <span className={`font-mono font-medium ${exceedsOrder ? 'text-destructive' : ''}`}>
            {totalRefund.toFixed(3)} {currency}
            {exceedsOrder && <span className="ms-2 text-xs">exceeds order</span>}
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-heading-sm text-heading">
          Aura points <span className="text-sm font-normal text-muted-foreground">(optional sidecar, not a payment method)</span>
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
        <Button type="button" variant="ghost" onClick={() => router.push(`/${locale}/cases`)} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || exceedsOrder}>
          {isPending ? 'Creating…' : 'Create case'}
        </Button>
      </div>
    </form>
  );
}
