import { useEffect, useRef, useState, type FormEvent } from "react";
import { withCsrfHeader } from "@/lib/csrf";
import { RecommendedPilot } from "./RecommendedPilot";
import type {
  DeliveryProposal,
  JobBuyingRequirements,
  JobMarketplaceWorkflow,
  MarketplaceJobStage,
} from "@/types/jobMarketplace";

const stages: Array<[MarketplaceJobStage, string]> = [
  ["job_submitted", "Job submitted"],
  ["brief_agreed", "Brief agreed"],
  ["options_assessed", "Options assessed"],
  ["proposals_ready", "Proposals ready"],
  ["pilot_agreed", "Pilot agreed"],
  ["results_recorded", "Results recorded"],
];

const owners = { site: "You", blueprint: "Blueprint", deployment_partner: "Delivery partner", none: "No action needed" };
const evidenceLabels = { prior_deployment: "Prior deployment", simulation: "Simulation", physical_trial: "Physical trial", unverified: "Not yet verified" };
const money = (value: number | null) => value === null ? "Quote needed" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);

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
    && stages.some(([id]) => id === item.stage) && Array.isArray(item.proposals)
    && Boolean(item.requirements) && typeof item.nextAction === "string"
    && Object.prototype.hasOwnProperty.call(owners, item.actionOwner ?? "");
}

/** The signed owner link is the credential; remounting keeps every record scoped to that link. */
export function JobWorkspace({ token }: { token: string }) {
  return <JobWorkspaceForToken key={token} token={token} />;
}

