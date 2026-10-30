// Simple consistency flags (backlog item 19). Rule-based, no AI. Each flag
// means "a person should look at this", never "this is false" or "fraud".
// Computed from public data only, so they can be shown on the public page.

import type { Passport } from "@/lib/passport";

export interface ReviewFlag {
  id: string;
  /** Short, neutral description of what to look at */
  message: string;
  /** Which part of the passport it concerns */
  area: "budget" | "funds" | "purchases" | "claims" | "verification";
}

/** Claims older than this with nothing attached get flagged. */
export const STALE_CLAIM_DAYS = 60;

export function computeFlags(p: Passport, today: Date = new Date()): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const n = (x: string | number | null | undefined) => Number(x ?? 0);
  const base = p.project.base_currency;
  const statusOf = new Map(p.assertions.map((a) => [a.id, a.status]));

  // Spent more than approved on a budget line.
  for (const l of p.budgetVsActual) {
    if (n(l.spent_base) > n(l.approved_amount_base)) {
      flags.push({
        id: `over-${l.budget_line_id}`, area: "budget",
        message: `"${l.category}": recorded spending is more than the approved amount.`,
      });
    }
  }

  // Spent more than received.
  const received = p.fundsReceived.reduce((t, f) => t + n(f.amount_base), 0);
  const spent = p.payments.reduce((t, x) => t + n(x.amount_base), 0);
  if (spent > received) {
    flags.push({
      id: "spent-over-received", area: "funds",
      message: `Recorded payments (${base} ${spent.toFixed(2)}) are more than recorded funds received (${base} ${received.toFixed(2)}).`,
    });
  }

  // Purchases: paid more than cost; or payments with no supporting document.
  for (const pu of p.purchases) {
    const pays = p.payments.filter((x) => x.purchase_id === pu.id);
    const paid = pays.reduce((t, x) => t + n(x.amount_base), 0);
    if (paid > n(pu.amount_base) + 0.005) {
      flags.push({
        id: `overpaid-${pu.id}`, area: "purchases",
        message: `"${pu.description}": recorded payments are more than the purchase cost.`,
      });
    }
    const supported = (id: string | null) => {
      const s = id ? statusOf.get(id) : undefined;
      return s === "documented" || s === "verified";
    };
    if (pays.length > 0 && !supported(pu.assertion_id) && pays.every((x) => !supported(x.assertion_id))) {
      flags.push({
        id: `no-receipt-${pu.id}`, area: "purchases",
        message: `"${pu.description}": payments recorded with no receipt or other supporting document.`,
      });
    }
  }

  // Old claims with nothing attached.
  const cutoff = today.getTime() - STALE_CLAIM_DAYS * 86_400_000;
  for (const a of p.assertions) {
    if (a.status === "claim" && new Date(`${a.asserted_on}T00:00:00Z`).getTime() < cutoff) {
      flags.push({
        id: `stale-${a.id}`, area: "claims",
        message: `"${a.statement}" has had no supporting material for over ${STALE_CLAIM_DAYS} days.`,
      });
    }
  }

  // Verifications later found to have a tie, or that didn't confirm.
  for (const v of p.verifications) {
    const a = p.assertions.find((x) => x.id === v.assertion_id);
    if (v.tie_flagged) {
      flags.push({
        id: `tie-${v.id}`, area: "verification",
        message: `A verification of "${a?.statement ?? "a claim"}" was flagged for a possible tie to the project.`,
      });
    } else if (v.finding !== "confirmed") {
      flags.push({
        id: `finding-${v.id}`, area: "verification",
        message: `A verifier ${v.finding === "disputed" ? "disputed" : "could not confirm"} "${a?.statement ?? "a claim"}".`,
      });
    }
  }

  return flags;
}
