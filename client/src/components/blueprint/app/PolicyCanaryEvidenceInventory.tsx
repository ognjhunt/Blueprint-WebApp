import type { User as FirebaseUser } from "firebase/auth";
import { Download } from "lucide-react";

import { Button, ProofBoundary, StatusChip } from "@/components/blueprint";
import {
  buildCanaryArtifactInventory,
  normalizedArtifact,
  resolvedCanaryCandidates,
} from "@/lib/policyCanaryResultPortal";
import {
  createTaskEvaluationResultArtifactTicket,
  humanBytes,
  type TaskEvaluationResultArtifact,
  type TaskEvaluationResultSiteRecord,
} from "@/lib/taskEvaluationResults";

function reported(value: unknown, suffix = "") {
  return value === null || value === undefined || value === ""
    ? "Unavailable — not delivered"
    : `${String(value)}${suffix}`;
}

function bytes(value: unknown) {
  return typeof value === "number" ? humanBytes(value) : "Unavailable — not delivered";
}

async function downloadArtifact(
  user: FirebaseUser | null,
  recordId: string,
  artifact: TaskEvaluationResultArtifact,
) {
  const url = await createTaskEvaluationResultArtifactTicket(
    user,
    recordId,
    artifact.artifact_id,
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.relative_path.split("/").pop() || artifact.role;
  anchor.click();
}

export function PolicyCanaryEvidenceInventory({
  result,
  user,
}: {
  result: TaskEvaluationResultSiteRecord;
  user: FirebaseUser | null;
}) {
  const publication = result.publication;
  const canary = publication.policy_canary_result || {};
  const telemetry = canary.runtime_system_telemetry || {};
  const reproducibility = canary.reproducibility
    || publication.result_delivery?.reproducibility
    || {};
  const artifacts = buildCanaryArtifactInventory(result);
  const totalArtifactBytes = artifacts.reduce((total, artifact) => total + (artifact.size_bytes || 0), 0);
  const roleSummary = [...artifacts.reduce((map, artifact) => {
    const entry = map.get(artifact.role) || { role: artifact.role, count: 0, bytes: 0 };
    entry.count += 1;
    entry.bytes += artifact.size_bytes || 0;
    map.set(artifact.role, entry);
    return map;
  }, new Map<string, { role: string; count: number; bytes: number }>()).values()]
    .sort((left, right) => right.count - left.count || right.bytes - left.bytes);
  const systemTelemetryValues = [
    telemetry.gpu_utilization_percent,
    telemetry.gpu_memory_bytes,
    telemetry.cpu_utilization_percent,
    telemetry.memory_bytes,
    telemetry.network_received_bytes,
    telemetry.network_transmitted_bytes,
    telemetry.disk_read_bytes,
    telemetry.disk_written_bytes,
    telemetry.policy_query_count,
    telemetry.policy_latency_ms?.p50,
    telemetry.policy_latency_ms?.p95,
    telemetry.policy_latency_ms?.maximum,
  ];
  const hasSystemTelemetry = systemTelemetryValues.some(
    (value) => value !== null && value !== undefined,
  );
  const candidates = resolvedCanaryCandidates(result);
  const notification = publication.notification_delivery;
  const receiptRows: Array<[string, TaskEvaluationResultArtifact | undefined, string]> = [
    ["Billing", normalizedArtifact(reproducibility.billing_receipt || canary.closure?.billing) || undefined, "Official provider billing receipt"],
    ["Teardown", normalizedArtifact(reproducibility.teardown_receipt || canary.closure?.teardown) || undefined, "Resource teardown receipt"],
    ["Provider zero", normalizedArtifact(reproducibility.provider_zero_receipt || canary.closure?.provider_zero) || undefined, "Authenticated post-teardown inventory receipt"],
    ["Email delivery", normalizedArtifact(notification?.receipt) || undefined, notification ? `${notification.status} · ${notification.delivered_at_iso || "timestamp unavailable"}` : "Unavailable — not delivered"],
  ];
  const roleSet = new Set(artifacts.map((artifact) => artifact.role));
  const requiredRoles = [
    "summary_csv",
    "episode_csv",
    "full_json_report",
    "evidence_manifest",
    "lossless_policy_inputs",
    "review_video",
    "returned_action_sequence",
    "state_trace",
    "contact_force_trace",
  ];
  const origin = typeof window !== "undefined" ? window.location.origin : "https://tryblueprint.io";
  const provenanceRows = [
    ["Run ID", publication.run_id],
    ["Request digest", reported(publication.request_digest)],
    ["Configuration digest", reported(publication.configuration_digest)],
    ["Matrix digest", reported(canary.matrix_digest || publication.result_delivery?.matrix_digest)],
    ["Scene revision digest", reported(publication.scene?.revision_digest || reproducibility.scene_revision_digest)],
    ["Runtime container digest", reported(reproducibility.runtime_container_digest)],
    ["Scoring version", reported(reproducibility.scoring_version)],
    ...candidates.map((candidate) => [
      `${candidate.display_name} checkpoint`,
      candidate.checkpoint_digest,
    ]),
    ["Started", reported(publication.started_at_iso || reproducibility.started_at_iso)],
    ["Completed", reported(publication.completed_at_iso || reproducibility.completed_at_iso)],
    ["Duration", reported(publication.duration_seconds ?? reproducibility.duration_seconds, " seconds")],
    ["Official cost", typeof reproducibility.official_total_usd === "number" ? `$${reproducibility.official_total_usd.toFixed(3)}` : "Unavailable — not delivered"],
    ["Provider / instance", `${reported(reproducibility.provider)} · ${Array.isArray(reproducibility.provider_instance_ids) ? reproducibility.provider_instance_ids.join(", ") : "instance unavailable"}`],
    ["Actor", publication.submitted_by ? `${publication.submitted_by.actor_id} · ${publication.submitted_by.actor_role}` : "Unavailable — not delivered"],
    ["Team / visibility", `${reported(publication.team_namespace)} · ${reported(publication.access_visibility || result.access_visibility)}`],
    ["Permanent result URL", `${origin}/app/results/${encodeURIComponent(result.record_id)}`],
    ["Machine-readable API", `${origin}/api/task-evaluation-results/${encodeURIComponent(result.record_id)}`],
    ["Schemas", `${publication.schema_version} · ${publication.result_delivery?.schema_version || "delivery unavailable"} · ${canary.schema_version || "result unavailable"}`],
  ];

  return <details className="runway-panel p-5">
    <summary className="cursor-pointer list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="runway-meta">Advanced evidence</p>
          <h2 className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">Evidence and provenance</h2>
        </div>
        <span className="runway-num text-caption text-ink-500">{artifacts.length} delivered files · expand to inspect</span>
      </div>
    </summary>

    <div className="mt-6 flex flex-col gap-8 border-t border-line pt-6">
      <section aria-labelledby="canary-provenance-title">
        <h3 id="canary-provenance-title" className="font-display text-body font-semibold uppercase text-ink-900">Exact run bindings</h3>
        <dl className="mt-3 grid gap-x-8 md:grid-cols-2">
          {provenanceRows.map(([label, value]) => <div key={label} className="min-w-0 border-b border-line-soft py-2">
            <dt className="runway-meta">{label}</dt>
            <dd className="runway-num mt-1 break-all text-[0.68rem] text-ink-700">{value}</dd>
          </div>)}
        </dl>
      </section>

      <section aria-labelledby="canary-telemetry-title">
        <h3 id="canary-telemetry-title" className="font-display text-body font-semibold uppercase text-ink-900">Runtime, schema, and timebase</h3>
        <p className="mt-1 text-caption text-ink-500">Only executor-sealed values are shown. Missing channels are not estimated.</p>
        <table className="mt-3 w-full border-collapse text-left text-caption"><tbody>{[
          ["Observation schema", reported(reproducibility.observation_schema_id)],
          ["Action schema", reported(reproducibility.action_schema_id)],
          ["Calibration digest", reported(reproducibility.calibration_digest)],
          ["Clock / frequency", reproducibility.timebase ? `${reproducibility.timebase.clock_id} · ${reported(reproducibility.timebase.frequency_hz, " Hz")}` : "Unavailable — not delivered"],
          ["Timebase synchronized", reproducibility.timebase ? reproducibility.timebase.synchronized ? "Yes" : "No" : "Unavailable — not delivered"],
        ].map(([label, value]) => <tr key={label} className="border-b border-line-soft">
          <th className="runway-meta w-64 px-3 py-3">{label}</th>
          <td className="runway-num px-3 py-3 text-ink-700">{value}</td>
        </tr>)}</tbody></table>
        {hasSystemTelemetry ? <table className="mt-3 w-full border-collapse text-left text-caption"><tbody>{[
          ["GPU utilization", reported(telemetry.gpu_utilization_percent, "%")],
          ["GPU memory", bytes(telemetry.gpu_memory_bytes)],
          ["CPU utilization", reported(telemetry.cpu_utilization_percent, "%")],
          ["Memory", bytes(telemetry.memory_bytes)],
          ["Network received / transmitted", `${bytes(telemetry.network_received_bytes)} / ${bytes(telemetry.network_transmitted_bytes)}`],
          ["Disk read / written", `${bytes(telemetry.disk_read_bytes)} / ${bytes(telemetry.disk_written_bytes)}`],
          ["Policy queries", reported(telemetry.policy_query_count)],
          ["Policy latency p50 / p95 / max", `${reported(telemetry.policy_latency_ms?.p50, " ms")} / ${reported(telemetry.policy_latency_ms?.p95, " ms")} / ${reported(telemetry.policy_latency_ms?.maximum, " ms")}`],
        ].map(([label, value]) => <tr key={label} className="border-b border-line-soft">
          <th className="runway-meta w-64 px-3 py-3">{label}</th>
          <td className="runway-num px-3 py-3 text-ink-700">{value}</td>
        </tr>)}</tbody></table> : <p className="mt-3 text-caption text-ink-500">System telemetry (GPU, memory, disk, network, policy latency) was not captured in this run.</p>}
      </section>

      <section aria-labelledby="canary-artifact-inventory-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="canary-artifact-inventory-title" className="font-display text-body font-semibold uppercase text-ink-900">Complete artifact inventory</h3>
            <p className="mt-1 text-caption text-ink-500">All {artifacts.length} files are hash-verified and digest-bound to this run · {humanBytes(totalArtifactBytes)} total.</p>
          </div>
          <div className="flex flex-wrap gap-2">{requiredRoles.map((role) => <StatusChip key={role} tone={roleSet.has(role) ? "proof" : "warn"} square>
            {role.replaceAll("_", " ")} · {roleSet.has(role) ? "delivered" : "typed gap"}
          </StatusChip>)}</div>
        </div>
        <div className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {roleSummary.map((entry) => <div key={entry.role} className="bg-paper-0 p-3">
            <p className="text-caption font-semibold text-ink-800">{entry.role.replaceAll("_", " ")}</p>
            <p className="runway-num mt-1 text-body-s text-ink-700">{entry.count} file{entry.count === 1 ? "" : "s"} · {humanBytes(entry.bytes)}</p>
          </div>)}
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-caption font-semibold text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action">View all {artifacts.length} files with digests</summary>
          <div className="mt-3 max-h-[38rem] overflow-auto border border-line">
          <table className="w-full min-w-[70rem] border-collapse text-left text-caption">
            <thead className="sticky top-0 bg-runway-black">
              <tr className="border-b border-line">
                <th className="runway-meta px-3 py-2">Role</th>
                <th className="runway-meta px-3 py-2">Media type</th>
                <th className="runway-meta px-3 py-2">Size</th>
                <th className="runway-meta px-3 py-2">Digest</th>
                <th className="runway-meta px-3 py-2">Retention</th>
                <th className="runway-meta px-3 py-2">File</th>
              </tr>
            </thead>
            <tbody>{artifacts.map((artifact) => <tr key={artifact.artifact_id} className="border-b border-line-soft">
              <td className="px-3 py-3 font-semibold">{artifact.role.replaceAll("_", " ")}</td>
              <td className="runway-num px-3 py-3">{artifact.media_type || artifact.content_type}</td>
              <td className="runway-num px-3 py-3">{humanBytes(artifact.size_bytes)}</td>
              <td className="runway-num max-w-64 break-all px-3 py-3">{artifact.sha256}</td>
              <td className="px-3 py-3">{artifact.retention_status || "Not reported"}{artifact.retention_expires_at_iso ? ` · ${artifact.retention_expires_at_iso}` : ""}</td>
              <td className="px-3 py-3"><Button
                type="button"
                size="sm"
                variant="secondary"
                iconLeft={<Download aria-hidden="true" />}
                onClick={() => void downloadArtifact(user, result.record_id, artifact)}
              >Download</Button></td>
            </tr>)}{!artifacts.length ? <tr><td className="px-3 py-6 text-ink-500" colSpan={6}>No artifacts were delivered.</td></tr> : null}</tbody>
          </table>
          </div>
        </details>
      </section>

      <section aria-labelledby="canary-closure-title">
        <h3 id="canary-closure-title" className="font-display text-body font-semibold uppercase text-ink-900">Billing, teardown, provider zero, and notification</h3>
        <table className="mt-3 w-full border-collapse text-left text-caption">
          <thead><tr className="border-b border-line bg-runway-black"><th className="runway-meta px-3 py-2">Receipt</th><th className="runway-meta px-3 py-2">State</th><th className="runway-meta px-3 py-2">Digest</th><th className="runway-meta px-3 py-2">Access</th></tr></thead>
          <tbody>{receiptRows.map(([label, artifact, state]) => <tr key={label} className="border-b border-line-soft">
            <td className="px-3 py-3 font-semibold">{label}</td>
            <td className="px-3 py-3">{state}</td>
            <td className="runway-num max-w-72 break-all px-3 py-3">{artifact?.sha256 || "Unavailable — not delivered"}</td>
            <td className="px-3 py-3">{artifact ? <Button type="button" size="sm" variant="secondary" iconLeft={<Download aria-hidden="true" />} onClick={() => void downloadArtifact(user, result.record_id, artifact)}>Download</Button> : <span className="text-ink-400">Typed gap</span>}</td>
          </tr>)}</tbody>
        </table>
        {notification?.status === "failed" ? <ProofBoundary level="warn" title="Notification delivery failed">
          The result remains valid and accessible. Failure: {notification.failure_reason || "provider did not return a reason"}. Attempts: {notification.attempts}.
        </ProofBoundary> : null}
      </section>
    </div>
  </details>;
}
