import type { Money } from "@/lib/types";

/** Formats a recorded amount, e.g. "USD 1,800.00" or "UGX 3,700,000". */
export function formatMoney(amount: Money | null | undefined, currency: string): string {
  return `${currency} ${formatAmount(amount, currency)}`;
}

/** Number only, for table cells whose column header names the currency. */
export function formatAmount(amount: Money | null | undefined, currency: string): string {
  const n = Number(amount ?? 0);
  const zeroDecimals = ["UGX", "RWF", "KES"].includes(currency) && Number.isInteger(n);
  return n.toLocaleString("en-US", {
    minimumFractionDigits: zeroDecimals ? 0 : 2,
    maximumFractionDigits: zeroDecimals ? 0 : 2,
  });
}

export function formatDate(d: string | null | undefined): string | null {
  if (!d) return null;
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  });
}
