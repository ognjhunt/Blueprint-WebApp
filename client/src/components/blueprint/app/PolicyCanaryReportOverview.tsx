import { useMemo, useState } from "react";
import { Check, Copy, Filter } from "lucide-react";

import { Button, ProofBoundary, StatusChip } from "@/components/blueprint";
import {
  availableCanaryFilters,
  buildAlignedCanaryCells,
  buildFailureAnalysis,
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

function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="flex min-w-0 items-start justify-between gap-2 border-b border-line-soft py-2 last:border-0">
    <div className="min-w-0"><dt className="runway-meta">{label}</dt><dd className="runway-num mt-1 break-all text-[0.68rem] text-ink-700">{value}</dd></div>
    <button type="button" aria-label={`Copy ${label}`} className="mt-1 shrink-0 text-ink-400 hover:text-ink-800" onClick={() => void navigator.clipboard.writeText(value).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1200); })}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button>
  </div>;
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
  const origin = typeof window !== "undefined" ? window.location.origin : "https://tryblueprint.io";
  const resultPath = `${origin}/app/results/${encodeURIComponent(result.record_id)}`;
  const apiPath = `${origin}/api/task-evaluation-results/${encodeURIComponent(result.record_id)}`;
  const reproducibility = canary.reproducibility || delivery?.reproducibility || {};
  const candidateResults = canary.candidate_results?.length
    ? canary.candidate_results
    : delivery?.candidate_results || [];
  const coverageGaps = Array.isArray(canary.coverage_gaps) ? canary.coverage_gaps : [];

  return <>
    <section className="runway-panel p-5" aria-labelledby="canary-repro-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="runway-meta">Reproducibility header</p><h2 id="canary-repro-title" className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">Exact run bindings</h2></div>
        <StatusChip tone="warn" square>No winner · unqualified</StatusChip>
      </div>
      <div className="mt-4 grid gap-x-6 lg:grid-cols-2"><dl>
        <Copyable label="Run ID" value={publication.run_id} />
        <Copyable label="Request digest" value={readable(publication.request_digest)} />
        <Copyable label="Configuration digest" value={readable(publication.configuration_digest)} />
        <Copyable label="Matrix digest" value={readable(canary.matrix_digest || delivery?.matrix_digest)} />
        <Copyable label="Scene revision digest" value={readable(publication.scene?.revision_digest || reproducibility.scene_revision_digest)} />
        <Copyable label="Runtime container digest" value={readable(reproducibility.runtime_container_digest)} />
        <Copyable label="Scoring version" value={readable(reproducibility.scoring_version)} />
      </dl><dl>
        {candidates.map((candidate) => <Copyable key={candidate.candidate_id} label={`${candidate.display_name} checkpoint`} value={candidate.checkpoint_digest} />)}
        <Copyable label="Started" value={readable(publication.started_at_iso)} />
        <Copyable label="Completed" value={readable(publication.completed_at_iso)} />
        <Copyable label="Duration seconds" value={readable(publication.duration_seconds)} />
        <Copyable label="Actor" value={publication.submitted_by ? `${publication.submitted_by.actor_id} · ${publication.submitted_by.actor_role}` : "Unavailable — not delivered"} />
        <Copyable label="Team / visibility" value={`${readable(publication.team_namespace)} · ${readable(publication.access_visibility || result.access_visibility)}`} />
        <Copyable label="Result URL" value={resultPath} />
        <Copyable label="Machine-readable API" value={apiPath} />
        <Copyable label="Schemas" value={`${publication.schema_version} · ${delivery?.schema_version || "delivery unavailable"} · ${canary.schema_version || "result unavailable"}`} />
      </dl></div>
    </section>

    <section className="runway-panel overflow-x-auto p-5" aria-labelledby="canary-metrics-title">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="runway-meta">Candidate metrics</p><h2 id="canary-metrics-title" className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">Numerators, denominators, and uncertainty</h2></div><StatusChip tone="warn" square>Diagnostic only</StatusChip></div>
      <table className="mt-4 w-full min-w-[68rem] border-collapse text-left text-caption"><thead><tr className="border-b border-line bg-runway-black"><th className="runway-meta px-3 py-2">Policy</th><th className="runway-meta px-3 py-2">Success</th><th className="runway-meta px-3 py-2">Wilson 95% CI</th><th className="runway-meta px-3 py-2">Progress</th><th className="runway-meta px-3 py-2">Destination error</th><th className="runway-meta px-3 py-2">Contact maintained</th><th className="runway-meta px-3 py-2">Collision</th><th className="runway-meta px-3 py-2">Action delivery</th><th className="runway-meta px-3 py-2">Interpretable</th></tr></thead><tbody>{candidateResults.map((candidate: Record<string, any>) => {
        const metrics = candidate.metrics || {};
        const value = (key: string) => candidate[key] ?? metrics[key];
        const denominator = Number(value("interpretable_episode_count") || 0);
        const interval = wilson95(Number(value("success_count") || 0), denominator);
        return <tr key={candidate.candidate_id} className="border-b border-line-soft"><td className="px-3 py-3 font-semibold">{value("display_name") || candidate.candidate_id}</td><td className="runway-num px-3 py-3">{value("success_count")}/{denominator} · {percent(value("success_rate"))}</td><td className="runway-num px-3 py-3">{interval ? `${percent(interval.lower)}–${percent(interval.upper)}` : "Not meaningful"}</td><td className="runway-num px-3 py-3">{readable(value("progress_score"))}</td><td className="runway-num px-3 py-3">{readable(value("mean_destination_error"))}</td><td className="runway-num px-3 py-3">{percent(value("contact_maintenance_rate"))}</td><td className="runway-num px-3 py-3">{percent(value("collision_rate"))}</td><td className="runway-num px-3 py-3">{percent(value("action_delivery_rate"))}</td><td className="runway-num px-3 py-3">{denominator}/{value("episodes_completed")}</td></tr>;
      })}</tbody></table>
    </section>

    <section className="runway-panel p-5" aria-labelledby="canary-matrix-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="runway-meta">Variation matrix</p><h2 id="canary-matrix-title" className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">Aligned cells and outcomes</h2></div><Filter className="size-4 text-ink-400" /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="runway-label">Family<select className="runway-input" value={filters.family} onChange={(event) => setFilters((current) => ({ ...current, family: event.target.value }))}><option value="all">All families</option>{filterOptions.families.map((family) => <option key={family} value={family}>{family.replaceAll("_", " ")}</option>)}</select></label>
        <label className="runway-label">Seed<select className="runway-input" value={filters.seed} onChange={(event) => setFilters((current) => ({ ...current, seed: event.target.value }))}><option value="all">All seeds</option>{filterOptions.seeds.map((seed) => <option key={seed} value={seed}>{seed}</option>)}</select></label>
        <label className="runway-label">Outcome<select className="runway-input" value={filters.outcome} onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value as EpisodeFilters["outcome"] }))}><option value="all">All outcomes</option><option value="success">Success</option><option value="failure">Failure</option></select></label>
        <label className="runway-label">Interpretability<select className="runway-input" value={filters.interpretability} onChange={(event) => setFilters((current) => ({ ...current, interpretability: event.target.value as EpisodeFilters["interpretability"] }))}><option value="all">All episodes</option><option value="interpretable">Interpretable</option><option value="uninterpretable">Uninterpretable</option></select></label>
      </div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[54rem] border-collapse text-left text-caption"><thead><tr className="border-b border-line bg-runway-black"><th className="runway-meta px-3 py-2">Cell / seed</th><th className="runway-meta px-3 py-2">Family</th><th className="runway-meta px-3 py-2">Partition</th>{candidates.map((candidate) => <th key={candidate.candidate_id} className="runway-meta px-3 py-2">{candidate.display_name}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.key} className="border-b border-line-soft"><td className="runway-num px-3 py-3">{row.cellId}<br />{row.seed ?? "seed unavailable"}</td><td className="px-3 py-3">{row.familyId.replaceAll("_", " ")}</td><td className="px-3 py-3"><StatusChip tone={row.partition === "held_out" ? "warn" : "neutral"} square>{row.partition.replaceAll("_", " ")}</StatusChip></td>{candidates.map((candidate) => { const episode = row.episodesByCandidate[candidate.candidate_id]; return <td key={candidate.candidate_id} className="px-3 py-3">{episode ? <a className="font-semibold text-ink-800 underline-offset-2 hover:underline" href={`#episode-${episode.episode_id}`}>{episode.score.policy_outcome_interpretable === false ? "Uninterpretable" : episode.score.task_succeeded === true ? "Success" : episode.score.task_succeeded === false ? "Failure" : episode.score.status}</a> : <span className="text-ink-400">Typed gap — episode absent</span>}</td>; })}</tr>)}{!rows.length ? <tr><td className="px-3 py-6 text-ink-500" colSpan={3 + candidates.length}>No delivered episode matches these filters.</td></tr> : null}</tbody></table></div>
      {coverageGaps.length ? <ProofBoundary level="warn" title="Coverage gaps">{coverageGaps.map((gap: Record<string, any>) => `${gap.family}: ${gap.explanation} Fallback: ${gap.deterministic_fallback_family}.`).join(" ")}</ProofBoundary> : <p className="mt-3 text-caption text-ink-500">No typed coverage gaps were reported.</p>}
    </section>

    <details className="runway-panel p-5" open><summary className="cursor-pointer font-display text-title-m font-semibold uppercase text-ink-900">Failure analysis</summary><table className="mt-4 w-full border-collapse text-left text-caption"><thead><tr className="border-b border-line bg-runway-black"><th className="runway-meta px-3 py-2">Cohort</th><th className="runway-meta px-3 py-2">Count</th><th className="runway-meta px-3 py-2">Representative episodes</th></tr></thead><tbody>{failures.map((failure) => <tr key={failure.cohort} className="border-b border-line-soft"><td className="px-3 py-3 font-semibold">{failure.cohort.replaceAll("_", " ")}</td><td className="runway-num px-3 py-3">{failure.count}</td><td className="px-3 py-3">{failure.representativeEpisodeIds.length ? failure.representativeEpisodeIds.map((id) => <a key={id} href={`#episode-${id}`} className="mr-3 underline-offset-2 hover:underline">{id}</a>) : <span className="text-ink-400">None delivered</span>}</td></tr>)}</tbody></table></details>
  </>;
}
