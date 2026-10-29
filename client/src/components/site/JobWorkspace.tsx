import { PolicyScreeningCandidates } from "@/components/shared/PolicyScreeningCandidates";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { withCsrfHeader } from "@/lib/csrf";
import type { TaskOutcome } from "@/types/taskOutcome";
import type {
  JobBuyingRequirements,
  JobMarketplaceWorkflow,
  MarketplaceJobStage,
} from "@/types/jobMarketplace";

const stages: Array<[MarketplaceJobStage, string]> = [
  ["job_submitted", "Job submitted"],
  ["brief_agreed", "Brief agreed"],
  ["options_assessed", "Options assessed"],
];

const owners = { site: "You", blueprint: "Blueprint", none: "No action needed" };

/** Progress is based on recorded milestones, never an elapsed-time estimate. */
export function JobProgress({ stage, completed = [] }: { stage: MarketplaceJobStage; completed?: MarketplaceJobStage[] }) {
  return <ol className="job-progress" aria-label="Job milestones">
    {stages.map(([id, label], index) => <li key={id} data-complete={completed.includes(id)} aria-current={id === stage ? "step" : undefined}>
      <span className="job-progress-number" aria-hidden="true">{completed.includes(id) ? "✓" : index + 1}</span>
      <span>{label}<span className="job-progress-status">{id === stage ? "Current step" : completed.includes(id) ? "Recorded" : "Not yet recorded"}</span></span>
    </li>)}
  </ol>;
}

function isWorkflow(value: unknown): value is JobMarketplaceWorkflow {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<JobMarketplaceWorkflow>;
  return item.schemaVersion === "job_marketplace.v1" && typeof item.revision === "string"
    && stages.some(([id]) => id === item.stage)
    && Boolean(item.requirements) && typeof item.nextAction === "string"
    && Object.prototype.hasOwnProperty.call(owners, item.actionOwner ?? "");
}

/** The signed owner link is the credential; remounting keeps every record scoped to that link. */
type JobWorkspaceProps = { token: string; preparationOutcome?: TaskOutcome | null; currentStatusKnown?: boolean;
  currentNextAction?: { text: string; owner: "site" | "blueprint" };
};
export function JobWorkspace(props: JobWorkspaceProps) {
  return <JobWorkspaceForToken key={props.token} {...props} />;
}

