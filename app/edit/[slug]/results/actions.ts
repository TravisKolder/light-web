"use server";

import { revalidatePath } from "next/cache";
import { UUID, isValidDate } from "@/lib/edit-validation";
import { beginEdit, statementInProject } from "../action-helpers";

// Server actions for the results forms (backlog item 25a): progress reports,
// outcomes, lessons learned and the sustainability plan. Each re-checks
// editor access, validates every field, confirms a linked statement belongs
// to this project, and never sets a status.

const MAX_LONG = 4000;
const MAX_SHORT = 300;

export async function addProgressReport(formData: FormData) {
  const { get, slug, projectId, supabase, today, back, to } = await beginEdit(formData, {
    page: "results", anchor: "add-report", errorKey: "reportError",
  });
  const start = get("period_start");
  const end = get("period_end");
  const summary = get("summary");
  const setbacks = get("setbacks");
  const authorId = get("author_id");
  const assertionId = get("assertion_id");

  if (!isValidDate(start) || !isValidDate(end)) back("date");
  if (start > end) back("order");
  if (end > today) back("future");
  if (summary.length === 0) back("summary");
  if (summary.length > MAX_LONG || setbacks.length > MAX_LONG) back("long");
  if (authorId && !UUID.test(authorId)) back("person");
  if (assertionId && !UUID.test(assertionId)) back("assertion");
  if (assertionId && !(await statementInProject(supabase, assertionId, projectId))) back("assertion");

  const { error } = await supabase.from("progress_reports").insert({
    project_id: projectId,
    period_start: start,
    period_end: end,
    summary,
    setbacks: setbacks || null,
    author_id: authorId || null,
    assertion_id: assertionId || null,
  });
  if (error) {
    console.error("addProgressReport failed:", error.message);
    back("save");
  }
  revalidatePath(`/edit/${slug}/results`);
  to("reportAdded=1");
}

export async function addOutcome(formData: FormData) {
  const { get, slug, projectId, supabase, back, to } = await beginEdit(formData, {
    page: "results", anchor: "add-outcome", errorKey: "outcomeError",
  });
  const description = get("description");
  const measure = get("measure");
  const target = get("target");
  const achieved = get("achieved");
  const assertionId = get("assertion_id");

  if (description.length === 0) back("description");
  if ([description, measure, target, achieved].some((v) => v.length > MAX_SHORT)) back("long");
  if (assertionId && !UUID.test(assertionId)) back("assertion");
  if (assertionId && !(await statementInProject(supabase, assertionId, projectId))) back("assertion");

  const { error } = await supabase.from("outcomes").insert({
    project_id: projectId,
    description,
    measure: measure || null,
    target: target || null,
    achieved: achieved || null,
    assertion_id: assertionId || null,
  });
  if (error) {
    console.error("addOutcome failed:", error.message);
    back("save");
  }
  revalidatePath(`/edit/${slug}/results`);
  to("outcomeAdded=1");
}

export async function addLesson(formData: FormData) {
  const { get, slug, projectId, supabase, today, back, to } = await beginEdit(formData, {
    page: "results", anchor: "add-lesson", errorKey: "lessonError",
  });
  const lesson = get("lesson");
  const recordedOn = get("recorded_on");

  if (lesson.length === 0) back("lesson");
  if (lesson.length > MAX_LONG) back("long");
  if (recordedOn && !isValidDate(recordedOn)) back("date");
  if (recordedOn > today) back("future");

  const { error } = await supabase.from("lessons").insert({
    project_id: projectId,
    lesson,
    // Empty → today where the project is.
    recorded_on: recordedOn || today,
  });
  if (error) {
    console.error("addLesson failed:", error.message);
    back("save");
  }
  revalidatePath(`/edit/${slug}/results`);
  to("lessonAdded=1");
}

export async function addSustainabilityPlan(formData: FormData) {
  const { get, slug, projectId, supabase, back, to } = await beginEdit(formData, {
    page: "results", anchor: "add-plan", errorKey: "planError",
  });
  const plan = get("plan");
  const funding = get("funding_after_grant");
  const owner = get("local_owner");
  const reviewOn = get("review_on");

  if (plan.length === 0) back("plan");
  if (plan.length > MAX_LONG || funding.length > MAX_LONG || owner.length > MAX_SHORT) back("long");
  // The review date is a plan, so it may be in the future.
  if (reviewOn && !isValidDate(reviewOn)) back("date");

  const { error } = await supabase.from("sustainability_plans").insert({
    project_id: projectId,
    plan,
    funding_after_grant: funding || null,
    local_owner: owner || null,
    review_on: reviewOn || null,
  });
  if (error) {
    console.error("addSustainabilityPlan failed:", error.message);
    back("save");
  }
  revalidatePath(`/edit/${slug}/results`);
  to("planAdded=1");
}
