import { PolicyScreeningCandidates } from "@/components/shared/PolicyScreeningCandidates";
import { useEffect, useRef, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { JobManagedEvaluation } from "./JobManagedEvaluation";
import { Button } from "@/components/blueprint";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { JobMarketplaceWorkflow, JobOptionsReview } from "@/types/jobMarketplace";

function errorMessage(value: { error?: unknown; fields?: Array<{ path?: unknown; message?: unknown }> }, status: number) {
  const fields = Array.isArray(value.fields)
    ? value.fields.map((field) => `${Array.isArray(field.path) ? field.path.join(".") : String(field.path ?? "Field")}: ${String(field.message ?? "Check this value.")}`)
    : [];
  return [typeof value.error === "string" ? value.error : `Request failed (${status}).`, ...fields].join(" ");
}

/** Evidence questions and the options assessment. Scientific results stay in their owner systems. */
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
  const evidenceKey = useRef("");
  const [question, setQuestion] = useState("");
  const generation = useRef(0);
  const [review, setReview] = useState<{ disposition: JobOptionsReview["disposition"]; summary: string; nextAction: string }>({
    disposition: "options_identified", summary: "", nextAction: "",
  });
  const base = `/api/job-workflow/admin/${encodeURIComponent(requestId)}`;

  useEffect(() => {
    generation.current += 1;
    loadingRef.current = false;
    busyRef.current = false;
    setWorkflow(null); setLoadState("idle"); setError(""); setNotice(""); setBusy(false); setMustRefresh(false);
    setQuestion(""); evidenceKey.current = "";
    setReview({ disposition: "options_identified", summary: "", nextAction: "" });
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
      if (!response.ok || value.schemaVersion !== "job_marketplace.v1" || !value.requirements) {
        setLoadState("failed"); setError(errorMessage(value, response.status)); return;
      }
      accept(value as JobMarketplaceWorkflow);
    } catch {
      if (epoch === generation.current) {
        setLoadState("failed"); setError("The job records could not be loaded. Check your connection and try again.");
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
      if (value.schemaVersion !== "job_marketplace.v1" || !value.requirements) {
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

  const mutationDisabled = busy || mustRefresh;
  const prefix = `job-workflow-${requestId}`;

  return (
    <details onToggle={(event) => { if (event.currentTarget.open && loadState === "idle") void load(); }}>
      <summary className="runway-rule-head runway-meta cursor-pointer">Job evidence and options assessment</summary>
      <div className="mt-4 grid gap-5">
        <p className="text-sm text-runway-mute">Ask Pipeline evidence questions and record the options assessment. These records do not establish a passed evaluation, physical performance or safety.</p>
        {loadState === "loading" ? <p className="text-sm text-runway-mute">Loading job records…</p> : null}
        {error ? <p role="alert" className="text-sm text-runway-red">{error}</p> : null}
        {notice ? <p role="status" className="text-sm text-runway-green">{notice}</p> : null}
        {loadState !== "idle" ? <div><Button type="button" variant="secondary" size="sm" disabled={busy || loadState === "loading"} onClick={() => void load()}>Refresh job records</Button></div> : null}
        {workflow ? (
          <>
            {workflow.reviewRequired ? <p className="text-sm text-runway-signal">The job scope or buying requirements changed since the options assessment. Record a new assessment against the current job.</p> : null}
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
                <textarea id={`${prefix}-question`} className="runway-input" required maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Which uncertainty needs evidence before the decision?" />
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
          </>
        ) : null}
      </div>
    </details>
  );
}