function JobWorkspaceForToken({ token, preparationOutcome, currentStatusKnown = true, currentNextAction }: JobWorkspaceProps) {
  const [workflow, setWorkflow] = useState<JobMarketplaceWorkflow | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const active = useRef(true);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const endpoint = `/api/job-workflow/owner/${encodeURIComponent(token)}`;

  useEffect(() => {
    active.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function load() {
      if (inFlight.current) {
        timer = setTimeout(load, 15_000);
        return;
      }
      const requestGeneration = ++generation.current;
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal, referrerPolicy: "no-referrer" });
        const value: unknown = await response.json();
        if (!response.ok || !isWorkflow(value)) throw new Error("Job planning could not be loaded. Your job and recording are still saved.");
        if (active.current && generation.current === requestGeneration) {
          setWorkflow(value);
          setError("");
        }
      } catch (cause) {
        if (active.current && !controller.signal.aborted && generation.current === requestGeneration) {
          setError(cause instanceof Error ? cause.message : "Job planning could not be loaded.");
        }
      } finally {
        if (active.current && !controller.signal.aborted) timer = setTimeout(load, 15_000);
      }
    }
    void load();
    return () => { active.current = false; controller.abort(); clearTimeout(timer); };
  }, [endpoint, refresh]);

  async function save(path: string, method: "PATCH" | "POST", body: unknown) {
    if (inFlight.current) throw new Error("Another change is being saved. Please wait a moment.");
    inFlight.current = true;
    ++generation.current;
    setPending(true);
    try {
      const response = await fetch(`${endpoint}/${path}`, {
        method, headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify(body), referrerPolicy: "no-referrer",
      });
      const value = await response.json().catch(() => null);
      if (!response.ok || !isWorkflow(value)) {
        if (response.status === 409 && active.current) setRefresh(value => value + 1);
        throw new Error(typeof value?.error === "string" ? value.error : "We could not confirm this change. Refresh the job before trying again.");
      }
      if (active.current) { setWorkflow(value); setError(""); }
    } finally {
      inFlight.current = false;
      if (active.current) setPending(false);
    }
  }

  if (!workflow) return <section className="job-workspace" aria-label="Job planning">
    {error ? <><p role="status">{error}</p><button type="button" className="ms-text-link" onClick={() => setRefresh(value => value + 1)}>Try loading job planning again</button></>
      : <p className="ms-field-hint">Loading job progress…</p>}
  </section>;

  const completed: MarketplaceJobStage[] = ["job_submitted"];
  if (workflow.briefAgreed) completed.push("brief_agreed");
  if (workflow.optionsAssessed) completed.push("options_assessed");

  return <section className="job-workspace" aria-labelledby="job-progress-title">
    <h2 id="job-progress-title">Your job, step by step</h2>
    <JobProgress stage={workflow.stage} completed={completed} />
    <div className="job-next-action">
      <p className="job-eyebrow">Next action · {currentStatusKnown
        ? preparationOutcome ? owners[preparationOutcome.actionOwner] : owners[currentNextAction?.owner ?? workflow.actionOwner]
        : owners.blueprint}</p>
      <p>{!currentStatusKnown ? "Checking the current job status. Your saved job remains available."
        : preparationOutcome?.nextStep ?? currentNextAction?.text ?? workflow.nextAction}</p>
    </div>
    {error && <p role="status" className="ms-field-hint">Updates could not be refreshed. Last loaded details are shown. <button type="button" className="ms-text-link" onClick={() => setRefresh(value => value + 1)}>Try again</button></p>}
    {workflow.review && <div className="job-review">
      <h3>{workflow.review.disposition === "no_suitable_option" ? "No suitable option yet" : workflow.review.disposition === "more_information" ? "A little more information is needed" : "What we know so far"}</h3>
      <p>{workflow.review.summary}</p>
      {currentStatusKnown && !preparationOutcome && !currentNextAction && workflow.review.nextAction !== workflow.nextAction && <p className="ms-field-hint">{workflow.review.nextAction}</p>}
    </div>}
    {workflow.managedEvidenceUnavailable && <p role="status" className="ms-field-hint">Policy results are temporarily unavailable. Reload this page to retry.</p>}
    {(workflow.managedEvidence ?? []).filter(item => item.current && item.screening).map(item => <section
      key={item.runId} className="job-review" aria-label="Simulation results for your job">
      <h3>{item.state === "completed" && item.screening!.candidates.some(candidate => candidate.scored > 0)
        ? "Your simulation estimate" : "Simulation evaluation"}</h3>
      <p>{item.summary}</p>
      <PolicyScreeningCandidates screening={item.screening!} />
      {item.limitations.map((limit, index) => <p className="ms-field-hint" key={index}>{limit}</p>)}
    </section>)}
    {((workflow.evidence ?? []).length > 0 || (workflow.managedEvidence ?? []).length > 0) && <details className="job-planning-details">
      <summary>Technical evidence and test details</summary>
    {(workflow.evidence ?? []).length > 0 && <section className="job-review" aria-label="Evidence for your job">
      <h3>Evidence for your job</h3>
      {workflow.evidence!.map(item => <article key={item.requestId} className="mt-3">
        <h4>{item.question}</h4>
        <p>{item.current ? item.state.replace(/_/g, " ") : "Historical — the job scope changed"}: {item.summary}</p>
        {item.claims.map(claim => <p key={claim.claimId}>{claim.claimId}: {claim.verdict.replace(/_/g, " ")} — {claim.rationale}</p>)}
        <p>Next: {item.nextAction}</p>
        {item.limitations.map((limit, index) => <p className="ms-field-hint" key={index}>{limit}</p>)}
        <p className="ms-field-hint break-all">Reference: {item.publicationDigest ?? item.requestId}{item.decisionDigest ? ` · Decision: ${item.decisionDigest}` : ""}</p>
      </article>)}
    </section>}
    {(workflow.managedEvidence ?? []).length > 0 && <section className="job-review" aria-label="Managed policy evidence for your job">
      <h3>Policy evidence for your job</h3>
      {workflow.managedEvidence!.map(item => <article key={item.runId} id={`managed-evidence-${encodeURIComponent(item.runId)}`} className="mt-3">
        <h4>{item.current ? item.state.replace(/_/g, " ") : "Historical — the job scope changed"}</h4>
        {(!item.current || !item.screening) && <>
        <p>{item.summary}</p><p>Next: {item.nextAction}</p>
        {item.screening && <PolicyScreeningCandidates screening={item.screening} />}
        {item.limitations.map((limit, index) => <p className="ms-field-hint" key={index}>{limit}</p>)}
        </>}
        <p className="ms-field-hint break-all">Run: {item.runId}{item.resultDigest ? ` · Result: ${item.resultDigest}` : ""}</p>
      </article>)}
    </section>}
    {workflow.jobId && (workflow.evidence ?? []).some(item => item.current && ["information_required", "blocked", "unavailable"].includes(item.state)) ? <p className="ms-field-hint"><a className="ms-text-link" href={`/app/captures?jobId=${encodeURIComponent(workflow.jobId!)}`}>Add task-specific capture evidence</a> when Blueprint needs it. Use the account that owns this job; the existing recording permissions still apply.</p> : null}
    </details>}
    <BuyingRequirements key="requirements" requirements={workflow.requirements} pending={pending} onSave={value => save("requirements", "PATCH", value)} />
  </section>;
}

