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
                    : "Results will appear when the evaluation produces recorded evidence."}
                </p>
                {item.runId && (
                  <ActionLink href={`/app/evaluation-runs/${item.runId}`}>
                    View run progress
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
                    : ""}{" "}
                  · {dateLabel(item.createdAt)}. Physical performance must be
                  confirmed in the pilot.
                </p>
              </>
            )}
          </section>
          <section className="ws-section">
            <h2>What happens next</h2>
            <p className="ws-section">
              {item.outcome
                ? `Site decision: ${statusLabel(item.outcome)}.`
                : item.successRate !== null
                  ? "The site reviews submitted results and chooses whether to invite a team to a pilot."
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
          {item.runId && <Evidence runId={item.runId} />}
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
