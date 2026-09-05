import { useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { Button, StatusChip } from "@/components/blueprint";
import { buildCanaryArtifactInventory, normalizedArtifact } from "@/lib/policyCanaryResultPortal";
import { controlsVerified, controlsWarnings, type ControlArtifact } from "@/lib/policyCanaryControls";
import type { TaskEvaluationResultSiteRecord } from "@/lib/taskEvaluationResults";
import { EvidenceVideo } from "./PolicyCanaryEpisodeExplorer";
import { PrimaryDownload } from "./PolicyCanaryPrimarySummary";

const controlName = (id: string) => id === "zero_action_negative" ? "Zero-action negative" : "Scripted positive";
const downloadNames: Record<string, string> = {
  control_cell_archive: "Cell evidence ZIP", frame_manifest: "Lossless frame manifest",
  state_trace: "State trace", action_trace: "Action trace",
};

export function PolicyCanaryControls({ result, user }: { result: TaskEvaluationResultSiteRecord; user: FirebaseUser | null }) {
  const publication = result.publication;
  const projection = publication.policy_canary_result;
  const controls = projection?.controls || publication.result_delivery?.controls || [];
  const summary = projection?.controls_summary || publication.result_delivery?.controls_summary;
  const status = publication.scene_controls_status || projection?.scene_controls_status || "configured_controls_pending";
  const verified = controlsVerified({ scene_controls_status: status, controls, controls_summary: summary });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = controls.find((row) => row.episode_id === selectedId) || controls[0];
  const inventory = buildCanaryArtifactInventory(result);
  const resolve = (reference?: ControlArtifact) => reference
    ? inventory.find((artifact) => artifact.artifact_id === reference.artifact_id) || normalizedArtifact(reference)
    : null;
  const csv = inventory.find((artifact) => artifact.role === "controls_csv") || null;
  const warning = controlsWarnings[verified ? "controls_verified_development_only" : status === "controls_failed" ? "controls_failed" : "configured_controls_pending"];

  return <section className="runway-panel min-w-0 p-5" aria-labelledby="canary-controls-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="runway-meta">Independent reference controls</p>
        <h2 id="canary-controls-title" className="mt-1 font-display text-title-m font-semibold uppercase text-ink-900">Per-cell controls</h2>
      </div>
      <StatusChip tone={verified ? "proof" : "warn"} square>{verified ? "20 / 20 controls verified" : `${summary?.passed_count ?? 0} / 20 controls passed`}</StatusChip>
    </div>
    <p className="mt-3 text-body-s text-ink-700">{warning}</p>
    <p className="mt-2 text-caption text-ink-500">The zero-action control should leave the task incomplete. The scripted positive control should complete it. These episodes are reported separately from the learned policies.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span className="runway-num text-caption text-ink-500">{summary?.recorded_count ?? controls.length} / 20 records · {summary?.completed_count ?? 0} completed · {summary?.verified_cell_count ?? 0} / 10 matched cells verified</span>
      <PrimaryDownload artifact={csv} label="Controls CSV" recordId={result.record_id} user={user} />
    </div>
    {controls.length ? <>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[36rem] border-collapse text-left text-caption">
        <caption className="sr-only">Reference control outcomes for each scenario cell</caption>
        <thead><tr className="border-b border-line"><th scope="col" className="px-3 py-2">Cell / seed</th><th scope="col" className="px-3 py-2">Control</th><th scope="col" className="px-3 py-2">Control result</th><th scope="col" className="px-3 py-2">Task outcome</th><th scope="col" className="px-3 py-2">Evidence</th></tr></thead>
        <tbody>{controls.map((row) => <tr key={row.episode_id} className="border-b border-line-soft">
          <th scope="row" className="px-3 py-3 font-medium">{row.cell_id}<span className="runway-num block text-ink-400">Seed {row.seed}</span></th>
          <td className="px-3 py-3">{controlName(row.control_id)}</td>
          <td className="px-3 py-3"><StatusChip tone={row.control_passed ? "proof" : "warn"} square>{row.control_passed ? "Control passed" : row.terminal_state === "blocked" ? "Evidence incomplete" : "Control failed"}</StatusChip></td>
          <td className="px-3 py-3">{row.score.outcome?.replaceAll("_", " ") || "Not scored"}</td>
          <td className="px-3 py-3"><Button type="button" size="sm" variant="secondary" aria-label={`Inspect ${controlName(row.control_id)} for ${row.cell_id}`} aria-pressed={selected?.episode_id === row.episode_id} onClick={() => setSelectedId(row.episode_id)}>Inspect</Button></td>
        </tr>)}</tbody>
      </table></div>
      {selected ? <div className="mt-6 border-t border-line pt-5">
        <h3 className="font-display text-title-s font-semibold text-ink-900">{controlName(selected.control_id)} · {selected.cell_id}</h3>
        {selected.score.failed_criteria?.length ? <p className="mt-2 text-body-s text-ink-700">Failed criteria: {selected.score.failed_criteria.map((item) => typeof item === "string" ? item.replaceAll("_", " ") : JSON.stringify(item)).join(", ")}</p> : null}
        {selected.evidence_gaps.length ? <p role="status" className="mt-2 text-body-s text-ink-700">Evidence gaps: {selected.evidence_gaps.join(", ")}</p> : null}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">{["external", "wrist", "overview"].map((camera) => <EvidenceVideo key={`${selected.episode_id}-${camera}`} artifact={resolve(selected.videos[camera]) || undefined} camera={camera} policy={controlName(selected.control_id)} user={user} recordId={result.record_id} selectedTimeSeconds={null} timebaseOffsetSeconds={null} />)}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryDownload artifact={resolve(selected.receipt)} label="Control receipt" recordId={result.record_id} user={user} />
          <PrimaryDownload artifact={resolve(selected.cell_receipt)} label="Cell receipt" recordId={result.record_id} user={user} />
          {selected.artifacts.map((artifact) => <PrimaryDownload key={artifact.artifact_id} artifact={resolve(artifact)} label={downloadNames[artifact.role] || artifact.role.replaceAll("_", " ")} recordId={result.record_id} user={user} />)}
        </div>
      </div> : null}
    </> : <p className="mt-5 text-body-s text-ink-500">No control episode receipts were delivered for this run.</p>}
  </section>;
}
