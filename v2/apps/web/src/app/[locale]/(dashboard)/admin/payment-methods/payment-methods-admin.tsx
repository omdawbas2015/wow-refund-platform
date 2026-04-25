'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createPaymentMethodAction,
  updatePaymentMethodAction,
  deletePaymentMethodAction,
} from '@/app/actions/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaymentBrand } from '@/components/ui/payment-method-icons';
import { cn } from '@/lib/utils';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

type MethodRow = {
  id: string;
  key: string;
  label: string;
  labelAr: string | null;
  iconSlug: string | null;
  color: string | null;
  requiresAuthCode: boolean;
  executionType: string;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
  createdAt: string;
};

const WELL_KNOWN_GATEWAYS = [
  { key: 'PAYPAL', label: 'PayPal', color: '#003087' },
  { key: 'TABBY', label: 'Tabby', color: '#3BFFC1' },
  { key: 'TAMARA', label: 'Tamara', color: '#2D2D2D' },
  { key: 'STCPAY', label: 'stc pay', color: '#4F008C' },
  { key: 'MADA', label: 'Mada', color: '#004B87' },
  { key: 'BENEFIT', label: 'Benefit', color: '#00A8E0' },
  { key: 'QPAY', label: 'QPay', color: '#FF6B00' },
  { key: 'STRIPE', label: 'Stripe', color: '#635BFF' },
  { key: 'CHECKOUT', label: 'Checkout.com', color: '#0B5CFF' },
  { key: 'ADYEN', label: 'Adyen', color: '#0ABF53' },
  { key: 'HYPERPAY', label: 'HyperPay', color: '#17A5E3' },
  { key: 'MOYASAR', label: 'Moyasar', color: '#1D1D1D' },
  { key: 'FAWRY', label: 'Fawry', color: '#FABB05' },
  { key: 'PAYMOB', label: 'Paymob', color: '#2563EB' },
];

