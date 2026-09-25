import { TaskThumbnail } from "./TaskThumbnail";
import { TaskThumbnailEditor } from "./TaskThumbnailEditor";
import { useEffect, useState } from "react";
import { type TaskListingDetails, opportunityLabels } from "@/types/taskBrowse";
import { TaskFacts } from "./TaskFacts";
const blank: TaskListingDetails = { title: "", taskFamily: "", siteType: "", region: "", objects: "", cycleTarget: "", pilotTiming: "", pilotBudget: "", pilotPriceStatus: "target_budget", pilotConditions: "", ongoingTarget: "", opportunity: "not_seeking" };

/** Public text is a separate, explicit grant. A capture grant never populates this. */
export function PublicTaskListing({ token }: { token: string }) {
  const [details, setDetails] = useState(blank);
  const [thumbnailPng, setThumbnailPng] = useState<string | null | undefined>(undefined);
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState("loading");
  useEffect(() => {
    let active = true;
    fetch(`/api/task-listings/owner/${encodeURIComponent(token)}`).then(async r => {
      if (!r.ok) throw new Error();
      const { listing, thumbnailPng: savedThumbnail } = await r.json();
      if (!active) return;
      setExistingThumbnail(savedThumbnail ?? null);
      if (listing) { setDetails({ ...blank, ...listing.details }); setEnabled(listing.enabled); }
      setState("idle");
    }).catch(() => { if (active) setState("load_error"); });
    return () => { active = false; };
  }, [token]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setState("saving");
    try {
      const r = await fetch(`/api/task-listings/owner/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, details, consent, thumbnailPng, ...(thumbnailPng ? { thumbnailConsent: true } : {}) }),
      });
      if (!r.ok) throw new Error();
      setState("saved");
    } catch { setState("error"); }
  }
  const previewThumbnail = thumbnailPng === undefined ? existingThumbnail : thumbnailPng;
  const field = (key: keyof TaskListingDetails, label: string, maxLength: number, required = false) =>
    <label key={key}>{label}<input value={details[key] ?? ""} maxLength={maxLength} minLength={key === "title" ? 8 : undefined} required={required || (key === "pilotBudget" && details.pilotPriceStatus === "site_offer")}
      onChange={e => { setDetails({ ...details, [key]: e.target.value }); setConsent(false); setState("idle"); }} /></label>;
  return <details className="ms-task-interest"><summary>Share a task card with robot teams</summary>
    <p className="ms-field-hint">Optional. Share only the text and thumbnail you approve below. Your contact details, full footage and scene stay private. Use a general region and leave out identifying details.</p>
    {state === "loading" ? <p role="status">Loading your card…</p> : state === "load_error" ? <p role="alert">Your card could not be loaded. Reopen this page to try again.</p> :
      <form className="ms-form" onSubmit={save} aria-label="Public task card">
        {field("title", "Describe the task without naming your site", 160, true)}
        {field("taskFamily", "Task family", 60, true)}
        {field("objects", "Objects (optional)", 160)}
        {field("region", "Region (optional)", 80)}
        <details><summary>More task details (optional)</summary>
          {field("siteType", "Site type", 80)}{field("cycleTarget", "Cycle target", 80)}
          {field("pilotTiming", "Pilot timing", 80)}
          <label>Pilot price status<select value={details.pilotPriceStatus ?? "target_budget"} onChange={e => { setDetails({ ...details, pilotPriceStatus: e.target.value as TaskListingDetails["pilotPriceStatus"] }); setConsent(false); setState("idle"); }}>
            <option value="target_budget">Target budget, open to proposals</option>
            <option value="site_offer">Site's proposed price</option>
          </select></label>
          {field("pilotBudget", details.pilotPriceStatus === "site_offer" ? "Proposed provider pilot price (before Blueprint fee)" : "Target provider pilot budget (before Blueprint fee)", 80)}
          <label>Pilot conditions (optional)<textarea value={details.pilotConditions ?? ""} maxLength={320} onChange={e => { setDetails({ ...details, pilotConditions: e.target.value }); setConsent(false); setState("idle"); }} placeholder="For example: four weeks, including setup and provider support" /></label>
          {field("ongoingTarget", "Ongoing price target, if the pilot works (optional)", 80)}
          <p className="ms-field-hint">A posted price is a proposal, not a purchase approval. Providers can accept it, ask for changes, or decline after evaluation.</p>
        </details>
        <label>Pilot availability<select value={details.opportunity} onChange={e => { setDetails({ ...details, opportunity: e.target.value as TaskListingDetails["opportunity"] }); setConsent(false); }}>
          {Object.entries(opportunityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <TaskThumbnailEditor existing={existingThumbnail} onChange={png => { setThumbnailPng(png); setConsent(false); setState("idle"); }} />
        <div className="ms-task-preview" aria-label="Public card preview"><p className="ms-field-hint">Public preview · {opportunityLabels[details.opportunity]}</p><div className="ms-task-heading"><h3>{details.title || "Your task"}</h3><TaskThumbnail src={previewThumbnail ? `data:image/png;base64,${previewThumbnail}` : null} title={details.title || "Your task"} taskFamily={details.taskFamily} /></div><p>{details.taskFamily}</p><TaskFacts details={details} /></div>
        <label className="ms-check-row"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Show this card in the task library</label>
        <label className="ms-check-row"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required />I reviewed the text and thumbnail for identifying details and am authorized to make them public. I can remove this card here at any time.</label>
        <button className="ms-button" disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Save public card"}</button>
        {state === "saved" && <p role="status">{enabled ? "Public card saved. Listing pauses and rights restrictions still apply." : "Your card is hidden."}</p>}
        {state === "error" && <p role="alert">The card was not saved. Try again.</p>}
      </form>}
  </details>;
}