function JobWorkspaceForToken({ token }: { token: string }) {
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

  const available = workflow.proposals.filter(proposal => proposal.status === "available");
  const visibleProposals = workflow.proposals.filter(proposal => proposal.status !== "withdrawn");
  const selected = workflow.proposals.find(proposal => proposal.id === workflow.selection?.proposalId && proposal.revision === workflow.selection.proposalRevision);
  const completed: MarketplaceJobStage[] = ["job_submitted"];
  if (workflow.briefAgreed) completed.push("brief_agreed");
  if (workflow.optionsAssessed) completed.push("options_assessed");
  if (available.length) completed.push("proposals_ready");
  if (workflow.agreement) completed.push("pilot_agreed");
  if (workflow.outcome) completed.push("results_recorded");

  return <><section className="job-workspace" aria-labelledby="job-progress-title">
    <h2 id="job-progress-title">Your job, step by step</h2>
    <JobProgress stage={workflow.stage} completed={completed} />
    <div className="job-next-action">
      <p className="job-eyebrow">Next action · {owners[workflow.actionOwner]}</p>
      <p>{workflow.nextAction}</p>
    </div>
    {error && <p role="status" className="ms-field-hint">Updates could not be refreshed. Last loaded details are shown. <button type="button" className="ms-text-link" onClick={() => setRefresh(value => value + 1)}>Try again</button></p>}
    {workflow.review && <div className="job-review">
      <h3>{workflow.review.disposition === "no_suitable_option" ? "No suitable option yet" : workflow.review.disposition === "more_information" ? "A little more information is needed" : "What we know so far"}</h3>
      <p>{workflow.review.summary}</p>
      {workflow.review.nextAction !== workflow.nextAction && <p className="ms-field-hint">{workflow.review.nextAction}</p>}
    </div>}
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
    {workflow.managedEvidenceUnavailable && <p role="status" className="ms-field-hint">Policy results are temporarily unavailable. Reload this page to retry.</p>}
    {(workflow.managedEvidence ?? []).length > 0 && <section className="job-review" aria-label="Managed policy evidence for your job">
      <h3>Policy evidence for your job</h3>
      {workflow.managedEvidence!.map(item => <article key={item.runId} id={`managed-evidence-${encodeURIComponent(item.runId)}`} className="mt-3">
        <h4>{item.current ? item.state.replace(/_/g, " ") : "Historical — the job scope changed"}</h4>
        <p>{item.summary}</p><p>Next: {item.nextAction}</p>
        {item.limitations.map((limit, index) => <p className="ms-field-hint" key={index}>{limit}</p>)}
        <p className="ms-field-hint break-all">Run: {item.runId}{item.resultDigest ? ` · Result: ${item.resultDigest}` : ""}</p>
      </article>)}
    </section>}
    {workflow.jobId && (workflow.evidence ?? []).some(item => item.current && ["information_required", "blocked", "unavailable"].includes(item.state)) ? <p className="ms-field-hint"><a className="ms-text-link" href={`/app/captures?jobId=${encodeURIComponent(workflow.jobId!)}`}>Add task-specific capture evidence</a> when Blueprint needs it. Use the account that owns this job; the existing recording permissions still apply.</p> : null}
    <BuyingRequirements key="requirements" locked={Boolean(workflow.agreement)} requirements={workflow.requirements} pending={pending} onSave={value => save("requirements", "PATCH", value)} />

    <section className="job-proposals" aria-labelledby="delivery-proposals-title">
      <h3 id="delivery-proposals-title">Delivery proposals</h3>
      {!available.length ? <p className="ms-field-hint">No delivery proposal is ready to review. Blueprint will identify suitable options and explain any checks still needed.</p>
        : <p className="ms-field-hint">Compare the complete cost, commitments and support. Choosing a proposal starts the agreement process; it does not sign a contract or reserve a date.</p>}
      {visibleProposals.map(proposal => <ProposalCard key={`${proposal.id}:${proposal.revision}`} proposal={proposal}
        selected={selected?.id === proposal.id} locked={Boolean(workflow.agreement) || proposal.status !== "available"} hasSelection={Boolean(workflow.selection)} pending={pending}
        evidenceHref={digest => `${endpoint}/evidence/${encodeURIComponent(digest)}`}
        onSelect={() => save("select", "POST", { proposalId: proposal.id, expectedRevision: proposal.revision, authorized: true })} />)}
      {workflow.selection && (!selected || selected.status !== "available") && <p role="status">Your selected proposal changed or is no longer available. Ask Blueprint to review the updated scope before making another commitment.</p>}
    </section>

    {selected && selected.status !== "withdrawn" && <section className="job-agreement" aria-labelledby="pilot-agreement-title">
      <h3 id="pilot-agreement-title">{selected.status === "review_required" ? "Your previous choice needs review" : workflow.agreement ? "Pilot agreement recorded" : "Your choice is recorded"}</h3>
      <p>{selected.providerName}{workflow.agreement ? " — the site and delivery partner's agreement is on record." : " — agree the scope, price, dates and support directly before physical work starts."}</p>
      {workflow.agreement?.plannedStartIso && <p>Planned start: {new Date(workflow.agreement.plannedStartIso).toLocaleString()}.</p>}
      <p className="ms-field-hint">The customer awards the contract. The delivery partner installs, commissions and supports the system. Blueprint coordinates the decision and records the outcome.</p>
      {!workflow.agreement && <p className="ms-field-hint">Blueprint will record the agreed pilot after both parties confirm it. A proposal selection alone is not an agreement.</p>}
      {workflow.agreement && (workflow.agreement.outcomeRecordingAuthorized !== true || !workflow.agreement.outcomeRecordingPermissionReference) && !workflow.outcome && <p className="ms-field-hint">Ask Blueprint to confirm both parties’ permission before recording pilot results.</p>}
    </section>}
    {workflow.outcome ? <section className="job-outcome" aria-labelledby="reported-outcome-title">
      <h3 id="reported-outcome-title">Outcome reported by your site</h3>
      <p>{workflow.outcome.summary}</p>
      <dl className="job-facts">
        <div><dt>Agreed criteria met</dt><dd>{workflow.outcome.metCriteria === null ? "Not determined" : workflow.outcome.metCriteria ? "Yes, reported by the site" : "No, reported by the site"}</dd></div>
        {workflow.outcome.measuredUnitsPerHour !== null && <div><dt>Completed units per hour</dt><dd>{workflow.outcome.measuredUnitsPerHour}</dd></div>}
        {workflow.outcome.interventionsPerHour !== null && <div><dt>Human interventions per hour</dt><dd>{workflow.outcome.interventionsPerHour}</dd></div>}
      </dl>
      {workflow.outcome.notes && <p>{workflow.outcome.notes}</p>}
      <p className="ms-field-hint">This is your site's report. It does not change evaluation scores or establish independent physical validation.</p>
    </section> : selected && selected.status !== "withdrawn" && workflow.agreement?.outcomeRecordingAuthorized === true && Boolean(workflow.agreement.outcomeRecordingPermissionReference) ? <OutcomeForm historical={selected.status === "review_required"} proposal={selected} pending={pending} onSave={value => save("outcome", "POST", value)} /> : null}
  </section>
    <RecommendedPilot token={token} bookedOnly />
  </>;
}

