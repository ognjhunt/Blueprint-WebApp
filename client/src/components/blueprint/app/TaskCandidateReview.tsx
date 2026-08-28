import { useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, RotateCcw, XCircle } from "lucide-react";

import { Button, Card, ProofBoundary, StatusChip } from "@/components/blueprint";
import type {
  CaptureTaskReview,
  TaskCandidate,
  TaskDecisionCommandRequest,
} from "@/lib/captureUploads";

const fieldClass =
  "mt-1.5 w-full rounded-md border border-line bg-paper-0 px-3 py-2.5 text-body-s text-ink-900 shadow-sm outline-none focus:border-action focus:ring-2 focus:ring-action/20";
const labelClass = "text-body-s font-semibold text-ink-800";

function displayRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => String(row.description || row.label || row.object_id || row.region_id || ""))
    .filter(Boolean);
}

function EvidenceList({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  const items = displayRows(rows);
  return (
    <div>
      <h3 className="text-micro font-semibold uppercase tracking-eyebrow text-ink-400">{title}</h3>
      {items.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-body-s text-ink-600">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : <p className="mt-2 text-body-s text-ink-400">None reported.</p>}
    </div>
  );
}

function CandidateActionPanel({
  candidate,
  submitting,
  onSubmit,
}: {
  candidate: TaskCandidate;
  submitting: boolean;
  onSubmit: (request: Omit<TaskDecisionCommandRequest, "idempotency_key">) => void;
}) {
  const condition = candidate.proposed_measurable_success_condition;
  const [rationale, setRationale] = useState("");
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(candidate.description);
  const [taskFamily, setTaskFamily] = useState(candidate.likely_task_family);
  const [metric, setMetric] = useState(condition.metric);
  const [operator, setOperator] = useState(condition.operator);
  const [threshold, setThreshold] = useState(String(condition.threshold));
  const [units, setUnits] = useState(condition.units);
  const [reset, setReset] = useState(candidate.required_site_reset);

  function command(
    action: TaskDecisionCommandRequest["action"],
    editedTask: Record<string, unknown> | null = null,
  ) {
    onSubmit({
      schema_version: "task_candidate_decision_command.v1",
      discovery_digest: "",
      task_candidate_id: candidate.task_candidate_id,
      candidate_digest: candidate.candidate_digest,
      action,
      rationale: rationale.trim(),
      edited_task: editedTask,
    });
  }

  const actionDisabled = submitting || !rationale.trim();
  return (
    <div className="mt-5 border-t border-line-soft pt-5">
      <label>
        <span className={labelClass}>Decision rationale</span>
        <textarea
          className={fieldClass}
          rows={2}
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          placeholder="Why this task is correct, incorrect, or needs more capture"
        />
      </label>

      {editing ? (
        <div className="mt-4 grid gap-3 rounded-md border border-line bg-inset p-4 md:grid-cols-2">
          <label className="md:col-span-2"><span className={labelClass}>Exact task</span><textarea className={fieldClass} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <label><span className={labelClass}>Task family</span><input className={fieldClass} value={taskFamily} onChange={(event) => setTaskFamily(event.target.value)} /></label>
          <label><span className={labelClass}>Metric</span><input className={fieldClass} value={metric} onChange={(event) => setMetric(event.target.value)} /></label>
          <label><span className={labelClass}>Operator</span><input className={fieldClass} value={operator} onChange={(event) => setOperator(event.target.value)} /></label>
          <label><span className={labelClass}>Threshold</span><input className={fieldClass} value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label>
          <label><span className={labelClass}>Units</span><input className={fieldClass} value={units} onChange={(event) => setUnits(event.target.value)} /></label>
          <label className="md:col-span-2"><span className={labelClass}>Reset instructions</span><textarea className={fieldClass} rows={2} value={reset} onChange={(event) => setReset(event.target.value)} /></label>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button
              type="button"
              variant="action"
              size="sm"
              disabled={actionDisabled || !description.trim() || !taskFamily.trim() || !metric.trim() || !operator.trim() || !threshold.trim() || !units.trim() || !reset.trim()}
              onClick={() => command("edit_and_approve", {
                description: description.trim(),
                task_family: taskFamily.trim(),
                measurable_success_conditions: [{
                  metric: metric.trim(),
                  operator: operator.trim(),
                  threshold: threshold.trim(),
                  units: units.trim(),
                }],
                reset_contract: { instructions: reset.trim() },
                task_objects: candidate.observed_objects,
                target_regions: candidate.target_regions,
                required_robot_capabilities: candidate.required_robot_capabilities,
              })}
            >Submit edited task</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel edit</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="action" size="sm" iconLeft={<CheckCircle2 />} disabled={actionDisabled} onClick={() => command("approve")}>Approve candidate</Button>
          <Button type="button" variant="secondary" size="sm" iconLeft={<Pencil />} disabled={submitting} onClick={() => setEditing(true)}>Edit exact task</Button>
          <Button type="button" variant="secondary" size="sm" iconLeft={<XCircle />} disabled={actionDisabled} onClick={() => command("reject")}>Reject</Button>
          <Button type="button" variant="secondary" size="sm" iconLeft={<RotateCcw />} disabled={actionDisabled} onClick={() => command("request_more_capture")}>Request more capture</Button>
        </div>
      )}
    </div>
  );
}

export function TaskCandidateReview({
  review,
  submitting,
  onSubmit,
}: {
  review: CaptureTaskReview;
  submitting: boolean;
  onSubmit: (request: Omit<TaskDecisionCommandRequest, "idempotency_key">) => void;
}) {
  const discovery = review.discovery;
  if (!discovery) return null;
  const pending = review.status === "decision_pending_pipeline_validation";
  const approved = review.status === "task_approved";
  const rejected = review.status === "task_rejected";
  const recaptureRequested = review.status === "recapture_requested";
  const actionsAvailable = review.status === "task_approval_required";
  return (
    <section className="flex flex-col gap-5" aria-labelledby="task-candidate-heading">
      <div>
        <StatusChip tone="warn" square>Customer intent required</StatusChip>
        <h2 id="task-candidate-heading" className="mt-3 text-title-l font-semibold tracking-tight text-ink-900">Review proposed tasks</h2>
        <p className="mt-2 max-w-3xl text-body-s text-ink-500">These are Pipeline-authored hypotheses grounded in the capture. Approving one records your intent; it does not prove the task succeeds.</p>
      </div>

      <ProofBoundary level="info" title="Approval command boundary" icon={AlertTriangle}>
        WebApp records your exact command and digest binding. Pipeline must still validate it and compile an approved task before any Decision/Evidence Request exists.
      </ProofBoundary>

      {pending && review.latest_decision_command ? (
        <ProofBoundary level="proof" title="Decision command recorded" icon={CheckCircle2}>
          Your “{review.latest_decision_command.action.replace(/_/g, " ")}” command is pending Pipeline validation. No evaluation has started from this command yet.
        </ProofBoundary>
      ) : null}

      {approved && review.latest_decision_command ? (
        <ProofBoundary level="proof" title="Task intent approved by Pipeline" icon={CheckCircle2}>
          Pipeline validated the exact customer command and emitted an approved task definition. No Decision/Evidence Request or task-success result exists until the immutable testbed is compiled.
        </ProofBoundary>
      ) : null}

      {rejected ? (
        <ProofBoundary level="info" title="Candidate rejected" icon={XCircle}>
          Pipeline recorded the rejection. This candidate will not become a customer decision request.
        </ProofBoundary>
      ) : null}

      {recaptureRequested ? (
        <ProofBoundary level="info" title="More capture requested" icon={RotateCcw}>
          Pipeline recorded the request for supplemental capture. The current proposal remains unapproved.
        </ProofBoundary>
      ) : null}

      <Card pad="lg" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <EvidenceList title="Direct observations" rows={discovery.scene_analysis.observed_site_facts} />
        <EvidenceList title="Inferred objects and affordances" rows={discovery.scene_analysis.inferred_objects_and_affordances} />
        <EvidenceList title="Unsupported or occluded" rows={discovery.scene_analysis.unsupported_or_occluded_regions} />
        <EvidenceList title="Hazards" rows={discovery.scene_analysis.hazards} />
        <EvidenceList title="Privacy-sensitive areas" rows={discovery.scene_analysis.privacy_sensitive_areas} />
      </Card>

      <div className="grid gap-4">
        {discovery.task_candidates.map((candidate) => {
          const condition = candidate.proposed_measurable_success_condition;
          return (
            <Card key={candidate.task_candidate_id} pad="lg">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <h3 className="text-title-m font-semibold text-ink-900">{candidate.description}</h3>
                  <p className="mt-1 font-mono text-[0.68rem] text-ink-400">{candidate.task_candidate_id}</p>
                </div>
                <StatusChip tone="neutral" square>{Math.round(candidate.confidence * 100)}% proposal confidence</StatusChip>
              </div>
              <dl className="mt-5 grid gap-4 text-body-s md:grid-cols-2 lg:grid-cols-3">
                <div><dt className="font-semibold text-ink-800">Task family</dt><dd className="mt-1 text-ink-600">{candidate.likely_task_family}</dd></div>
                <div><dt className="font-semibold text-ink-800">Proposed success condition</dt><dd className="mt-1 text-ink-600">{condition.metric} {condition.operator} {String(condition.threshold)} {condition.units}</dd></div>
                <div><dt className="font-semibold text-ink-800">Estimated evaluation cost</dt><dd className="mt-1 text-ink-600">${candidate.estimated_evaluation_cost_usd.toFixed(2)}</dd></div>
                <div><dt className="font-semibold text-ink-800">Observed objects</dt><dd className="mt-1 text-ink-600">{displayRows(candidate.observed_objects).join(", ")}</dd></div>
                <div><dt className="font-semibold text-ink-800">Target regions</dt><dd className="mt-1 text-ink-600">{displayRows(candidate.target_regions).join(", ")}</dd></div>
                <div><dt className="font-semibold text-ink-800">Required reset</dt><dd className="mt-1 text-ink-600">{candidate.required_site_reset}</dd></div>
              </dl>
              {candidate.missing_evidence.length ? <p className="mt-4 text-body-s text-warn"><strong>Missing evidence:</strong> {candidate.missing_evidence.join(" ")}</p> : null}
              {candidate.prohibited_claims.length ? <p className="mt-2 text-body-s text-ink-500"><strong>Prohibited claims:</strong> {candidate.prohibited_claims.join(", ")}</p> : null}
              {actionsAvailable ? <CandidateActionPanel candidate={candidate} submitting={submitting} onSubmit={onSubmit} /> : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
