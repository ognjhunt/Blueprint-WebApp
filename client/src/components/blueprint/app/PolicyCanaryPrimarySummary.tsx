import { useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { Download } from "lucide-react";

import { Button, PolicyRankBar, StatusChip } from "@/components/blueprint";
import {
  canaryCandidateSummaries,
  formatCanaryPercent,
  pairedCanaryComparison,
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

function ciCaption(wilson: { lower: number; upper: number } | null) {
  if (!wilson) return "Interval not meaningful at this count";
  return `95% CI ${Math.round(wilson.lower * 100)}–${Math.round(wilson.upper * 100)}%`;
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
  const summaries = canaryCandidateSummaries(result);
  const comparison = pairedCanaryComparison(result);
  const hasVerdict = Boolean(comparison && summaries.some((summary) => summary.success_rate !== null));

  return <section
    className="runway-panel overflow-hidden border-t-2 border-t-runway-signal"
    aria-labelledby="canary-primary-summary"
  >
    <div className="flex flex-col gap-6 p-5 lg:p-6">
      <div className="flex flex-col gap-2">
        <p className="runway-meta text-runway-signal">Head-to-head policy test · simulation</p>
        {hasVerdict && comparison ? <>
          <h2 className="font-display text-[clamp(1.4rem,3.2vw,2.15rem)] font-semibold leading-tight tracking-[0.005em] text-ink-900">
            {comparison.headline}
          </h2>
          <p className="max-w-3xl text-body-s text-ink-600">{comparison.verdict}</p>
        </> : <h2 id="canary-primary-summary" className="font-display text-[clamp(1.35rem,3vw,2.1rem)] font-semibold uppercase leading-tight tracking-[0.005em] text-ink-900">
          {cellCount} scenario cells · {policyCount} policies · {episodeCount} episodes
        </h2>}
      </div>

      {hasVerdict ? <div className="flex flex-col gap-4 border-t border-line pt-5">
        <p className="runway-meta">Success rate · scored episodes · Wilson 95% interval</p>
        <div className="flex flex-col gap-4">
          {summaries.map((summary) => {
            const isLeader = comparison?.leader?.candidate_id === summary.candidate_id;
            return <div key={summary.candidate_id} className="flex flex-col gap-1">
              <PolicyRankBar
                label={summary.display_name}
                value={summary.success_rate ?? 0}
                winner={isLeader}
                style={{ gridTemplateColumns: "minmax(10rem,16rem) minmax(0,1fr) auto" }}
                metric={<span>
                  {formatCanaryPercent(summary.success_rate)}
                  <span className="ml-1 text-ink-400">{summary.success_count}/{summary.interpretable_count}</span>
                </span>}
              />
              <p className="runway-num pl-2 text-[0.66rem] text-ink-400">
                {ciCaption(summary.wilson)}
              </p>
            </div>;
          })}
        </div>
        <p className="text-caption text-ink-500">
          N = {cellCount} per policy on one scene — a diagnostic sample. Peer practice for a ranking-grade
          claim is roughly 50–300+ trials per condition, so this run can flag a large gap but does not
          settle a winner.
        </p>
      </div> : null}

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        {hasVerdict ? <h2
          id="canary-primary-summary"
          className="runway-meta text-ink-500"
        >
          {cellCount} scenario cells · {policyCount} policies · {episodeCount} episodes
        </h2> : null}
        <p className="text-body-s text-ink-600">
          {candidates.map((candidate) => candidate.display_name).join(" versus ")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={episodeRecords === episodeCount ? "proof" : "warn"} square>
            {episodeRecords}/{episodeCount} episode records
          </StatusChip>
          <StatusChip tone={blocked ? "warn" : "proof"} square>{completed} completed · {blocked} blocked</StatusChip>
          <StatusChip tone="warn" square>No winner declared · diagnostic</StatusChip>
        </div>
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
