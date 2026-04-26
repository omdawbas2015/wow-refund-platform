'use client';

/**
 * Date-range picker with an inline month calendar and preset shortcuts.
 * Selection happens entirely inside the popover — click a day to set the
 * "from", click another to set the "to", everything in between highlights
 * as a range. Presets (Today / 7 / 30 days, etc.) feed the same state so
 * the user always sees what they picked on the calendar itself.
 */

import * as React from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { Calendar, X } from 'lucide-react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type DateRangeValue = {
  from: string | null; // yyyy-mm-dd
  to: string | null;
};

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISO(s: string | null): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatShort(iso: string): string {
  const d = parseISO(iso);
  if (!d) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type Preset = { label: string; from: string; to: string };

function presets(): Preset[] {
  const now = new Date();
  const today = toISO(now);
  const minus = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return toISO(d);
  };
  const startOfMonth = () => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return toISO(d);
  };
  return [
    { label: 'Today', from: today, to: today },
    { label: 'Last 7 days', from: minus(6), to: today },
    { label: 'Last 30 days', from: minus(29), to: today },
    { label: 'Month to date', from: startOfMonth(), to: today },
    { label: 'Last 3 months', from: minus(89), to: today },
  ];
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Any date',
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const label = React.useMemo(() => {
    if (value.from && value.to) {
      if (value.from === value.to) return formatShort(value.from);
      return `${formatShort(value.from)} – ${formatShort(value.to)}`;
    }
    if (value.from) return `From ${formatShort(value.from)}`;
    if (value.to) return `Until ${formatShort(value.to)}`;
    return placeholder;
  }, [value, placeholder]);

  const hasValue = Boolean(value.from || value.to);

  const selected: DateRange | undefined = React.useMemo(() => {
    const from = parseISO(value.from);
    const to = parseISO(value.to);
    if (!from && !to) return undefined;
    return { from, to };
  }, [value]);

  const handleSelect = (range: DateRange | undefined) => {
    if (!range || (!range.from && !range.to)) {
      onChange({ from: null, to: null });
      return;
    }
    onChange({
      from: range.from ? toISO(range.from) : null,
      to: range.to ? toISO(range.to) : null,
    });
  };

  const applyPreset = (p: Preset) => {
    onChange({ from: p.from, to: p.to });
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: null, to: null });
  };

  const activePresetLabel = (() => {
    if (!value.from || !value.to) return null;
    const match = presets().find(
      (p) => p.from === value.from && p.to === value.to,
    );
    return match?.label ?? null;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface ps-3 pe-2 text-sm transition-colors',
            hasValue ? 'text-heading' : 'text-muted-foreground',
            'hover:border-heading/30 data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/20',
          )}
        >
          <Calendar
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              hasValue ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          <span className="truncate">{label}</span>
          {hasValue && (
            <span
              role="button"
              tabIndex={0}
              onClick={clear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') clear(e as unknown as React.MouseEvent);
              }}
              className="ms-1 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-heading"
              aria-label="Clear date range"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto overflow-hidden rounded-xl border border-border bg-popover p-0 shadow-xl ring-1 ring-black/[0.04]"
        align="end"
        sideOffset={6}
      >
        <div className="flex">
          <div className="flex w-[160px] flex-col gap-0.5 border-e border-border bg-surface-subtle/40 p-3">
            <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Quick ranges
            </div>
            {presets().map((p) => {
              const active = activePresetLabel === p.label;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-start text-xs font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-heading hover:bg-muted',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
            <div className="mt-1 border-t border-border/60 pt-1">
              <button
                type="button"
                onClick={() => onChange({ from: null, to: null })}
                className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-start text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-heading"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            </div>
          </div>
          <div className="p-3">
            <DayPicker
              mode="range"
              selected={selected}
              onSelect={handleSelect}
              numberOfMonths={1}
              showOutsideDays
              classNames={{
                months: 'flex flex-col sm:flex-row gap-3',
                month: 'space-y-3',
                month_caption:
                  'flex justify-center pt-1 pb-1 relative items-center',
                caption_label: 'text-sm font-medium text-heading',
                nav: 'absolute inset-x-1 top-1 flex items-center justify-between px-1',
                button_previous:
                  'h-6 w-6 p-0 opacity-60 hover:opacity-100 rounded-md hover:bg-muted inline-flex items-center justify-center',
                button_next:
                  'h-6 w-6 p-0 opacity-60 hover:opacity-100 rounded-md hover:bg-muted inline-flex items-center justify-center',
                month_grid: 'w-full border-collapse',
                weekdays: 'flex',
                weekday:
                  'text-muted-foreground w-8 text-center font-normal text-[0.7rem]',
                week: 'flex w-full mt-1',
                day: 'relative p-0 text-center text-sm first:rounded-s-md last:rounded-e-md',
                day_button:
                  'inline-flex h-8 w-8 items-center justify-center rounded-md font-normal text-heading transition-colors hover:bg-muted',
                selected:
                  '[&>button]:!bg-primary [&>button]:!text-primary-foreground',
                today: '[&>button]:underline [&>button]:underline-offset-2',
                outside: '[&>button]:text-muted-foreground/40',
                disabled: '[&>button]:text-muted-foreground/30',
                range_start:
                  '!bg-primary/10 !rounded-s-md [&>button]:!bg-primary [&>button]:!text-primary-foreground',
                range_end:
                  '!bg-primary/10 !rounded-e-md [&>button]:!bg-primary [&>button]:!text-primary-foreground',
                range_middle:
                  '!bg-primary/10 !rounded-none [&>button]:!bg-transparent [&>button]:!text-heading',
                hidden: 'invisible',
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-border/60 px-1 pt-2 text-xs">
              <span className="text-muted-foreground">
                {hasValue ? (
                  <>
                    <span className="text-heading">{label}</span>
                  </>
                ) : (
                  'Pick a start date, then an end date.'
                )}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
