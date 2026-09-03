import { useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { Download } from "lucide-react";

import { Button, StatusChip } from "@/components/blueprint";
import {
  primaryCanaryDownloads,
  resolvedCanaryCandidates,
} from "@/lib/policyCanaryResultPortal";
import {
  createTaskEvaluationResultArtifactTicket,
  type TaskEvaluationResultArtifact,
  type TaskEvaluationResultSiteRecord,
} from "@/lib/taskEvaluationResults";

function PrimaryDownload({
  artifact,
  label,
  recordId,
  user,
}: {
  artifact: TaskEvaluationResultArtifact | null;
  label: string;
  recordId: string;
  user: FirebaseUser | null;
}) {
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  async function download() {
    if (!artifact) return;
    setState("loading");
    try {
      const url = await createTaskEvaluationResultArtifactTicket(
        user,
        recordId,
        artifact.artifact_id,
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = artifact.relative_path.split("/").pop() || artifact.role;
      anchor.click();
      setState("idle");
    } catch {
      setState("failed");
    }
  }
  const text = !artifact
    ? `${label} unavailable`
    : state === "loading"
      ? `Preparing ${label}…`
      : state === "failed"
        ? `Retry ${label}`
        : label;
  return <Button
    type="button"
    size="sm"
    variant={label === "Full JSON" ? "action" : "secondary"}
    iconLeft={<Download aria-hidden="true" />}
    disabled={!artifact || state === "loading"}
    onClick={() => void download()}
  >
    {text}
  </Button>;
}

export function PolicyCanaryPrimarySummary({
  result,
  user,
}: {
  result: TaskEvaluationResultSiteRecord;
  user: FirebaseUser | null;
}) {
  const publication = result.publication;
  const canary = publication.policy_canary_result || {};
  const candidates = resolvedCanaryCandidates(result);
  const cellCount = Number(canary.counts?.episodes_per_policy || 10);
  const policyCount = Number(canary.counts?.policy_count || candidates.length || 2);
  const episodeCount = Number(canary.counts?.learned_policy_rollout_count || cellCount * policyCount);
  const completed = Number(
    canary.counts?.completed_learned_policy_rollout_count
      ?? 0,
  );
  const episodeRecords = (publication.result_delivery?.episodes || [])
    .filter((episode) => episode.episode_kind === "learned_candidate").length;
  const blocked = Math.max(episodeRecords - completed, 0);
  const downloads = primaryCanaryDownloads(result);

  return <section
    className="runway-panel overflow-hidden border-t-2 border-t-runway-signal"
    aria-labelledby="canary-primary-summary"
  >
    <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:p-6">
      <div>
        <p className="runway-meta text-runway-signal">Quick policy canary</p>
        <h2
          id="canary-primary-summary"
          className="mt-2 font-display text-[clamp(1.35rem,3vw,2.1rem)] font-semibold uppercase leading-tight tracking-[0.005em] text-ink-900"
        >
          {cellCount} scenario cells · {policyCount} policies · {episodeCount} episodes
        </h2>
        <p className="mt-3 text-body-s text-ink-600">
          {candidates.map((candidate) => candidate.display_name).join(" versus ")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <StatusChip tone={episodeRecords === episodeCount ? "proof" : "warn"} square>
          {episodeRecords}/{episodeCount} episode records
        </StatusChip>
        <StatusChip tone={blocked ? "warn" : "proof"} square>{completed} completed · {blocked} blocked</StatusChip>
        <StatusChip tone="warn" square>No winner · unqualified</StatusChip>
      </div>
    </div>
    <div className="border-t border-line bg-inset px-5 py-4 lg:px-6">
      <p className="runway-meta mb-3">Primary downloads</p>
      <div className="flex flex-wrap gap-2" aria-label="Primary result downloads">
        {downloads.map((download) => <PrimaryDownload
          key={download.key}
          artifact={download.artifact}
          label={download.label}
          recordId={result.record_id}
          user={user}
        />)}
      </div>
    </div>
  </section>;
}