export function PaymentMethodsAdmin({ methods }: { methods: MethodRow[] }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => { setShowForm(true); setEditingId(null); }}
          disabled={showForm}
        >
          <Plus className="h-4 w-4" />
          Add payment method
        </Button>
      </div>

      {showForm && !editingId && (
        <AddMethodForm
          existingKeys={methods.map((m) => m.key)}
          onClose={() => setShowForm(false)}
        />
      )}

      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/70">
              <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">Method</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Auth</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cases</th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active</th>
              <th className="px-4 py-2.5 text-end text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {methods.map((m) => (
              editingId === m.id ? (
                <EditMethodRow key={m.id} method={m} onClose={() => setEditingId(null)} />
              ) : (
                <MethodRow
                  key={m.id}
                  method={m}
                  onEdit={() => { setEditingId(m.id); setShowForm(false); }}
                />
              )
            ))}
            {methods.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No payment methods configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MethodRow({ method, onEdit }: { method: MethodRow; onEdit: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      await updatePaymentMethodAction({ id: method.id, isActive: !method.isActive });
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${method.label}"? ${method.usageCount > 0 ? 'It is in use and will be deactivated instead.' : ''}`)) return;
    startTransition(async () => {
      await deletePaymentMethodAction({ id: method.id });
      router.refresh();
    });
  }

  return (
    <tr className={cn(!method.isActive && 'opacity-50')}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <PaymentBrand brandKey={method.key} size="sm" />
          <div>
            <div className="font-medium text-heading">{method.label}</div>
            {method.labelAr && (
              <div className="text-xs text-muted-foreground" dir="rtl">{method.labelAr}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{method.key}</td>
      <td className="px-4 py-3">
        <span className={cn(
          'rounded-full px-2 py-0.5 text-xs font-medium',
          method.executionType === 'BATCH'
            ? 'bg-amber-100 text-amber-800'
            : 'bg-blue-100 text-blue-800',
        )}>
          {method.executionType}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {method.requiresAuthCode ? (
          <span className="text-xs font-medium text-foreground">Required</span>
        ) : (
          <span className="text-xs text-muted-foreground">---</span>
        )}
      </td>
      <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">
        {method.usageCount}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          type="button"
          onClick={toggleActive}
          disabled={isPending}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title={method.isActive ? 'Deactivate' : 'Activate'}
        >
          {method.isActive ? (
            <ToggleRight className="h-5 w-5 text-primary" />
          ) : (
            <ToggleLeft className="h-5 w-5" />
          )}
        </button>
      </td>
      <td className="px-4 py-3 text-end">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            disabled={isPending}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AddMethodForm({
  existingKeys,
  onClose,
}: {
  existingKeys: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [iconSlug, setIconSlug] = useState('');
  const [color, setColor] = useState('#000000');
  const [requiresAuthCode, setRequiresAuthCode] = useState(false);
  const [executionType, setExecutionType] = useState('MANUAL');
  const [sortOrder, setSortOrder] = useState(0);

  const availableGateways = WELL_KNOWN_GATEWAYS.filter(
    (g) => !existingKeys.includes(g.key),
  );

  function selectGateway(gw: typeof WELL_KNOWN_GATEWAYS[0]) {
    setKey(gw.key);
    setLabel(gw.label);
    setColor(gw.color);
    setIconSlug(gw.key.toLowerCase().replace(/_/g, '-'));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createPaymentMethodAction({
        key,
        label,
        labelAr: labelAr || undefined,
        iconSlug: iconSlug || undefined,
        color: color || undefined,
        requiresAuthCode,
        executionType,
        sortOrder,
      });
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-heading">Add payment method</h3>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {availableGateways.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Quick add from popular gateways</div>
          <div className="flex flex-wrap gap-1.5">
            {availableGateways.map((gw) => (
              <button
                key={gw.key}
                type="button"
                onClick={() => selectGateway(gw)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  key === gw.key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface hover:bg-surface-subtle',
                )}
              >
                {gw.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pm-key">Key</Label>
          <Input
            id="pm-key"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            required
            placeholder="PAYPAL"
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pm-label">Label (EN)</Label>
          <Input
            id="pm-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            placeholder="PayPal"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pm-labelAr">Label (AR)</Label>
          <Input
            id="pm-labelAr"
            value={labelAr}
            onChange={(e) => setLabelAr(e.target.value)}
            placeholder="باي بال"
            dir="rtl"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pm-color">Brand color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded border border-border"
            />
            <Input
              id="pm-color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="font-mono flex-1"
              placeholder="#000000"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pm-exec">Execution type</Label>
          <select
            id="pm-exec"
            value={executionType}
            onChange={(e) => setExecutionType(e.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
          >
            <option value="MANUAL">Manual</option>
            <option value="BATCH">Batch</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pm-sort">Sort order</Label>
          <Input
            id="pm-sort"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={requiresAuthCode}
              onChange={(e) => setRequiresAuthCode(e.target.checked)}
              className="rounded border-border"
            />
            Requires auth code
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 sm:col-span-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? 'Creating...' : 'Create method'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function EditMethodRow({ method, onClose }: { method: MethodRow; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [label, setLabel] = useState(method.label);
  const [labelAr, setLabelAr] = useState(method.labelAr ?? '');
  const [color, setColor] = useState(method.color ?? '#000000');
  const [requiresAuthCode, setRequiresAuthCode] = useState(method.requiresAuthCode);
  const [executionType, setExecutionType] = useState(method.executionType);
  const [sortOrder, setSortOrder] = useState(method.sortOrder);

  function handleSave() {
    startTransition(async () => {
      const result = await updatePaymentMethodAction({
        id: method.id,
        label,
        labelAr: labelAr || undefined,
        color: color || undefined,
        requiresAuthCode,
        executionType,
        sortOrder,
      });
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        alert(result.error);
      }
    });
  }

  return (
    <tr className="bg-primary/5">
      <td className="px-4 py-2" colSpan={7}>
        <div className="grid gap-3 py-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Label (EN)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Label (AR)</Label>
            <Input value={labelAr} onChange={(e) => setLabelAr(e.target.value)} className="h-8 text-sm" dir="rtl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Color</Label>
            <div className="flex items-center gap-1.5">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border border-border" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-8 text-sm font-mono flex-1" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Execution</Label>
            <select
              value={executionType}
              onChange={(e) => setExecutionType(e.target.value)}
              className="flex h-8 w-full rounded-md border border-border bg-surface px-2 text-sm"
            >
              <option value="MANUAL">Manual</option>
              <option value="BATCH">Batch</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sort order</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="h-8 text-sm" />
          </div>
          <div className="flex items-end gap-1.5">
            <label className="flex items-center gap-2 text-xs cursor-pointer pb-1">
              <input
                type="checkbox"
                checked={requiresAuthCode}
                onChange={(e) => setRequiresAuthCode(e.target.checked)}
                className="rounded border-border"
              />
              Auth code required
            </label>
          </div>
          <div className="flex items-end justify-end gap-1.5 sm:col-span-3">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
              <Check className="h-3.5 w-3.5" />
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );
}
