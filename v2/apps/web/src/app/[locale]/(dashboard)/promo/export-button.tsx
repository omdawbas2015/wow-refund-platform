'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Loader2, FileSpreadsheet, Check } from 'lucide-react';
import { exportPromoAllocationsXlsxAction } from '@/app/actions/promo';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';

/**
 * Admin-only Excel export button. Opens a small inline panel with a single
 * date-range popover + type filter, runs the server action, and triggers a
 * client-side Blob download of the .xlsx workbook.
 *
 * The two separate From / To inputs the previous version had are replaced
 * with one calendar popover that handles both ends of the range, plus
 * preset shortcuts (Today / Last 7 days / Month to date / etc.).
 */
export function PromoExportButton() {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRangeValue>({ from: null, to: null });
  const [type, setType] = useState<'ALL' | 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY'>('ALL');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);

  function download() {
    setError(null);
    setLastCount(null);
    startTransition(async () => {
      const res = await exportPromoAllocationsXlsxAction({
        fromDate: range.from ?? undefined,
        toDate: range.to ?? undefined,
        type,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // ExcelJS workbook arrives as base64 → decode into a Blob and trigger
      // a save dialog. Done client-side so we never round-trip the binary
      // payload through Next's server-action JSON channel as raw bytes.
      const bin = atob(res.data!.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
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
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Export Excel
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-lg border border-border bg-card p-4 sm:w-auto sm:min-w-[420px]">
      <div className="flex items-center gap-2 text-sm font-medium text-heading">
        <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        Export allocations to Excel
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Date range</Label>
        <DateRangePicker value={range} onChange={setRange} placeholder="All time" />
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
        <p className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="h-3 w-3" /> Exported {lastCount} allocation{lastCount === 1 ? '' : 's'}.
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
              <Download className="mr-2 h-4 w-4" /> Download .xlsx
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
