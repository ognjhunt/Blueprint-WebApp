import { useEffect, useRef, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { Link } from "wouter";
import { EvaluationRunConfiguration } from "@/components/blueprint/app/EvaluationRunConfiguration";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { buildEvaluationReadyRunInput, createEvaluationReadyRun, fetchEvaluationReadySetup,
  type EvaluationReadySetupView } from "@/lib/evaluationReadyRuns";

type Offering = { source_launch_id: string; availability: "available" | "unavailable";
  diagnostic_only: boolean; next_action: string; reason: string | null };

/** Use the existing managed run and its real scene; no team invitation is needed. */
export function JobManagedEvaluation({ currentUser, jobId, briefDigest }: {
  currentUser: FirebaseUser; jobId: string; briefDigest: string;
}) {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [nextAction, setNextAction] = useState("");
  const [setup, setSetup] = useState<EvaluationReadySetupView | null>(null);
  const [runId, setRunId] = useState("");
  const [runHref, setRunHref] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [priorRuns, setPriorRuns] = useState<Array<{ run_id: string; href: string; state: string; brief_current: boolean }>>([]);
  const generation = useRef(0);

  useEffect(() => {
    let active = true;
    generation.current += 1;
    setSetup(null); setOfferings([]); setRunHref(""); setError(""); setNextAction(""); setPriorRuns([]);
    void withFirebaseAuthHeaders(currentUser).then(headers => fetch(
      `/api/configured-scene-offerings/job/${encodeURIComponent(jobId)}/managed-evaluations?brief_digest=${encodeURIComponent(briefDigest)}`,
      { credentials: "include", headers },
    )).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Managed policy setup is unavailable.");
      if (payload.schema_version !== "job_managed_evaluations.v1" || !Array.isArray(payload.offerings)) throw new Error("Managed policy setup could not be confirmed.");
      if (active) { setOfferings(payload.offerings); setNextAction(payload.next_action); setPriorRuns(payload.runs || []); }
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Managed policy setup is unavailable."); });
    return () => { active = false; };
  }, [currentUser, jobId, briefDigest]);

  async function choose(sourceLaunchId: string) {
    const epoch = generation.current;
    setBusy(true); setError(""); setSetup(null);
    try {
      const value = await fetchEvaluationReadySetup(currentUser, sourceLaunchId);
      if (epoch !== generation.current) return;
      setSetup(value);
      setRunId(`job-${jobId.slice(0, 60)}-${crypto.randomUUID()}`);
    } catch (reason) { if (epoch === generation.current) setError(reason instanceof Error ? reason.message : "Managed policy setup is unavailable."); }
    finally { if (epoch === generation.current) setBusy(false); }
  }

  async function submit(configuration: { presetId: EvaluationReadySetupView["defaultPresetId"] }) {
    if (!setup || busy) return;
    const epoch = generation.current;
    setBusy(true); setError("");
    try {
      const receipt = await createEvaluationReadyRun({ currentUser, sourceLaunchId: setup.sourceLaunchId,
        input: buildEvaluationReadyRunInput({ runId, offeringDigest: setup.offeringDigest, ...configuration,
          jobEvidenceBinding: { job_id: jobId, brief_digest: briefDigest } }) });
      if (epoch === generation.current) setRunHref(`/app/evaluation-runs/${encodeURIComponent(receipt.run.run_id)}`);
    } catch (reason) { if (epoch === generation.current) setError(reason instanceof Error ? reason.message : "Preparation could not be confirmed. Retry uses the same run identity."); }
    finally { if (epoch === generation.current) setBusy(false); }
  }

  return <div className="space-y-4">
    <p className="text-sm">Blueprint can run supported policies itself. Use new simulation only when it answers a remaining job question.</p>
    {nextAction ? <p className="text-sm">{nextAction}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {priorRuns.map(run => <p key={run.run_id} className="text-sm"><Link href={run.href}>Open policy run · {run.state}</Link>
      {run.brief_current ? "" : " · earlier brief; historical evidence"}</p>)}
    {runHref ? <p><Link href={runHref}>Open the run status and its exact results →</Link></p> : <>
      {offerings.map(offering => <div key={offering.source_launch_id} className="space-y-2">
        <p className="text-sm">{offering.next_action}</p>
        {offering.availability === "available" ? <button type="button" className="ws-secondary"
          disabled={busy} onClick={() => void choose(offering.source_launch_id)}>Use this job's policy setup</button>
          : offering.diagnostic_only ? <p className="text-sm">This scene currently supports a diagnostic canary only; it cannot supply a qualified evaluation result.</p> : null}
      </div>)}
      {setup ? <EvaluationRunConfiguration setup={setup} submitting={busy} onSubmit={value => void submit(value)} /> : null}
    </>}
  </div>;
}
