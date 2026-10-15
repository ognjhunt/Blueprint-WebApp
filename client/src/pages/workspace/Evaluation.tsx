import { Link, useParams } from "wouter";
import { useWorkspace, statusLabel, dateLabel } from "@/lib/workspace";
import { useBuyerAppRunDetail } from "@/lib/buyerAppData";
import {
  Frame,
  Empty,
  Tag,
  ActionLink,
} from "@/components/workspace/WorkspaceUI";
import { RunRecord } from "@/pages/app/RunDetail";
import type { EpisodeOutcomeRow } from "@/types/workspace";

const OUTCOME_REASONS: Record<string, string> = {
  task_succeeded: "Task completed",
  task_not_completed: "Task not completed",
  policy_action_beyond_joint_limits: "Action outside the robot's joint limits",
  policy_service_did_not_answer: "Policy service did not answer in time",
  policy_action_invalid: "Action had the wrong shape or non-finite values",
  policy_service_error: "Policy service error",
  simulator_score_undetermined: "Simulator could not score (not counted)",
  simulator_failed_during_episode: "Simulator failed (not counted)",
  simulator_failed_before_policy: "Simulator failed before the policy ran (not counted)",
};

/** Each episode's outcome, by variation family only: a cell's draw stays hidden. */
function EpisodeOutcomes({ rows }: { rows: EpisodeOutcomeRow[] }) {
  return (
    <details className="ws-section">
      <summary>Every episode ({rows.length})</summary>
      <div className="ws-table-wrap">
        <table className="ws-table">
          <thead>
            <tr><th>Cell</th><th>Variation</th><th>Outcome</th><th>Why</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.cell_id}>
                <td>{row.cell_id}</td>
                <td>{row.family ?? "—"}</td>
                <td>{row.outcome === "void" ? "Not counted" : row.outcome === "success" ? "Success" : "Failure"}</td>
                <td>{OUTCOME_REASONS[row.reason] ?? row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
function Evidence({ runId }: { runId: string }) {
  const query = useBuyerAppRunDetail(runId);
  return (
    <details className="ws-section">
      <summary>Run configuration, evidence & files</summary>
      {query.isLoading ? (
        <p role="status">Loading run evidence…</p>
      ) : query.error ? (
        <p role="alert">{query.error.message}</p>
      ) : query.run ? (
        <RunRecord run={query.run} />
      ) : (
        <p>No run evidence is available.</p>
      )}
    </details>
  );
}
export default function Evaluation() {
  const query = useWorkspace(),
    { evaluationId } = useParams<{ evaluationId: string }>(),
    item = query.data?.evaluations.find((item) => item.id === evaluationId);
  return (
    <Frame
      query={query}
      active="overview"
      title={item?.title || "Evaluation"}
      back={{
        href: item?.archived ? "/app/history" : "/app",
        label: "Evaluations",
      }}
    >
      {!item ? (
        <Empty
          title="Evaluation not found"
          href="/app"
          action="Your evaluations"
        >
          This evaluation is unavailable in your account.
        </Empty>
      ) : (
        <>
          <div className="ws-detail-header">
            <p>{item.setupName || "Your evaluation"}</p>
            <p>
              <Tag tone={item.selected ? "green" : "neutral"}>
                {item.outcome
                  ? statusLabel(item.outcome)
                  : item.successRate !== null
                    ? "Awaiting site decision"
                    : statusLabel(item.status)}
              </Tag>
            </p>
          </div>
          <section className="ws-section">
            <h2>Your result</h2>
            {item.successRate === null && item.cycleTimeSeconds === null ? (
              <div className="ws-empty">
                <p>
                  {item.status === "requested"
                    ? "Your request is saved. Blueprint will review compatibility, confirm costs, and prepare the evaluation."
                    : [
                          "failed",
                          "blocked",
                          "abstained",
                          "cancelled",
                          "decided",
                          "decision_available",
                          "completed",
                          "complete",
                          "partially_decided",
                        ].includes(item.status)
                      ? "No single scored result is available. Review the run details for individual policy results, failures, or limitations."
                      : "Results will appear when the evaluation produces recorded evidence."}
                </p>
                {item.runId && (
                  <ActionLink href={`/app/runs/${item.runId}`}>
                    View run record
                  </ActionLink>
                )}
              </div>
            ) : (
              <>
                <div className="ws-table-wrap ws-section">
                  <table className="ws-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th>Your result</th>
                        <th>Site target</th>
                        <th>Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [
                          "Success rate",
                          item.successRate,
                          item.terms.successRate,
                          "%",
                          true,
                        ],
                        [
                          "Cycle time",
                          item.cycleTimeSeconds,
                          item.terms.cycleTimeSeconds,
                          " sec",
                          false,
                        ],
                      ].map(([label, value, target, unit, higher]) => (
                        <tr key={String(label)}>
                          <td>{label}</td>
                          <td>
                            {value === null
                              ? "Not recorded"
                              : `${Number(Number(value).toFixed(1))}${unit}`}
                          </td>
                          <td>
                            {target === null
                              ? "To be agreed"
                              : `${higher ? "At least" : "At most"} ${target}${unit}`}
                          </td>
                          <td>
                            {value === null || target === null
                              ? "Not assessed"
                              : (
                                    higher
                                      ? Number(value) >= Number(target)
                                      : Number(value) <= Number(target)
                                  )
                                ? "Meets target"
                                : "Below target"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="ws-note">
                  {item.evidenceLabel}
                  {item.sampleCount !== null
                    ? ` · ${item.sampleCount} trials`
                    : ""}
                  {item.successRateInterval
                    ? ` · 95% interval ${item.successRateInterval[0]}–${item.successRateInterval[1]}%`
                    : ""}{" "}
                  · {dateLabel(item.createdAt)}. Physical performance must be
                  confirmed in the pilot.
                </p>
                {item.episodeOutcomes?.length ? <EpisodeOutcomes rows={item.episodeOutcomes} /> : null}
              </>
            )}
          </section>
          <section className="ws-section">
            <h2>What happens next</h2>
            <p className="ws-section">
              {item.outcome
                ? `Site decision: ${statusLabel(item.outcome)}.`
                : item.successRate !== null
                  ? "Blueprint reviews submitted results and recommends one team whose evaluation passed; the site can book that pilot."
                  : "You can return here to track the request. No compute starts before the run is authorized."}
            </p>
            {item.taskId && (
              <p className="ws-section">
                <ActionLink href={`/app/opportunities/${item.taskId}`}>
                  View opening
                </ActionLink>
              </p>
            )}
          </section>
          {/* A team evaluation's evidence is its per-episode outcomes above; the Task
              Evaluation run record does not exist for it. */}
          {item.runId && !item.teamEvaluation && <Evidence runId={item.runId} />}
          <details className="ws-section">
            <summary>Failures & limitations</summary>
            <p>
              Compare each result only with its recorded task, test conditions,
              and targets. A simulation result does not establish physical
              performance, deployment readiness, or safety.
            </p>
            {item.runId && (
              <p className="ws-note">
                Detailed findings and supporting artifacts are available in the
                run evidence above.
              </p>
            )}
          </details>
        </>
      )}
    </Frame>
  );
}
