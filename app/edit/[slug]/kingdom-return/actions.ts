"use server";

import { revalidatePath } from "next/cache";
import { UUID, isValidDate } from "@/lib/edit-validation";
import { beginEdit } from "../action-helpers";

// Server action for a Kingdom Return entry (backlog item 25b; concept paper
// §6). An entry is a narrative for one dimension, tied to the statements and
// evidence that support it. There is deliberately no score, rating or rank
// anywhere in this form or in the table behind it.

const DIMENSIONS = ["multiplication", "subtraction", "stewardship", "sustainability", "restoration"] as const;
const MAX_NARRATIVE = 4000;
const MAX_LINKS = 40;

export async function addKingdomReturnEntry(formData: FormData) {
  const { get, slug, projectId, supabase, today, back, to } = await beginEdit(formData, {
    page: "kingdom-return", anchor: "add-entry", errorKey: "error",
  });
  const dimension = get("dimension");
  const narrative = get("narrative");
  const recordedOn = get("recorded_on");
  const authorId = get("author_id");
  const assertionIds = [...new Set(formData.getAll("link_assertion").map(String))];
  const evidenceIds = [...new Set(formData.getAll("link_evidence").map(String))];

  if (!(DIMENSIONS as readonly string[]).includes(dimension)) back("dimension");
  if (narrative.length === 0) back("narrative");
  if (narrative.length > MAX_NARRATIVE) back("long");
  if (recordedOn && !isValidDate(recordedOn)) back("date");
  if (recordedOn > today) back("future");
  if (authorId && !UUID.test(authorId)) back("person");
  if ([...assertionIds, ...evidenceIds].some((id) => !UUID.test(id))) back("links");
  if (assertionIds.length + evidenceIds.length > MAX_LINKS) back("links");

  // Every linked statement and evidence item must belong to this project
  // (composite foreign keys enforce it too).
  if (assertionIds.length > 0) {
    const { data } = await supabase.from("assertions").select("id").eq("project_id", projectId).in("id", assertionIds);
    if ((data ?? []).length !== assertionIds.length) back("links");
  }
  if (evidenceIds.length > 0) {
    const { data } = await supabase.from("evidence_items").select("id").eq("project_id", projectId).in("id", evidenceIds);
    if ((data ?? []).length !== evidenceIds.length) back("links");
  }

  const { data: entry, error } = await supabase
    .from("kingdom_return_entries")
    .insert({
      project_id: projectId,
      dimension,
      narrative,
      recorded_on: recordedOn || today,
      author_id: authorId || null,
    })
    .select("id")
    .single();
  if (error || !entry) {
    console.error("addKingdomReturnEntry failed:", error?.message);
    back("save");
  }

  const links = [
    ...assertionIds.map((id) => ({ project_id: projectId, entry_id: entry!.id, assertion_id: id })),
    ...evidenceIds.map((id) => ({ project_id: projectId, entry_id: entry!.id, evidence_item_id: id })),
  ];
  if (links.length > 0) {
    const { error: linkError } = await supabase.from("kingdom_return_links").insert(links);
    if (linkError) {
      console.error("addKingdomReturnEntry: links failed:", linkError.message);
      revalidatePath(`/edit/${slug}/kingdom-return`);
      back("linksNotSaved");
    }
  }

  revalidatePath(`/edit/${slug}/kingdom-return`);
  to("added=1");
}
