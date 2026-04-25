/**
 * Light-weight formatters for rendering batch summary tables inside
 * outbound emails. Kept here (instead of `lib/format.ts`) so the email
 * dispatcher doesn't pull in case-list table rendering and vice versa.
 */

export function formatMoney(amount: number, currency: string): string {
  // Use a plain `${amount} ${currency}` rather than Intl.NumberFormat so the
  // emails stay locale-agnostic — managers/finance see the raw value with the
  // ISO code.
  return `${amount.toFixed(2)} ${currency}`;
}

export interface CaseRow {
  caseNumber: string;
  customerName: string;
  orderNumber: string;
  brandName: string;
  paymentLabel: string;
  refundAmount: number;
  currency: string;
}

export function renderCasesTable(rows: CaseRow[]): string {
  if (rows.length === 0) return '(none)';
  return rows
    .map(
      (r, i) =>
        `${(i + 1).toString().padStart(2, ' ')}. ${r.caseNumber}  ` +
        `${r.customerName}  /  Order ${r.orderNumber}  /  ` +
        `${r.brandName}  /  ${r.paymentLabel}  /  ` +
        `${formatMoney(r.refundAmount, r.currency)}`,
    )
    .join('\n');
}

export interface KnetComponentRow {
  caseNumber: string;
  authCode: string | null;
  amount: number;
  currency: string;
  customerName: string;
}

export function renderKnetComponentsTable(rows: KnetComponentRow[]): string {
  if (rows.length === 0) return '(none)';
  return rows
    .map(
      (r, i) =>
        `${(i + 1).toString().padStart(2, ' ')}. ${r.caseNumber}  ` +
        `Auth ${r.authCode ?? '—'}  ` +
        `${formatMoney(r.amount, r.currency)}  ` +
        `${r.customerName}`,
    )
    .join('\n');
}

export interface AuraOrderRow {
  caseNumber: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  points: number;
}

export function renderAuraOrdersTable(rows: AuraOrderRow[]): string {
  if (rows.length === 0) return '(none)';
  return rows
    .map(
      (r, i) =>
        `${(i + 1).toString().padStart(2, ' ')}. ${r.caseNumber}  ` +
        `Order ${r.orderNumber}  /  ${r.customerName} <${r.customerEmail}>  /  ` +
        `${r.points} points`,
    )
    .join('\n');
}
