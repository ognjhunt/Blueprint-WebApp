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
import { PilotBookingDetails } from "@/components/site/PilotBookingDetails";
import type { EpisodeOutcomeRow, WorkspaceEvaluation } from "@/types/workspace";

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
/** The run's real episode count, from its own rows when it has them. */
function episodeCountLabel(item: Pick<WorkspaceEvaluation, "episodeOutcomes" | "sampleCount">): string | null {
  const rows = item.episodeOutcomes;
  if (rows?.length) {
    const counted = rows.filter((row) => row.outcome !== "void").length;
    const succeeded = rows.filter((row) => row.outcome === "success").length;
    const voided = rows.length - counted;
    return `${succeeded} of ${counted} counted episodes succeeded${voided
      ? ` (${voided} not counted: the simulator, not your policy, failed)` : ""}`;
  }
  return item.sampleCount !== null ? `${item.sampleCount} episodes` : null;
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
    item = query.data?.evaluations.find((item) => item.id === evaluationId),
    // Only a run that can back a recommendation is compared with the site's targets.
    counts = item?.notCountedReason === null,
    episodes = item ? episodeCountLabel(item) : null;
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
                    ? counts ? "Awaiting site decision" : "Does not count"
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
                    ? "Your request is saved. Blueprint reviews it and admits the evaluation; nothing runs before then."
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
                          "no_result",
                        ].includes(item.status)
                      ? item.hasRunRecord
                        ? "No single scored result is available. Review the run details for individual policy results, failures, or limitations."
                        : "This run ended without a scored result."
                      : "Results will appear when the evaluation produces recorded evidence."}
                </p>
                {item.runId && item.hasRunRecord && (
                  <ActionLink href={`/app/runs/${item.runId}`}>
                    View run record
                  </ActionLink>
                )}
              </div>
            ) : (
              <>
                {!counts && (
                  <p className="ws-note">
                    This run does not count toward a recommendation. {item.notCountedReason} Its
                    numbers are for your own review and are not compared with the site&rsquo;s targets.
                  </p>
                )}
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
                            {!counts || value === null || target === null
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
                {counts && item.cycleTimeSeconds !== null && (
                  <p className="ws-note">
                    Cycle time is measured on the simulator clock, including settling. Policy-service
                    latency is recorded separately and is excluded. The physical pilot measures actual throughput.
                  </p>
                )}
                <p className="ws-note">
                  {item.evidenceLabel}
                  {episodes ? ` · ${episodes}` : ""}
                  {item.successRateInterval
                    ? ` · 95% interval ${item.successRateInterval[0]}–${item.successRateInterval[1]}%`
                    : ""}{" "}
                  · {dateLabel(item.createdAt)}. A bounded simulation estimate:
                  physical performance must be confirmed in the pilot.
                </p>
                {item.episodeOutcomes?.length ? <EpisodeOutcomes rows={item.episodeOutcomes} /> : null}
              </>
            )}
          </section>
          {item.pilotBooking && (
            <section className="ws-section" aria-labelledby="pilot-booking-title">
              <h2 id="pilot-booking-title">Pilot booked</h2>
              <p>
                The site booked the pilot Blueprint recommended with your team
                {item.pilotBooking.bookedAtIso ? ` on ${dateLabel(item.pilotBooking.bookedAtIso)}` : ""}.
              </p>
              <PilotBookingDetails booking={item.pilotBooking} other="site" />
            </section>
          )}
          <section className="ws-section">
            <h2>What happens next</h2>
            <p className="ws-section">
              {item.outcome
                ? `Site decision: ${statusLabel(item.outcome)}.`
                : item.successRate !== null
                  ? counts
                    ? "Blueprint reviews submitted results and recommends one team whose evaluation passed; the site can book that pilot."
                    : "This run cannot back a recommendation."
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
          {/* A free run's evidence is its per-episode outcomes above; it has no Task
              Evaluation run record. */}
          {item.runId && item.hasRunRecord && <Evidence runId={item.runId} />}
          <details className="ws-section">
            <summary>Failures & limitations</summary>
            <p>
              Compare each result only with its recorded task, test conditions,
              and targets. A simulation result does not establish physical
              performance, deployment readiness, or safety.
            </p>
            {item.runId && item.hasRunRecord && (
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
