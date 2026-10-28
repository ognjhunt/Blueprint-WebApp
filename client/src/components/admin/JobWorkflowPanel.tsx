import { PolicyScreeningCandidates } from "@/components/shared/PolicyScreeningCandidates";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { JobManagedEvaluation } from "./JobManagedEvaluation";
import { Button, StatusChip } from "@/components/blueprint";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type {
  DeliveryEvidenceLevel,
  DeliveryProposal,
  DeliveryProposalInput,
  JobMarketplaceWorkflow,
  JobOptionsReview,
} from "@/types/jobMarketplace";

type Draft = Omit<DeliveryProposalInput, "installationCostUsd" | "monthlyCostUsd" | "recommendationReason"> & {
  installationCostUsd: string;
  monthlyCostUsd: string;
  recommendationReason: string;
};

const EVIDENCE_LABELS: Record<DeliveryEvidenceLevel, string> = {
  prior_deployment: "Prior deployment",
  simulation: "Simulation",
  physical_trial: "Physical trial",
  unverified: "Not independently verified",
};

const TEXT_FIELDS = [
  ["scope", "Job scope", "The work and operating conditions this proposal covers."],
  ["deliveryCommitment", "Delivery commitment", "What the provider agrees to deliver and support."],
  ["equipment", "Equipment", "Robot, gripper, cameras and other equipment included."],
  ["software", "Software and inference", "Policies, model versions, controllers and hosting arrangements."],
  ["sitePreparation", "Site preparation", "Space, utilities, access and work the customer must provide."],
  ["humanAssistance", "Human assistance", "Loading, supervision, interventions and exception handling."],
  ["timing", "Delivery timing", "Availability, installation time and the proposed pilot window."],
  ["support", "Support commitments", "Maintenance, response times and the responsible support company."],
  ["exclusions", "Exclusions and remaining costs", "State what is excluded, or explicitly record that nothing is excluded."],
  ["acceptanceCriteria", "Pilot acceptance criteria", "The output, quality, speed and intervention measures used to accept the pilot."],
] as const;

function emptyDraft(): Draft {
  return {
    providerName: "", scope: "", equipment: "", software: "", deliveryCommitment: "",
    installationCostUsd: "", monthlyCostUsd: "", currency: "USD", exclusions: "",
    sitePreparation: "", humanAssistance: "", timing: "", support: "",
    evidence: [{ level: "unverified", summary: "" }], acceptanceCriteria: "", recommendationReason: "",
  };
}

function editDraft(proposal: DeliveryProposal): Draft {
  return {
    ...proposal,
    installationCostUsd: proposal.installationCostUsd === null ? "" : String(proposal.installationCostUsd),
    monthlyCostUsd: proposal.monthlyCostUsd === null ? "" : String(proposal.monthlyCostUsd),
    evidence: proposal.evidence.map((item) => ({ ...item })),
    recommendationReason: proposal.recommendationReason ?? "",
  };
}

function money(value: number | null) {
  return value === null ? "Not quoted" : new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  }).format(value);
}

function localDate(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : value;
}

