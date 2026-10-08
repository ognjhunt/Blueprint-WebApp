import { TaskThumbnail } from "./TaskThumbnail";
import { TaskThumbnailEditor } from "./TaskThumbnailEditor";
import { useEffect, useRef, useState } from "react";
import { type TaskListingDetails, opportunityLabels } from "@/types/taskBrowse";
import { TaskFacts } from "./TaskFacts";
const blank: TaskListingDetails = { title: "", taskFamily: "", siteType: "", region: "", objects: "", cycleTarget: "", pilotTiming: "", pilotBudget: "", pilotPriceStatus: "target_budget", pilotConditions: "", ongoingTarget: "", opportunity: "not_seeking" };

/** Public text is a separate, explicit grant. A capture grant never populates this. */
export function PublicTaskListing(props: { token: string; jobRevision?: string }) {
  return <PublicTaskListingForToken key={props.token} {...props} />;
}
function PublicTaskListingForToken({ token, jobRevision }: { token: string; jobRevision?: string }) {
  const dirty = useRef(false);
  const [revision, setRevision] = useState<string>();
  const [error, setError] = useState("");
  const [details, setDetails] = useState(blank);
  const [thumbnailPng, setThumbnailPng] = useState<string | null | undefined>(undefined);
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState("loading");
  const [reviewRequired, setReviewRequired] = useState(false);
  const [sources, setSources] = useState<Record<string, { basis: string; field: string }>>({});
  useEffect(() => {
    let active = true;
    fetch(`/api/task-listings/owner/${encodeURIComponent(token)}`).then(async r => {
      if (!r.ok) throw new Error();
      const { listing, draft, briefRevision, thumbnailPng: savedThumbnail } = await r.json();
      if (!active) return;
      setRevision(briefRevision);
      setConsent(false);
      setExistingThumbnail(savedThumbnail ?? null);
      if (!dirty.current) {
        if (listing) setDetails({ ...blank, ...listing.details });
        else if (draft?.details) setDetails({ ...blank, ...draft.details });
        setEnabled(listing?.enabled === true);
      }
      setSources(dirty.current ? {} : Object.fromEntries(Object.entries(draft?.sources ?? {}).filter(([field]) =>
        !listing || listing.details?.[field] === draft?.details?.[field])) as Record<string, { basis: string; field: string }>);
      setReviewRequired(listing?.reviewRequired === true);
      setState("idle");
    }).catch(() => { if (active) setState("load_error"); });
    return () => { active = false; };
  }, [token, jobRevision]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setState("saving");
    try {
      const r = await fetch(`/api/task-listings/owner/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, details, consent, expectedBriefRevision: revision, thumbnailPng, ...(thumbnailPng ? { thumbnailConsent: true } : {}) }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "The card was not saved.");
      dirty.current = false; setReviewRequired(false); setState("saved");
    } catch (error) { setError(error instanceof Error ? error.message : "The card was not saved."); setState("error"); }
  }
  const previewThumbnail = thumbnailPng === undefined ? existingThumbnail : thumbnailPng;
  const field = (key: Exclude<keyof TaskListingDetails, "targeting">, label: string, maxLength: number, required = false) =>
    <label key={key}>{label}<input value={details[key] ?? ""} maxLength={maxLength} minLength={key === "title" ? 8 : undefined} required={required}
      onChange={e => { dirty.current = true; setDetails({ ...details, [key]: e.target.value }); setConsent(false); setState("idle"); }} /></label>;
  return <details className="ms-task-interest"><summary>Manage opportunity sharing (optional)</summary>
    <p className="ms-field-hint">Optional. Share only the text and thumbnail you approve below. Your contact details, full footage and scene stay private. Use a general region and leave out identifying details.</p>
    <p className="ms-field-hint">This card belongs to the same job. {sources.title ? "The title comes from your job brief. " : ""}{sources.cycleTarget ? "The cycle target comes from your stated success criteria, not an observed video rate. " : ""}Review changes for public use; saving a private draft does not publish it.</p>
    {reviewRequired && <p role="alert">Your brief changed. The card is hidden for renewed review; your public edits are retained.</p>}
    {state === "loading" ? <p role="status">Loading your card…</p> : state === "load_error" ? <p role="alert">Your card could not be loaded. Reopen this page to try again.</p> :
      <form className="ms-form" onSubmit={save} aria-label="Public job card">
        {field("title", "Describe the job without naming your site", 160, true)}
        {field("taskFamily", "Job type", 60, true)}
        {field("objects", "Objects (optional)", 160)}
        {field("region", "Region (optional)", 80)}
        <details><summary>More job details (optional)</summary>
          {field("siteType", "Site type", 80)}{field("cycleTarget", "Cycle target", 80)}
          {field("pilotTiming", "Pilot timing", 80)}
          <label>Pilot conditions (optional)<textarea value={details.pilotConditions ?? ""} maxLength={320} onChange={e => { dirty.current = true; setDetails({ ...details, pilotConditions: e.target.value }); setConsent(false); setState("idle"); }} placeholder="For example: four weeks, including setup and provider support" /></label>
          <p className="ms-field-hint">You do not need to propose a budget. Any provider cost belongs in a concrete pilot proposal for applicable approval. Previously supplied price information stays on this job; this form does not amend an agreement.</p>
        </details>
        <label>Pilot availability<select value={details.opportunity} onChange={e => { dirty.current = true; setDetails({ ...details, opportunity: e.target.value as TaskListingDetails["opportunity"] }); setConsent(false); }}>
          {Object.entries(opportunityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <TaskThumbnailEditor existing={existingThumbnail} onChange={png => { dirty.current = true; setThumbnailPng(png); setConsent(false); setState("idle"); }} />
        <div className="ms-task-preview" aria-label="Public card preview"><p className="ms-field-hint">Public preview · {opportunityLabels[details.opportunity]}</p><div className="ms-task-heading"><h3>{details.title || "Your job"}</h3><TaskThumbnail src={previewThumbnail ? `data:image/png;base64,${previewThumbnail}` : null} title={details.title || "Your job"} taskFamily={details.taskFamily} /></div><p>{details.taskFamily}</p><TaskFacts details={details} /></div>
        <label className="ms-check-row"><input type="checkbox" checked={enabled} onChange={e => { dirty.current = true; setEnabled(e.target.checked); setConsent(false); }} />Show this card in the job library</label>
        {enabled && details.opportunity === "open" && <p className="ms-field-hint">Opening to pilot proposals is free. Any later work needs separately agreed scope and cost. <a href="/beta#scope" target="_blank" rel="noreferrer">Beta program scope</a></p>}
        <label className="ms-check-row"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required={enabled} />I reviewed the text and thumbnail for identifying details and am authorized to make them public. I can remove this card here at any time.</label>
        <button className="ms-button" disabled={state === "saving"}>{state === "saving" ? "Saving…" : enabled ? "Publish reviewed card" : "Save private draft"}</button>
        {state === "saved" && <p role="status">{enabled ? "Public card saved. Listing pauses and rights restrictions still apply." : "Your card is hidden."}</p>}
        {state === "error" && <p role="alert">{error}</p>}
      </form>}
  </details>;
}
