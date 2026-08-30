import { AlertTriangle, CheckCircle2, Fingerprint, Hand } from "lucide-react";

import { Card, StatusChip } from "@/components/blueprint";
import {
  buildEvaluationResultAnalytics,
  type CandidateMetricSummary,
} from "@/lib/evaluationResultAnalytics";
import type { TaskEvaluationResultEpisode } from "@/lib/taskEvaluationResults";

const candidateLabels: Record<string, string> = {
  pi05_droid: "π0.5 DROID",
  groot_n17_droid: "GR00T N1.7 DROID",
};

function candidateLabel(candidateId: string) {
  return candidateLabels[candidateId] ?? candidateId.replaceAll("_", " ");
}

function rateLabel(metric: CandidateMetricSummary) {
  return metric.successRate === null ? "Not scored" : `${Math.round(metric.successRate * 100)}%`;
}

function MetricCell({ metric, baseline }: { metric: CandidateMetricSummary; baseline?: number | null }) {
  const delta = metric.successRate !== null && typeof baseline === "number"
    ? metric.successRate - baseline
    : null;
  return (
    <div>
      <p className="runway-num text-body-s font-semibold text-ink-900">{rateLabel(metric)}</p>
      <p className="runway-meta mt-1">{metric.successfulEpisodes}/{metric.scoredEpisodes} episodes</p>
      {delta !== null ? <p className="runway-num mt-1 text-[0.66rem] text-ink-400">Δ canonical {delta >= 0 ? "+" : ""}{Math.round(delta * 100)} pp</p> : null}
    </div>
  );
}

export function EvaluationResultOverview({ episodes }: { episodes: TaskEvaluationResultEpisode[] }) {
  const analytics = buildEvaluationResultAnalytics(episodes);
  const learnedEpisodes = episodes.filter((episode) => episode.episode_kind === "learned_candidate");
  const evidenceReported = learnedEpisodes.some((episode) => episode.evidence?.complete !== undefined);
  const evidenceComplete = learnedEpisodes.filter((episode) => episode.evidence?.complete).length;
  const canonicalFamily = analytics.families.find((family) => family.familyId === "canonical_anchor");

  return (
    <section className="flex flex-col gap-6" aria-labelledby="evaluation-result-overview-title">
      <div className="flex flex-col gap-1">
        <p className="runway-meta">Paired policy matrix</p>
        <h2 id="evaluation-result-overview-title" className="font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">
          Candidate comparison
        </h2>
        <p className="max-w-3xl text-body-s text-ink-500">
          Rates use scored learned-policy episodes only. Controls stay visible separately and are never counted as policy performance.
        </p>
      </div>

      <div className="runway-panel overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-left" aria-label="Candidate comparison">
          <thead>
            <tr className="border-b border-line bg-runway-black">
              <th className="runway-meta px-4 py-3">Candidate</th>
              <th className="runway-meta px-4 py-3">Success rate</th>
              <th className="runway-meta px-4 py-3">Failures</th>
              <th className="runway-meta px-4 py-3">Contacts</th>
              <th className="runway-meta px-4 py-3">Evidence complete</th>
            </tr>
          </thead>
          <tbody>
            {analytics.candidates.map((candidate) => (
              <tr key={candidate.candidateId} className="border-b border-line-soft last:border-0">
                <td className="px-4 py-4">
                  <p className="font-semibold text-ink-900">{candidateLabel(candidate.candidateId)}</p>
                  <p className="runway-num mt-1 text-[0.68rem] text-ink-400">{candidate.candidateId}</p>
                </td>
                <td className="px-4 py-4"><MetricCell metric={candidate} /></td>
                <td className="runway-num px-4 py-4 text-body-s text-ink-700">{candidate.failureCount}</td>
                <td className="runway-num px-4 py-4 text-body-s text-ink-700">{candidate.contactCount ?? "Not reported"}</td>
                <td className="runway-num px-4 py-4 text-body-s text-ink-700">
                  {evidenceReported ? `${candidate.evidenceCompleteEpisodes}/${candidate.scoredEpisodes}` : "Not reported"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analytics.families.length ? (
        <div className="runway-panel overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left" aria-label="Per-variation results">
            <thead>
              <tr className="border-b border-line bg-runway-black">
                <th className="runway-meta px-4 py-3">Variation family</th>
                {analytics.candidates.map((candidate) => (
                  <th key={candidate.candidateId} className="runway-meta px-4 py-3">{candidateLabel(candidate.candidateId)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analytics.families.map((family) => (
                <tr key={family.familyId} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-body-s font-semibold capitalize text-ink-800">{family.label}</p>
                    <p className="runway-num mt-0.5 text-[0.67rem] text-ink-400">{family.familyId}</p>
                  </td>
                  {family.candidates.map((candidate) => (
                    <td key={candidate.candidateId} className="px-4 py-3"><MetricCell metric={candidate} baseline={canonicalFamily?.candidates.find((baseline) => baseline.candidateId === candidate.candidateId)?.successRate} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card pad="md"><p className="text-body-s text-ink-500">Per-variation labels were not included in this result record.</p></Card>
      )}

      <div className="grid gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-4">
        <div className="bg-paper-0 p-5">
          <Fingerprint className="size-4 text-ink-500" aria-hidden="true" />
          <p className="runway-meta mt-3">Paired outcomes</p>
          <p className="runway-num mt-1 text-title-l font-semibold text-ink-900">{analytics.paired.comparablePairs}</p>
          <p className="mt-1 text-caption text-ink-500">{analytics.paired.discordantPairs} discordant · π0.5 {analytics.paired.pi05Wins} · GR00T {analytics.paired.grootWins} · ties {analytics.paired.ties}</p>
        </div>
        <div className="bg-paper-0 p-5">
          <Hand className="size-4 text-ink-500" aria-hidden="true" />
          <p className="runway-meta mt-3">Contacts</p>
          <p className="runway-num mt-1 text-title-l font-semibold text-ink-900">
            {analytics.candidates.some((candidate) => candidate.contactCount !== null)
              ? analytics.candidates.reduce((total, candidate) => total + (candidate.contactCount ?? 0), 0)
              : "—"}
          </p>
          <p className="mt-1 text-caption text-ink-500">Reported learned-policy contacts</p>
        </div>
        <div className="bg-paper-0 p-5">
          <AlertTriangle className="size-4 text-ink-500" aria-hidden="true" />
          <p className="runway-meta mt-3">Failure modes</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {analytics.failures.length ? analytics.failures.map((failure) => (
              <StatusChip key={failure.code} tone="warn" square>{failure.code.replaceAll("_", " ")} · {failure.count}</StatusChip>
            )) : <span className="text-body-s text-ink-500">None classified</span>}
          </div>
        </div>
        <div className="bg-paper-0 p-5">
          {evidenceReported && evidenceComplete === learnedEpisodes.length
            ? <CheckCircle2 className="size-4 text-proof-fg" aria-hidden="true" />
            : <Fingerprint className="size-4 text-ink-500" aria-hidden="true" />}
          <p className="runway-meta mt-3">Evidence complete</p>
          <p className="runway-num mt-1 text-title-l font-semibold text-ink-900">
            {evidenceReported ? `${evidenceComplete}/${learnedEpisodes.length}` : "—"}
          </p>
          <p className="mt-1 text-caption text-ink-500">Lossless inputs, frame manifest, review video, independent grade</p>
        </div>
      </div>
    </section>
  );
}