function BuyingRequirements({ requirements, pending, locked = false, onSave }: {
  requirements: JobBuyingRequirements; pending: boolean; locked?: boolean; onSave: (value: JobBuyingRequirements) => Promise<void>;
}) {
  const [draft, setDraft] = useState(requirements);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const stored = JSON.stringify(requirements);
  useEffect(() => { setDraft(JSON.parse(stored)); }, [stored]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    try { await onSave(draft); setMessage("Planning details saved. They are targets for proposals, not an approval to spend."); }
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
  if (locked) return <details className="job-planning-details">
    <summary>Planning details for the agreed pilot</summary>
    <p className="ms-field-hint">These details belong to the agreed pilot. Contact <a href="mailto:hello@tryblueprint.io">Blueprint</a> to review a scope or budget change with the delivery partner.</p>
    <dl className="job-facts job-facts-full">{fields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{requirements[key] || "Not recorded"}</dd></div>)}</dl>
  </details>;
  return <details className="job-planning-details">
    <summary>Planning details <span className="ms-field-hint">Optional · update as you learn more</span></summary>
    <p className="ms-field-hint">These help Blueprint scope useful proposals. Leave anything you do not know blank. No budget or spending approval is needed to assess your job.</p>
    <form className="ms-form" aria-label="Job planning details" onSubmit={submit}>
      <label>Where are you in the buying process?
        <select value={draft.purchaseReadiness} onChange={event => setDraft({ ...draft, purchaseReadiness: event.target.value as JobBuyingRequirements["purchaseReadiness"] })}>
          <option value="unsure">Not sure yet</option><option value="exploring">Exploring automation</option><option value="planning">Planning a project</option><option value="ready_for_proposals">Ready to review proposals</option>
        </select>
      </label>
      {fields.map(([key, label, placeholder]) => <label key={key}>{label}<input value={draft[key] ?? ""} maxLength={key === "requiredOutput" ? 2000 : 500} placeholder={placeholder} onChange={event => setDraft({ ...draft, [key]: event.target.value || null })} /></label>)}
      <button className="ms-button" disabled={pending}>{pending ? "Saving…" : "Save planning details"}</button>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    </form>
  </details>;
}

