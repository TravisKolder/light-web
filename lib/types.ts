// Shared TypeScript types for the Project Passport.
//
// These mirror the public_* views (supabase/migrations/...0009 and ...0010),
// which are what the pages read. They contain NO private fields by design:
// donor identity, contact details, GPS, payment references, and private
// people's names are not in these types, so a page built on them can't
// accidentally render them.
//
// Postgres numeric comes back from Supabase as a string or number depending
// on the client settings, so money fields are typed as `Money` and should be
// formatted with Number(...) at display time.

export type Uuid = string;
/** ISO date, YYYY-MM-DD */
export type IsoDate = string;
/** numeric(…) from Postgres */
export type Money = number | string;

// ---------------------------------------------------------------------------
// Enums (keep in sync with the migrations)
// ---------------------------------------------------------------------------

/** The three states every assertion is kept in. Never merged. */
export type AssertionStatus = "claim" | "documented" | "verified";

export type ProjectStatus = "planned" | "active" | "completed" | "paused";
export type LeaderRole = "local_lead" | "treasurer" | "board" | "staff" | "other";
export type DocumentKind =
  | "receipt" | "invoice" | "photo" | "report" | "contract" | "bank_statement" | "other";
export type VerificationMethod =
  | "site_visit" | "document_review" | "third_party_audit"
  | "photo_geolocation" | "interview" | "other";
export type VerificationFinding = "confirmed" | "not_confirmed" | "disputed";
export type RateSource = "same_currency" | "bank" | "central_bank" | "mobile_money" | "manual";
export type FundsSourceCategory = "individual" | "church" | "foundation" | "local" | "other";
export type SupplierKind = "business" | "individual" | "cooperative" | "government" | "other";
export type PaymentMethod = "bank_transfer" | "mobile_money" | "cash" | "check";
export type EvidenceKind = "photo" | "video" | "receipt" | "site_report" | "other";

/** Kingdom Return dimensions. Narrative + linked evidence only; no score. */
export type KingdomReturnDimension =
  | "multiplication" | "subtraction" | "stewardship" | "sustainability" | "restoration";

export const KINGDOM_RETURN_DIMENSIONS: readonly {
  key: KingdomReturnDimension;
  label: string;
  question: string;
}[] = [
  { key: "multiplication", label: "Multiplication",
    question: "What new capacity, opportunity, or lasting good was created?" },
  { key: "subtraction", label: "Subtraction",
    question: "What suffering, waste, dependency, or recurring problem was reduced?" },
  { key: "stewardship", label: "Stewardship",
    question: "Were resources used faithfully and as promised?" },
  { key: "sustainability", label: "Sustainability",
    question: "Can the work continue after the original funding ends?" },
  { key: "restoration", label: "Restoration",
    question: "When mistakes or failures occurred, were they acknowledged and corrected?" },
];

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

/** Original amount + the rate used to convert it to the project's base currency. */
export interface RecordedAmount {
  amount: Money;
  currency: string;
  exchange_rate: Money;
  rate_date: IsoDate;
  rate_source: RateSource;
  amount_base: Money;
}

// ---------------------------------------------------------------------------
// Public view rows
// ---------------------------------------------------------------------------

export interface PublicProject {
  id: Uuid;
  slug: string;
  title: string;
  organization_id: Uuid;
  country: string | null;
  region: string | null;
  need_statement: string | null;
  objectives: string[] | null;
  status: ProjectStatus;
  start_date: IsoDate | null;
  end_date: IsoDate | null;
  base_currency: string;
  created_at: string;
}

export interface PublicOrganization {
  id: Uuid;
  name: string;
  country: string | null;
  region: string | null;
  description: string | null;
  website: string | null;
}

export interface PublicProjectLeader {
  project_id: Uuid;
  role: LeaderRole;
  since: IsoDate | null;
  /** null unless the person opted into a public profile */
  display_name: string | null;
  role_title: string | null;
}

