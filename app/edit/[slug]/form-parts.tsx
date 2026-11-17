import type { AssertionStatus } from "@/lib/types";

// Form pieces shared by the editor's money pages (budget and funds;
// purchases and payments).

export type AssertionRow = { id: string; statement: string; status: AssertionStatus };

export const MONEY_ERRORS: Record<string, string> = {
  project: "That project couldn't be found. Go back to the editor home and try again.",
  amount: "Please enter the amount as a number, like 1250 or 1250.50.",
  currency: "Please enter the currency as its three-letter code, like USD or UGX.",
  rateNotNeeded:
    "This amount is in the project's reporting currency, so it needs no exchange rate. Leave the exchange-rate boxes empty.",
  rate: "This amount is in another currency, so it needs an exchange rate: how much one unit is worth in the reporting currency (for example 0.00027).",
  rateDate: "Please give the date of the exchange rate (not in the future).",
  rateSource: "Please say where the exchange rate came from.",
  date: "Please enter a valid date.",
  future: "The date can't be in the future.",
  assertion: "Please choose one of this project's statements.",
  long: "One of the text boxes is too long.",
};
const RATE_SOURCE_LABEL = { bank: "Bank", central_bank: "Central bank", mobile_money: "Mobile money", manual: "Other / worked out by hand" };
export function MoneyFields({ base, idPrefix, today }: { base: string; idPrefix: string; today: string }) {
  return (
    <>
      <label htmlFor={`${idPrefix}_currency`}>Currency (three-letter code)</label>
      <input
        id={`${idPrefix}_currency`} name="currency" type="text" defaultValue={base}
        required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" autoCapitalize="characters"
      />
      <fieldset className="gps">
        <legend>Only if the currency isn&apos;t {base}</legend>
        <p className="small muted">
          Totals are kept in {base}. For any other currency, record the rate used, its
          date and where it came from, so a reader can check the conversion.
        </p>
        <label htmlFor={`${idPrefix}_rate`}>Exchange rate: 1 unit = how many {base}</label>
        <input id={`${idPrefix}_rate`} name="exchange_rate" type="text" inputMode="decimal" placeholder="e.g. 0.00027" />
        <label htmlFor={`${idPrefix}_rate_date`}>Date of the rate</label>
        <input id={`${idPrefix}_rate_date`} name="rate_date" type="date" max={today} />
        <label htmlFor={`${idPrefix}_rate_source`}>Where the rate came from</label>
        <select id={`${idPrefix}_rate_source`} name="rate_source" defaultValue="">
          <option value="">Choose…</option>
          {Object.entries(RATE_SOURCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </fieldset>
    </>
  );
}

export function StatementSelect({ id, assertions }: { id: string; assertions: AssertionRow[] }) {
  return (
    <>
      <label htmlFor={id}>Statement this supports (optional)</label>
      <select id={id} name="assertion_id" defaultValue="">
        <option value="">None yet</option>
        {assertions.map((a) => (
          <option key={a.id} value={a.id}>
            {a.statement.length > 90 ? `${a.statement.slice(0, 90)}…` : a.statement}
          </option>
        ))}
      </select>
      <p className="small muted">
        The entry shows that statement&apos;s status (claim, documented or verified). With
        none linked it shows &ldquo;No statement&rdquo; on the passport.
      </p>
    </>
  );
}
