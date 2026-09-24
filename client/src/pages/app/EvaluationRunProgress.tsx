import { useEffect, useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useParams } from "wouter";

import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { ActionLink } from "@/components/workspace/WorkspaceUI";
import { useAuth } from "@/contexts/AuthContext";
import { EvaluationRunStatusError, fetchEvaluationReadyRun, type EvaluationReadyRunProjection } from "@/lib/evaluationReadyRuns";
import type { PolicyCanaryRunProjection } from "@/lib/policyCanaryRuns";
import { policyCandidateLabel as candidateLabel } from "@/lib/policyCandidateLabels";

const terminalStates = new Set(["results_ready", "abstained", "blocked", "failed", "cancelled"]);
const familyLabels = {
  canonical_anchor: "Baseline",
  placement_approach: "Placement and approach",
  illumination: "Lighting",
  camera_sensor: "Camera and sensor",
  bounded_physics: "Physics",
  pairwise: "Combined",
  held_out: "Held out",
} as const;

/** Four plain steps; the runtime's own stage names stay out of the main view. */
const steps = ["Queued", "Preparing", "Running", "Results"] as const;
const evaluationStep: Record<string, number> = {
  queued_for_preparation: 0, preparing: 1, ready_to_activate: 1, queued: 1, running: 2, aggregating: 3, results_ready: 4,
};
const canaryStep: Record<string, number> = {
  queued: 0, preparing: 1, provider_allocating: 1, runtime_starting: 1,
  policy_a_running: 2, policy_b_running: 2, artifacts_syncing: 2,
  report_generating: 3, billing_teardown: 3, terminal: 4,
};
const canaryPhase: Record<string, string> = {
  queued: "Queued",
  preparing: "Preparing the scene",
  provider_allocating: "Starting a simulator",
  runtime_starting: "Starting a simulator",
  policy_a_running: "Running the first policy",
  policy_b_running: "Running the second policy",
  artifacts_syncing: "Saving videos and files",
  report_generating: "Writing up the results",
  billing_teardown: "Shutting down",
  terminal: "Done",
};

