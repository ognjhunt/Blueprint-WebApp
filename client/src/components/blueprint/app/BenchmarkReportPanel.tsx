import { ShieldCheck } from "lucide-react";

import { ProofBoundary, StatusChip } from "@/components/blueprint";
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
      <p className="rounded-md border border-line bg-paper-1 p-4 text-body-s text-ink-600">
        The protocol is frozen, but no completed aggregate has been supplied by the
        Pipeline yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="min-w-[78rem] border-collapse bg-white text-left text-body-xs">
        <thead className="bg-paper-1 text-ink-600">
          <tr>
            <th className="px-3 py-3 font-semibold">Policy / checkpoint</th>
            {metricColumns.map((metric) => (
              <th key={metric.key} className="px-3 py-3 font-semibold">
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {benchmark.policy_aggregates.map((policy) => (
            <tr key={`${policy.policy_id}:${policy.checkpoint_sha256}`} className="border-t border-line">
              <td className="px-3 py-3 align-top">
                <div className="font-semibold text-ink-900">{policy.policy_id}</div>
                <code className="text-[0.68rem] text-ink-500" title={policy.checkpoint_sha256}>
                  {shortDigest(policy.checkpoint_sha256)}
                </code>
              </td>
              {metricColumns.map((metric) => (
                <td key={metric.key} className="px-3 py-3 align-top text-ink-700">
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
          <article key={axis} className="rounded-md border border-line bg-white p-4">
            <h4 className="text-body-s font-semibold capitalize text-ink-900">{axis}</h4>
            <p className="mt-1 text-body-xs text-ink-500">
              {counts.seen} seen · {counts.unseen} unseen scenarios
            </p>
            {benchmark.policy_aggregates.map((policy) => {
              const seen = breakdown?.seen?.[policy.policy_id]?.full_task_success;
              const unseen = breakdown?.unseen?.[policy.policy_id]?.full_task_success;
              if (!seen && !unseen) return null;
              return (
                <p key={policy.policy_id} className="mt-3 text-body-xs leading-5 text-ink-700">
                  <span className="font-semibold">{policy.policy_id}</span>
                  <br />
                  seen {seen ? formatBenchmarkMetric(seen) : "—"}
                  <br />
                  unseen {unseen ? formatBenchmarkMetric(unseen) : "—"}
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
    <section className="rounded-md border border-line bg-white p-4" aria-label="External rank fidelity">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-title-s font-semibold text-ink-900">
            {externalScopeLabel(external.measurement_scope)}
          </h3>
          <p className="mt-1 text-body-xs text-ink-500">
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
              <div key={name} className="rounded-md bg-paper-1 p-3">
                <dt className="text-body-xs font-semibold capitalize text-ink-600">
                  {name.replace(/_/g, " ")}
                </dt>
                <dd className="mt-1 text-body-s text-ink-900">
                  {formatBenchmarkMetric(metric, { count: name === "mmrv" })}
                </dd>
              </div>
            ) : null,
          )}
        </dl>
      ) : null}

      {external.site_alignment === "different_site" ? (
        <p className="mt-4 text-body-xs leading-5 text-ink-600">
          This tests whether policy ordering transfers across sites. It is not
          validation of the captured target site.
        </p>
      ) : null}
      {external.blockers.length > 0 ? (
        <p className="mt-4 text-body-xs text-block-700">
          Blocked: {external.blockers.join(", ").replace(/_/g, " ")}
        </p>
      ) : null}
    </section>
  );
}

export function BenchmarkReportPanel({ benchmark }: { benchmark: BenchmarkProjection }) {
  return (
    <section className="flex flex-col gap-4" aria-label="Benchmark report">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
            Benchmark-grade evaluation
          </h2>
          <p className="mt-1 text-body-s text-ink-500">
            {benchmark.benchmark_id} · {benchmark.benchmark_version}
          </p>
        </div>
        <StatusChip tone={benchmark.status === "complete" ? "proof" : benchmark.status === "blocked" ? "block" : "warn"} square>
          {benchmark.status}
        </StatusChip>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-line bg-white p-4">
          <div className="text-body-xs font-semibold uppercase tracking-wide text-ink-500">Fixed rollouts</div>
          <div className="mt-2 text-title-m font-semibold text-ink-900">
            {benchmark.rollout_protocol.fixed_rollouts_per_scenario_policy}
          </div>
          <div className="text-body-xs text-ink-500">per policy and scenario</div>
        </div>
        <div className="rounded-md border border-line bg-white p-4">
          <div className="text-body-xs font-semibold uppercase tracking-wide text-ink-500">Hidden test</div>
          <div className="mt-2 text-title-m font-semibold text-ink-900">
            {benchmark.split_summary.counts.hidden_test}
          </div>
          <div className="text-body-xs text-ink-500">identifiers redacted</div>
        </div>
        <div className="rounded-md border border-line bg-white p-4">
          <div className="text-body-xs font-semibold uppercase tracking-wide text-ink-500">Uncertainty</div>
          <div className="mt-2 text-title-m font-semibold text-ink-900">95% CI</div>
          <div className="text-body-xs text-ink-500">10,000 bootstrap replicates</div>
        </div>
        <div className="rounded-md border border-line bg-white p-4">
          <div className="text-body-xs font-semibold uppercase tracking-wide text-ink-500">Benchmark card</div>
          <code className="mt-2 block text-body-s font-semibold text-ink-900" title={benchmark.benchmark_card_sha256}>
            {shortDigest(benchmark.benchmark_card_sha256)}
          </code>
          <div className="text-body-xs text-ink-500">content-addressed</div>
        </div>
      </div>

      {benchmark.environment_summary ? (
        <div className="rounded-md border border-line bg-white p-4">
          <h3 className="text-title-s font-semibold text-ink-900">Environment binding</h3>
          <p className="mt-2 text-body-s text-ink-700">
            {benchmark.environment_summary.site_id} ·{" "}
            {benchmark.environment_summary.representation_type.replace(/_/g, " ")} ·
            physics authority {benchmark.environment_summary.physics_authority}
          </p>
          <p className="mt-1 text-body-xs text-ink-500">
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
        <div className="rounded-md border border-line bg-white p-4">
          <h3 className="text-title-s font-semibold text-ink-900">Evidence completeness</h3>
          <p className="mt-2 text-body-s text-ink-700">
            {benchmark.evidence_summary.video_count} videos ·{" "}
            {benchmark.evidence_summary.action_trace_count} action traces ·{" "}
            {benchmark.evidence_summary.evaluator_output_count} evaluator outputs
            across {benchmark.evidence_summary.attempt_count} scheduled attempts
          </p>
          <p className="mt-1 text-body-xs text-ink-500">
            {benchmark.evidence_summary.all_attempts_digest_bound
              ? "Every scheduled attempt is digest-bound."
              : "Evidence coverage is incomplete."}
          </p>
        </div>
      ) : null}

      <div>
        <h3 className="mb-3 text-title-s font-semibold text-ink-900">Seen / unseen generalization</h3>
        <GeneralizationResults benchmark={benchmark} />
      </div>

      <ExternalComparison benchmark={benchmark} />

      <ProofBoundary level="info" title="Benchmark proof boundary" icon={ShieldCheck}>
        Hidden scenario identities remain in the Pipeline. Simulation and cross-site
        agreement do not prove real-world performance at the target site, and this
        report cannot upgrade a public claim automatically.
      </ProofBoundary>
    </section>
  );
}
