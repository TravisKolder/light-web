import type { Metadata } from "next";
import { formatDate } from "@/lib/format";
import { Crumbs, FormMessages, ProjectFields, loadEditorProject } from "../page-helpers";
import { addLeader, addPerson, updateAbout } from "./actions";

// Editor: the project's public text (need, objectives, organization
// description), its leaders, and people (backlog item 26c). People are shared
// across projects. Names and titles show publicly only for people with a
// public profile; contact details never do.

export const metadata: Metadata = { title: "Edit people and project details — Light Web" };
export const dynamic = "force-dynamic";

const COMMON: Record<string, string> = {
  project: "That project couldn't be found. Go back to the editor home and try again.",
  long: "One of the text boxes is too long.",
  save: "It couldn't be saved. Please try again; if it keeps failing, tell Travis.",
};
const ABOUT_ERRORS = {
  ...COMMON,
  tooMany: "Please list at most 20 objectives.",
  objectiveLong: "Each objective can be at most 300 characters.",
};
const LEADER_ERRORS = {
  ...COMMON,
  person: "Please choose a person from the list.",
  role: "Please choose a role.",
  date: "Please enter a valid date.",
  future: "The date can't be in the future.",
  already: "That person is already listed in that role.",
  beneficiary: "A beneficiary can't be listed as a project leader.",
  verifier:
    "That person verified a statement in this project, so they can't also be a leader: a verifier must be independent of the project.",
};
const PERSON_ERRORS = {
  ...COMMON,
  name: "Please give the name to show (for example a first name and initial).",
  email: "Please enter a valid email address, or leave it empty.",
  beneficiaryPublic: "Beneficiaries are never shown publicly. Untick one of the two boxes.",
};

const ROLE_LABEL: Record<string, string> = {
  local_lead: "Local lead", treasurer: "Treasurer", board: "Board member", staff: "Staff", other: "Other",
};

type ProjectText = { need_statement: string | null; objectives: string[] | null; organization_id: string };
type LeaderRow = {
  role: string; since: string | null;
  person: { id: string; display_name: string; role_title: string | null; public_profile: boolean } | null;
};
type PersonRow = {
  id: string; display_name: string; role_title: string | null; public_profile: boolean; is_beneficiary: boolean;
};

