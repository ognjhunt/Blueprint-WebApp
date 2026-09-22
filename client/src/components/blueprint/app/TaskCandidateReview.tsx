import { useState } from "react";

import { Field, Tag } from "@/components/workspace/WorkspaceUI";
import type {
  CaptureTaskReview,
  TaskCandidate,
  TaskDecisionCommandRequest,
} from "@/lib/captureUploads";

function displayRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => String(row.description || row.label || row.object_id || row.region_id || ""))
    .filter(Boolean);
}

function EvidenceList({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  const items = displayRows(rows);
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      {items.length ? (
        <ul className="mt-1 list-disc pl-5 text-sm">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : <p className="mt-1 text-sm text-ink-500">None reported.</p>}
    </div>
  );
}

const operatorLabels: Record<string, string> = { "<=": "≤", ">=": "≥", "==": "=" };

const actionLabels: Record<string, string> = {
  approve: "approve",
  edit_and_approve: "edit and approve",
  reject: "reject",
  request_more_capture: "ask for more capture",
};

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
    <div className="mt-6">
      <div className="ws-fields">
        <Field label="Why" wide>
          <textarea
            rows={2}
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            placeholder="Why this task is correct, incorrect, or needs more capture"
          />
        </Field>
      </div>

      {editing ? (
        <>
          <div className="ws-fields mt-6">
            <Field label="Exact task" wide><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
            <Field label="Task family"><input value={taskFamily} onChange={(event) => setTaskFamily(event.target.value)} /></Field>
            <Field label="Metric"><input value={metric} onChange={(event) => setMetric(event.target.value)} /></Field>
            <Field label="Operator"><input value={operator} onChange={(event) => setOperator(event.target.value)} /></Field>
            <Field label="Threshold"><input value={threshold} onChange={(event) => setThreshold(event.target.value)} /></Field>
            <Field label="Units"><input value={units} onChange={(event) => setUnits(event.target.value)} /></Field>
            <Field label="Reset instructions" wide><textarea rows={2} value={reset} onChange={(event) => setReset(event.target.value)} /></Field>
          </div>
          <div className="ws-form-actions">
            <button
              type="button"
              className="ws-primary"
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
            >Approve edited task</button>
            <button type="button" className="ws-link" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <div className="ws-form-actions">
          <button type="button" className="ws-primary" disabled={actionDisabled} onClick={() => command("approve")}>Approve this task</button>
          <button type="button" className="ws-secondary" disabled={submitting} onClick={() => setEditing(true)}>Edit the task</button>
          <button type="button" className="ws-link" disabled={actionDisabled} onClick={() => command("reject")}>Reject</button>
          <button type="button" className="ws-link" disabled={actionDisabled} onClick={() => command("request_more_capture")}>Ask for more capture</button>
        </div>
      )}
    </div>
  );
}

/** Proposed tasks with one decision each; what the capture showed stays one click away. */
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
  const actionsAvailable = review.status === "task_approval_required";
  const latest = review.latest_decision_command;
  const statusLine = review.status === "decision_pending_pipeline_validation" && latest
    ? `Your decision (${actionLabels[latest.action] || latest.action.replace(/_/g, " ")}) is recorded and being checked. Nothing has started from it yet.`
    : review.status === "task_approved" && latest
      ? "Task approved. Next, build its testbed."
      : review.status === "task_rejected"
        ? "You rejected this task, so it won't be evaluated."
        : review.status === "recapture_requested"
          ? "You asked for more capture. The proposal stays unapproved."
          : null;
  return (
    <section aria-labelledby="task-candidate-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="task-candidate-heading">Proposed tasks</h2>
        {actionsAvailable ? <Tag>Needs your review</Tag> : null}
      </div>
      <p className="mt-2 text-ink-600">
        Blueprint found these tasks in your capture. Approving one records what you want tested; it doesn't show the
        task will succeed.
      </p>
      {statusLine ? <p className="ws-alert mt-4" role="status">{statusLine}</p> : null}

      {discovery.task_candidates.map((candidate) => {
        const condition = candidate.proposed_measurable_success_condition;
        return (
          <article key={candidate.task_candidate_id} className="mt-8 border-t border-line pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-lg">{candidate.description}</h3>
              <Tag>{Math.round(candidate.confidence * 100)}% confidence</Tag>
            </div>
            <dl className="ws-facts">
              <div><dt>Success means</dt><dd>{condition.metric.replace(/_/g, " ")} {operatorLabels[condition.operator] || condition.operator} {String(condition.threshold)} {condition.units}</dd></div>
              <div><dt>Objects</dt><dd>{displayRows(candidate.observed_objects).join(", ") || "None listed"}</dd></div>
              <div><dt>Where</dt><dd>{displayRows(candidate.target_regions).join(", ") || "None listed"}</dd></div>
              <div><dt>Reset between tries</dt><dd>{candidate.required_site_reset}</dd></div>
              <div><dt>Estimated cost to evaluate</dt><dd>${candidate.estimated_evaluation_cost_usd.toFixed(2)}</dd></div>
            </dl>
            {candidate.missing_evidence.length ? <p className="mt-3 text-sm">Still missing: {candidate.missing_evidence.join(" ")}</p> : null}
            <details className="mt-4">
              <summary>More about this task</summary>
              <p className="text-sm">Task family: {candidate.likely_task_family}</p>
              {candidate.prohibited_claims.length ? <p className="mt-1 text-sm">Can't be used to claim: {candidate.prohibited_claims.map((claim) => claim.replace(/_/g, " ")).join(", ")}</p> : null}
              <p className="mt-1 break-all text-xs text-ink-500">{candidate.task_candidate_id}</p>
            </details>
            {actionsAvailable ? <CandidateActionPanel candidate={candidate} submitting={submitting} onSubmit={onSubmit} /> : null}
          </article>
        );
      })}

      <details className="mt-8">
        <summary>What Blueprint saw in the capture</summary>
        <div className="grid gap-5 md:grid-cols-2">
          <EvidenceList title="Direct observations" rows={discovery.scene_analysis.observed_site_facts} />
          <EvidenceList title="Inferred objects and affordances" rows={discovery.scene_analysis.inferred_objects_and_affordances} />
          <EvidenceList title="Hidden or not covered" rows={discovery.scene_analysis.unsupported_or_occluded_regions} />
          <EvidenceList title="Hazards" rows={discovery.scene_analysis.hazards} />
          <EvidenceList title="Privacy-sensitive areas" rows={discovery.scene_analysis.privacy_sensitive_areas} />
        </div>
      </details>
    </section>
  );
}
