import { TaskThumbnail } from "./TaskThumbnail";
import { isLikelyPhone } from "@/lib/device";
import { TaskFacts } from "./TaskFacts";
import { useEffect, useState } from "react";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { LibraryAccess } from "@/lib/robotTeamAccess";
import { RobotTeamEarlyAccess } from "./RobotTeamEarlyAccess";
import { RobotTeamPlanPreview } from "./RobotTeamPlanPreview";
import { opportunityLabels, taskStageLabels, type TaskBrowseCard } from "@/types/taskBrowse";

export function TaskBrowse() {
  const [items, setItems] = useState<TaskBrowseCard[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const [family, setFamily] = useState("");
  const [region, setRegion] = useState("");
  const [availability, setAvailability] = useState("");
  const [selected, setSelected] = useState<TaskBrowseCard | null>(null);
  const [access, setAccess] = useState<LibraryAccess | null>(null);
  const auth = useOptionalAuth();
  const currentUser = auth?.currentUser ?? null;
  // Back from Stripe or a verification email for a plan that was not tied to
  // one task: open that plan instead of leaving it in a closed section.
  const [returning] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return !params.get("sceneId") && (params.has("funded") || params.get("connect") === "1");
  });
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    // Early access: the server returns tasks only to an approved team, so the
    // request carries the signed-in account when there is one.
    withFirebaseAuthHeaders(currentUser).catch(() => ({})).then(headers =>
      fetch("/api/site-worlds/tasks", { signal: controller.signal, headers })).then(async response => {
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error("invalid library");
      setAccess(data.access ?? null);
      setItems(data.items); setState("ready");
      const sceneId = new URLSearchParams(window.location.search).get("sceneId");
      if (sceneId) setSelected(data.items.find((item: TaskBrowseCard) => item.id === sceneId && item.evaluationAvailable) || null);
    }).catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [retry, currentUser?.uid]);
  const filtered = items.filter(item => (!family || item.taskFamily === family)
    && (!region || item.region.toLowerCase().includes(region.toLowerCase()))
    && (!availability || (availability === "ready" ? item.evaluationAvailable : item.opportunity === availability)));
  if (selected) return <section aria-label="Evaluate selected task">
    <button className="ms-text-link" type="button" onClick={() => setSelected(null)}>← All tasks</button>
    <div className="ms-task-heading"><h2>{selected.title}</h2><TaskThumbnail src={selected.thumbnailUrl} title={selected.title} taskFamily={selected.taskFamily} /></div><TaskFacts details={selected} />
    <RobotTeamPlanPreview key={selected.id} sceneId={selected.id} />
  </section>;
  // Nothing library-shaped renders until the server has said who may see it,
  // so a visitor outside early access never sees the library flash by.
  if (state === "loading") return <section aria-label="Task library"><p role="status">Loading…</p></section>;
  if (state === "error") return <section aria-label="Task library"><div role="alert"><p>The task library could not be loaded.</p>
    <button className="ms-button" onClick={() => setRetry(retry + 1)}>Try again</button></div></section>;
  // Anything other than an explicit "allowed" is the early-access page.
  const gated = state === "ready" && access !== null && !access.allowed;
  if (gated) return <RobotTeamEarlyAccess access={access} email={currentUser?.email ?? null} />;
  const libraryEmpty = state === "ready" && items.length === 0;
  return <section aria-label="Task library">
    {!libraryEmpty && <details className="ms-browse-filters" open={!isLikelyPhone()}><summary>Filter tasks</summary>
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
    </details>}
    {libraryEmpty && <div className="ms-task-empty">
      <h2>The first site tasks are being prepared.</h2>
      <p>Sites film their own tasks and choose whether to share them with robot teams. We email you as soon as a site lists a new task.</p>
    </div>}
    {state === "ready" && items.length > 0 && <>
      <p className="ms-field-hint">{filtered.length} {filtered.length === 1 ? "task" : "tasks"} · Details shared by site owners. A past task can remain available for evaluation.</p>
      {filtered.length === 0 && <div className="ms-task-empty">
        <h2>No tasks match these filters.</h2>
        <p>Try a different task or region, or <a href="mailto:hello@tryblueprint.io">tell us what you need</a>.</p>
        <button className="ms-text-link" onClick={() => { setFamily(""); setRegion(""); setAvailability(""); }}>Clear filters</button>
      </div>}
      <ul className="ms-task-list">{filtered.map(item => <li key={item.id}>
        <div className="ms-task-heading"><div><div className="ms-task-meta"><span>{taskStageLabels[item.stage]}</span><span>{opportunityLabels[item.opportunity]}</span></div>
        <h2>{item.title}</h2></div><TaskThumbnail src={item.thumbnailUrl} title={item.title} taskFamily={item.taskFamily} /></div><TaskFacts details={item} />
        {item.evaluationAvailable ? <button className="ms-button" onClick={() => setSelected(item)}>Self-directed evaluation · ${item.costUsd}</button>
          : <p className="ms-field-hint">{item.stage === "capture" ? "Footage is the next step." : "The scene is being prepared for evaluation."} No runs available yet.</p>}
      </li>)}</ul>
    </>}
    <p className="ms-field-hint">Invited evaluations for matched site tasks are free within the invitation's stated scope. The prices above are for optional self-directed runs.</p>
    <details className="ms-task-interest" open={returning || undefined}
      ref={(element) => { if (element && returning) element.scrollIntoView({ block: "start" }); }}>
      <summary>Already have a robot policy to evaluate? Register it and see a plan</summary>
      <RobotTeamPlanPreview />
    </details>
    <p className="ms-field-hint"><a href="/agent-access.openapi.json">Agent API (OpenAPI spec, JSON)</a> · <a href="mailto:hello@tryblueprint.io">Talk to a person</a></p>
  </section>;
}
