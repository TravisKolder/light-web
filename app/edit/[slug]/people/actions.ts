"use server";

import { revalidatePath } from "next/cache";
import { UUID, isValidDate } from "@/lib/edit-validation";
import { beginEdit } from "../action-helpers";

// Server actions for people, project leaders and the project's public text
// (backlog item 26c). People are shared across projects; contact details are
// private columns that no public view reads. Every change is kept in
// audit_log by the database.

const MAX_NAME = 200;
const MAX_LONG = 4000;
const MAX_OBJECTIVE = 300;
const MAX_OBJECTIVES = 20;
const LEADER_ROLES = ["local_lead", "treasurer", "board", "staff", "other"] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function addPerson(formData: FormData) {
  const { get, slug, supabase, back, to } = await beginEdit(formData, {
    page: "people", anchor: "add-person", errorKey: "personError",
  });
  const displayName = get("display_name");
  const roleTitle = get("role_title");
  const isPublic = get("public_profile") === "yes";
  const isBeneficiary = get("is_beneficiary") === "yes";
  const fullName = get("full_name");
  const email = get("email");
  const phone = get("phone");

  if (displayName.length === 0) back("name");
  if ([displayName, roleTitle, fullName, email, phone].some((v) => v.length > MAX_NAME)) back("long");
  if (isPublic && isBeneficiary) back("beneficiaryPublic");
  if (email && !EMAIL.test(email)) back("email");

  const { error } = await supabase.from("people").insert({
    display_name: displayName,
    role_title: roleTitle || null,
    public_profile: isPublic,
    is_beneficiary: isBeneficiary,
    full_name: fullName || null,
    email: email || null,
    phone: phone || null,
  });
  if (error) {
    console.error("addPerson failed:", error.message);
    back("save");
  }
  revalidatePath(`/edit/${slug}/people`);
  to("personAdded=1");
}

export async function addLeader(formData: FormData) {
  const { get, slug, projectId, supabase, today, back, to } = await beginEdit(formData, {
    page: "people", anchor: "add-leader", errorKey: "leaderError",
  });
  const personId = get("person_id");
  const role = get("role");
  const since = get("since");

  if (!UUID.test(personId)) back("person");
  if (!(LEADER_ROLES as readonly string[]).includes(role)) back("role");
  if (since && !isValidDate(since)) back("date");
  if (since && since > today) back("future");

  // A leader can't also be an independent verifier of this project. The
  // database checks this when a verification is added; this covers the
  // other order (a verifier later made a leader).
  const { data: verified } = await supabase
    .from("verifications")
    .select("id, assertions!inner(project_id)")
    .eq("verifier_id", personId)
    .eq("assertions.project_id", projectId)
    .limit(1);
  if (verified && verified.length > 0) back("verifier");

  const { error } = await supabase.from("project_leaders").insert({
    project_id: projectId,
    person_id: personId,
    role,
    since: since || null,
  });
  if (error) {
    if (error.code === "23505") back("already");
    if (/beneficiary/i.test(error.message)) back("beneficiary");
    console.error("addLeader failed:", error.message);
    back("save");
  }
  revalidatePath(`/edit/${slug}/people`);
  to("leaderAdded=1");
}

export async function updateAbout(formData: FormData) {
  const { get, slug, projectId, supabase, back, to } = await beginEdit(formData, {
    page: "people", anchor: "about", errorKey: "aboutError",
  });
  const need = get("need_statement");
  const objectives = get("objectives")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const orgDescription = get("org_description");

  if (need.length > MAX_LONG || orgDescription.length > MAX_LONG) back("long");
  if (objectives.length > MAX_OBJECTIVES) back("tooMany");
  if (objectives.some((o) => o.length > MAX_OBJECTIVE)) back("objectiveLong");

  const { data: project } = await supabase
    .from("projects")
    .select("organization_id")
    .eq("id", projectId)
    .maybeSingle<{ organization_id: string }>();
  if (!project) back("project");

  const [p, o] = await Promise.all([
    supabase.from("projects").update({ need_statement: need || null, objectives }).eq("id", projectId),
    supabase.from("organizations").update({ description: orgDescription || null }).eq("id", project!.organization_id),
  ]);
  for (const r of [p, o]) {
    if (r.error) {
      console.error("updateAbout failed:", r.error.message);
      back("save");
    }
  }
  revalidatePath(`/edit/${slug}/people`);
  to("aboutSaved=1");
}
