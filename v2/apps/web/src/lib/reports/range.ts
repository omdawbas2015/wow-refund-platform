/**
 * Date range utilities for reports.
 *
 * `parseRange` accepts an optional `from` / `to` ISO date string from URL
 * search params and returns the resolved start/end Date (inclusive).
 * Defaults to the last 30 days when both are missing.
 */

export interface DateRange {
  from: Date;
  to: Date;
  fromIso: string;
  toIso: string;
}

export function parseRange(input: { from?: string; to?: string } = {}): DateRange {
  const now = new Date();
  const defaultTo = new Date(now);
  defaultTo.setUTCHours(23, 59, 59, 999);
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  defaultFrom.setUTCHours(0, 0, 0, 0);

  const from = input.from && /^\d{4}-\d{2}-\d{2}$/.test(input.from)
    ? new Date(`${input.from}T00:00:00.000Z`)
    : defaultFrom;
  const to = input.to && /^\d{4}-\d{2}-\d{2}$/.test(input.to)
    ? new Date(`${input.to}T23:59:59.999Z`)
    : defaultTo;

  return {
    from,
    to,
    fromIso: from.toISOString().slice(0, 10),
    toIso: to.toISOString().slice(0, 10),
  };
}

export function eachDayInRange(range: DateRange): string[] {
  const days: string[] = [];
  const cursor = new Date(range.from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(range.to);
  end.setUTCHours(0, 0, 0, 0);
  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
