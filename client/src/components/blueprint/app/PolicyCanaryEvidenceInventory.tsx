import type { User as FirebaseUser } from "firebase/auth";
import { Download } from "lucide-react";

import { Button, ProofBoundary, StatusChip } from "@/components/blueprint";
import { buildCanaryArtifactInventory } from "@/lib/policyCanaryResultPortal";
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

async function downloadArtifact(user: FirebaseUser, recordId: string, artifact: TaskEvaluationResultArtifact) {
  const url = await createTaskEvaluationResultArtifactTicket(user, recordId, artifact.artifact_id);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.relative_path.split("/").pop() || artifact.role;
  anchor.click();
}

export function PolicyCanaryEvidenceInventory({ result, user }: { result: TaskEvaluationResultSiteRecord; user: FirebaseUser }) {
  const publication = result.publication;
  const canary = publication.policy_canary_result || {};
  const telemetry = canary.runtime_system_telemetry || {};
  const reproducibility = canary.reproducibility
    || publication.result_delivery?.reproducibility
    || {};
  const artifacts = buildCanaryArtifactInventory(result);
  const notification = publication.notification_delivery;
  const receiptRows: Array<[string, TaskEvaluationResultArtifact | undefined, string]> = [
    ["Billing", reproducibility.billing_receipt, "Official provider billing receipt"],
    ["Teardown", reproducibility.teardown_receipt, "Resource teardown receipt"],
    ["Provider zero", reproducibility.provider_zero_receipt, "Authenticated post-teardown inventory receipt"],
    ["Email delivery", notification?.receipt || undefined, notification ? `${notification.status} · ${notification.delivered_at_iso || "timestamp unavailable"}` : "Unavailable — not delivered"],
  ];
  const roleSet = new Set(artifacts.map((artifact) => artifact.role));
  const requiredRoles = [
    "summary_csv", "episode_csv", "full_json_report", "evidence_manifest",
    "lossless_policy_inputs", "review_video", "returned_action_sequence",
    "state_trace", "contact_force_trace",
  ];

  return <>
    <details className="runway-panel p-5" open>
      <summary className="cursor-pointer font-display text-title-m font-semibold uppercase text-ink-900">Runtime and system telemetry</summary>
      <p className="mt-2 text-caption text-ink-500">Values are displayed only when sealed by the executor. Missing channels are not estimated.</p>
      <table className="mt-4 w-full border-collapse text-left text-caption"><tbody>{[
        ["GPU utilization", reported(telemetry.gpu_utilization_percent, "%")],
        ["GPU memory", bytes(telemetry.gpu_memory_bytes)],
        ["CPU utilization", reported(telemetry.cpu_utilization_percent, "%")],
        ["Memory", bytes(telemetry.memory_bytes)],
        ["Network received / transmitted", `${bytes(telemetry.network_received_bytes)} / ${bytes(telemetry.network_transmitted_bytes)}`],
        ["Disk read / written", `${bytes(telemetry.disk_read_bytes)} / ${bytes(telemetry.disk_written_bytes)}`],
        ["Policy queries", reported(telemetry.policy_query_count)],
        ["Policy latency p50 / p95 / max", `${reported(telemetry.policy_latency_ms?.p50, " ms")} / ${reported(telemetry.policy_latency_ms?.p95, " ms")} / ${reported(telemetry.policy_latency_ms?.maximum, " ms")}`],
        ["Episode wall time min / median / max", `${reported(telemetry.episode_wall_time_seconds?.minimum, " s")} / ${reported(telemetry.episode_wall_time_seconds?.median, " s")} / ${reported(telemetry.episode_wall_time_seconds?.maximum, " s")}`],
      ].map(([label, value]) => <tr key={label} className="border-b border-line-soft"><th className="runway-meta w-64 px-3 py-3">{label}</th><td className="runway-num px-3 py-3 text-ink-700">{value}</td></tr>)}</tbody></table>
    </details>

    <details className="runway-panel p-5" open>
      <summary className="cursor-pointer font-display text-title-m font-semibold uppercase text-ink-900">Schema, calibration, and timebase</summary>
      <table className="mt-4 w-full border-collapse text-left text-caption"><tbody>{[
        ["Observation schema", reported(reproducibility.observation_schema_id)],
        ["Action schema", reported(reproducibility.action_schema_id)],
        ["Calibration digest", reported(reproducibility.calibration_digest)],
        ["Clock / frequency", reproducibility.timebase ? `${reproducibility.timebase.clock_id} · ${reported(reproducibility.timebase.frequency_hz, " Hz")}` : "Unavailable — not delivered"],
        ["Timebase synchronized", reproducibility.timebase ? reproducibility.timebase.synchronized ? "Yes" : "No" : "Unavailable — not delivered"],
      ].map(([label, value]) => <tr key={label} className="border-b border-line-soft"><th className="runway-meta w-64 px-3 py-3">{label}</th><td className="runway-num px-3 py-3 text-ink-700">{value}</td></tr>)}</tbody></table>
    </details>

    <details className="runway-panel p-5" open>
      <summary className="cursor-pointer font-display text-title-m font-semibold uppercase text-ink-900">Complete artifact inventory</summary>
      <p className="mt-2 text-caption text-ink-500">Every row is a delivered, digest-bound artifact. Access uses bounded authenticated tickets; host paths and provider secrets are never exposed.</p>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[70rem] border-collapse text-left text-caption"><thead><tr className="border-b border-line bg-runway-black"><th className="runway-meta px-3 py-2">Role</th><th className="runway-meta px-3 py-2">Media type</th><th className="runway-meta px-3 py-2">Size</th><th className="runway-meta px-3 py-2">Digest</th><th className="runway-meta px-3 py-2">Retention</th><th className="runway-meta px-3 py-2">Access</th><th className="runway-meta px-3 py-2">File</th></tr></thead><tbody>{artifacts.map((artifact) => <tr key={artifact.artifact_id} className="border-b border-line-soft"><td className="px-3 py-3 font-semibold">{artifact.role.replaceAll("_", " ")}</td><td className="runway-num px-3 py-3">{artifact.media_type || artifact.content_type}</td><td className="runway-num px-3 py-3">{humanBytes(artifact.size_bytes)}</td><td className="runway-num max-w-64 break-all px-3 py-3">{artifact.sha256}</td><td className="px-3 py-3">{artifact.retention_status || "Not reported"}{artifact.retention_expires_at_iso ? ` · ${artifact.retention_expires_at_iso}` : ""}</td><td className="px-3 py-3">{artifact.access_mode || "Authenticated ticket"}</td><td className="px-3 py-3"><Button type="button" size="sm" variant="secondary" iconLeft={<Download />} onClick={() => void downloadArtifact(user, result.record_id, artifact)}>Download</Button></td></tr>)}{!artifacts.length ? <tr><td className="px-3 py-6 text-ink-500" colSpan={7}>No artifacts were delivered.</td></tr> : null}</tbody></table></div>
      <div className="mt-4 flex flex-wrap gap-2">{requiredRoles.map((role) => <StatusChip key={role} tone={roleSet.has(role) ? "proof" : "warn"} square>{role.replaceAll("_", " ")} · {roleSet.has(role) ? "delivered" : "typed gap"}</StatusChip>)}<StatusChip tone={artifacts.some((artifact) => artifact.role.includes("mcap") || artifact.role.includes("rosbag")) ? "proof" : "neutral"} square>MCAP / ROS bag · {artifacts.some((artifact) => artifact.role.includes("mcap") || artifact.role.includes("rosbag")) ? "delivered" : "optional, absent"}</StatusChip></div>
    </details>

    <details className="runway-panel p-5" open>
      <summary className="cursor-pointer font-display text-title-m font-semibold uppercase text-ink-900">Billing, teardown, provider zero, and notification</summary>
      <table className="mt-4 w-full border-collapse text-left text-caption"><thead><tr className="border-b border-line bg-runway-black"><th className="runway-meta px-3 py-2">Receipt</th><th className="runway-meta px-3 py-2">State / timestamp</th><th className="runway-meta px-3 py-2">Digest</th><th className="runway-meta px-3 py-2">Access</th></tr></thead><tbody>{receiptRows.map(([label, artifact, state]) => <tr key={label} className="border-b border-line-soft"><td className="px-3 py-3 font-semibold">{label}</td><td className="px-3 py-3">{state}</td><td className="runway-num max-w-72 break-all px-3 py-3">{artifact?.sha256 || "Unavailable — not delivered"}</td><td className="px-3 py-3">{artifact ? <Button type="button" size="sm" variant="secondary" iconLeft={<Download />} onClick={() => void downloadArtifact(user, result.record_id, artifact)}>Download</Button> : <span className="text-ink-400">Typed gap</span>}</td></tr>)}</tbody></table>
      {notification?.status === "failed" ? <ProofBoundary level="warn" title="Notification delivery failed">The result remains valid and accessible. Failure: {notification.failure_reason || "provider did not return a reason"}. Attempts: {notification.attempts}.</ProofBoundary> : null}
    </details>
  </>;
}
