import { useMemo, useState } from "react";
import { Filter } from "lucide-react";

import { Button, ProofBoundary, StatusChip } from "@/components/blueprint";
import {
  availableCanaryFilters,
  buildAlignedCanaryCells,
  buildFailureAnalysis,
  humanCanaryCellLabel,
  pairedCanaryComparison,
  resolvedCanaryCandidates,
  wilson95,
  type EpisodeFilters,
} from "@/lib/policyCanaryResultPortal";
import type { TaskEvaluationResultSiteRecord } from "@/lib/taskEvaluationResults";

function readable(value: unknown, fallback = "Unavailable — not delivered") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function percent(value: unknown) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "Unavailable";
}

export function PolicyCanaryReportOverview({ result }: { result: TaskEvaluationResultSiteRecord }) {
  const publication = result.publication;
  const delivery = publication.result_delivery;
  const canary = publication.policy_canary_result || {};
  const candidates = resolvedCanaryCandidates(result);
  const episodes = delivery?.episodes || [];
  const [filters, setFilters] = useState<EpisodeFilters>({
    family: "all", seed: "all", outcome: "all", interpretability: "all",
  });
  const filterOptions = useMemo(() => availableCanaryFilters(episodes), [episodes]);
  const rows = useMemo(() => buildAlignedCanaryCells(
    episodes,
    candidates.map((candidate) => candidate.candidate_id),
    filters,
  ), [candidates, episodes, filters]);
  const failures = useMemo(() => buildFailureAnalysis(episodes), [episodes]);
  const candidateResults = canary.candidate_results?.length
    ? canary.candidate_results
    : delivery?.candidate_results || [];
  const coverageGaps = Array.isArray(canary.coverage_gaps) ? canary.coverage_gaps : [];
  const correctedFailureCriteria = Object.entries(
    (result.score_correction?.correction.score_updates || []).reduce<Record<string, number>>(
      (counts, update) => {
        for (const criterion of update.new_score.failed_criteria || []) {
          counts[criterion] = (counts[criterion] || 0) + 1;
        }
        return counts;
      },
      {},
    ),
  ).sort(([left], [right]) => left.localeCompare(right));

  const comparison = pairedCanaryComparison(result);
  const metricValue = (candidate: Record<string, any>, key: string) => {
    const metrics = candidate.metrics || {};
    return candidate[key] ?? metrics[key];
  };
  const optionalMetricLabels: Record<string, string> = {
    progress_score: "progress",
    mean_destination_error: "destination error",
    contact_maintenance_rate: "contact maintained",
  };
  const optionalMetricColumns = [
    { key: "progress_score", label: "Progress", render: (candidate: Record<string, any>) => readable(metricValue(candidate, "progress_score")) },
    { key: "mean_destination_error", label: "Destination error", render: (candidate: Record<string, any>) => readable(metricValue(candidate, "mean_destination_error")) },
    { key: "contact_maintenance_rate", label: "Contact maintained", render: (candidate: Record<string, any>) => percent(metricValue(candidate, "contact_maintenance_rate")) },
  ].filter((column) => candidateResults.some((candidate: Record<string, any>) => {
    const raw = metricValue(candidate, column.key);
    return raw !== null && raw !== undefined && raw !== "";
  }));
  const droppedMetricLabels = Object.keys(optionalMetricLabels)
    .filter((key) => !optionalMetricColumns.some((column) => column.key === key))
    .map((key) => optionalMetricLabels[key]);

  return <>
    <section className="runway-panel overflow-x-auto p-5" aria-labelledby="canary-metrics-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="runway-meta">Candidate metrics</p><h2 id="canary-metrics-title" className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">Success, uncertainty, and the paired gap</h2></div><StatusChip tone="warn" square>Diagnostic only</StatusChip></div>
      {comparison ? <div className="mt-3 border-l-2 border-runway-signal pl-3">
        <p className="text-body-s font-semibold text-ink-900">{comparison.headline}</p>
        <p className="mt-0.5 text-caption text-ink-500">{comparison.verdict}{comparison.comparablePairs ? ` Matched cells ${comparison.comparablePairs}; discordant split ${comparison.leaderOnlyWins}–${comparison.laggardOnlyWins}.` : ""}</p>
      </div> : null}
      <table className="mt-4 w-full min-w-[46rem] border-collapse text-left text-caption"><thead><tr className="border-b border-line bg-runway-black"><th className="runway-meta px-3 py-2">Policy</th><th className="runway-meta px-3 py-2">Success</th><th className="runway-meta px-3 py-2">Wilson 95% CI</th>{optionalMetricColumns.map((column) => <th key={column.key} className="runway-meta px-3 py-2">{column.label}</th>)}<th className="runway-meta px-3 py-2">Collision</th><th className="runway-meta px-3 py-2">Action delivery</th><th className="runway-meta px-3 py-2">Scored episodes</th></tr></thead><tbody>{candidateResults.map((candidate: Record<string, any>) => {
        const denominator = Number(metricValue(candidate, "interpretable_episode_count") || 0);
        const interval = wilson95(Number(metricValue(candidate, "success_count") || 0), denominator);
        const isLeader = comparison?.leader?.candidate_id === candidate.candidate_id;
        return <tr key={candidate.candidate_id} className="border-b border-line-soft"><td className="px-3 py-3 font-semibold">{metricValue(candidate, "display_name") || candidate.candidate_id}{isLeader ? <StatusChip tone="proof" square dot={false} className="ml-2">Lead</StatusChip> : null}</td><td className="runway-num px-3 py-3">{metricValue(candidate, "success_count")}/{denominator} · {percent(metricValue(candidate, "success_rate"))}</td><td className="runway-num px-3 py-3">{interval ? `${percent(interval.lower)}–${percent(interval.upper)}` : "Not meaningful"}</td>{optionalMetricColumns.map((column) => <td key={column.key} className="runway-num px-3 py-3">{column.render(candidate)}</td>)}<td className="runway-num px-3 py-3">{percent(metricValue(candidate, "collision_rate"))}</td><td className="runway-num px-3 py-3">{percent(metricValue(candidate, "action_delivery_rate"))}</td><td className="runway-num px-3 py-3">{denominator}/{metricValue(candidate, "episodes_completed")}</td></tr>;
      })}</tbody></table>
      {droppedMetricLabels.length ? <p className="mt-3 text-caption text-ink-500">Not delivered for this run: {droppedMetricLabels.join(", ")}. These metrics are omitted rather than shown blank.</p> : null}
    </section>

    <section className="runway-panel p-5" aria-labelledby="canary-matrix-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="runway-meta">Variation matrix</p><h2 id="canary-matrix-title" className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">Aligned cells and outcomes</h2></div><Filter className="size-4 text-ink-400" /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="runway-label">Family<select className="runway-input" value={filters.family} onChange={(event) => setFilters((current) => ({ ...current, family: event.target.value }))}><option value="all">All families</option>{filterOptions.families.map((family) => <option key={family} value={family}>{family.replaceAll("_", " ")}</option>)}</select></label>
        <label className="runway-label">Seed<select className="runway-input" value={filters.seed} onChange={(event) => setFilters((current) => ({ ...current, seed: event.target.value }))}><option value="all">All seeds</option>{filterOptions.seeds.map((seed) => <option key={seed} value={seed}>{seed}</option>)}</select></label>
        <label className="runway-label">Outcome<select className="runway-input" value={filters.outcome} onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value as EpisodeFilters["outcome"] }))}><option value="all">All outcomes</option><option value="success">Success</option><option value="failure">Failure</option></select></label>
        <label className="runway-label">Interpretability<select className="runway-input" value={filters.interpretability} onChange={(event) => setFilters((current) => ({ ...current, interpretability: event.target.value as EpisodeFilters["interpretability"] }))}><option value="all">All episodes</option><option value="interpretable">Interpretable</option><option value="uninterpretable">Uninterpretable</option></select></label>
      </div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[54rem] border-collapse text-left text-caption"><thead><tr className="border-b border-line bg-runway-black"><th className="runway-meta px-3 py-2">Cell / seed</th><th className="runway-meta px-3 py-2">Family</th><th className="runway-meta px-3 py-2">Partition</th>{candidates.map((candidate) => <th key={candidate.candidate_id} className="runway-meta px-3 py-2">{candidate.display_name}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.key} className="border-b border-line-soft"><td className="px-3 py-3"><span className="font-semibold text-ink-800">{humanCanaryCellLabel(row, index, rows)}</span><br /><span className="runway-num text-[0.65rem] text-ink-400">{row.cellId} · {row.seed ?? "seed unavailable"}</span></td><td className="px-3 py-3">{row.familyId.replaceAll("_", " ")}</td><td className="px-3 py-3"><StatusChip tone={row.partition === "held_out" ? "warn" : "neutral"} square>{row.partition.replaceAll("_", " ")}</StatusChip></td>{candidates.map((candidate) => { const episode = row.episodesByCandidate[candidate.candidate_id]; return <td key={candidate.candidate_id} className="px-3 py-3">{episode ? <a className="font-semibold text-ink-800 underline-offset-2 hover:underline" href={`#episode-${episode.episode_id}`}>{episode.score.policy_outcome_interpretable === false ? "Uninterpretable" : episode.score.task_succeeded === true ? "Success" : episode.score.task_succeeded === false ? "Failure" : episode.score.status}</a> : <span className="text-ink-400">Typed gap — episode absent</span>}</td>; })}</tr>)}{!rows.length ? <tr><td className="px-3 py-6 text-ink-500" colSpan={3 + candidates.length}>No delivered episode matches these filters.</td></tr> : null}</tbody></table></div>
      {coverageGaps.length ? <ProofBoundary level="warn" title="Coverage gaps">{coverageGaps.map((gap: Record<string, any>) => `${gap.family}: ${gap.explanation} Fallback: ${gap.deterministic_fallback_family}.`).join(" ")}</ProofBoundary> : <p className="mt-3 text-caption text-ink-500">No typed coverage gaps were reported.</p>}
    </section>

    {result.score_correction ? <section className="runway-panel p-5" aria-labelledby="corrected-failure-criteria-title"><p className="runway-meta">Verified correction overlay</p><h2 id="corrected-failure-criteria-title" className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">Corrected failed criteria</h2>{correctedFailureCriteria.length ? <dl className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">{correctedFailureCriteria.map(([criterion, count]) => <div key={criterion} className="bg-paper-0 p-3"><dt className="text-caption font-semibold text-ink-800">{criterion.replaceAll("_", " ")}</dt><dd className="runway-num mt-1 text-title-m font-semibold">{count}</dd></div>)}</dl> : <p className="mt-3 text-body-s text-ink-500">No corrected episode failed a task criterion.</p>}</section> : null}

    <details className="runway-panel p-5" open><summary className="cursor-pointer font-display text-title-m font-semibold uppercase text-ink-900">Failure analysis</summary><table className="mt-4 w-full border-collapse text-left text-caption"><thead><tr className="border-b border-line bg-runway-black"><th className="runway-meta px-3 py-2">Cohort</th><th className="runway-meta px-3 py-2">Count</th><th className="runway-meta px-3 py-2">Representative episodes</th></tr></thead><tbody>{failures.map((failure) => <tr key={failure.cohort} className="border-b border-line-soft"><td className="px-3 py-3 font-semibold">{failure.cohort.replaceAll("_", " ")}</td><td className="runway-num px-3 py-3">{failure.count}</td><td className="px-3 py-3">{failure.representativeEpisodeIds.length ? failure.representativeEpisodeIds.map((id) => <a key={id} href={`#episode-${id}`} className="mr-3 underline-offset-2 hover:underline">{id}</a>) : <span className="text-ink-400">None delivered</span>}</td></tr>)}</tbody></table></details>
  </>;
}
