// Loads a Project Passport from the public_* views, or from the local
// fictional sample fixture when Supabase isn't configured (dev / preview).
//
// Only public data is ever loaded here: the anon key can read only the
// public_* views, and the fixture was generated from those same views as the
// anon role (scripts/export-sample-fixture.sql).

import { getSupabaseClient } from "@/lib/supabase/client";
import sample from "@/lib/sample/passport.json";
import type {
  PublicAssertion, PublicBudgetLine, PublicBudgetVsActual, PublicDocument,
  PublicEvidence, PublicFundsReceived, PublicKingdomReturnEntry,
  PublicKingdomReturnLink, PublicLesson, PublicOrganization, PublicOutcome,
  PublicPayment, PublicProgressReport, PublicProject, PublicProjectLeader,
  PublicPurchase, PublicSustainabilityPlan, PublicVerification,
} from "@/lib/types";

export interface Passport {
  project: PublicProject;
  organization: PublicOrganization | null;
  leaders: PublicProjectLeader[];
  assertions: PublicAssertion[];
  budgetLines: PublicBudgetLine[];
  budgetVsActual: PublicBudgetVsActual[];
  fundsReceived: PublicFundsReceived[];
  purchases: PublicPurchase[];
  payments: PublicPayment[];
  documents: PublicDocument[];
  verifications: PublicVerification[];
  evidence: PublicEvidence[];
  progressReports: PublicProgressReport[];
  outcomes: PublicOutcome[];
  lessons: PublicLesson[];
  sustainabilityPlans: PublicSustainabilityPlan[];
  kingdomReturnEntries: PublicKingdomReturnEntry[];
  kingdomReturnLinks: PublicKingdomReturnLink[];
  /** "sample" when served from the fictional fixture */
  source: "supabase" | "sample";
}

export const SAMPLE_PASSPORT: Passport = {
  ...(sample as Omit<Passport, "source">),
  source: "sample",
};

const LIST_VIEWS = {
  leaders: "public_project_leaders",
  assertions: "public_assertions",
  budgetLines: "public_budget_lines",
  budgetVsActual: "public_budget_vs_actual",
  fundsReceived: "public_funds_received",
  purchases: "public_purchases",
  payments: "public_payments",
  documents: "public_documents",
  verifications: "public_verifications",
  evidence: "public_evidence",
  progressReports: "public_progress_reports",
  outcomes: "public_outcomes",
  lessons: "public_lessons",
  sustainabilityPlans: "public_sustainability_plans",
  kingdomReturnEntries: "public_kingdom_return_entries",
  kingdomReturnLinks: "public_kingdom_return_links",
} as const;

/** Returns the passport for a slug, or null if there's no public project with it. */
export async function getPassport(slug: string): Promise<Passport | null> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return slug === SAMPLE_PASSPORT.project.slug ? SAMPLE_PASSPORT : null;
  }

  const { data: project, error } = await supabase
    .from("public_projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<PublicProject>();
  if (error) throw new Error(`Loading project failed: ${error.message}`);
  if (!project) return null;

  const { data: organization } = await supabase
    .from("public_organizations")
    .select("*")
    .eq("id", project.organization_id)
    .maybeSingle<PublicOrganization>();

  const entries = await Promise.all(
    Object.entries(LIST_VIEWS).map(async ([key, view]) => {
      const { data, error: e } = await supabase.from(view).select("*").eq("project_id", project.id);
      if (e) throw new Error(`Loading ${view} failed: ${e.message}`);
      return [key, data ?? []] as const;
    }),
  );

  return {
    project,
    organization: organization ?? null,
    ...(Object.fromEntries(entries) as Omit<Passport, "project" | "organization" | "source">),
    source: "supabase",
  };
}

export interface ProjectSummary {
  project: PublicProject;
  organizationName: string | null;
  statusCounts: Record<"claim" | "documented" | "verified", number>;
  source: "supabase" | "sample";
}

function countStatuses(assertions: Pick<PublicAssertion, "status">[]) {
  const c = { claim: 0, documented: 0, verified: 0 };
  for (const a of assertions) c[a.status] += 1;
  return c;
}

/** All public projects with a count of claims by status. */
export async function listProjects(): Promise<ProjectSummary[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [{
      project: SAMPLE_PASSPORT.project,
      organizationName: SAMPLE_PASSPORT.organization?.name ?? null,
      statusCounts: countStatuses(SAMPLE_PASSPORT.assertions),
      source: "sample",
    }];
  }

  const [projects, orgs, assertions] = await Promise.all([
    supabase.from("public_projects").select("*").order("title"),
    supabase.from("public_organizations").select("id, name"),
    supabase.from("public_assertions").select("project_id, status"),
  ]);
  for (const r of [projects, orgs, assertions]) {
    if (r.error) throw new Error(`Loading projects failed: ${r.error.message}`);
  }
  const orgName = new Map((orgs.data ?? []).map((o: { id: string; name: string }) => [o.id, o.name]));
  const rows = (assertions.data ?? []) as Pick<PublicAssertion, "project_id" | "status">[];

  return ((projects.data ?? []) as PublicProject[]).map((p) => ({
    project: p,
    organizationName: orgName.get(p.organization_id) ?? null,
    statusCounts: countStatuses(rows.filter((a) => a.project_id === p.id)),
    source: "supabase" as const,
  }));
}
