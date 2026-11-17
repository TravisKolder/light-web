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

/** Today's calendar date (YYYY-MM-DD) in an IANA time zone; UTC if the zone is missing or invalid. */
export function todayInTimeZone(timeZone: string | null | undefined, now: Date = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** "Africa/Kampala" → "Kampala time"; plain "UTC" stays "UTC". */
export function timeZoneLabel(timeZone: string | null | undefined): string {
  if (!timeZone || timeZone === "UTC") return "UTC";
  return `${timeZone.split("/").pop()!.replace(/_/g, " ")} time`;
}
