'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { exportPromoAllocationsCsvAction } from '@/app/actions/promo';

/**
 * Admin-only CSV export button. Opens a small inline panel with a date
 * range + type filter, runs the server action, and triggers a client-side
 * Blob download with the returned CSV text.
 *
 * Kept as an inline disclosure (not a modal) to stay consistent with the
 * existing no-modal UI pattern in this app.
 */
export function PromoExportButton() {
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [type, setType] = useState<'ALL' | 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY'>('ALL');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);

  function download() {
    setError(null);
    setLastCount(null);
    startTransition(async () => {
      const res = await exportPromoAllocationsCsvAction({
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        type,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const blob = new Blob([res.data!.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.data!.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLastCount(res.data!.rowCount);
    });
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="mr-2 h-4 w-4" />
        Export CSV
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-border bg-card p-4 sm:w-auto sm:min-w-[420px]">
      <div className="flex items-center gap-2 text-sm font-medium text-heading">
        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
        Export allocations
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="ex-from" className="text-xs">From</Label>
          <Input id="ex-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ex-to" className="text-xs">To</Label>
          <Input id="ex-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="ex-type" className="text-xs">Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger id="ex-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            <SelectItem value="CUSTOMER_COMPENSATION">Customer compensation</SelectItem>
            <SelectItem value="SERVICE_RECOVERY">Service recovery</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {lastCount !== null && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Exported {lastCount} allocation{lastCount === 1 ? '' : 's'}.
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
        <Button size="sm" onClick={download} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting…
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" /> Download CSV
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