export default async function EditPeople({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const q = await searchParams;
  const { supabase, project, today } = await loadEditorProject(slug);
  const text = project as unknown as ProjectText;

  const [orgRes, leadersRes, peopleRes] = await Promise.all([
    supabase.from("organizations").select("name, description").eq("id", text.organization_id)
      .maybeSingle<{ name: string; description: string | null }>(),
    supabase.from("project_leaders")
      .select("role, since, person:people(id, display_name, role_title, public_profile)")
      .eq("project_id", project.id).order("role"),
    supabase.from("people").select("id, display_name, role_title, public_profile, is_beneficiary")
      .order("display_name"),
  ]);
  const org = orgRes.data;
  const leaders = (leadersRes.data ?? []) as unknown as LeaderRow[];
  const people = (peopleRes.data ?? []) as PersonRow[];
  const leaderChoices = people.filter((p) => !p.is_beneficiary);

  return (
    <main className="passport">
      <Crumbs project={project} here="People and project details" />
      <h1>People and project details</h1>

      <h2 id="about">Need, objectives and organization</h2>
      <p className="small muted">All of this is public on the passport.</p>
      <FormMessages added={q.aboutSaved} addedText="Saved." error={q.aboutError} errors={ABOUT_ERRORS} />
      <form action={updateAbout} className="editor-form">
        <ProjectFields project={project} />
        <label htmlFor="need_statement">The need this project addresses</label>
        <textarea id="need_statement" name="need_statement" rows={4} maxLength={4000}
          defaultValue={text.need_statement ?? ""} />
        <label htmlFor="objectives">Objectives (one per line)</label>
        <textarea id="objectives" name="objectives" rows={5}
          defaultValue={(text.objectives ?? []).join("\n")} />
        <label htmlFor="org_description">About {org?.name ?? "the organization"}</label>
        <textarea id="org_description" name="org_description" rows={4} maxLength={4000}
          defaultValue={org?.description ?? ""} />
        <p className="small muted">
          The organization description is shared by all of its projects.
        </p>
        <button type="submit">Save</button>
      </form>

      <h2 id="leaders">Project leaders</h2>
      <p className="small muted">
        The role always shows on the passport; the name and title only for people with a
        public profile.
      </p>
      {leaders.length === 0 ? (
        <p className="muted">No leaders listed yet.</p>
      ) : (
        <ul className="statement-list">
          {leaders.map((l) => (
            <li key={`${l.person?.id}-${l.role}`}>
              <strong>{ROLE_LABEL[l.role] ?? l.role}</strong>: {l.person?.display_name ?? "Unknown person"}
              {l.person?.role_title ? ` (${l.person.role_title})` : ""}
              <p className="muted small">
                {l.since ? `Since ${formatDate(l.since)}` : "Start date not recorded"}
                {" · "}
                {l.person?.public_profile ? "Name shown publicly" : "Name hidden publicly (role only)"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <h3 id="add-leader">Add a leader</h3>
      <FormMessages added={q.leaderAdded} addedText="Leader added." error={q.leaderError} errors={LEADER_ERRORS} />
      {leaderChoices.length === 0 ? (
        <p className="muted">Add a person below first.</p>
      ) : (
        <form action={addLeader} className="editor-form">
          <ProjectFields project={project} />
          <label htmlFor="leader_person">Person</label>
          <select id="leader_person" name="person_id" required defaultValue="">
            <option value="" disabled>Choose a person…</option>
            {leaderChoices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}{p.role_title ? ` (${p.role_title})` : ""}
              </option>
            ))}
          </select>
          <label htmlFor="leader_role">Role</label>
          <select id="leader_role" name="role" required defaultValue="">
            <option value="" disabled>Choose a role…</option>
            {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label htmlFor="leader_since">Since (optional)</label>
          <input id="leader_since" name="since" type="date" max={today} />
          <button type="submit">Add leader</button>
        </form>
      )}

      <h2 id="add-person">Add a person</h2>
      <p className="small muted">
        People are shared across all projects. Only the name to show and title can ever
        appear publicly, and only if &ldquo;public profile&rdquo; is ticked. Full name and
        contact details are private and never shown on a passport.
      </p>
      <FormMessages added={q.personAdded} addedText="Person added." error={q.personError} errors={PERSON_ERRORS} />
      <form action={addPerson} className="editor-form">
        <ProjectFields project={project} />
        <label htmlFor="display_name">Name to show</label>
        <input id="display_name" name="display_name" required maxLength={200} placeholder="e.g. Grace N." />
        <label htmlFor="role_title">Title or role (optional)</label>
        <input id="role_title" name="role_title" maxLength={200} placeholder="e.g. Head teacher" />
        <label className="checkbox">
          <input type="checkbox" name="public_profile" value="yes" /> Public profile: show this
          name and title on passports (only with the person&apos;s consent)
        </label>
        <label className="checkbox">
          <input type="checkbox" name="is_beneficiary" value="yes" /> This person is a
          beneficiary (never shown publicly, can&apos;t be a leader)
        </label>
        <fieldset className="gps">
          <legend>Private (never public)</legend>
          <label htmlFor="full_name">Full name</label>
          <input id="full_name" name="full_name" maxLength={200} />
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" maxLength={200} />
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" maxLength={200} />
        </fieldset>
        <button type="submit">Add person</button>
      </form>

      <h2>Everyone recorded</h2>
      {people.length === 0 ? (
        <p className="muted">No people yet.</p>
      ) : (
        <ul className="statement-list">
          {people.map((p) => (
            <li key={p.id}>
              {p.display_name}{p.role_title ? ` (${p.role_title})` : ""}
              <p className="muted small">
                {p.is_beneficiary ? "Beneficiary · private" : p.public_profile ? "Public profile" : "Private"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
