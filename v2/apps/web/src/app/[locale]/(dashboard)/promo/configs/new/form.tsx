'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createPromoConfigAction } from '@/app/actions/promo';

interface Brand {
  id: string;
  name: string;
}
interface Country {
  id: string;
  code: string;
  name: string;
}

interface Props {
  brands: Brand[];
  countries: Country[];
}

export function NewConfigForm({ brands, countries }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [brandId, setBrandId] = useState(brands[0]?.id ?? '');
  const [countryId, setCountryId] = useState(countries[0]?.id ?? '');
  const [type, setType] = useState<'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY'>(
    'CUSTOMER_COMPENSATION',
  );
  const [value, setValue] = useState('5');
  const [currency, setCurrency] = useState('KWD');
  const [label, setLabel] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createPromoConfigAction({
        brandId,
        countryId,
        type,
        value: Number(value),
        currency,
        label,
      });
      if (result.ok && result.data) {
        toast.success('Config created');
        router.push(`/promo/configs/${result.data.id}`);
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Brand">
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            required
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Country">
          <select
            value={countryId}
            onChange={(e) => setCountryId(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            required
          >
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select
            value={type}
            onChange={(e) =>
              setType(e.target.value as 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY')
            }
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            required
          >
            <option value="CUSTOMER_COMPENSATION">Customer compensation (emailed)</option>
            <option value="SERVICE_RECOVERY">Service recovery (internal)</option>
          </select>
        </Field>
        <Field label="Value">
          <input
            type="number"
            step="0.001"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            required
          />
        </Field>
        <Field label="Currency">
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={6}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            required
          />
        </Field>
        <Field label="Label (optional)">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Q1 service-recovery pool"
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Create config'}
        </Button>
      </div>
    </form>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
      {props.label}
      {props.children}
    </label>
  );
}