function friendlyState(state: string) {
  return state.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function Steps({ current }: { current: number }) {
  return (
    <ol className="grid grid-cols-4 gap-3" aria-label="Evaluation progress">
      {steps.map((label, index) => (
        <li
          key={label}
          aria-current={index === current ? "step" : undefined}
          className={`border-t-2 pt-2 text-sm ${index < current ? "border-[var(--ws-green)]" : index === current ? "border-[var(--ws-green)] font-medium" : "border-line text-ink-500"}`}
        >{label}</li>
      ))}
    </ol>
  );
}

function PolicySummary({ run }: { run: EvaluationReadyRunProjection }) {
  const policyResult = run.policy_run_result;
  if (policyResult) {
    const decision = policyResult.paired_comparison.decision;
    return (
      <section className="ws-section" aria-labelledby="terminal-summary-title">
        <p className="ws-kicker">Result</p>
        <h2 id="terminal-summary-title">
          {decision === "abstain" ? "No decision" : decision === "tie" ? "Tie" : `${candidateLabel(decision)} selected`}
        </h2>
        <ul className="mt-4 flex flex-col">
          {policyResult.candidate_results.map((candidate) => {
            const canonical = candidate.family_metrics.canonical_anchor;
            return <li key={candidate.candidate_id} className="flex justify-between gap-4 border-t border-line py-3">
              <span>{candidateLabel(candidate.candidate_id)}</span>
              <span className="tabular-nums">{canonical ? `${Math.round(canonical.success_rate * 100)}%` : "—"} <span className="text-sm text-ink-500">baseline success · {candidate.episodes_completed} episodes</span></span>
            </li>;
          })}
        </ul>
        <p className="ws-note">Simulation only: it doesn't show real-world performance or safety.</p>
        {policyResult.blockers.length ? <p className="mt-2 text-sm text-runway-red">{policyResult.blockers.join(" · ")}</p> : null}
        <details className="mt-4">
          <summary>Details</summary>
          <div className="ws-table-wrap">
            <table className="ws-table" aria-label="Per-family policy results">
              <thead><tr><th>Scenario family</th>{policyResult.candidate_results.map((candidate) => <th key={candidate.candidate_id}>{candidateLabel(candidate.candidate_id)}</th>)}</tr></thead>
              <tbody>{Object.entries(familyLabels).map(([family, label]) => <tr key={family}><td>{label}</td>{policyResult.candidate_results.map((candidate) => {
                const metric = candidate.family_metrics[family as keyof typeof familyLabels];
                return <td key={candidate.candidate_id} className="tabular-nums">{metric ? `${Math.round(metric.success_rate * 100)}%` : "—"}</td>;
              })}</tr>)}</tbody>
            </table>
          </div>
          <p className="ws-note">
            {policyResult.paired_comparison.matched_episode_pairs} matched scenario pairs · {policyResult.matrix.completed_episode_count} of {policyResult.matrix.expected_episode_count} episodes complete.{" "}
            {policyResult.candidate_results.map((candidate) => `${candidateLabel(candidate.candidate_id)}: ${candidate.failures.reduce((total, failure) => total + failure.count, 0)} failures, ${candidate.contacts.violation_count} contact violations`).join(" · ")}.
          </p>
          <p className="break-all text-xs text-ink-500">Projection {policyResult.projection_digest} · delivery {policyResult.result_delivery_digest}</p>
        </details>
      </section>
    );
  }
  const summary = run.result_summary;
  if (!summary) return null;
  return (
    <section className="ws-section" aria-labelledby="terminal-summary-title">
      <p className="ws-kicker">Result</p>
      <h2 id="terminal-summary-title">Baseline success</h2>
      <ul className="mt-4 flex flex-col">
        {Object.entries(summary.canonical).map(([candidateId, metric]) => {
          if (!metric) return null;
          return <li key={candidateId} className="flex justify-between gap-4 border-t border-line py-3">
            <span>{candidateLabel(candidateId)}</span>
            <span className="tabular-nums">{Math.round(metric.success_rate * 100)}% <span className="text-sm text-ink-500">{metric.successes} of {metric.attempts}</span></span>
          </li>;
        })}
      </ul>
      <p className="ws-note">{summary.paired.summary} Simulation only: it doesn't show real-world performance or safety.</p>
    </section>
  );
}

export default function EvaluationRunProgress() {
  const { runId = "" } = useParams<{ runId?: string }>();
  const decodedRunId = decodeURIComponent(runId);
  const { currentUser } = useAuth();
  const ownerKey = currentUser ? `${currentUser.uid}:${currentUser.tenantId || ""}` : null;
  const [snapshot, setSnapshot] = useState<{
    owner: string; runId: string; run: EvaluationReadyRunProjection | PolicyCanaryRunProjection;
  } | null>(null);
  const run = currentUser && snapshot?.owner === ownerKey && snapshot.runId === decodedRunId
    ? snapshot.run : null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSnapshot(null);
    setError(null);
    if (!currentUser || !decodedRunId) return;
    let cancelled = false;
    let failures = 0;
    let verified: EvaluationReadyRunProjection | PolicyCanaryRunProjection | null = null;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await fetchEvaluationReadyRun(currentUser, decodedRunId, controller.signal);
        if (cancelled) return;
        if (!next) throw new EvaluationRunStatusError(404);
        if (next.run_id !== decodedRunId) throw new EvaluationRunStatusError(409);
        if (verified && Date.parse(String(verified.updated_at_iso)) > Date.parse(String(next.updated_at_iso))) {
          setError("An older status update was ignored. Showing the last verified status; retrying automatically.");
          timer = setTimeout(() => void load(), Math.min(8_000 * 2 ** failures++, 60_000));
          return;
        }
        failures = 0;
        verified = next;
        setSnapshot({ owner: ownerKey!, runId: decodedRunId, run: next });
        setError(null);
        if (!next.terminal && !terminalStates.has(next.state)) timer = setTimeout(() => void load(), 8_000);
      } catch (reason) {
        if (cancelled) return;
        const status = reason instanceof EvaluationRunStatusError ? reason.status : null;
        const retryable = status === null || status === 429 || status >= 500;
        if (!retryable) setSnapshot(null);
        setError(retryable
          ? "Status update failed. Displayed data may be stale; retrying automatically."
          : reason instanceof Error ? reason.message : "Evaluation status is unavailable");
        if (retryable) {
          const backoff = Math.min(8_000 * 2 ** failures++, 60_000);
          const retryAfter = reason instanceof EvaluationRunStatusError ? (reason.retryAfterSeconds || 0) * 1000 : 0;
          timer = setTimeout(() => void load(), Math.max(backoff, retryAfter));
        }
      }
    };
    void load();
    return () => { cancelled = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [currentUser, decodedRunId, ownerKey]);

  const progress = run?.progress;
  const terminal = Boolean(run && (run.terminal || terminalStates.has(run.state)));
  const canaryRun = run && "run_kind" in run && run.run_kind === "internal_policy_canary"
    ? run as PolicyCanaryRunProjection
    : null;
  const percent = progress?.total_episodes ? Math.round((progress.completed_episodes / progress.total_episodes) * 100) : 0;
  const current = !run ? 0 : terminal && run.state === "results_ready"
    ? 4
    : canaryRun ? canaryStep[canaryRun.stage] ?? 1 : evaluationStep[run.state] ?? 1;
  const phase = !run ? "" : terminal
    ? friendlyState(run.state)
    : canaryRun ? canaryPhase[canaryRun.stage] || friendlyState(canaryRun.stage) : friendlyState(run.phase || run.state);
  const emailed = ["accepted", "delivered"].includes(String(canaryRun?.notification_delivery?.status || ""));
  return (
    <AppShell active="runs" breadcrumb={`runs / ${decodedRunId || "evaluation"}`}>
      <Helmet><title>Evaluation run · Blueprint</title></Helmet>
      <Link className="ws-back" href="/app/runs">← All runs</Link>
      {!run && !error ? <BuyerAppLoadingState /> : null}
      {error ? <div className="ws-alert" role="alert"><p>{error}</p></div> : null}
      {run ? <>
        <header className="ws-heading"><div><h1>{canaryRun ? "Policy test" : "Evaluation"}</h1></div></header>
        <section aria-label="Progress" className="flex max-w-3xl flex-col gap-5">
          <Steps current={current} />
          <div>
            <p className="text-sm text-ink-500">Current phase</p>
            <p className="text-xl">{phase}</p>
            {terminal && run.phase && run.phase !== run.state ? <p className="mt-1 text-sm text-ink-500">Last reported phase: <span>{friendlyState(run.phase)}</span></p> : null}
          </div>
          {progress ? <div>
            <div className="h-1.5 overflow-hidden bg-inset" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`${progress.completed_episodes} of ${progress.total_episodes} episodes complete`}>
              <div className="h-full bg-[var(--ws-green)] transition-[width]" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-sm tabular-nums">{progress.completed_episodes} / {progress.total_episodes} episodes · {percent}%</p>
          </div> : null}
          {canaryRun ? <p className="text-sm text-ink-500">
            Policies: {canaryRun.completed_learned_episode_count} of {canaryRun.expected_learned_episode_count} episodes ·
            control runs: {canaryRun.completed_control_episode_count} of {canaryRun.episode_counts?.control_episode_count || 20}
          </p> : null}
        </section>
        {run.error ? <div className="ws-alert mt-6" role="alert"><p>{run.error.message}</p><p className="mt-1 text-xs">{run.error.code}</p></div> : null}
        {run.result ? <p className="mt-8"><ActionLink href={run.result.href} primary>View results</ActionLink></p> : null}
        {!canaryRun ? <PolicySummary run={run as EvaluationReadyRunProjection} /> : null}
        <p className="ws-note">
          {terminal
            ? emailed ? "We emailed you when this finished." : "Only your team can see this run."
            : "This page updates on its own, and we'll email you when the results are ready."}
        </p>
        <details className="ws-section">
          <summary>Run details</summary>
          <p className="break-all text-sm">{run.run_id}</p>
          {run.episode_counts ? <p className="mt-1 text-sm text-ink-500">{run.episode_counts.learned_episode_count} policy episodes · {run.episode_counts.control_episode_count} control episodes</p> : null}
          {canaryRun ? <p className="mt-1 text-sm text-ink-500">Stage: {canaryRun.stage}</p> : null}
        </details>
      </> : null}
    </AppShell>
  );
}
