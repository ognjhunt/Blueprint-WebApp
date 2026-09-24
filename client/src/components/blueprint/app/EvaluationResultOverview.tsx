import {
  buildEvaluationResultAnalytics,
  type CandidateMetricSummary,
} from "@/lib/evaluationResultAnalytics";
import type { TaskEvaluationResultEpisode } from "@/lib/taskEvaluationResults";

import { policyCandidateLabel as candidateLabel } from "@/lib/policyCandidateLabels";

function rateLabel(metric: CandidateMetricSummary) {
  return metric.successRate === null ? "Not scored" : `${Math.round(metric.successRate * 100)}%`;
}

function MetricCell({ metric, baseline }: { metric: CandidateMetricSummary; baseline?: number | null }) {
  const delta = metric.successRate !== null && typeof baseline === "number"
    ? metric.successRate - baseline
    : null;
  return (
    <>
      <span className="tabular-nums">{rateLabel(metric)}</span>{" "}
      <span className="text-sm text-ink-500">{metric.successfulEpisodes}/{metric.scoredEpisodes}</span>
      {delta !== null ? <span className="block text-xs text-ink-500">Δ canonical {delta >= 0 ? "+" : ""}{Math.round(delta * 100)} pp</span> : null}
    </>
  );
}

/** One comparison table and one paired-outcome line; variations, failures, and evidence stay in a drawer. */
export function EvaluationResultOverview({ episodes }: { episodes: TaskEvaluationResultEpisode[] }) {
  const analytics = buildEvaluationResultAnalytics(episodes);
  const learnedEpisodes = episodes.filter((episode) => episode.episode_kind === "learned_candidate");
  const evidenceReported = learnedEpisodes.some((episode) => episode.evidence?.complete !== undefined);
  const evidenceComplete = learnedEpisodes.filter((episode) => episode.evidence?.complete).length;
  const canonicalFamily = analytics.families.find((family) => family.familyId === "canonical_anchor");
  const paired = analytics.paired;

  return (
    <section aria-labelledby="evaluation-result-overview-title">
      <h2 id="evaluation-result-overview-title">Policy comparison</h2>
      <p className="mt-2 text-sm text-ink-600">Success rates count scored policy episodes only. Control runs aren't counted.</p>
      <div className="ws-table-wrap mt-4">
        <table className="ws-table" aria-label="Candidate comparison">
          <thead>
            <tr><th>Policy</th><th>Success</th><th>Failures</th><th>Contacts</th></tr>
          </thead>
          <tbody>
            {analytics.candidates.map((candidate) => (
              <tr key={candidate.candidateId}>
                <td>{candidateLabel(candidate.candidateId)}</td>
                <td><MetricCell metric={candidate} /></td>
                <td className="tabular-nums">{candidate.failureCount}</td>
                <td className="tabular-nums">{candidate.contactCount ?? "Not reported"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-ink-600">
        Paired outcomes: {paired.comparablePairs} scenarios run by both policies; {paired.discordantPairs} came out
        differently{paired.firstId && paired.secondId
          ? ` (${candidateLabel(paired.firstId)} ${paired.firstWins}, ${candidateLabel(paired.secondId)} ${paired.secondWins})`
          : ""}; {paired.ties} ties.
      </p>

      <details className="mt-4">
        <summary>By variation, failure, and evidence</summary>
        {analytics.families.length ? (
          <div className="ws-table-wrap">
            <table className="ws-table" aria-label="Per-variation results">
              <thead>
                <tr>
                  <th>Variation</th>
                  {analytics.candidates.map((candidate) => <th key={candidate.candidateId}>{candidateLabel(candidate.candidateId)}</th>)}
                </tr>
              </thead>
              <tbody>
                {analytics.families.map((family) => (
                  <tr key={family.familyId}>
                    <td className="capitalize">{family.label}</td>
                    {family.candidates.map((candidate) => (
                      <td key={candidate.candidateId}>
                        <MetricCell metric={candidate} baseline={canonicalFamily?.candidates.find((baseline) => baseline.candidateId === candidate.candidateId)?.successRate} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-ink-500">This result doesn't label its variations.</p>}
        <dl className="ws-facts">
          <div>
            <dt>Failure modes</dt>
            <dd>{analytics.failures.length ? analytics.failures.map((failure) => `${failure.code.replaceAll("_", " ")} · ${failure.count}`).join(", ") : "None classified"}</dd>
          </div>
          <div>
            <dt>Evidence complete</dt>
            <dd>{evidenceReported ? `${evidenceComplete} of ${learnedEpisodes.length} policy episodes` : "Not reported"}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-ink-500">Complete evidence means lossless inputs, a frame manifest, a review video, and an independent grade.</p>
      </details>
    </section>
  );
}
