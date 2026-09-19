import { TaskThumbnail } from "./TaskThumbnail";
import { isLikelyPhone } from "@/lib/device";
import { TaskFacts } from "./TaskFacts";
import { useEffect, useState } from "react";
import { withCsrfHeader } from "@/lib/csrf";
import { RobotTeamPlanPreview } from "./RobotTeamPlanPreview";
import { opportunityLabels, taskStageLabels, type TaskBrowseCard, type TaskListingDetails } from "@/types/taskBrowse";

export function TaskBrowse() {
  const [items, setItems] = useState<TaskBrowseCard[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [family, setFamily] = useState("");
  const [region, setRegion] = useState("");
  const [availability, setAvailability] = useState("");
  const [selected, setSelected] = useState<TaskBrowseCard | null>(null);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    fetch("/api/site-worlds/tasks", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error("invalid library");
      setItems(data.items); setState("ready");
    }).catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [retry]);
  const filtered = items.filter(item => (!family || item.taskFamily === family)
    && (!region || item.region.toLowerCase().includes(region.toLowerCase()))
    && (!availability || (availability === "ready" ? item.evaluationAvailable : item.opportunity === availability)));
  async function saveInterest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaved("saving");
    try {
      const response = await fetch("/api/task-listings/interests", { method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ email: data.get("email"), taskFamily: data.get("taskFamily"),
          siteType: data.get("siteType"), region: data.get("region"), mayContact: data.get("mayContact") === "on" }) });
      if (!response.ok) throw new Error("not saved");
      setSaved("saved");
    } catch { setSaved("error"); }
  }
  if (selected) return <section aria-label="Evaluate selected task">
    <button className="ms-text-link" type="button" onClick={() => setSelected(null)}>← All tasks</button>
    <div className="ms-task-heading"><h2>{selected.title}</h2><TaskThumbnail src={selected.thumbnailUrl} title={selected.title} taskFamily={selected.taskFamily} /></div><TaskFacts details={selected} />
    <RobotTeamPlanPreview key={selected.id} sceneId={selected.id} />
  </section>;
  return <section aria-label="Task library">
    <details className="ms-browse-filters" open={!isLikelyPhone()}><summary>Filter tasks</summary>
    <div className="ms-task-filters">
      <label>Task<select aria-label="Filter by task" value={family} onChange={e => setFamily(e.target.value)}>
        <option value="">All tasks</option>{[...new Set(items.map(item => item.taskFamily))].sort().map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Region<input aria-label="Filter by region" placeholder="Any region" value={region} maxLength={80} onChange={e => setRegion(e.target.value)} /></label>
      <label>Availability<select aria-label="Filter by availability" value={availability} onChange={e => setAvailability(e.target.value)}>
        <option value="">Live and past</option><option value="open">Open to pilot proposals</option>
        <option value="ready">Ready to evaluate</option><option value="past">Past opportunities</option>
      </select></label>
    </div>
    </details>
    {state === "loading" && <p role="status">Loading tasks…</p>}
    {state === "error" && <div role="alert"><p>The task library could not be loaded.</p>
      <button className="ms-button" onClick={() => setRetry(retry + 1)}>Try again</button></div>}
    {state === "ready" && <>
      <p className="ms-field-hint">{filtered.length} {filtered.length === 1 ? "task" : "tasks"} · Details shared by site owners. A past task can remain available for evaluation.</p>
      {filtered.length === 0 && <div className="ms-task-empty">
        <h2>{items.length ? "No tasks match these filters." : "No public tasks to browse yet."}</h2>
        <p>{items.length ? "Try a different task or region, or tell us what you need below." : "Tell us what work you are looking for. Sites appear here when their owners choose to share them."}</p>
        {items.length > 0 && <button className="ms-text-link" onClick={() => { setFamily(""); setRegion(""); setAvailability(""); }}>Clear filters</button>}
      </div>}
      <ul className="ms-task-list">{filtered.map(item => <li key={item.id}>
        <div className="ms-task-heading"><div><div className="ms-task-meta"><span>{taskStageLabels[item.stage]}</span><span>{opportunityLabels[item.opportunity]}</span></div>
        <h2>{item.title}</h2></div><TaskThumbnail src={item.thumbnailUrl} title={item.title} taskFamily={item.taskFamily} /></div><TaskFacts details={item} />
        {item.evaluationAvailable ? <button className="ms-button" onClick={() => setSelected(item)}>Evaluate this task · ${item.costUsd}</button>
          : <p className="ms-field-hint">{item.stage === "capture" ? "Footage is the next step." : "The scene is being prepared for evaluation."} No runs available yet.</p>}
      </li>)}</ul>
    </>}
    <details className="ms-task-interest" open={state === "ready" && items.length === 0 ? true : undefined}>
      <summary>Tell us what you are looking for</summary>
      {saved === "saved" ? <p role="status">Preferences saved. {"You can return here to browse new tasks."}</p> :
        <form className="ms-form" onSubmit={saveInterest} aria-label="Task preferences">
          <label>Task<input name="taskFamily" defaultValue={family} placeholder="e.g. Pick and place" maxLength={60} required /></label>
          <label>Region<input name="region" defaultValue={region} placeholder="e.g. US, Midwest" maxLength={80} /></label>
          <label>Site type<input name="siteType" placeholder="e.g. Warehouse" maxLength={80} /></label>
          <label>Work email<input name="email" type="email" maxLength={320} required /></label>
          <label className="ms-check-row"><input name="mayContact" type="checkbox" />You may email me about matching tasks.</label>
          {saved === "error" && <p role="alert">Preferences could not be saved. Try again.</p>}
          <button className="ms-button" disabled={saved === "saving"}>{saved === "saving" ? "Saving…" : "Save preferences"}</button>
        </form>}
    </details>
    <details className="ms-task-interest"><summary>Already have a robot setup to evaluate?</summary><RobotTeamPlanPreview /></details>
    <p className="ms-field-hint"><a href="/agent-access.openapi.json">For agents: API reference</a> · <a href="mailto:hello@tryblueprint.io">Talk to a person</a></p>
  </section>;
}
