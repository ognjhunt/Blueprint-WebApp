import { StatusChip } from "@/components/blueprint";
import {
  externalScopeLabel,
  formatBenchmarkMetric,
  type BenchmarkMetricBundle,
  type BenchmarkProjection,
} from "@/lib/benchmarkProjection";

const metricColumns: Array<{
  key: keyof BenchmarkMetricBundle;
  label: string;
  count?: boolean;
}> = [
  { key: "full_task_success", label: "Full success" },
  { key: "partial_progress", label: "Partial progress" },
  { key: "efficiency", label: "Efficiency" },
  { key: "safety_interventions", label: "Interventions", count: true },
  { key: "evaluator_abstention", label: "Abstention" },
  { key: "coverage", label: "Coverage" },
];

const axes = ["task", "scene", "object", "camera", "lighting", "embodiment"] as const;

function shortDigest(value: string) {
  return value.length > 16 ? `${value.slice(0, 12)}…` : value;
}

function PolicyResults({ benchmark }: { benchmark: BenchmarkProjection }) {
  if (benchmark.policy_aggregates.length === 0) {
    return (
      <p className="runway-panel p-4 text-body-s text-runway-body">
        The protocol is frozen, but no completed aggregate has been supplied by the
        Pipeline yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="runway-table min-w-[78rem]">
        <thead>
          <tr>
            <th>Policy / checkpoint</th>
            {metricColumns.map((metric) => (
              <th key={metric.key}>{metric.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {benchmark.policy_aggregates.map((policy) => (
            <tr key={`${policy.policy_id}:${policy.checkpoint_sha256}`}>
              <td className="align-top">
                <div className="runway-num font-semibold text-runway-text">{policy.policy_id}</div>
                <code className="runway-num text-[0.68rem] text-runway-faint" title={policy.checkpoint_sha256}>
                  {shortDigest(policy.checkpoint_sha256)}
                </code>
              </td>
              {metricColumns.map((metric) => (
                <td key={metric.key} className="runway-num align-top">
                  {formatBenchmarkMetric(policy.metrics[metric.key], {
                    count: metric.count,
                  })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GeneralizationResults({ benchmark }: { benchmark: BenchmarkProjection }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {axes.map((axis) => {
        const counts = benchmark.split_summary.generalization_counts[axis];
        const breakdown = benchmark.breakdowns.generalization[axis];
        return (
          <article key={axis} className="runway-panel p-4">
            <h4 className="font-display uppercase text-body-s font-semibold tracking-[0.005em] text-runway-text">{axis}</h4>
            <p className="mt-1 text-body-xs text-runway-mute">
              {counts.seen} seen · {counts.unseen} unseen scenarios
            </p>
            {benchmark.policy_aggregates.map((policy) => {
              const seen = breakdown?.seen?.[policy.policy_id]?.full_task_success;
              const unseen = breakdown?.unseen?.[policy.policy_id]?.full_task_success;
              if (!seen && !unseen) return null;
              return (
                <p key={policy.policy_id} className="mt-3 text-body-xs leading-5 text-runway-body">
                  <span className="runway-num font-semibold text-runway-text">{policy.policy_id}</span>
                  <br />
                  seen <span className="runway-num">{seen ? formatBenchmarkMetric(seen) : "—"}</span>
                  <br />
                  unseen <span className="runway-num">{unseen ? formatBenchmarkMetric(unseen) : "—"}</span>
                </p>
              );
            })}
          </article>
        );
      })}
    </div>
  );
}

function ExternalComparison({ benchmark }: { benchmark: BenchmarkProjection }) {
  const external = benchmark.external_rank_fidelity;
  if (!external) return null;

  return (
    <section className="runway-panel p-4" aria-label="External rank fidelity">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display uppercase text-title-s font-semibold tracking-[0.005em] text-runway-text">
            {externalScopeLabel(external.measurement_scope)}
          </h3>
          <p className="mt-1 text-body-xs text-runway-mute">
            {external.matched_policies.length} exact checkpoint matches
          </p>
        </div>
        <StatusChip tone={external.status === "measured" ? "proof" : "block"} square>
          {external.status}
        </StatusChip>
      </div>

      {Object.keys(external.metrics).length > 0 ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(external.metrics).map(([name, metric]) =>
            metric ? (
              <div key={name} className="border border-runway-line-soft bg-runway-black p-3">
                <dt className="runway-meta">
                  {name.replace(/_/g, " ")}
                </dt>
                <dd className="runway-num mt-1 text-body-s text-runway-text">
                  {formatBenchmarkMetric(metric, { count: name === "mmrv" })}
                </dd>
              </div>
            ) : null,
          )}
        </dl>
      ) : null}

      {external.site_alignment === "different_site" ? (
        <p className="mt-4 text-body-xs leading-5 text-runway-body">
          This tests whether policy ordering transfers across sites. It is not
          validation of the captured target site.
        </p>
      ) : null}
      {external.blockers.length > 0 ? (
        <p className="mt-4 text-body-xs text-runway-red">
          Blocked: {external.blockers.join(", ").replace(/_/g, " ")}
        </p>
      ) : null}
    </section>
  );
}

export function BenchmarkReportPanel({ benchmark }: { benchmark: BenchmarkProjection }) {
  return (
    <section className="flex flex-col gap-5 text-sm" aria-label="Benchmark report">
      <div>
        <h3 className="text-lg">Benchmark-grade evaluation</h3>
        <p className="mt-1 text-ink-500">
          {benchmark.benchmark_id} · {benchmark.benchmark_version} · {benchmark.status} ·{" "}
          {benchmark.rollout_protocol.fixed_rollouts_per_scenario_policy} rollouts per policy and scenario ·{" "}
          {benchmark.split_summary.counts.hidden_test} hidden test scenarios · 95% intervals from 10,000 bootstrap samples ·
          card <code title={benchmark.benchmark_card_sha256}>{shortDigest(benchmark.benchmark_card_sha256)}</code>
        </p>
      </div>

      {benchmark.environment_summary ? (
        <div>
          <h4 className="font-medium">Environment binding</h4>
          <p className="mt-1">
            {benchmark.environment_summary.site_id} ·{" "}
            {benchmark.environment_summary.representation_type.replace(/_/g, " ")} ·
            physics authority {benchmark.environment_summary.physics_authority}
          </p>
          <p className="mt-1 text-ink-500">
            {benchmark.environment_summary.same_site_capture
              ? "Bound to the captured target site."
              : "Cross-site environment."}{" "}
            {benchmark.environment_summary.representation_type ===
            "captured_3dgs_site_memory"
              ? "The 3DGS supplies site/observation context; declared physics remains separate."
              : null}
          </p>
        </div>
      ) : null}

      <PolicyResults benchmark={benchmark} />

      {benchmark.evidence_summary ? (
        <p>
          {benchmark.evidence_summary.video_count} videos ·{" "}
          {benchmark.evidence_summary.action_trace_count} action traces ·{" "}
          {benchmark.evidence_summary.evaluator_output_count} evaluator outputs
          across {benchmark.evidence_summary.attempt_count} scheduled attempts.{" "}
          <span className="text-ink-500">
            {benchmark.evidence_summary.all_attempts_digest_bound
              ? "Every scheduled attempt is digest-bound."
              : "Evidence coverage is incomplete."}
          </span>
        </p>
      ) : null}

      <div>
        <h4 className="mb-3 font-medium">Seen / unseen generalization</h4>
        <GeneralizationResults benchmark={benchmark} />
      </div>

      <ExternalComparison benchmark={benchmark} />

      <p className="text-ink-500">
        Hidden scenarios stay private. Simulation and cross-site agreement don't prove real-world
        performance at the target site.
      </p>
    </section>
  );
}
