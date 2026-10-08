import { withCsrfHeader } from "@/lib/csrf";
import type { User } from "firebase/auth";
import { TaskThumbnail } from "./TaskThumbnail";
import { isLikelyPhone } from "@/lib/device";
import { TaskFacts } from "./TaskFacts";
import { useEffect, useState } from "react";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { LibraryAccess } from "@/lib/robotTeamAccess";
import { RobotTeamEarlyAccess } from "./RobotTeamEarlyAccess";
import { opportunityLabels, taskStageLabels, type TaskBrowseCard } from "@/types/taskBrowse";

/** `inWorkspace` drops the public-page extras (the agent API link) inside the signed-in app. */
export function TaskBrowse({ inWorkspace = false }: { inWorkspace?: boolean } = {}) {
  const [items, setItems] = useState<TaskBrowseCard[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [family, setFamily] = useState("");
  const [region, setRegion] = useState("");
  const [availability, setAvailability] = useState("");
  const [access, setAccess] = useState<LibraryAccess | null>(null);
  const [previewApplication, setPreviewApplication] = useState(false);
  const auth = useOptionalAuth();
  const currentUser = auth?.currentUser ?? null;
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    const timeout = window.setTimeout(() => {
      controller.abort();
      setState("error");
    }, 15_000);
    // Early access: the server returns tasks only to an approved team, so the
    // request carries the signed-in account when there is one.
    withFirebaseAuthHeaders(currentUser).catch(() => ({})).then(headers =>
      fetch("/api/site-worlds/tasks", { signal: controller.signal, headers })).then(async response => {
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!Array.isArray(data.items)) throw new Error("invalid library");
      setAccess(data.access ?? null);
      setItems(data.items); setState("ready");
    }).catch(() => { if (!controller.signal.aborted) setState("error"); })
      .finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [retry, currentUser?.uid]);
  const filtered = items.filter(item => (!family || item.taskFamily === family)
    && (!region || item.region.toLowerCase().includes(region.toLowerCase()))
    && (!availability || (availability === "ready" ? item.evaluationAvailable : item.opportunity === availability)));
  // Nothing library-shaped renders until the server has said who may see it,
  // so a visitor outside early access never sees the library flash by.
  // The public application is useful without that lookup. Render the same
  // component on the server, while loading and on failure so typed fields
  // survive the access response and a text reader can inspect the first step.
  if ((state === "loading" || state === "error") && !currentUser) {
    return <RobotTeamEarlyAccess access={null} email={null} />;
  }
  if (state === "loading") return <section aria-label="Job library"><p role="status">Loading…</p></section>;
  if (state === "error") return <section aria-label="Job library"><div role="alert"><p>The job library could not be loaded.</p>
    <button className="ms-button" onClick={() => setRetry(retry + 1)}>Try again</button>
    <p><a href="mailto:hello@tryblueprint.io">Email us about a job or your application</a></p></div></section>;
  // Anything other than an explicit "allowed" is the early-access page.
  const gated = state === "ready" && access !== null && !access.allowed;
  if (gated) return <RobotTeamEarlyAccess access={access} email={currentUser?.email ?? null} />;
  // Say why the library shows instead of the application, so a signed-in
  // viewer is never left guessing. Staff can still see the public form.
  const viewer = currentUser && state === "ready" && access?.staff ? <p className="ms-field-hint" role="note">
    Signed in as {currentUser.email ?? "your account"}
    {access?.staff ? <> · staff view: you see what approved teams see. <button type="button" className="ms-text-link" onClick={() => setPreviewApplication(!previewApplication)}>{previewApplication ? "Back to the job library" : "Preview the application form"}</button></> : access?.gated ? " · approved for early access." : null}
  </p> : null;
  // A preview must never submit: a real submit records an application and
  // sends email, so the whole form is disabled here.
  if (previewApplication) return <>{viewer}<p className="ms-field-hint">Preview only. Submitting is disabled.</p>
    <fieldset disabled aria-label="Application form preview" style={{ border: 0, padding: 0, margin: 0 }}><RobotTeamEarlyAccess access={null} email={null} /></fieldset></>;
  const libraryEmpty = state === "ready" && items.length === 0;
  return <section aria-label="Job library">
    {viewer}
    {!libraryEmpty && <details className="ms-browse-filters" open={!isLikelyPhone()}><summary>Filter jobs</summary>
    <div className="ms-task-filters">
      <label>Job<select aria-label="Filter by job" value={family} onChange={e => setFamily(e.target.value)}>
        <option value="">All jobs</option>{[...new Set(items.map(item => item.taskFamily))].sort().map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Region<input aria-label="Filter by region" placeholder="Any region" value={region} maxLength={80} onChange={e => setRegion(e.target.value)} /></label>
      <label>Availability<select aria-label="Filter by availability" value={availability} onChange={e => setAvailability(e.target.value)}>
        <option value="">Live and past</option><option value="open">Open to pilot proposals</option>
        <option value="ready">Ready to evaluate</option><option value="past">Past opportunities</option>
      </select></label>
    </div>
    </details>}
    {libraryEmpty && <div className="ms-task-empty">
      <h2>The first site jobs are being prepared.</h2>
      <p>Sites film their own jobs and choose whether to share them with robot teams. We email you as soon as a site lists a new job.</p>
    </div>}
    {state === "ready" && items.length > 0 && <>
      <p className="ms-field-hint">{filtered.length} {filtered.length === 1 ? "job" : "jobs"} · Details shared by site owners. A past job can remain available for evaluation.</p>
      {filtered.length === 0 && <div className="ms-task-empty">
        <h2>No jobs match these filters.</h2>
        <p>Try a different job or region, or <a href="mailto:hello@tryblueprint.io">tell us what you need</a>.</p>
        <button className="ms-text-link" onClick={() => { setFamily(""); setRegion(""); setAvailability(""); }}>Clear filters</button>
      </div>}
      <ul className="ms-task-list">{filtered.map(item => <li key={item.id}>
        <div className="ms-task-heading"><div><div className="ms-task-meta"><span>{taskStageLabels[item.stage]}</span><span>{opportunityLabels[item.opportunity]}</span></div>
        <h2>{item.title}</h2></div><TaskThumbnail src={item.thumbnailUrl} title={item.title} taskFamily={item.taskFamily} /></div><TaskFacts details={item} />
        {item.evaluationAvailable ? <a className="ms-text-link" href={inWorkspace ? `/app/opportunities/${encodeURIComponent(item.id)}` : "/app"}>Request a free invited evaluation</a> : <p className="ms-field-hint">An evaluation is not ready yet. You can still assess the shared job and provide proposal inputs.</p>}
        {item.opportunity === "open" && currentUser && !access?.staff && <TeamJobResponse jobId={item.id} user={currentUser} />}
      </li>)}</ul>
    </>}
    <p className="ms-field-hint">Invited evaluations are free within the approved scope and share results with the site.</p>
    <p className="ms-field-hint">{!inWorkspace && <><a href="/agent-access.openapi.json">Agent API (OpenAPI spec, JSON)</a> · </>}<a href="mailto:hello@tryblueprint.io">Talk to a person</a></p>
  </section>;
}

