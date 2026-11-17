"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UUID, isValidDate } from "@/lib/edit-validation";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";
import { loadProject, statementInProject } from "../action-helpers";

// Server action for recording an independent verification (backlog item 21f).
//
// This is the product's main safeguard, so the rules live in the database:
// a trigger refuses any verifier with a tie to the project, and only the
// database can move a statement to "verified" (and only for a confirmed,
// unflagged verification). This action records what the verifier reported; it
// never sets a status and never decides whether a statement is true.

const METHODS = ["site_visit", "document_review", "third_party_audit", "photo_geolocation", "interview", "other"] as const;
const FINDINGS = ["confirmed", "not_confirmed", "disputed"] as const;
const MAX_DECLARATION = 2000;
const MAX_NOTES = 4000;
const MAX_NAME = 120;

// The database's reason for refusing a verifier → the error shown on the page.
const TIE_REASONS: [RegExp, string][] = [
  [/a beneficiary cannot verify/, "tieBeneficiary"],
  [/listed as a leader/, "tieLeader"],
  [/made an assertion/, "tieStatement"],
  [/uploaded documents/, "tieDocument"],
  [/supplied evidence/, "tieEvidence"],
  [/gave funds/, "tieGiver"],
  [/contact for a supplier/, "tieSupplier"],
  [/wrote a progress report/, "tieReport"],
  [/wrote a Kingdom Return entry/, "tieKingdomReturn"],
];

export async function addVerification(formData: FormData) {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const slug = get("slug");
  const projectId = get("project_id");
  const assertionId = get("assertion_id");
  const verifierId = get("verifier_id");
  const newName = get("new_verifier_name");
  const newRole = get("new_verifier_role");
  const newPublic = formData.get("new_verifier_public") === "on";
  const declaration = get("independence_declaration");
  const declaredOn = get("independence_declared_on");
  const verifiedOn = get("verified_on");
  const method = get("method");
  const finding = get("finding");
  const notes = get("notes");
  const confirmed = formData.get("declaration_confirmed") === "on";
  const back = (q: string) => redirect(`/edit/${encodeURIComponent(slug)}/verify?${q}#add-verification`);

  const session = await getEditorSession();
  if (session.state !== "editor") redirect("/edit");

  if (!UUID.test(projectId)) back("error=project");
  if (!UUID.test(assertionId)) back("error=assertion");
  if (verifierId && !UUID.test(verifierId)) back("error=verifier");
  if (!verifierId && !newName) back("error=verifier");
  if (verifierId && newName) back("error=verifierBoth");
  if (newName.length > MAX_NAME || newRole.length > MAX_NAME) back("error=long");
  if (declaration.length === 0) back("error=declaration");
  if (declaration.length > MAX_DECLARATION || notes.length > MAX_NOTES) back("error=long");
  if (!confirmed) back("error=notConfirmed");
  if (!isValidDate(declaredOn) || !isValidDate(verifiedOn)) back("error=date");
  if (declaredOn > verifiedOn) back("error=order");
  if (!(METHODS as readonly string[]).includes(method)) back("error=method");
  if (!(FINDINGS as readonly string[]).includes(finding)) back("error=finding");

  const supabase = (await getSupabaseServerClient())!;
  const project = await loadProject(supabase, projectId);
  if (!project) back("error=project");
  if (verifiedOn > project!.today) back("error=future");
  // verifications has no project column: confirm the statement is this project's.
  if (!(await statementInProject(supabase, assertionId, projectId))) back("error=assertion");

  // A new verifier is added only after everything else has passed. Only a
  // display name and role are taken; contact details are private and not
  // collected by this form.
  let verifier = verifierId;
  if (newName) {
    const { data: created, error: personError } = await supabase
      .from("people")
      .insert({ display_name: newName, role_title: newRole || null, public_profile: newPublic })
      .select("id")
      .single();
    if (personError || !created) {
      console.error("addVerification: creating verifier failed:", personError?.message);
      back("error=save");
    }
    verifier = created!.id as string;
  }

  const { error } = await supabase.from("verifications").insert({
    assertion_id: assertionId,
    verifier_id: verifier,
    independence_declaration: declaration,
    independence_declared_on: declaredOn,
    verified_on: verifiedOn,
    method,
    finding,
    notes: notes || null,
  });
  if (error) {
    console.error("addVerification failed:", error.message);
    const tie = TIE_REASONS.find(([re]) => re.test(error.message))?.[1];
    back(`error=${tie ?? (/not independent/.test(error.message) ? "tie" : "save")}`);
  }

  revalidatePath(`/edit/${slug}/verify`);
  revalidatePath(`/edit/${slug}`);
  back(`added=${finding}`);
}
