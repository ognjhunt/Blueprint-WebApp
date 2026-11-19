import { useEffect, useRef, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { JobMarketplaceWorkflow } from "@/types/jobMarketplace";

function errorMessage(value: { error?: unknown; fields?: Array<{ path?: unknown; message?: unknown }> }, status: number) {
  const fields = Array.isArray(value.fields)
    ? value.fields.map((field) => `${Array.isArray(field.path) ? field.path.join(".") : String(field.path ?? "Field")}: ${String(field.message ?? "Check this value.")}`)
    : [];
  return [typeof value.error === "string" ? value.error : `Request failed (${status}).`, ...fields].join(" ");
}

/** Evidence questions. Scientific results stay in their owner systems. */
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
  const base = `/api/job-workflow/admin/${encodeURIComponent(requestId)}`;

  useEffect(() => {
    generation.current += 1;
    loadingRef.current = false;
    busyRef.current = false;
    setWorkflow(null); setLoadState("idle"); setError(""); setNotice(""); setBusy(false); setMustRefresh(false);
    setQuestion(""); evidenceKey.current = "";
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
  }

  async function load() {
    if (loadingRef.current || busyRef.current) return;
    const epoch = generation.current;
    loadingRef.current = true; setLoadState("loading"); setError("");
    try {
      const response = await fetch(base, await authorized());
      const value = await response.json().catch(() => ({}));
      if (epoch !== generation.current) return;
      if (!response.ok || value.schemaVersion !== "job_marketplace.v1") {
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
      if (value.schemaVersion !== "job_marketplace.v1") {
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

  // A staff tool on the admin job page: mounted, and so loaded, only when opened.
  useEffect(() => { if (loadState === "idle") void load(); }, [loadState, requestId]);

  const mutationDisabled = busy || mustRefresh;
  const prefix = `job-workflow-${requestId}`;

  return (
    <section aria-label="Job evidence questions" className="admin-job-tool">
      <div className="admin-job-tool">
        <p className="bare-helper">Ask Pipeline evidence questions. These records do not establish a passed evaluation, physical performance or safety.</p>
        {loadState === "loading" ? <p className="bare-helper" role="status">Loading job records…</p> : null}
        {error ? <p role="alert" className="bare-notice">{error}</p> : null}
        {notice ? <p role="status" className="bare-done">{notice}</p> : null}
        {loadState !== "idle" ? <div><button type="button" className="bare-quiet-button" disabled={busy || loadState === "loading"} onClick={() => void load()}>Refresh job records</button></div> : null}
        {workflow ? (
          <>
            <section className="admin-job-tool" aria-label="Job evidence">
              <h3 className="bare-rows-title">Evidence for this job</h3>
              <p className="bare-helper">Ask Pipeline a specific technical question when an uncertainty affects the decision. Saving a question does not allocate paid resources or invite a team.</p>
              {(workflow.evidence ?? []).map(item => <article className="admin-job-tool" key={item.requestId}>
                <p><strong>{item.question}</strong></p>
                <p>{item.current ? item.state.replace(/_/g, " ") : "Historical — scope changed"}: {item.summary}</p>
                {item.claims.map(claim => <p key={claim.claimId}>{claim.claimId}: {claim.verdict.replace(/_/g, " ")} — {claim.rationale}</p>)}
                <p>Next: {item.nextAction}</p>
                {item.limitations.map((limit, index) => <p className="bare-helper" key={index}>{limit}</p>)}
                {item.serviceMessage ? <p role="status">{item.serviceMessage}</p> : null}
                <p className="bare-helper">Request {item.requestId}{item.decisionDigest ? ` · Decision ${item.decisionDigest}` : ""}{item.publicationDigest ? ` · Publication ${item.publicationDigest}` : ""}</p>
                <div>
                  <button type="button" className="bare-quiet-button" disabled={mutationDisabled} onClick={() => void mutate(`/evidence/${encodeURIComponent(item.requestId)}/refresh`, {}, value => { const saved = value.evidence?.find(row => row.requestId === item.requestId); return saved?.serviceMessage ?? `Evidence status: ${saved?.state.replace(/_/g, " ") ?? "unconfirmed"}.`; })}>Refresh evidence</button>
                  {item.current && item.state === "planned" ? <button type="button" className="ms-button" disabled={mutationDisabled} onClick={() => void mutate(`/evidence/${encodeURIComponent(item.requestId)}/execute`, {}, value => { const saved = value.evidence?.find(row => row.requestId === item.requestId); return saved?.serviceMessage ?? `Pipeline returned ${saved?.state.replace(/_/g, " ") ?? "an unconfirmed state"}. ${saved?.nextAction ?? "Refresh this question before retrying."}`; })}>Run permitted local evidence</button> : null}
                  {["planned", "information_required", "blocked", "unavailable"].includes(item.state) ? <button type="button" className="bare-quiet-button" disabled={mutationDisabled} onClick={() => void mutate(`/evidence/${encodeURIComponent(item.requestId)}/cancel`, {}, value => { const saved = value.evidence?.find(row => row.requestId === item.requestId); return saved?.state === "cancelled" ? "Evidence request cancelled." : `Cancellation was not confirmed. ${saved?.serviceMessage ?? saved?.nextAction ?? "Refresh the evidence status before retrying."}`; })}>Cancel evidence request</button> : null}
                </div>
              </article>)}
              {(workflow.managedEvidence ?? []).map(item => <article key={item.runId} id={`managed-evidence-${encodeURIComponent(item.runId)}`} className="admin-job-tool">
                <p><strong>Managed policy run: {item.current ? item.state.replace(/_/g, " ") : "earlier scope"}</strong></p>
                <p>{item.summary}</p><p>Next: {item.opsNextAction ?? item.nextAction}</p>
                {item.limitations.map((limit, index) => <p className="bare-helper" key={index}>{limit}</p>)}
                <p className="bare-helper">Run {item.runId}{item.resultDigest ? ` · Result ${item.resultDigest}` : ""}</p>
              </article>)}
              {!workflow.evidenceContext?.question ? <p className="bare-helper"><a className="ms-text-link" href={`/app/captures?jobId=${encodeURIComponent(requestId)}`}>Prepare task-specific capture evidence</a> when the question needs new site observations. Use the existing capture task approval and compilation actions; recording permissions and source access still apply.</p> : null}
              <form aria-label="Ask an evidence question" className="ms-form" onSubmit={async event => {
                event.preventDefault(); evidenceKey.current ||= crypto.randomUUID();
                if (await mutate("/evidence", { question: question.trim() }, "Evidence question saved.", "POST", { "Idempotency-Key": evidenceKey.current })) evidenceKey.current = "";
              }}>
                <label htmlFor={`${prefix}-question`}>Question that changes the decision</label>
                <textarea id={`${prefix}-question`} required maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Which uncertainty needs evidence before the decision?" />
                <div><button type="submit" className="ms-button" disabled={mutationDisabled || !workflow.briefAgreed}>Ask Pipeline</button></div>
                {!workflow.briefAgreed ? <p className="ms-field-hint">Agree the job brief before requesting task-specific evidence.</p> : null}
              </form>
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}