/** The existing card is sufficient to express interest; private job data remains private. */
function TeamJobResponse({ jobId, user }: { jobId: string; user: User }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    const data = new FormData(event.currentTarget); setSaving(true); setMessage("");
    try {
      const state = String(data.get("state")), recommendationId = String(data.get("recommendationId") || "").trim();
      const response = await fetch(`/api/site-worlds/tasks/${encodeURIComponent(jobId)}/interest`, { method: "POST", credentials: "include",
        headers: await withFirebaseAuthHeaders(user, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ state, inputs: data.get("inputs"), ...(state === "committed" ? { recommendationId, authorized: data.get("authorized") === "on" } : {}) }) });
      const body = await response.json();
      setMessage(response.ok ? body.nextAction : body.error || "Your response was not saved.");
    } catch { setMessage("Your response was not confirmed. Try again from this job."); }
    finally { setSaving(false); }
  }
  return <details><summary>Respond about this job</summary><form onSubmit={submit} className="ms-form" aria-label="Respond about this job">
    <p className="ms-field-hint">Only the shared card is available here. Give the quote basis, available timing, evidence of capability or one question needed to scope a proposal. Interest does not commit your team.</p>
    <label>Your decision<select name="state"><option value="interested">Interested — review for a proposal</option><option value="declined">Not a fit</option><option value="committed">Confirm our current proposal commitment</option></select></label>
    <label>Proposal inputs or question<textarea name="inputs" required minLength={4} maxLength={2000} /></label>
    <details><summary>For a commitment already reviewed with Blueprint</summary>
      <label>Proposal reference<input name="recommendationId" maxLength={120} /></label>
      <label className="ms-check-row"><input name="authorized" type="checkbox" />I reviewed that proposal and have authority to commit this team's scope, cost and proposed timing. A confirmed date and site agreement are still required.</label>
    </details>
    <button className="ms-button" disabled={saving}>{saving ? "Saving…" : "Save response"}</button>{message && <p role="status">{message}</p>}
  </form></details>;
}
