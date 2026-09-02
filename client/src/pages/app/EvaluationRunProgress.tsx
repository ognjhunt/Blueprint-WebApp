import { useEffect, useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, Bell, Check, Circle, Loader2, ShieldAlert } from "lucide-react";

import { Button, Card, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { useAuth } from "@/contexts/AuthContext";
import { fetchEvaluationReadyRun, type EvaluationReadyRunProjection } from "@/lib/evaluationReadyRuns";
import type { PolicyCanaryRunProjection } from "@/lib/policyCanaryRuns";

const stateOrder = ["queued_for_preparation", "preparing", "ready_to_activate", "queued", "running", "aggregating", "results_ready"];
const terminalStates = new Set(["results_ready", "abstained", "blocked", "failed"]);
const candidateLabels = { pi05_droid: "π0.5 DROID", groot_n17_droid: "GR00T N1.7 DROID" } as const;
const familyLabels = {
  canonical_anchor: "Canonical anchor",
  placement_approach: "Placement + approach",
  illumination: "Illumination",
  camera_sensor: "Camera + sensor",
  bounded_physics: "Bounded physics",
  pairwise: "Pairwise",
  held_out: "Held-out",
} as const;

function friendlyState(state: string) {
  return state.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function RunTimeline({ state }: { state: string }) {
  const activeIndex = Math.max(0, stateOrder.indexOf(state));
  const steps = [
    { at: 0, label: "Plan sealed" },
    { at: 1, label: "Prepared" },
    { at: 3, label: "Evaluation" },
    { at: 5, label: "Results" },
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-4" aria-label="Evaluation progress">
      {steps.map((step) => {
        const complete = activeIndex > step.at;
        const active = activeIndex === step.at || (step.at === 3 && activeIndex === 4);
        return <li key={step.label} className={`flex items-center gap-2 border-t-2 pt-3 ${complete ? "border-proof-bd" : active ? "border-runway-signal" : "border-line"}`}>
          {complete ? <Check className="size-4 text-proof-fg" aria-hidden="true" /> : active ? <Loader2 className="size-4 animate-spin text-runway-signal" aria-hidden="true" /> : <Circle className="size-4 text-ink-300" aria-hidden="true" />}
          <span className="text-caption font-semibold text-ink-700">{step.label}</span>
        </li>;
      })}
    </ol>
  );
}

const canaryStages = [
  "queued", "preparing", "provider_allocating", "runtime_starting",
  "policy_a_running", "policy_b_running", "artifacts_syncing",
  "report_generating", "billing_teardown", "terminal",
];

function PolicyCanaryTimeline({ stage }: { stage: string }) {
  const activeIndex = Math.max(0, canaryStages.indexOf(stage));
  return <ol className="grid gap-2 sm:grid-cols-5 lg:grid-cols-10" aria-label="Policy canary progress">
    {canaryStages.map((item, index) => <li key={item} className={`border-t-2 pt-2 ${index < activeIndex ? "border-proof-bd" : index === activeIndex ? "border-runway-signal" : "border-line"}`}><span className="text-[0.68rem] font-semibold text-ink-600">{friendlyState(item)}</span></li>)}
  </ol>;
}

function PolicyCanarySummary({ run }: { run: PolicyCanaryRunProjection }) {
  return <section className="runway-panel p-5" aria-labelledby="canary-summary-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="runway-meta">Diagnostic policy execution</p><h2 id="canary-summary-title" className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">Unqualified canary status</h2></div><StatusChip tone={run.state === "results_ready" ? "warn" : run.error ? "block" : "neutral"} square>{run.result_status ? friendlyState(run.result_status) : friendlyState(run.state)}</StatusChip></div>
    <div className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-3">
      <div className="bg-paper-0 p-4"><p className="runway-meta">Learned-policy episodes</p><p className="runway-num mt-2 text-title-l font-semibold text-ink-900">{run.completed_learned_episode_count}/{run.expected_learned_episode_count}</p></div>
      <div className="bg-paper-0 p-4"><p className="runway-meta">Diagnostic controls</p><p className="runway-num mt-2 text-title-l font-semibold text-ink-900">{run.completed_control_episode_count}/{run.episode_counts?.control_episode_count || 20}</p><p className="text-caption text-ink-500">Reported separately; nonblocking</p></div>
      <div className="bg-paper-0 p-4"><p className="runway-meta">Notification</p><p className="mt-2 text-body-s font-semibold text-ink-900">{String(run.notification_delivery?.status || "Pending")}</p></div>
    </div>
    <p className="mt-4 text-body-s text-ink-500">No winner is declared. Controls-pending or uninterpretable outcomes cannot contribute to official policy ranking, selection, or evaluation readiness.</p>
  </section>;
}

function TerminalSummary({ run }: { run: EvaluationReadyRunProjection }) {
  const policyResult = run.policy_run_result;
  if (policyResult) return (
    <section className="runway-panel p-5" aria-labelledby="terminal-summary-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="runway-meta">Deterministic paired comparison</p><h2 id="terminal-summary-title" className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">Policy results</h2></div>
        <StatusChip tone={policyResult.paired_comparison.decision === "abstain" ? "warn" : "proof"} square>{policyResult.paired_comparison.decision === "abstain" ? "Abstained" : policyResult.paired_comparison.decision === "tie" ? "Tie" : `${candidateLabels[policyResult.paired_comparison.decision]} selected`}</StatusChip>
      </div>
      <div className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-2">
        {policyResult.candidate_results.map((candidate) => {
          const canonical = candidate.family_metrics.canonical_anchor;
          const failureCount = candidate.failures.reduce((total, failure) => total + failure.count, 0);
          return <div key={candidate.candidate_id} className="bg-paper-0 p-4"><p className="text-body-s font-semibold text-ink-900">{candidateLabels[candidate.candidate_id]}</p><p className="runway-num mt-2 text-title-l font-semibold text-ink-900">{canonical ? `${Math.round(canonical.success_rate * 100)}%` : "—"}</p><p className="text-caption text-ink-500">{candidate.episodes_completed} episodes · {failureCount} failures · {candidate.contacts.contact_count} contacts · {candidate.contacts.violation_count} violations</p><p className="mt-1 text-caption text-ink-400">{candidate.evidence.lossless_frame_manifest_count} frame manifests · {candidate.evidence.review_video_count} review videos · {candidate.evidence.typed_media_gap_count} media gaps</p></div>;
        })}
      </div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[38rem] border-collapse text-left" aria-label="Per-family policy results"><thead><tr className="border-b border-line bg-runway-black"><th className="runway-meta px-3 py-2">Family</th>{policyResult.candidate_results.map((candidate) => <th key={candidate.candidate_id} className="runway-meta px-3 py-2">{candidateLabels[candidate.candidate_id]}</th>)}</tr></thead><tbody>{Object.entries(familyLabels).map(([family, label]) => <tr key={family} className="border-b border-line-soft last:border-0"><td className="px-3 py-2 text-caption font-semibold text-ink-700">{label}</td>{policyResult.candidate_results.map((candidate) => { const metric = candidate.family_metrics[family as keyof typeof familyLabels]; return <td key={candidate.candidate_id} className="runway-num px-3 py-2 text-caption text-ink-700">{metric ? `${Math.round(metric.success_rate * 100)}% · Δ ${metric.degradation_from_canonical >= 0 ? "+" : ""}${Math.round(metric.degradation_from_canonical * 100)} pp` : "Not reported"}</td>; })}</tr>)}</tbody></table></div>
      <p className="mt-4 text-caption text-ink-500">{policyResult.paired_comparison.matched_episode_pairs} matched scenario pairs · deterministic non-policy scoring · {policyResult.matrix.completed_episode_count}/{policyResult.matrix.expected_episode_count} episodes complete</p>
      {policyResult.blockers.length ? <p className="mt-2 text-caption text-runway-red">{policyResult.blockers.join(" · ")}</p> : null}
      <p className="runway-num mt-2 break-all text-[0.64rem] text-ink-400">Projection {policyResult.projection_digest} · delivery {policyResult.result_delivery_digest}</p>
    </section>
  );
  const summary = run.result_summary;
  if (!summary) return null;
  return (
    <section className="runway-panel p-5" aria-labelledby="terminal-summary-title">
      <p className="runway-meta">Candidate comparison</p>
      <h2 id="terminal-summary-title" className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">Canonical success</h2>
      <div className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-2">
        {(["pi05_droid", "groot_n17_droid"] as const).map((candidateId) => {
          const metric = summary.canonical[candidateId];
          if (!metric) return null;
          return <div key={candidateId} className="bg-paper-0 p-4">
            <p className="text-body-s font-semibold text-ink-900">{candidateId === "pi05_droid" ? "π0.5 DROID" : "GR00T N1.7 DROID"}</p>
            <p className="runway-num mt-2 text-title-l font-semibold text-ink-900">{Math.round(metric.success_rate * 100)}%</p>
            <p className="text-caption text-ink-500">{metric.successes} / {metric.attempts} canonical attempts</p>
          </div>;
        })}
      </div>
      <p className="mt-4 text-body-s text-ink-500">{summary.paired.summary}</p>
      <p className="mt-2 text-caption text-ink-400">{summary.evidence_completeness.complete_episode_count} complete evidence bundles · {summary.evidence_completeness.invalid_episode_count} invalid episodes · {summary.contacts.event_count} contacts</p>
    </section>
  );
}

export default function EvaluationRunProgress() {
  const { runId = "" } = useParams<{ runId?: string }>();
  const decodedRunId = decodeURIComponent(runId);
  const { currentUser } = useAuth();
  const [run, setRun] = useState<EvaluationReadyRunProjection | PolicyCanaryRunProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser || !decodedRunId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await fetchEvaluationReadyRun(currentUser, decodedRunId);
        if (cancelled) return;
        if (!next) throw new Error("This run is not available to the signed-in team.");
        setRun(next);
        setError(null);
        if (!terminalStates.has(next.state)) timer = setTimeout(() => void load(), 8_000);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Evaluation status is unavailable");
      }
    };
    void load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [currentUser, decodedRunId]);

  const progress = run?.progress;
  const canaryRun = run && "run_kind" in run && run.run_kind === "internal_policy_canary"
    ? run as PolicyCanaryRunProjection
    : null;
  const internalCanary = Boolean(canaryRun);
  const percent = progress?.total_episodes ? Math.round((progress.completed_episodes / progress.total_episodes) * 100) : 0;
  return (
    <AppShell active="runs" breadcrumb={`runs / ${decodedRunId || "evaluation"}`}>
      <Helmet><title>Evaluation run · Blueprint</title></Helmet>
      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <Link href="/app/runs" className="inline-flex w-fit items-center gap-1.5 text-body-s font-semibold text-ink-500 hover:text-ink-800"><ArrowLeft className="size-4" aria-hidden="true" />All runs</Link>
        {!run && !error ? <BuyerAppLoadingState /> : null}
        {error ? <BuyerAppErrorState message={error} /> : null}
        {run ? <>
          <header className="border-b border-line pb-5">
            <div className="flex flex-wrap items-center gap-3"><h1 className="font-display text-[1.65rem] font-semibold uppercase text-ink-900">{internalCanary ? "Policy canary" : "Policy evaluation"}</h1><StatusChip tone={internalCanary ? "warn" : run.state === "results_ready" ? "proof" : run.error ? "block" : "warn"} square>{friendlyState(run.state)}</StatusChip></div>
            <p className="runway-num mt-2 text-caption text-ink-400">{run.run_id}</p>
          </header>
          {canaryRun ? <><ProofBoundary level="warn" title="Controls pending — results are unqualified" icon={ShieldAlert}>This canary remains diagnostic even when every episode succeeds. It cannot change the scene to evaluation ready.</ProofBoundary><PolicyCanaryTimeline stage={canaryRun.stage} /></> : <RunTimeline state={run.state} />}
          <Card pad="md">
            <div className="flex items-end justify-between gap-4"><div><p className="runway-meta">Current phase</p><p className="mt-1 text-body font-semibold text-ink-900">{friendlyState(run.phase || run.state)}</p></div>{progress ? <p className="runway-num text-title-m font-semibold text-ink-900">{percent}%</p> : null}</div>
            {progress ? <><div className="mt-4 h-2 overflow-hidden bg-inset" aria-label={`${progress.completed_episodes} of ${progress.total_episodes} episodes complete`}><div className="h-full bg-runway-signal transition-[width]" style={{ width: `${percent}%` }} /></div><p className="runway-num mt-2 text-caption text-ink-500">{progress.completed_episodes} / {progress.total_episodes} episodes</p></> : null}
            {run.episode_counts ? <p className="mt-2 text-caption text-ink-400">{run.episode_counts.learned_episode_count} learned-policy episodes · {run.episode_counts.control_episode_count} control episodes</p> : null}
          </Card>
          {run.error ? <ProofBoundary level="block" title={run.error.code} icon={ShieldAlert}>{run.error.message}</ProofBoundary> : null}
          {canaryRun ? <PolicyCanarySummary run={canaryRun} /> : <TerminalSummary run={run as EvaluationReadyRunProjection} />}
          {run.result ? <Button asChild variant="action" className="w-fit"><Link href={run.result.href}>Open complete results <ArrowRight aria-hidden="true" /></Link></Button> : null}
          <ProofBoundary level="info" title="Private team delivery" icon={Bell}>We email the verified account when the digest-bound result is ready, blocked, or cancelled. Access remains scoped to the authenticated team; simulation results are not physical success, deployment approval, or safety approval.</ProofBoundary>
        </> : null}
      </div>
    </AppShell>
  );
}
