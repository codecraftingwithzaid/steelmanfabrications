import { round2 } from "./format";

/** A single billable line as needed for totals math (UI-agnostic). */
export interface CalcLineItem {
  qty: number;
  rate: number;
}

export interface DocumentTotals {
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
}

/** Row total = qty * rate, rounded to 2 decimals. Non-finite inputs -> 0. */
export function lineTotal(qty: number, rate: number): number {
  const q = Number.isFinite(qty) ? qty : 0;
  const r = Number.isFinite(rate) ? rate : 0;
  return round2(q * r);
}

/**
 * Authoritative totals computation. Used client-side for live UX and mirrored
 * by the Postgres trigger server-side so stored totals never trust raw client
 * input. `gstPercent` of null/undefined/blank means "no GST" (amount hidden).
 */
export function computeTotals(
  items: CalcLineItem[],
  gstPercent: number | null | undefined,
): DocumentTotals {
  const subtotal = round2(
    items.reduce((sum, item) => sum + lineTotal(item.qty, item.rate), 0),
  );

  const hasGst =
    gstPercent !== null &&
    gstPercent !== undefined &&
    Number.isFinite(gstPercent) &&
    gstPercent > 0;

  const gstAmount = hasGst ? round2((subtotal * (gstPercent as number)) / 100) : 0;
  const grandTotal = round2(subtotal + gstAmount);

  return { subtotal, gstAmount, grandTotal };
}