function isoDate(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function errorMessage(value: { error?: unknown; fields?: Array<{ path?: unknown; message?: unknown }> }, status: number) {
  const fields = Array.isArray(value.fields)
    ? value.fields.map((field) => `${Array.isArray(field.path) ? field.path.join(".") : String(field.path ?? "Field")}: ${String(field.message ?? "Check this value.")}`)
    : [];
  return [typeof value.error === "string" ? value.error : `Request failed (${status}).`, ...fields].join(" ");
}

/** Commercial records only. Scientific results and recommendation evidence stay in their owner systems. */
export function JobWorkflowPanel({ requestId, currentUser, onChanged }: {
  requestId: string;
  currentUser: FirebaseUser | null;
  onChanged?: () => void;
}) {
  const [workflow, setWorkflow] = useState<JobMarketplaceWorkflow | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [mustRefresh, setMustRefresh] = useState(false);
  const busyRef = useRef(false);
  const loadingRef = useRef(false);
  const proposalKey = useRef("");
  const evidenceKey = useRef("");
  const [question, setQuestion] = useState("");
  const generation = useRef(0);
  const [showProposal, setShowProposal] = useState(false);
  const [editing, setEditing] = useState<DeliveryProposal | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [review, setReview] = useState<{ disposition: JobOptionsReview["disposition"]; summary: string; nextAction: string }>({
    disposition: "options_identified", summary: "", nextAction: "",
  });
  const [agreement, setAgreement] = useState({ agreedAt: "", plannedStart: "", siteReference: "", providerReference: "", confirmed: false, outcomeAuthorized: false, outcomeReference: "" });
  const base = `/api/job-workflow/admin/${encodeURIComponent(requestId)}`;

  useEffect(() => {
    generation.current += 1;
    loadingRef.current = false;
    busyRef.current = false;
    setWorkflow(null); setLoadState("idle"); setError(""); setNotice(""); setBusy(false); setMustRefresh(false);
    setShowProposal(false); setEditing(null); setDraft(emptyDraft()); setWithdrawId(null); setQuestion(""); evidenceKey.current = "";
    setReview({ disposition: "options_identified", summary: "", nextAction: "" });
    setAgreement({ agreedAt: "", plannedStart: "", siteReference: "", providerReference: "", confirmed: false, outcomeAuthorized: false, outcomeReference: "" });
    return () => { generation.current += 1; };
  }, [requestId]);

  async function authorized(json = false, extraHeaders: Record<string, string> = {}) {
    return {
      credentials: "include" as const,
      headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ ...(json ? { "Content-Type": "application/json" } : {}), ...extraHeaders })),
    };
  }

  function accept(value: JobMarketplaceWorkflow) {
    setWorkflow(value); setLoadState("ready"); setMustRefresh(false);
    if (value.evidenceContext?.question) setQuestion(previous => previous || value.evidenceContext!.question!);
    if (value.review) setReview({ disposition: value.review.disposition, summary: value.review.summary, nextAction: value.review.nextAction });
  }

  async function load() {
    if (loadingRef.current || busyRef.current) return;
    const epoch = generation.current;
    loadingRef.current = true; setLoadState("loading"); setError("");
    try {
      const response = await fetch(base, await authorized());
      const value = await response.json().catch(() => ({}));
      if (epoch !== generation.current) return;
      if (!response.ok || value.schemaVersion !== "job_marketplace.v1" || !Array.isArray(value.proposals)) {
        setLoadState("failed"); setError(errorMessage(value, response.status)); return;
      }
      accept(value as JobMarketplaceWorkflow);
    } catch {
      if (epoch === generation.current) {
        setLoadState("failed"); setError("The delivery workflow could not be loaded. Check your connection and try again.");
      }
    } finally {
      if (epoch === generation.current) loadingRef.current = false;
    }
  }

  async function mutate(path: string, body: unknown, message: string | ((value: JobMarketplaceWorkflow) => string), method = "POST", extraHeaders: Record<string, string> = {}) {
    if (busyRef.current || mustRefresh) return false;
    const epoch = generation.current;
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${base}${path}`, { ...await authorized(true, extraHeaders), method, body: JSON.stringify(body) });
      const value = await response.json().catch(() => ({}));
      if (epoch !== generation.current) return false;
      if (!response.ok) { setError(errorMessage(value, response.status)); return false; }
      // Every mutation returns the saved workflow. Do not hide a completed action behind a second GET.
      if (value.schemaVersion !== "job_marketplace.v1" || !Array.isArray(value.proposals)) {
        setMustRefresh(true);
        setError("The server response could not be confirmed. Refresh the workflow before making another change.");
        return false;
      }
      accept(value as JobMarketplaceWorkflow); setNotice(typeof message === "function" ? message(value as JobMarketplaceWorkflow) : message); onChanged?.(); return true;
    } catch {
      if (epoch === generation.current) {
        setMustRefresh(true);
        setError("The change could not be confirmed. Refresh the workflow before trying again.");
      }
      return false;
    } finally {
      if (epoch === generation.current) { busyRef.current = false; setBusy(false); }
    }
  }

  function beginProposal(proposal: DeliveryProposal | null) {
    proposalKey.current = proposal ? "" : crypto.randomUUID();
    setEditing(proposal); setDraft(proposal ? editDraft(proposal) : emptyDraft());
    setShowProposal(true); setError(""); setNotice("");
  }

  async function saveProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const required = [["providerName", "Delivery company"], ...TEXT_FIELDS.map(([key, label]) => [key, label])] as Array<[keyof Draft, string]>;
    const missing = required.filter(([key]) => !String(draft[key]).trim()).map(([, label]) => label);
    if (!draft.evidence.length || draft.evidence.some((item) => !item.summary.trim())) missing.push("Evidence summary");
    if (missing.length) { setError(`Complete these fields: ${missing.join(", ")}.`); return; }
    const installationCostUsd = draft.installationCostUsd.trim() ? Number(draft.installationCostUsd) : null;
    const monthlyCostUsd = draft.monthlyCostUsd.trim() ? Number(draft.monthlyCostUsd) : null;
    if ([installationCostUsd, monthlyCostUsd].some((value) => value !== null && (!Number.isFinite(value) || value < 0))) {
      setError("Enter a non-negative USD amount for each quoted cost, or leave it blank if not quoted."); return;
    }
    const body: DeliveryProposalInput = {
      providerName: draft.providerName.trim(), scope: draft.scope.trim(), equipment: draft.equipment.trim(),
      software: draft.software.trim(), deliveryCommitment: draft.deliveryCommitment.trim(), installationCostUsd,
      monthlyCostUsd, currency: "USD", exclusions: draft.exclusions.trim(), sitePreparation: draft.sitePreparation.trim(),
      humanAssistance: draft.humanAssistance.trim(), timing: draft.timing.trim(), support: draft.support.trim(),
      evidence: draft.evidence.map((item) => ({ level: item.level, summary: item.summary.trim(), ...(item.reference ? { reference: item.reference } : {}) })),
      acceptanceCriteria: draft.acceptanceCriteria.trim(), recommendationReason: draft.recommendationReason.trim() || null,
    };
    const saved = await mutate(editing ? `/proposals/${encodeURIComponent(editing.id)}` : "/proposals",
      editing ? { ...body, expectedRevision: editing.revision } : body,
      editing ? "Proposal changes saved." : "Delivery proposal saved and available to the customer.", editing ? "PUT" : "POST",
      editing ? {} : { "Idempotency-Key": proposalKey.current });
    if (saved) { setShowProposal(false); setEditing(null); setDraft(emptyDraft()); }
  }

  async function saveAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = workflow?.proposals.find((item) => item.id === workflow.selection?.proposalId);
    const agreedAtIso = isoDate(agreement.agreedAt);
    const plannedStartIso = isoDate(agreement.plannedStart);
    if (!selected || !agreement.confirmed || !agreedAtIso || !agreement.siteReference.trim() || !agreement.providerReference.trim()) {
      setError("Select a customer-chosen proposal, record the agreement date and both parties' agreement references, and confirm the agreement."); return;
    }
    if (agreement.outcomeAuthorized && !agreement.outcomeReference.trim()) { setError("Record the written permission covering both parties before enabling outcome recording."); return; }
    if (agreement.plannedStart.trim() && !plannedStartIso) { setError("Enter a valid planned start date or leave it blank."); return; }
    await mutate("/agreement", {
      proposalId: selected.id, expectedRevision: selected.revision, agreedAtIso, plannedStartIso,
      siteAgreementReference: agreement.siteReference.trim(), providerAgreementReference: agreement.providerReference.trim(),
      outcomeRecordingAuthorized: agreement.outcomeAuthorized, outcomeRecordingPermissionReference: agreement.outcomeAuthorized ? agreement.outcomeReference.trim() : null,
    }, "Pilot agreement recorded. This does not record a physical result.");
  }

  const selected = workflow?.proposals.find((item) => item.id === workflow.selection?.proposalId) ?? null;
  const mutationDisabled = busy || mustRefresh;
  const prefix = `job-workflow-${requestId}`;

  return (
    <details onToggle={(event) => { if (event.currentTarget.open && loadState === "idle") void load(); }}>
      <summary className="runway-rule-head runway-meta cursor-pointer">Delivery proposals and pilot agreement</summary>
      <div className="mt-4 grid gap-5">
        <p className="text-sm text-runway-mute">Record comparable written proposals and the parties' agreement. These commercial records do not establish a passed evaluation, physical performance or safety.</p>
        {loadState === "loading" ? <p className="text-sm text-runway-mute">Loading delivery records…</p> : null}
        {error ? <p role="alert" className="text-sm text-runway-red">{error}</p> : null}
        {notice ? <p role="status" className="text-sm text-runway-green">{notice}</p> : null}
        {loadState !== "idle" ? <div><Button type="button" variant="secondary" size="sm" disabled={busy || loadState === "loading"} onClick={() => void load()}>Refresh delivery records</Button></div> : null}
        {workflow ? (
          <>
            {workflow.reviewRequired ? <p className="text-sm text-runway-signal">The job scope, buying requirements or referenced evidence changed. Proposals marked for review must be updated before they can be selected or agreed.</p> : null}
            <div className="grid gap-1 text-sm text-runway-body">
              <p><span className="font-semibold">Next step:</span> {workflow.nextAction}</p>
              <p className="text-xs text-runway-mute">Responsible: {workflow.actionOwner.replace(/_/g, " ")}.</p>
            </div>
            <section className="grid gap-3" aria-label="Job evidence">
              <h3 className="text-lg font-semibold text-runway-text">Evidence for this job</h3>
              <p className="text-sm text-runway-mute">Record the options assessment directly when existing evidence is sufficient. Ask Pipeline a specific technical question when an uncertainty affects the decision. Saving a question does not allocate paid resources or invite a team.</p>
              {(workflow.evidence ?? []).map(item => <article className="grid gap-2 border-t border-runway-line pt-3 text-sm" key={item.requestId}>
                <p className="font-semibold">{item.question}</p>
                <p>{item.current ? item.state.replace(/_/g, " ") : "Historical — scope changed"}: {item.summary}</p>
                {item.claims.map(claim => <p key={claim.claimId}>{claim.claimId}: {claim.verdict.replace(/_/g, " ")} — {claim.rationale}</p>)}
                <p>Next: {item.nextAction}</p>
                {item.limitations.map((limit, index) => <p className="text-runway-mute" key={index}>{limit}</p>)}
                {item.serviceMessage ? <p role="status">{item.serviceMessage}</p> : null}
                <p className="break-all text-xs text-runway-mute">Request {item.requestId}{item.decisionDigest ? ` · Decision ${item.decisionDigest}` : ""}{item.publicationDigest ? ` · Publication ${item.publicationDigest}` : ""}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={mutationDisabled} onClick={() => void mutate(`/evidence/${encodeURIComponent(item.requestId)}/refresh`, {}, value => { const saved = value.evidence?.find(row => row.requestId === item.requestId); return saved?.serviceMessage ?? `Evidence status: ${saved?.state.replace(/_/g, " ") ?? "unconfirmed"}.`; })}>Refresh evidence</Button>
                  {item.current && item.state === "planned" ? <Button type="button" size="sm" disabled={mutationDisabled} onClick={() => void mutate(`/evidence/${encodeURIComponent(item.requestId)}/execute`, {}, value => { const saved = value.evidence?.find(row => row.requestId === item.requestId); return saved?.serviceMessage ?? `Pipeline returned ${saved?.state.replace(/_/g, " ") ?? "an unconfirmed state"}. ${saved?.nextAction ?? "Refresh this question before retrying."}`; })}>Run permitted local evidence</Button> : null}
                  {["planned", "information_required", "blocked", "unavailable"].includes(item.state) ? <Button type="button" size="sm" variant="secondary" disabled={mutationDisabled} onClick={() => void mutate(`/evidence/${encodeURIComponent(item.requestId)}/cancel`, {}, value => { const saved = value.evidence?.find(row => row.requestId === item.requestId); return saved?.state === "cancelled" ? "Evidence request cancelled." : `Cancellation was not confirmed. ${saved?.serviceMessage ?? saved?.nextAction ?? "Refresh the evidence status before retrying."}`; })}>Cancel evidence request</Button> : null}
                </div>
              </article>)}
              {currentUser && workflow.evidenceContext ? <JobManagedEvaluation key={`${requestId}:${workflow.evidenceContext.briefDigest}`} currentUser={currentUser} jobId={requestId} briefDigest={workflow.evidenceContext.briefDigest} /> : null}
              {(workflow.managedEvidence ?? []).map(item => <article key={item.runId} id={`managed-evidence-${encodeURIComponent(item.runId)}`} className="grid gap-2 border-t border-runway-line pt-3 text-sm">
                <p className="font-semibold">Managed policy run · {item.current ? item.state.replace(/_/g, " ") : "Historical — scope changed"}</p>
                <p>{item.summary}</p><p>Next: {item.nextAction}</p>
                {item.screening && <PolicyScreeningCandidates screening={item.screening} />}
                {item.screening?.budget && <p className="text-runway-mute">Shared site screening budget: up to ${item.screening.budget.committedUpperBoundUsd} committed
                  of ${item.screening.budget.limitUsd}, including ${item.screening.budget.reservedUsd} reserved for unresolved runs. These are conservative bounds, not invoices.</p>}
                {item.limitations.map((limit, index) => <p className="text-runway-mute" key={index}>{limit}</p>)}
                <p className="break-all text-xs">Run {item.runId}{item.resultDigest ? ` · Result ${item.resultDigest}` : ""}</p>
                {!item.screening && <a className="text-sm underline" href={`/app/evaluation-runs/${encodeURIComponent(item.runId)}`}>Inspect exact run and evidence</a>}
              </article>)}
              {!workflow.evidenceContext?.question ? <p className="text-sm text-runway-mute"><a className="underline" href={`/app/captures?jobId=${encodeURIComponent(requestId)}`}>Prepare task-specific capture evidence</a> when the question needs new site observations. Use the existing capture task approval and compilation actions; recording permissions and source access still apply.</p> : null}
              <form aria-label="Ask an evidence question" className="grid gap-3" onSubmit={async event => {
                event.preventDefault(); evidenceKey.current ||= crypto.randomUUID();
                if (await mutate("/evidence", { question: question.trim() }, "Evidence question saved.", "POST", { "Idempotency-Key": evidenceKey.current })) evidenceKey.current = "";
              }}>
                <label className="runway-label" htmlFor={`${prefix}-question`}>Question that changes the decision</label>
                <textarea id={`${prefix}-question`} className="runway-input" required maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Which uncertainty needs evidence before comparing delivery options?" />
                <div><Button type="submit" size="sm" disabled={mutationDisabled || !workflow.briefAgreed}>Ask Pipeline</Button></div>
                {!workflow.briefAgreed ? <p className="text-sm text-runway-mute">Agree the job brief before requesting task-specific evidence.</p> : null}
              </form>
            </section>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-runway-text">Record the options assessment</summary>
              <form className="mt-4 grid gap-4" aria-label="Options assessment" onSubmit={(event) => {
                event.preventDefault(); void mutate("/review", review, "Options assessment saved.");
              }}>
                <fieldset disabled={mutationDisabled || !workflow.briefAgreed} className="grid gap-4">
                  <div><label className="runway-label" htmlFor={`${prefix}-disposition`}>Assessment</label>
                    <select id={`${prefix}-disposition`} className="runway-input" value={review.disposition} onChange={(event) => setReview({ ...review, disposition: event.target.value as JobOptionsReview["disposition"] })}>
                      <option value="options_identified">Suitable options identified</option><option value="more_information">More information needed</option><option value="no_suitable_option">No suitable option found</option>
                    </select></div>
                  <div><label className="runway-label" htmlFor={`${prefix}-review`}>Assessment summary</label><textarea id={`${prefix}-review`} className="runway-input min-h-[5rem]" required maxLength={2000} value={review.summary} onChange={(event) => setReview({ ...review, summary: event.target.value })} /></div>
                  <div><label className="runway-label" htmlFor={`${prefix}-next`}>Next action</label><textarea id={`${prefix}-next`} className="runway-input min-h-[4rem]" required maxLength={2000} value={review.nextAction} onChange={(event) => setReview({ ...review, nextAction: event.target.value })} /></div>
                  <div><Button type="submit" size="sm">Save assessment</Button></div>
                </fieldset>
              </form>
            </details>

            <section aria-labelledby={`${prefix}-proposals-title`} className="grid gap-4">
              <h3 id={`${prefix}-proposals-title`} className="text-lg font-semibold text-runway-text">Delivery proposals</h3>
              {!workflow.proposals.length ? <p className="text-sm text-runway-mute">No delivery proposals have been recorded. Add only a real provider's scoped proposal.</p> : null}
              {workflow.proposals.map((proposal) => {
                const chosen = workflow.selection?.proposalId === proposal.id;
                const needsReview = proposal.status === "review_required";
                const locked = chosen && (!needsReview || Boolean(workflow.agreement));
                return <article key={proposal.id} className="grid gap-3 border border-runway-line p-4">
                  <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-runway-text">{proposal.providerName}</h4><StatusChip tone={proposal.status === "withdrawn" ? "neutral" : needsReview ? "warn" : "info"} square>{proposal.status === "withdrawn" ? "Withdrawn" : needsReview ? "Review current brief" : "Available"}</StatusChip>{chosen ? <StatusChip tone="proof" square>Customer selected</StatusChip> : null}</div>
                  <p className="whitespace-pre-wrap text-sm text-runway-body">{proposal.scope}</p>
                  <p className="text-sm text-runway-body">Installation: {money(proposal.installationCostUsd)} · Monthly: {money(proposal.monthlyCostUsd)}</p>
                  <p className="text-xs text-runway-mute">{proposal.evidence.map((item) => EVIDENCE_LABELS[item.level]).join(" · ")} · Updated {localDate(proposal.updatedAtIso)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" disabled={mutationDisabled || locked || proposal.status === "withdrawn"} onClick={() => beginProposal(proposal)}>{needsReview ? "Review and update proposal" : "Edit proposal"}</Button>
                    <Button type="button" size="sm" variant="secondary" disabled={mutationDisabled || chosen || proposal.status === "withdrawn"} onClick={() => setWithdrawId(proposal.id)}>Withdraw proposal</Button>
                  </div>
                  {locked ? <p className="text-xs text-runway-mute">This version is locked to the customer's choice. The customer must choose another proposal before it can be changed.</p> : null}
                  {withdrawId === proposal.id ? <div className="grid gap-3 border-t border-runway-line pt-3"><p className="text-sm text-runway-body">Withdraw this proposal from customer selection? Its record will remain in the job history.</p><div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={mutationDisabled} onClick={async () => { if (await mutate(`/proposals/${encodeURIComponent(proposal.id)}/withdraw`, { expectedRevision: proposal.revision }, "Proposal withdrawn.")) setWithdrawId(null); }}>Confirm withdrawal</Button><Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setWithdrawId(null)}>Keep proposal</Button></div></div> : null}
                </article>;
              })}
              {!showProposal ? <div><Button type="button" variant="secondary" size="sm" disabled={mutationDisabled || !workflow.briefAgreed || Boolean(workflow.agreement) || workflow.proposals.length >= 20} onClick={() => beginProposal(null)}>Add delivery proposal</Button></div> : null}
            </section>

            {showProposal ? <form onSubmit={saveProposal} className="grid gap-4 border border-runway-line p-4" aria-label={editing ? "Edit delivery proposal" : "New delivery proposal"}>
              <h4 className="font-semibold text-runway-text">{editing ? "Edit proposal" : "Add a written delivery proposal"}</h4>
              <p className="text-xs text-runway-mute">Saving makes this proposal available to the customer. Copy the provider's real terms; record unknowns explicitly. Evidence labels describe the supplied evidence and do not verify its claims.</p>
              <fieldset disabled={mutationDisabled} className="grid gap-4">
                <div><label className="runway-label" htmlFor={`${prefix}-provider`}>Delivery company</label><input id={`${prefix}-provider`} className="runway-input" required maxLength={160} value={draft.providerName} onChange={(event) => setDraft({ ...draft, providerName: event.target.value })} /></div>
                {TEXT_FIELDS.map(([key, label, hint]) => <div key={key}><label className="runway-label" htmlFor={`${prefix}-${key}`}>{label}</label><textarea id={`${prefix}-${key}`} className="runway-input min-h-[4rem]" required maxLength={2000} aria-describedby={`${prefix}-${key}-hint`} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /><p id={`${prefix}-${key}-hint`} className="mt-1 text-xs text-runway-mute">{hint}</p></div>)}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="runway-label" htmlFor={`${prefix}-installation`}>Installation cost (USD, optional)</label><input id={`${prefix}-installation`} className="runway-input" type="number" min="0" step="0.01" inputMode="decimal" value={draft.installationCostUsd} onChange={(event) => setDraft({ ...draft, installationCostUsd: event.target.value })} /></div>
                  <div><label className="runway-label" htmlFor={`${prefix}-monthly`}>Monthly cost (USD, optional)</label><input id={`${prefix}-monthly`} className="runway-input" type="number" min="0" step="0.01" inputMode="decimal" value={draft.monthlyCostUsd} onChange={(event) => setDraft({ ...draft, monthlyCostUsd: event.target.value })} /></div>
                </div>
                <p className="text-xs text-runway-mute">Leave a cost blank when it has not been quoted. Enter zero only if the provider explicitly quoted no charge.</p>
                {draft.evidence.map((item, index) => <fieldset key={index} className="grid gap-3 border-t border-runway-line pt-3"><legend className="runway-label">Evidence {index + 1}</legend><div><label className="runway-label" htmlFor={`${prefix}-evidence-reference-${index}`}>Pipeline evidence reference (optional)</label><select id={`${prefix}-evidence-reference-${index}`} className="runway-input" value={item.reference?.kind === "managed_run" ? `managed:${item.reference.runId}` : item.reference?.publicationDigest ?? ""} onChange={event => {
                  const managed = workflow.managedEvidence?.find(row => `managed:${row.runId}` === event.target.value);
                  if (managed?.resultDigest) {
                    setDraft({ ...draft, evidence: draft.evidence.map((entry, at) => at === index ? { ...entry, reference: { kind: "managed_run", runId: managed.runId, resultDigest: managed.resultDigest! } } : entry) });
                    return;
                  }
                  const evidence = workflow.evidence?.find(row => row.publicationDigest === event.target.value);
                  setDraft({ ...draft, evidence: draft.evidence.map((entry, at) => at === index ? { ...entry, reference: evidence?.publicationDigest ? { requestId: evidence.requestId, publicationDigest: evidence.publicationDigest } : undefined } : entry) });
                }}><option value="">Summary only</option>{(workflow.evidence ?? []).filter(row => row.current && row.publicationDigest).map(row => <option key={row.publicationDigest} value={row.publicationDigest!}>{row.question} — {row.state.replace(/_/g, " ")}</option>)}{(workflow.managedEvidence ?? []).filter(row => row.current && row.resultDigest).map(row => <option key={row.runId} value={`managed:${row.runId}`}>Managed run {row.runId} — {row.state.replace(/_/g, " ")}</option>)}</select><p className="text-xs text-runway-mute">The reference preserves the exact result. Keep its limitations in the summary and choose the evidence type accurately.</p></div><div><label className="runway-label" htmlFor={`${prefix}-evidence-level-${index}`}>Evidence type {index + 1}</label><select id={`${prefix}-evidence-level-${index}`} className="runway-input" value={item.level} onChange={(event) => setDraft({ ...draft, evidence: draft.evidence.map((entry, at) => at === index ? { ...entry, level: event.target.value as DeliveryEvidenceLevel } : entry) })}>{Object.entries(EVIDENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><label className="runway-label" htmlFor={`${prefix}-evidence-summary-${index}`}>Evidence summary {index + 1}</label><textarea id={`${prefix}-evidence-summary-${index}`} className="runway-input min-h-[4rem]" required maxLength={1000} value={item.summary} onChange={(event) => setDraft({ ...draft, evidence: draft.evidence.map((entry, at) => at === index ? { ...entry, summary: event.target.value } : entry) })} /></div>{draft.evidence.length > 1 ? <div><Button type="button" size="sm" variant="secondary" onClick={() => setDraft({ ...draft, evidence: draft.evidence.filter((_, at) => at !== index) })}>Remove evidence {index + 1}</Button></div> : null}</fieldset>)}
                {draft.evidence.length < 8 ? <div><Button type="button" size="sm" variant="secondary" onClick={() => setDraft({ ...draft, evidence: [...draft.evidence, { level: "unverified", summary: "" }] })}>Add evidence</Button></div> : null}
                <div><label className="runway-label" htmlFor={`${prefix}-reason`}>Why recommend this option? (optional)</label><textarea id={`${prefix}-reason`} className="runway-input min-h-[4rem]" maxLength={2000} value={draft.recommendationReason} onChange={(event) => setDraft({ ...draft, recommendationReason: event.target.value })} /></div>
                <div className="flex flex-wrap gap-2"><Button type="submit" size="sm">{busy ? "Saving…" : "Save proposal"}</Button><Button type="button" size="sm" variant="secondary" onClick={() => { setShowProposal(false); setEditing(null); }}>Cancel</Button></div>
              </fieldset>
            </form> : null}

            <section aria-labelledby={`${prefix}-agreement-title`} className="grid gap-3">
              <h3 id={`${prefix}-agreement-title`} className="text-lg font-semibold text-runway-text">Pilot agreement</h3>
              {workflow.agreement ? <div className="grid gap-2 text-sm text-runway-body"><p>Agreement recorded for {selected?.providerName ?? "the selected proposal"} on {localDate(workflow.agreement.agreedAtIso)}.</p>{workflow.agreement.plannedStartIso ? <p>Planned start: {localDate(workflow.agreement.plannedStartIso)}.</p> : <p>No start date recorded.</p>}<p className="break-words">Site agreement reference: {workflow.agreement.siteAgreementReference}</p><p className="break-words">Provider agreement reference: {workflow.agreement.providerAgreementReference}</p><p className="text-xs text-runway-mute">{workflow.agreement.outcomeRecordingAuthorized ? `Outcome recording is permitted under ${workflow.agreement.outcomeRecordingPermissionReference}.` : "Permission to record outcomes is not on file. The customer cannot report pilot outcomes through Blueprint until both parties authorize that use."}</p><p className="text-xs text-runway-mute">Agreement is a commercial record. Physical performance remains unmeasured until results are reported.</p></div>
                : !selected || selected.status !== "available" ? <p className="text-sm text-runway-mute">The customer must choose an available proposal for the current job brief before you can record the parties' agreement.</p>
                  : <form onSubmit={saveAgreement} aria-label="Record pilot agreement" className="grid gap-4"><p className="text-sm text-runway-body">Customer choice: <strong>{selected.providerName}</strong>. Record the agreement only after both parties agree to this exact proposal.</p><fieldset disabled={mutationDisabled} className="grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><div><label className="runway-label" htmlFor={`${prefix}-agreed`}>Agreement date and time (your local time)</label><input id={`${prefix}-agreed`} className="runway-input" type="datetime-local" required value={agreement.agreedAt} onChange={(event) => setAgreement({ ...agreement, agreedAt: event.target.value })} /></div><div><label className="runway-label" htmlFor={`${prefix}-start`}>Planned start (optional, your local time)</label><input id={`${prefix}-start`} className="runway-input" type="datetime-local" value={agreement.plannedStart} onChange={(event) => setAgreement({ ...agreement, plannedStart: event.target.value })} /></div></div><div><label className="runway-label" htmlFor={`${prefix}-site-reference`}>Site agreement reference</label><input id={`${prefix}-site-reference`} className="runway-input" required maxLength={1000} value={agreement.siteReference} onChange={(event) => setAgreement({ ...agreement, siteReference: event.target.value })} /></div><div><label className="runway-label" htmlFor={`${prefix}-provider-reference`}>Provider agreement reference</label><input id={`${prefix}-provider-reference`} className="runway-input" required maxLength={1000} value={agreement.providerReference} onChange={(event) => setAgreement({ ...agreement, providerReference: event.target.value })} /></div><label className="flex items-start gap-2 text-sm text-runway-body"><input type="checkbox" className="mt-1" required checked={agreement.confirmed} onChange={(event) => setAgreement({ ...agreement, confirmed: event.target.checked })} />I have recorded evidence that the site and delivery company agreed to this proposal. This does not certify safety or physical performance.</label><label className="flex items-start gap-2 text-sm text-runway-body"><input type="checkbox" className="mt-1" checked={agreement.outcomeAuthorized} onChange={(event) => setAgreement({ ...agreement, outcomeAuthorized: event.target.checked })} />Both parties have authorized Blueprint to record pilot outcomes within their written permissions. Optional; agreeing to a pilot alone does not grant this permission.</label>{agreement.outcomeAuthorized ? <div><label className="runway-label" htmlFor={`${prefix}-outcome-permission`}>Written outcome-recording permission reference</label><input id={`${prefix}-outcome-permission`} className="runway-input" required maxLength={1000} value={agreement.outcomeReference} onChange={(event) => setAgreement({ ...agreement, outcomeReference: event.target.value })} /><p className="mt-1 text-xs text-runway-mute">Identify the written permission covering both parties, the records Blueprint may receive, and their permitted uses.</p></div> : null}<div><Button type="submit" size="sm" disabled={!agreement.confirmed}>{busy ? "Saving…" : "Record pilot agreement"}</Button></div></fieldset></form>}
            </section>
            {workflow.outcome ? <section className="grid gap-2 text-sm text-runway-body" aria-label="Customer-reported pilot outcome"><h3 className="font-semibold text-runway-text">Customer-reported outcome</h3><p>{workflow.outcome.summary}</p><p>Acceptance criteria: {workflow.outcome.metCriteria === true ? "Reported met" : workflow.outcome.metCriteria === false ? "Reported not met" : "Not assessed"}.</p><p className="text-xs text-runway-mute">Reported by the customer. This does not create independently validated physical evidence.</p></section> : null}
          </>
        ) : null}
      </div>
    </details>
  );
}