export interface PublicAssertion {
  id: Uuid;
  project_id: Uuid;
  statement: string;
  status: AssertionStatus;
  asserted_on: IsoDate;
  asserted_by_name: string | null;
}

export interface PublicBudgetLine {
  id: Uuid;
  project_id: Uuid;
  category: string;
  description: string | null;
  approved_amount: Money;
  currency: string;
  exchange_rate: Money;
  rate_date: IsoDate;
  rate_source: RateSource;
  approved_amount_base: Money;
  approved_on: IsoDate | null;
  assertion_id: Uuid | null;
}

export interface PublicFundsReceived extends RecordedAmount {
  id: Uuid;
  project_id: Uuid;
  received_on: IsoDate;
  source_category: FundsSourceCategory;
  assertion_id: Uuid | null;
}

export interface PublicPurchase extends RecordedAmount {
  id: Uuid;
  project_id: Uuid;
  budget_line_id: Uuid;
  supplier_name: string | null;
  supplier_kind: SupplierKind | null;
  supplier_country: string | null;
  supplier_region: string | null;
  description: string;
  quantity: Money | null;
  unit: string | null;
  purchased_on: IsoDate;
  assertion_id: Uuid | null;
}

export interface PublicPayment extends RecordedAmount {
  id: Uuid;
  project_id: Uuid;
  purchase_id: Uuid;
  paid_on: IsoDate;
  method: PaymentMethod;
  assertion_id: Uuid | null;
}

export interface PublicBudgetVsActual {
  budget_line_id: Uuid;
  project_id: Uuid;
  category: string;
  approved_amount_base: Money;
  spent_base: Money;
  remaining_base: Money;
  assertion_id: Uuid | null;
}

export interface PublicDocument {
  id: Uuid;
  project_id: Uuid;
  assertion_id: Uuid;
  kind: DocumentKind;
  title: string;
  issued_on: IsoDate | null;
  contains_personal_data: boolean;
  /** null when the document contains personal data */
  storage_path: string | null;
}

export interface PublicVerification {
  id: Uuid;
  project_id: Uuid;
  assertion_id: Uuid;
  verifier_name: string | null;
  independence_declared_on: IsoDate;
  verified_on: IsoDate;
  method: VerificationMethod;
  finding: VerificationFinding;
  /** true = a tie to the project was found later; show "needs review" */
  tie_flagged: boolean;
}

export interface PublicEvidence {
  id: Uuid;
  project_id: Uuid;
  assertion_id: Uuid;
  kind: EvidenceKind;
  caption: string;
  captured_on: IsoDate | null;
  location_label: string | null;
  storage_path: string | null;
}

export interface PublicProgressReport {
  id: Uuid;
  project_id: Uuid;
  period_start: IsoDate;
  period_end: IsoDate;
  summary: string;
  setbacks: string | null;
  assertion_id: Uuid | null;
  author_name: string | null;
}

export interface PublicOutcome {
  id: Uuid;
  project_id: Uuid;
  description: string;
  measure: string | null;
  target: string | null;
  achieved: string | null;
  assertion_id: Uuid | null;
}

export interface PublicLesson {
  id: Uuid;
  project_id: Uuid;
  lesson: string;
  recorded_on: IsoDate;
}

export interface PublicSustainabilityPlan {
  id: Uuid;
  project_id: Uuid;
  plan: string;
  funding_after_grant: string | null;
  local_owner: string | null;
  review_on: IsoDate | null;
}

export interface PublicKingdomReturnEntry {
  id: Uuid;
  project_id: Uuid;
  dimension: KingdomReturnDimension;
  narrative: string;
  recorded_on: IsoDate;
  author_name: string | null;
}

export interface PublicKingdomReturnLink {
  id: Uuid;
  project_id: Uuid;
  entry_id: Uuid;
  assertion_id: Uuid | null;
  evidence_item_id: Uuid | null;
}
