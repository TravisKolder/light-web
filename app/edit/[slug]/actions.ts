"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { todayInTimeZone } from "@/lib/format";
import { getEditorSession, getSupabaseServerClient } from "@/lib/supabase/server";
import { EVIDENCE_BUCKET, prepareUpload, randomStoragePath } from "@/lib/uploads";

// Server action for adding an assertion (backlog item 21b).
// The form never sends a status: every new assertion starts as a claim, and
// only the database triggers can move it to documented or verified.

// Keep in sync with maxLength on the form in page.tsx ("use server" files
// may only export async functions).
const MAX_STATEMENT_LENGTH = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

type Supabase = NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>;

// Today's date where the project is (backlog 22d). Read from the database,
// never from the form. Falls back to UTC if the project has no time zone yet
// (migration 015 not applied).
async function projectToday(supabase: Supabase, projectId: string) {
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle<{ timezone?: string }>();
  return todayInTimeZone(data?.timezone);
}

export async function addAssertion(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const statement = String(formData.get("statement") ?? "").trim();
  const assertedBy = String(formData.get("asserted_by") ?? "").trim();
  const assertedOn = String(formData.get("asserted_on") ?? "").trim();
  const back = (q: string) => redirect(`/edit/${encodeURIComponent(slug)}?${q}#add`);

  const session = await getEditorSession();
  if (session.state !== "editor") redirect("/edit");

  if (!UUID.test(projectId)) back("error=project");
  if (statement.length === 0) back("error=statement");
  if (statement.length > MAX_STATEMENT_LENGTH) back("error=long");
  if (assertedBy && !UUID.test(assertedBy)) back("error=person");
  if (assertedOn && !isValidDate(assertedOn)) back("error=date");

  const supabase = (await getSupabaseServerClient())!;
  const today = await projectToday(supabase, projectId);
  if (assertedOn > today) back("error=future");

  const { error } = await supabase.from("assertions").insert({
    project_id: projectId,
    statement,
    asserted_by: assertedBy || null,
    // Empty → today where the project is.
    asserted_on: assertedOn || today,
  });
  if (error) {
    console.error("addAssertion failed:", error.message);
    back("error=save");
  }

  revalidatePath(`/edit/${slug}`);
  back("added=1");
}

// Server action for attaching a document to a statement (backlog items 21c1
// and 27b). The file is optional; when given, it is checked and cleaned in
// lib/uploads.ts, stored under a random name in the private `evidence`
// bucket, and its path saved in documents.storage_path. Adding a
// document lets the database trigger move the statement from claim to
// documented; this action never touches the status itself.

const DOCUMENT_KINDS = [
  "receipt",
  "invoice",
  "photo",
  "report",
  "contract",
  "bank_statement",
  "other",
] as const;
const MAX_TITLE_LENGTH = 300;

export async function addDocument(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const assertionId = String(formData.get("assertion_id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const issuedOn = String(formData.get("issued_on") ?? "").trim();
  const uploadedBy = String(formData.get("uploaded_by") ?? "").trim();
  const personal = formData.get("contains_personal_data") === "on";
  const back = (q: string) => redirect(`/edit/${encodeURIComponent(slug)}?${q}#add-document`);

  const session = await getEditorSession();
  if (session.state !== "editor") redirect("/edit");

  if (!UUID.test(projectId)) back("docError=project");
  if (!UUID.test(assertionId)) back("docError=assertion");
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) back("docError=kind");
  if (title.length === 0) back("docError=title");
  if (title.length > MAX_TITLE_LENGTH) back("docError=long");
  if (uploadedBy && !UUID.test(uploadedBy)) back("docError=person");
  if (issuedOn && !isValidDate(issuedOn)) back("docError=date");

  const supabase = await getSupabaseServerClient();
  if (issuedOn > (await projectToday(supabase!, projectId))) back("docError=future");
  // documents has no project_id column, so confirm the statement belongs to
  // this project before attaching anything to it.
  const { data: assertion } = await supabase!
    .from("assertions")
    .select("id")
    .eq("id", assertionId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!assertion) back("docError=assertion");

  // Optional file. Checked only after every other field passed, so a typo
  // never leaves an orphaned file in storage.
  let storagePath: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const prepared = await prepareUpload(file);
    if (!prepared.ok) back(`docError=${prepared.error}`);
    if (prepared.ok) {
      storagePath = randomStoragePath("documents", prepared.ext);
      const { error: upErr } = await supabase!.storage
        .from(EVIDENCE_BUCKET)
        .upload(storagePath, prepared.bytes, { contentType: prepared.contentType, upsert: false });
      if (upErr) {
        console.error("addDocument upload failed:", upErr.message);
        back("docError=fileUpload");
      }
    }
  }

  const { error } = await supabase!.from("documents").insert({
    assertion_id: assertionId,
    kind,
    title,
    issued_on: issuedOn || null,
    uploaded_by: uploadedBy || null,
    contains_personal_data: personal,
    storage_path: storagePath,
  });
  if (error) {
    console.error("addDocument failed:", error.message);
    // Don't leave a file behind that no document points to.
    if (storagePath) await supabase!.storage.from(EVIDENCE_BUCKET).remove([storagePath]);
    back("docError=save");
  }

  revalidatePath(`/edit/${slug}`);
  back("docAdded=1");
}

