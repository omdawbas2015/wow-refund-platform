'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { createCaseAction, lookupCustomerAction } from '@/app/actions/cases';

interface CountryOption {
  id: string;
  code: string;
  name: string;
  currency: string;
  branches: Array<{ id: string; name: string }>;
}
interface BrandOption {
  id: string;
  name: string;
}
interface PaymentMethodOption {
  id: string;
  key: string;
  label: string;
  requiresAuthCode: boolean;
}
interface RootCauseOption {
  id: string;
  label: string;
}

interface ComponentRow {
  paymentMethodKey: string;
  amount: string;
  currency: string;
  authCode: string;
  last4: string;
}

function emptyComponent(currency: string, paymentMethodKey: string): ComponentRow {
  return { paymentMethodKey, amount: '', currency, authCode: '', last4: '' };
}

export function CaseForm(props: {
  countries: CountryOption[];
  brands: BrandOption[];
  paymentMethods: PaymentMethodOption[];
  rootCauses: RootCauseOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const defaultCountry = props.countries[0];
  const defaultBrand = props.brands[0];
  const defaultMethod = props.paymentMethods[0];
  const defaultCurrency = defaultCountry?.currency ?? 'USD';

  const [countryId, setCountryId] = useState<string>(defaultCountry?.id ?? '');
  const [brandId, setBrandId] = useState<string>(defaultBrand?.id ?? '');
  const [branchId, setBranchId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [orderAmount, setOrderAmount] = useState('');
  const [rootCauseId, setRootCauseId] = useState<string>('');
  const [rootCauseNotes, setRootCauseNotes] = useState('');
  const [auraPoints, setAuraPoints] = useState<string>('');

  const [components, setComponents] = useState<ComponentRow[]>(() => [
    emptyComponent(defaultCurrency, defaultMethod?.key ?? ''),
  ]);

  const [customerSuggestions, setCustomerSuggestions] = useState<
    Array<{ customerName: string; customerEmail: string; customerPhone: string | null; caseCount: number }>
  >([]);

  const country = useMemo(
    () => props.countries.find((c) => c.id === countryId),
    [props.countries, countryId],
  );
  const branches = country?.branches ?? [];
  const currency = country?.currency ?? defaultCurrency;

  // Keep every component row in sync with the active country's currency so
  // a user who switches country mid-form can't accidentally submit a case
  // with mixed currencies (e.g. orderCurrency=AED but a component=KWD).
  // Only newly added components used to inherit the new currency, leaving
  // existing rows stale.
  useEffect(() => {
    setComponents((prev) =>
      prev.every((c) => c.currency === currency)
        ? prev
        : prev.map((c) => ({ ...c, currency })),
    );
  }, [currency]);

  const totalComponents = components.reduce(
    (sum, c) => sum + (parseFloat(c.amount) || 0),
    0,
  );
  const orderAmountNum = parseFloat(orderAmount) || 0;
  const exceedsOrder = totalComponents > orderAmountNum && orderAmountNum > 0;

  function updateComponent(index: number, patch: Partial<ComponentRow>) {
    setComponents((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addComponent() {
    setComponents((prev) => [...prev, emptyComponent(currency, defaultMethod?.key ?? '')]);
  }

  function removeComponent(index: number) {
    setComponents((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function lookupCustomer(query: string) {
    if (query.trim().length < 3) {
      setCustomerSuggestions([]);
      return;
    }
    const result = await lookupCustomerAction(query);
    if (result.ok) {
      setCustomerSuggestions(result.data);
    }
  }

  function applySuggestion(s: { customerName: string; customerEmail: string; customerPhone: string | null }) {
    setCustomerName(s.customerName);
    setCustomerEmail(s.customerEmail);
    if (s.customerPhone) setCustomerPhone(s.customerPhone);
    setCustomerSuggestions([]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!countryId || !brandId) {
      toast.error('Country and brand are required');
      return;
    }
    if (components.length === 0 || components.some((c) => !c.paymentMethodKey || !c.amount)) {
      toast.error('Each component needs a payment method and amount');
      return;
    }
    // Auth-code requirement comes from the payment method's
    // `requiresAuthCode` flag (admin-configurable) rather than a hardcoded
    // `KNET` check. The auth-code input is rendered as required using the
    // same flag — the validation has to match or admins can configure a
    // method that the UI marks required but the form lets through.
    const methodByKey = new Map(props.paymentMethods.map((m) => [m.key, m]));
    const authMissing = components.some((c) => {
      const m = methodByKey.get(c.paymentMethodKey);
      return m?.requiresAuthCode && !c.authCode.trim();
    });
    if (authMissing) {
      toast.error('Some components require an auth code');
      return;
    }

    startTransition(async () => {
      const result = await createCaseAction({
        countryId,
        brandId,
        branchId: branchId || undefined,
        customerName,
        customerEmail,
        customerPhone: customerPhone || '',
        customerNotes: customerNotes || '',
        orderNumber,
        orderDate: new Date(orderDate),
        orderAmount: orderAmountNum,
        orderCurrency: currency,
        rootCauseId: rootCauseId || undefined,
        rootCauseNotes: rootCauseNotes || '',
        auraPoints: auraPoints ? parseInt(auraPoints, 10) : undefined,
        components: components.map((c) => ({
          paymentMethodKey: c.paymentMethodKey,
          amount: parseFloat(c.amount) || 0,
          currency: c.currency || currency,
          authCode: c.authCode || undefined,
          last4: c.last4 || '',
        })),
      });

      if (result.ok) {
        toast.success(`Case ${result.data.caseNumber} created`);
        router.push(`/cases/${result.data.caseId}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <FormField label="Country" id="countryId" required>
          <Select value={countryId} onValueChange={setCountryId}>
            <SelectTrigger id="countryId">
              <SelectValue placeholder="Choose country" />
            </SelectTrigger>
            <SelectContent>
              {props.countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Brand" id="brandId" required>
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger id="brandId">
              <SelectValue placeholder="Choose brand" />
            </SelectTrigger>
            <SelectContent>
              {props.brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {branches.length > 0 ? (
          <FormField label="Branch (optional)" id="branchId" className="sm:col-span-2">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger id="branchId">
                <SelectValue placeholder="No specific branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No specific branch</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}
      </section>

      {/* Customer */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-heading">Customer</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Customer name" id="customerName" required>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Email" id="customerEmail" required>
            <Input
              id="customerEmail"
              type="email"
              value={customerEmail}
              onChange={(e) => {
                setCustomerEmail(e.target.value);
                lookupCustomer(e.target.value);
              }}
              required
            />
          </FormField>
          <FormField label="Phone" id="customerPhone">
            <Input
              id="customerPhone"
              value={customerPhone}
              onChange={(e) => {
                setCustomerPhone(e.target.value);
                lookupCustomer(e.target.value);
              }}
            />
          </FormField>
          <FormField label="Customer notes" id="customerNotes" className="sm:col-span-2">
            <Textarea
              id="customerNotes"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={2}
            />
          </FormField>
        </div>

        {customerSuggestions.length > 0 ? (
          <div className="mt-2 rounded-md border border-border bg-surface-subtle p-2">
            <div className="mb-1 text-xs font-medium text-muted-foreground">
              Existing customers ({customerSuggestions.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {customerSuggestions.map((s) => (
                <button
                  key={s.customerEmail}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-xs hover:border-primary/50"
                >
                  <span className="font-medium">{s.customerName}</span>
                  <span className="ms-1 text-muted-foreground">· {s.customerEmail}</span>
                  <span className="ms-1 text-muted-foreground">· {s.caseCount} case(s)</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* Order */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-heading">Order</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Order number" id="orderNumber" required>
            <Input
              id="orderNumber"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Order date" id="orderDate" required>
            <Input
              id="orderDate"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              required
            />
          </FormField>
          <FormField label={`Order amount (${currency})`} id="orderAmount" required>
            <Input
              id="orderAmount"
              type="number"
              step="0.001"
              min="0"
              value={orderAmount}
              onChange={(e) => setOrderAmount(e.target.value)}
              required
            />
          </FormField>
        </div>
      </section>

      {/* Refund components */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-heading">Refund components</h3>
          <Button type="button" size="sm" variant="outline" onClick={addComponent}>
            <Plus className="h-4 w-4" />
            Add component
          </Button>
        </div>

        <div className="space-y-3">
          {components.map((c, i) => {
            const method = props.paymentMethods.find((m) => m.key === c.paymentMethodKey);
            return (
              <div key={i} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-12">
                <div className="sm:col-span-3">
                  <FormField label="Method" id={`comp-method-${i}`} required>
                    <Select
                      value={c.paymentMethodKey}
                      onValueChange={(v) => updateComponent(i, { paymentMethodKey: v })}
                    >
                      <SelectTrigger id={`comp-method-${i}`}>
                        <SelectValue placeholder="Method" />
                      </SelectTrigger>
                      <SelectContent>
                        {props.paymentMethods.map((m) => (
                          <SelectItem key={m.key} value={m.key}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
                <div className="sm:col-span-3">
                  <FormField label={`Amount (${c.currency || currency})`} id={`comp-amount-${i}`} required>
                    <Input
                      id={`comp-amount-${i}`}
                      type="number"
                      step="0.001"
                      min="0"
                      value={c.amount}
                      onChange={(e) => updateComponent(i, { amount: e.target.value })}
                      required
                    />
                  </FormField>
                </div>
                {method?.requiresAuthCode ? (
                  <div className="sm:col-span-3">
                    <FormField label="Auth code" id={`comp-auth-${i}`} required>
                      <Input
                        id={`comp-auth-${i}`}
                        value={c.authCode}
                        onChange={(e) => updateComponent(i, { authCode: e.target.value })}
                        required
                      />
                    </FormField>
                  </div>
                ) : (
                  <div className="sm:col-span-3">
                    <FormField label="Last 4 (optional)" id={`comp-last4-${i}`}>
                      <Input
                        id={`comp-last4-${i}`}
                        maxLength={4}
                        value={c.last4}
                        onChange={(e) =>
                          updateComponent(i, { last4: e.target.value.replace(/[^0-9]/g, '') })
                        }
                      />
                    </FormField>
                  </div>
                )}
                <div className="flex items-end justify-end sm:col-span-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeComponent(i)}
                    disabled={components.length === 1}
                    aria-label="Remove component"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-muted-foreground">
            Total components: {totalComponents.toFixed(3)} {currency}
            {orderAmountNum > 0 && totalComponents < orderAmountNum
              ? ' · Will be marked as partial'
              : ''}
          </div>
          {exceedsOrder ? (
            <div className="text-destructive">Total exceeds order amount</div>
          ) : null}
        </div>
      </section>

      {/* Root cause + Aura */}
      <section className="grid gap-4 sm:grid-cols-2">
        <FormField label="Root cause" id="rootCauseId">
          <Select value={rootCauseId} onValueChange={setRootCauseId}>
            <SelectTrigger id="rootCauseId">
              <SelectValue placeholder="Choose a root cause" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {props.rootCauses.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Aura points (optional)" id="auraPoints">
          <Input
            id="auraPoints"
            type="number"
            min="0"
            step="1"
            value={auraPoints}
            onChange={(e) => setAuraPoints(e.target.value)}
          />
        </FormField>
        <FormField label="Root cause notes" id="rootCauseNotes" className="sm:col-span-2">
          <Textarea
            id="rootCauseNotes"
            value={rootCauseNotes}
            onChange={(e) => setRootCauseNotes(e.target.value)}
            rows={2}
          />
        </FormField>
      </section>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || exceedsOrder}>
          {pending ? 'Creating…' : 'Create draft case'}
        </Button>
      </div>
    </form>
  );
}
