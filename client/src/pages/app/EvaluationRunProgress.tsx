import { useEffect, useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, Bell, Check, Circle, Loader2, ShieldAlert } from "lucide-react";

import { Button, Card, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { useAuth } from "@/contexts/AuthContext";
import { fetchEvaluationReadyRun, type EvaluationReadyRunProjection } from "@/lib/evaluationReadyRuns";

const stateOrder = ["queued_for_preparation", "preparing", "ready_to_activate", "queued", "running", "aggregating", "results_ready"];
const terminalStates = new Set(["results_ready", "abstained", "blocked", "failed"]);

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

function TerminalSummary({ run }: { run: EvaluationReadyRunProjection }) {
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
  const [run, setRun] = useState<EvaluationReadyRunProjection | null>(null);
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
            <div className="flex flex-wrap items-center gap-3"><h1 className="font-display text-[1.65rem] font-semibold uppercase text-ink-900">Policy evaluation</h1><StatusChip tone={run.state === "results_ready" ? "proof" : run.error ? "block" : "warn"} square>{friendlyState(run.state)}</StatusChip></div>
            <p className="runway-num mt-2 text-caption text-ink-400">{run.run_id}</p>
          </header>
          <RunTimeline state={run.state} />
          <Card pad="md">
            <div className="flex items-end justify-between gap-4"><div><p className="runway-meta">Current phase</p><p className="mt-1 text-body font-semibold text-ink-900">{run.phase || friendlyState(run.state)}</p></div>{progress ? <p className="runway-num text-title-m font-semibold text-ink-900">{percent}%</p> : null}</div>
            {progress ? <><div className="mt-4 h-2 overflow-hidden bg-inset" aria-label={`${progress.completed_episodes} of ${progress.total_episodes} episodes complete`}><div className="h-full bg-runway-signal transition-[width]" style={{ width: `${percent}%` }} /></div><p className="runway-num mt-2 text-caption text-ink-500">{progress.completed_episodes} / {progress.total_episodes} episodes</p></> : null}
            {run.episode_counts ? <p className="mt-2 text-caption text-ink-400">{run.episode_counts.learned_episode_count} learned-policy episodes · {run.episode_counts.control_episode_count} control episodes</p> : null}
          </Card>
          {run.error ? <ProofBoundary level="block" title={run.error.code} icon={ShieldAlert}>{run.error.message}</ProofBoundary> : null}
          <TerminalSummary run={run} />
          {run.result ? <Button asChild variant="action" className="w-fit"><Link href={run.result.href}>Open complete results <ArrowRight aria-hidden="true" /></Link></Button> : null}
          <ProofBoundary level="info" title="Private team delivery" icon={Bell}>We email the verified account when the digest-bound results record is ready. Access remains scoped to the authenticated team; simulation results are not physical success, deployment approval, or safety approval.</ProofBoundary>
        </> : null}
      </div>
    </AppShell>
  );
}