// Server action for recording evidence against a statement (backlog items
// 21c2 and 27c). An optional file goes through the same checks as documents
// (real type, EXIF/GPS stripped, random name, private bucket). If the editor
// ticks "use the photo's location" and leaves the GPS fields empty, the GPS
// read from the original photo fills the PRIVATE gps fields. Evidence
// counts as a supporting document, so the database trigger may move the
// statement from claim to documented; this action never sets a status.
// GPS is PRIVATE (never in a public view); items that show identifiable
// people are left out of public views entirely.

const EVIDENCE_KINDS = ["photo", "video", "receipt", "site_report", "other"] as const;
const MAX_CAPTION_LENGTH = 500;
const MAX_LOCATION_LENGTH = 200;
const COORD = /^-?\d{1,3}(\.\d{1,6})?$/;

export async function addEvidence(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const assertionId = String(formData.get("assertion_id") ?? "").trim();
  const kind = String(formData.get("kind") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const capturedOn = String(formData.get("captured_on") ?? "").trim();
  const locationLabel = String(formData.get("location_label") ?? "").trim();
  const uploadedBy = String(formData.get("uploaded_by") ?? "").trim();
  const identifiable = formData.get("shows_identifiable_people") === "on";
  let lat = String(formData.get("gps_lat") ?? "").trim();
  let lng = String(formData.get("gps_lng") ?? "").trim();
  const usePhotoGps = formData.get("use_photo_gps") === "on";
  const back = (q: string) => redirect(`/edit/${encodeURIComponent(slug)}?${q}#add-evidence`);

  const session = await getEditorSession();
  if (session.state !== "editor") redirect("/edit");

  if (!UUID.test(projectId)) back("evError=project");
  if (!UUID.test(assertionId)) back("evError=assertion");
  if (!(EVIDENCE_KINDS as readonly string[]).includes(kind)) back("evError=kind");
  if (caption.length === 0) back("evError=caption");
  if (caption.length > MAX_CAPTION_LENGTH) back("evError=long");
  if (locationLabel.length > MAX_LOCATION_LENGTH) back("evError=location");
  if (uploadedBy && !UUID.test(uploadedBy)) back("evError=person");
  if (capturedOn && !isValidDate(capturedOn)) back("evError=date");
  // GPS: both or neither, within range (mirrors the table's constraints).
  if (Boolean(lat) !== Boolean(lng)) back("evError=gpsPair");
  if (lat) {
    if (!COORD.test(lat) || !COORD.test(lng)) back("evError=gps");
    const la = Number(lat);
    const ln = Number(lng);
    if (la < -90 || la > 90 || ln < -180 || ln > 180) back("evError=gps");
  }

  const supabase = await getSupabaseServerClient();
  if (capturedOn > (await projectToday(supabase!, projectId))) back("evError=future");
  // The table's composite foreign key also enforces this; checking first
  // gives a plain-language error instead of a database one.
  const { data: assertion } = await supabase!
    .from("assertions")
    .select("id")
    .eq("id", assertionId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!assertion) back("evError=assertion");

  // Optional file, checked only after every other field passed.
  let storagePath: string | null = null;
  let gpsNote = "";
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const prepared = await prepareUpload(file);
    if (!prepared.ok) back(`evError=${prepared.error}`);
    if (prepared.ok) {
      if (usePhotoGps && !lat) {
        if (prepared.gps) {
          lat = String(prepared.gps.lat);
          lng = String(prepared.gps.lng);
          gpsNote = "&gps=used";
        } else {
          gpsNote = "&gps=none";
        }
      }
      storagePath = randomStoragePath("evidence", prepared.ext);
      const { error: upErr } = await supabase!.storage
        .from(EVIDENCE_BUCKET)
        .upload(storagePath, prepared.bytes, { contentType: prepared.contentType, upsert: false });
      if (upErr) {
        console.error("addEvidence upload failed:", upErr.message);
        back("evError=fileUpload");
      }
    }
  }

  const { error } = await supabase!.from("evidence_items").insert({
    project_id: projectId,
    assertion_id: assertionId,
    kind,
    caption,
    captured_on: capturedOn || null,
    location_label: locationLabel || null,
    uploaded_by: uploadedBy || null,
    shows_identifiable_people: identifiable,
    gps_lat: lat ? Number(lat) : null,
    gps_lng: lng ? Number(lng) : null,
    storage_path: storagePath,
  });
  if (error) {
    console.error("addEvidence failed:", error.message);
    // Don't leave a file behind that no evidence item points to.
    if (storagePath) await supabase!.storage.from(EVIDENCE_BUCKET).remove([storagePath]);
    back("evError=save");
  }

  revalidatePath(`/edit/${slug}`);
  back(`evAdded=1${gpsNote}`);
}
