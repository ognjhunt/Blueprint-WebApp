import { useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { buildCanaryArtifactInventory, canaryControlsState, normalizedArtifact } from "@/lib/policyCanaryResultPortal";
import type { ControlArtifact } from "@/lib/policyCanaryControls";
import type { TaskEvaluationResultSiteRecord } from "@/lib/taskEvaluationResults";
import { EvidenceVideo, OutcomeTag } from "./PolicyCanaryEpisodeExplorer";
import { PrimaryDownload } from "./PolicyCanaryPrimarySummary";

const controlName = (id: string) => id === "zero_action_negative" ? "Do-nothing run" : "Scripted run";
const downloadNames: Record<string, string> = {
  control_cell_archive: "Cell evidence ZIP", frame_manifest: "Lossless frame manifest",
  state_trace: "State trace", action_trace: "Action trace",
};

/** Control runs sit in a closed drawer; the result notes say when they are missing or failed. */
export function PolicyCanaryControls({ result, user }: { result: TaskEvaluationResultSiteRecord; user: FirebaseUser | null }) {
  const { controls, summary, verified } = canaryControlsState(result);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!controls.length) return null;
  const selected = controls.find((row) => row.episode_id === selectedId) || controls[0];
  const inventory = buildCanaryArtifactInventory(result);
  const resolve = (reference?: ControlArtifact) => reference
    ? inventory.find((artifact) => artifact.artifact_id === reference.artifact_id) || normalizedArtifact(reference)
    : null;
  const csv = inventory.find((artifact) => artifact.role === "controls_csv") || null;
  const expected = summary?.expected_count || controls.length;
  const passed = summary?.passed_count ?? controls.filter((row) => row.control_passed).length;

  return <details>
    <summary>Control runs · {verified ? `all ${expected} passed` : `${passed} of ${expected} passed`}</summary>
    <section aria-label="Control runs" className="text-sm">
      <p className="max-w-3xl text-ink-600">
        Each scenario also ran two checks without a learned policy: a do-nothing run that should
        fail and a scripted run that should succeed. They test the scene and scorer and aren't
        counted in the results above.
      </p>
      <div className="mt-3"><PrimaryDownload artifact={csv} label="Controls CSV" recordId={result.record_id} user={user} /></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[34rem] border-collapse text-left">
        <caption className="sr-only">Control run outcomes for each scenario</caption>
        <thead><tr className="text-ink-500">
          <th scope="col" className="py-2 pr-4 font-normal">Scenario</th>
          <th scope="col" className="py-2 pr-4 font-normal">Check</th>
          <th scope="col" className="py-2 pr-4 font-normal">Result</th>
          <th scope="col" className="py-2 font-normal"><span className="sr-only">Evidence</span></th>
        </tr></thead>
        <tbody>{controls.map((row) => <tr key={row.episode_id} className="border-t border-line">
          <th scope="row" className="break-all py-2.5 pr-4 font-normal">{row.cell_id}<span className="block text-xs text-ink-500">Seed {row.seed}</span></th>
          <td className="py-2.5 pr-4">{controlName(row.control_id)}</td>
          <td className="py-2.5 pr-4">
            <OutcomeTag outcome={row.control_passed
              ? { label: "Passed", tone: "green" }
              : row.terminal_state === "blocked"
                ? { label: "Incomplete", tone: "neutral" }
                : { label: "Failed", tone: "red" }} />
            <span className="block text-xs text-ink-500">{row.score.outcome?.replaceAll("_", " ") || "Not scored"}</span>
          </td>
          <td className="py-2.5"><button
            type="button"
            className="ws-link"
            aria-label={`Inspect ${controlName(row.control_id)} for ${row.cell_id}`}
            aria-pressed={selected?.episode_id === row.episode_id}
            onClick={() => setSelectedId(row.episode_id)}
          >Inspect</button></td>
        </tr>)}</tbody>
      </table></div>
      {selected ? <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-lg">{controlName(selected.control_id)} · {selected.cell_id}</h3>
        {selected.score.failed_criteria?.length ? <p className="mt-2 text-ink-700">Failed criteria: {selected.score.failed_criteria.map((item) => typeof item === "string" ? item.replaceAll("_", " ") : JSON.stringify(item)).join(", ")}</p> : null}
        {selected.evidence_gaps.length ? <p role="status" className="mt-2 text-ink-700">Missing evidence: {selected.evidence_gaps.join(", ")}</p> : null}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">{["external", "wrist", "overview"].map((camera) => <EvidenceVideo key={`${selected.episode_id}-${camera}`} artifact={resolve(selected.videos[camera]) || undefined} camera={camera} policy={controlName(selected.control_id)} user={user} recordId={result.record_id} selectedTimeSeconds={null} timebaseOffsetSeconds={null} />)}</div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          <PrimaryDownload artifact={resolve(selected.receipt)} label="Control receipt" recordId={result.record_id} user={user} />
          <PrimaryDownload artifact={resolve(selected.cell_receipt)} label="Cell receipt" recordId={result.record_id} user={user} />
          {selected.artifacts.map((artifact) => <PrimaryDownload key={artifact.artifact_id} artifact={resolve(artifact)} label={downloadNames[artifact.role] || artifact.role.replaceAll("_", " ")} recordId={result.record_id} user={user} />)}
        </div>
      </div> : null}
    </section>
  </details>;
}
