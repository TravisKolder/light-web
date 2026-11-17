// Shared input checks for the editor's server actions. Plain module (not
// "use server"), so it can export constants and sync helpers.

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** "1,250.50" → "1250.50"; null if it isn't a plain amount with at most 2 decimals. */
export function parseAmount(raw: string): string | null {
  const s = raw.replace(/[,\s]/g, "");
  return /^\d{1,12}(\.\d{1,2})?$/.test(s) ? s : null;
}

/** Exchange rate: positive, up to 8 decimals. */
export function parseRate(raw: string): string | null {
  const s = raw.replace(/[,\s]/g, "");
  return /^\d{1,10}(\.\d{1,8})?$/.test(s) && Number(s) > 0 ? s : null;
}

export const RATE_SOURCES = ["bank", "central_bank", "mobile_money", "manual"] as const;
export const FUNDS_SOURCES = ["individual", "church", "foundation", "local", "other"] as const;

export type MoneyInput =
  | { ok: true; currency: string; exchange_rate: string; rate_date: string; rate_source: string }
  | { ok: false; error: "currency" | "rateNotNeeded" | "rate" | "rateDate" | "rateSource" };

/**
 * Applies the database's currency rule before it has to: an amount in the
 * project's reporting currency has rate 1 / same_currency; any other currency
 * needs a real rate, its date and where it came from.
 */
export function resolveMoney(
  f: { currency: string; rate: string; rateDate: string; rateSource: string },
  base: string,
  fallbackDate: string,
  today: string,
): MoneyInput {
  const currency = f.currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: "currency" };

  if (currency === base) {
    if (f.rate && Number(f.rate.replace(/[,\s]/g, "")) !== 1) return { ok: false, error: "rateNotNeeded" };
    return { ok: true, currency, exchange_rate: "1", rate_date: fallbackDate, rate_source: "same_currency" };
  }

  const rate = parseRate(f.rate);
  if (!rate) return { ok: false, error: "rate" };
  if (!isValidDate(f.rateDate) || f.rateDate > today) return { ok: false, error: "rateDate" };
  if (!(RATE_SOURCES as readonly string[]).includes(f.rateSource)) return { ok: false, error: "rateSource" };
  return { ok: true, currency, exchange_rate: rate, rate_date: f.rateDate, rate_source: f.rateSource };
}