function BuyingRequirements({ requirements, pending, onSave }: {
  requirements: JobBuyingRequirements; pending: boolean; onSave: (value: JobBuyingRequirements) => Promise<void>;
}) {
  const [draft, setDraft] = useState(requirements);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const stored = JSON.stringify(requirements);
  useEffect(() => { setDraft(JSON.parse(stored)); }, [stored]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    try { await onSave(draft); setMessage("Planning details saved. They are planning targets, not an approval to spend."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Planning details could not be saved."); }
  }
  const fields: Array<[Exclude<keyof JobBuyingRequirements, "purchaseReadiness">, string, string]> = [
    ["jobFrequency", "How often does the job happen?", "For example, two shifts a day"],
    ["requiredOutput", "Required output and quality", "What would a successful result look like?"],
    ["currentProcessCost", "Current process cost", "Optional estimate, including any labor that remains"],
    ["installationBudget", "Installation budget", "Your preferred range, or not sure"],
    ["ongoingBudget", "Acceptable ongoing cost", "For example, a monthly range or cost per unit"],
    ["targetStartDate", "Preferred timing", "A target date or a flexible window"],
  ];
  return <details className="job-planning-details">
    <summary>Planning details <span className="ms-field-hint">Optional · update as you learn more</span></summary>
    <p className="ms-field-hint">These help Blueprint scope the work. Leave anything you do not know blank. No budget or spending approval is needed to assess your job.</p>
    <form className="ms-form" aria-label="Job planning details" onSubmit={submit}>
      <label>Where are you in the buying process?
        <select value={draft.purchaseReadiness} onChange={event => setDraft({ ...draft, purchaseReadiness: event.target.value as JobBuyingRequirements["purchaseReadiness"] })}>
          <option value="unsure">Not sure yet</option><option value="exploring">Exploring automation</option><option value="planning">Planning a project</option><option value="ready_for_proposals">Ready to plan a pilot</option>
        </select>
      </label>
      {fields.map(([key, label, placeholder]) => <label key={key}>{label}<input value={draft[key] ?? ""} maxLength={key === "requiredOutput" ? 2000 : 500} placeholder={placeholder} onChange={event => setDraft({ ...draft, [key]: event.target.value || null })} /></label>)}
      <button className="ms-button" disabled={pending}>{pending ? "Saving…" : "Save planning details"}</button>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    </form>
  </details>;
}