function ProposalCard({ proposal, selected, locked, hasSelection, pending, onSelect, evidenceHref }: {
  proposal: DeliveryProposal; selected: boolean; locked: boolean; hasSelection: boolean; pending: boolean; onSelect: () => Promise<void>; evidenceHref: (digest: string) => string;
}) {
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!authorized || pending || locked || selected) return;
    setError("");
    try { await onSelect(); setAuthorized(false); }
    catch (cause) { setAuthorized(false); setError(cause instanceof Error ? cause.message : "Your choice could not be confirmed."); }
  }
  return <article className="job-proposal-card" aria-label={`${proposal.providerName} delivery proposal`}>
    <div className="job-proposal-heading"><h4>{proposal.providerName}</h4>{selected && <span className="job-selection-label">Your choice</span>}</div>
    <p>{proposal.scope}</p>
    {proposal.status === "review_required" && <p role="status">The job or its supporting evidence changed. Blueprint must review this proposal before you can choose it.</p>}
    <dl className="job-facts">
      <div><dt>Installation</dt><dd>{money(proposal.installationCostUsd)}</dd></div>
      <div><dt>Ongoing monthly cost</dt><dd>{money(proposal.monthlyCostUsd)}</dd></div>
      <div><dt>Proposed timing</dt><dd>{proposal.timing}</dd></div>
    </dl>
    {proposal.recommendationReason && <p><strong>Why Blueprint included this option:</strong> {proposal.recommendationReason}</p>}
    <details className="job-proposal-details"><summary>Review scope, evidence and support</summary>
      <dl className="job-facts job-facts-full">
        <div><dt>Equipment</dt><dd>{proposal.equipment}</dd></div>
        <div><dt>Software and policy</dt><dd>{proposal.software}</dd></div>
        <div><dt>Delivery commitment</dt><dd>{proposal.deliveryCommitment}</dd></div>
        <div><dt>Site preparation</dt><dd>{proposal.sitePreparation}</dd></div>
        <div><dt>Human assistance still needed</dt><dd>{proposal.humanAssistance}</dd></div>
        <div><dt>Support</dt><dd>{proposal.support}</dd></div>
        <div><dt>Exclusions and additional costs</dt><dd>{proposal.exclusions}</dd></div>
        <div><dt>Pilot acceptance criteria</dt><dd>{proposal.acceptanceCriteria}</dd></div>
      </dl>
      <h5>Evidence for this proposal</h5>
      {!proposal.evidence.length ? <p>No capability evidence is attached.</p> : <ul className="job-evidence-list">{proposal.evidence.map((evidence, index) => <li key={index}><strong>{evidenceLabels[evidence.level]}:</strong> <span>{evidence.summary}</span>{evidence.reference ? <p className="ms-field-hint break-all"><a className="ms-text-link" href={evidence.reference.kind === "managed_run" ? `#managed-evidence-${encodeURIComponent(evidence.reference.runId)}` : evidenceHref(evidence.reference.publicationDigest)} target={evidence.reference.kind === "managed_run" ? undefined : "_blank"} rel="noreferrer">Read this evidence</a> · Pipeline reference: {evidence.reference.kind === "managed_run" ? `${evidence.reference.runId} · ${evidence.reference.resultDigest}` : `${evidence.reference.requestId} · ${evidence.reference.publicationDigest}`}</p> : null}</li>)}</ul>}
      <p className="ms-field-hint">A prior deployment or simulation does not establish performance at your site. Agree what the physical pilot must demonstrate.</p>
    </details>
    {!selected && !locked && <form className="ms-form job-proposal-choice" onSubmit={submit} aria-label={`Choose ${proposal.providerName}`}>
      <label className="ms-check-row"><input type="checkbox" checked={authorized} onChange={event => setAuthorized(event.target.checked)} required />I am authorized to choose this proposal for my site. I understand the contract, price and dates still need agreement.{hasSelection ? " This will replace my previous choice." : ""}</label>
      <button className="ms-button" disabled={pending || !authorized}>{pending ? "Saving…" : "Choose this proposal"}</button>
      {error && <p role="alert">{error}</p>}
    </form>}
  </article>;
}

function OutcomeForm({ proposal, pending, historical = false, onSave }: { proposal: DeliveryProposal; pending: boolean; historical?: boolean; onSave: (value: Record<string, unknown>) => Promise<void> }) {
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (form.get("authorized") !== "on" || pending) return;
    const number = (key: string) => String(form.get(key) ?? "").trim() ? Number(form.get(key)) : null;
    setError("");
    try { await onSave({ proposalId: proposal.id, expectedRevision: proposal.revision, summary: String(form.get("summary") ?? ""),
      metCriteria: form.get("metCriteria") === "yes" ? true : form.get("metCriteria") === "no" ? false : null,
      measuredUnitsPerHour: number("measuredUnitsPerHour"), interventionsPerHour: number("interventionsPerHour"), notes: String(form.get("notes") ?? "") || null, authorized: true }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The outcome could not be saved."); }
  }
  return <details className="job-planning-details"><summary>Record your pilot outcome</summary>
    <p className="ms-field-hint">{historical ? "Report against the originally agreed proposal. Later job changes need separate review. " : "Record what happened against the agreed criteria. "}This site report stays separate from independently verified evaluation evidence.</p>
    <form className="ms-form" aria-label="Pilot outcome" onSubmit={submit}>
      <label>What happened?<textarea name="summary" required maxLength={2000} /></label>
      <label>Were the agreed criteria met?<select name="metCriteria" defaultValue="unknown"><option value="unknown">Not determined yet</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label>Completed units per hour (optional)<input name="measuredUnitsPerHour" type="number" min="0" max="1000000000" step="any" /></label>
      <label>Human interventions per hour (optional)<input name="interventionsPerHour" type="number" min="0" max="1000000000" step="any" /></label>
      <label>Other observations (optional)<textarea name="notes" maxLength={2000} /></label>
      <label className="ms-check-row"><input name="authorized" type="checkbox" required />I am authorized to record this site's pilot outcome.</label>
      <button className="ms-button" disabled={pending}>{pending ? "Saving…" : "Save pilot outcome"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </details>;
}
