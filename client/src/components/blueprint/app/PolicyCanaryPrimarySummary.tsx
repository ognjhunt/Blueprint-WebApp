import { useEffect, useRef, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { Download } from "lucide-react";

import {
  canaryCandidateSummaries,
  canaryControlsState,
  canaryUnscoredReasons,
  pairedCanaryComparison,
  primaryCanaryDownloads,
} from "@/lib/policyCanaryResultPortal";
import {
  createTaskEvaluationResultArtifactTicket,
  TaskEvaluationArtifactTicketError,
  type TaskEvaluationResultArtifact,
  type TaskEvaluationResultSiteRecord,
} from "@/lib/taskEvaluationResults";

/** Lets identifiers such as groot_n17_droid wrap at underscores rather than mid-word. */
export function WrapAtUnderscores({ text }: { text: string }) {
  return <>{text.split("_").map((part, index) => index
    ? <span key={index}>_<wbr />{part}</span>
    : part)}</>;
}

export function PrimaryDownload(props: Parameters<typeof PrimaryDownloadContent>[0]) {
  return <PrimaryDownloadContent key={`${props.user?.uid || "anonymous"}:${props.user?.tenantId || ""}:${props.recordId}:${props.artifact?.artifact_id || "missing"}`} {...props} />;
}

function PrimaryDownloadContent({
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
  const mounted = useRef(true);
  const request = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryWait, setRetryWait] = useState<number | null>(null);
  useEffect(() => {
    if (!retryWait) return;
    const timer = setTimeout(() => setRetryWait(null), retryWait * 1000);
    return () => clearTimeout(timer);
  }, [retryWait]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  async function download() {
    if (!artifact || retryWait) return;
    request.current?.abort(); request.current = new AbortController();
    setError(null);
    setState("loading");
    try {
      const url = await createTaskEvaluationResultArtifactTicket(
        user,
        recordId,
        artifact.artifact_id,
        { signal: request.current.signal },
      );
      if (!mounted.current) return;
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = String(artifact.relative_path || artifact.artifact_id).split("/").pop() || artifact.role;
      anchor.click();
      setState("idle");
    } catch (reason) {
      if (mounted.current) {
        setState("failed");
        setError(reason instanceof TaskEvaluationArtifactTicketError ? reason.message : "Artifact authorization failed. Retry the download.");
        if (reason instanceof TaskEvaluationArtifactTicketError && reason.status === 429) setRetryWait(reason.retryAfterSeconds);
      }
    }
  }
  const text = !artifact
    ? `${label} unavailable`
    : state === "loading"
      ? `Preparing ${label}…`
      : state === "failed"
        ? `Retry ${label}`
        : label;
  return <span className="inline-flex max-w-full flex-col items-start gap-1">
    <button
      type="button"
      className="ws-link"
      disabled={!artifact || state === "loading" || Boolean(retryWait)}
      onClick={() => void download()}
    >
      <Download size={16} aria-hidden="true" />
      {text}
    </button>
    {error ? <span role="status" className="max-w-xs text-sm text-runway-red">{error}</span> : null}
  </span>;
}

function episodes(count: number) {
  return `${count} episode${count === 1 ? "" : "s"}`;
}

/** One short caveat when the control runs cannot vouch for the scene and scorer. */
function controlsCaveat(result: TaskEvaluationResultSiteRecord) {
  const { controls, status, verified } = canaryControlsState(result);
  if (verified) return null;
  if (status === "controls_omitted_by_user") {
    return "Control runs were skipped, so it isn't confirmed that the task can be completed in this scene.";
  }
  if (status === "controls_failed") {
    return "Control runs failed, so the scene or scorer may not be working as intended.";
  }
  return controls.length
    ? "Not every control run passed, so it isn't confirmed that the task can be completed in this scene."
    : "Control runs weren't delivered, so it isn't confirmed that the task can be completed in this scene.";
}

/** The answer first: a plain verdict, the counts behind it, and what limits it. */
export function PolicyCanaryPrimarySummary({
  result,
  user,
  contractDelivered,
  correctionApplied,
  correctionRejected,
}: {
  result: TaskEvaluationResultSiteRecord;
  user: FirebaseUser | null;
  contractDelivered: boolean;
  correctionApplied: boolean;
  correctionRejected: boolean;
}) {
  const summaries = canaryCandidateSummaries(result);
  const comparison = pairedCanaryComparison(result);
  const downloads = primaryCanaryDownloads(result);
  const unscored = summaries.filter((summary) => summary.excluded_count > 0).map((summary) => {
    const reasons = canaryUnscoredReasons(result, summary.candidate_id);
    const why = reasons.length === 1
      ? reasons[0].reason
      : reasons.map((row) => `${row.reason} (${row.count})`).join(", ");
    return `${summary.display_name}: ${summary.excluded_count} of ${episodes(summary.delivered_count)} ${summary.excluded_count === 1 ? "wasn't" : "weren't"} scored — ${why}.`;
  });
  const controls = controlsCaveat(result);

  return <section aria-labelledby="canary-verdict">
    <p className="ws-kicker">Result</p>
    <h2 id="canary-verdict">{comparison?.headline || "These results can't be compared."}</h2>
    {comparison?.verdict ? <p className="mt-2 max-w-3xl text-ink-600">{comparison.verdict}</p> : null}

    <div className="mt-6 max-w-2xl overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-sm text-ink-500">
            <th scope="col" className="py-2 pr-3 font-normal sm:pr-6">Policy</th>
            <th scope="col" className="py-2 pr-3 text-right font-normal sm:pr-6">Episodes</th>
            <th scope="col" className="py-2 pr-3 text-right font-normal sm:pr-6">Scored</th>
            <th scope="col" className="py-2 text-right font-normal">Completed</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((summary) => <tr key={summary.candidate_id} className="border-t border-line">
            <th scope="row" className="py-3 pr-3 font-medium [overflow-wrap:anywhere] sm:pr-6"><WrapAtUnderscores text={summary.display_name} /></th>
            <td className="py-3 pr-3 text-right tabular-nums sm:pr-6">{summary.delivered_count}</td>
            <td className="py-3 pr-3 text-right tabular-nums sm:pr-6">{summary.interpretable_count}</td>
            <td className="py-3 text-right tabular-nums">{summary.success_count}</td>
          </tr>)}
        </tbody>
      </table>
    </div>

    <ul className="mt-4 flex max-w-3xl flex-col gap-1.5 text-sm text-ink-600">
      {unscored.map((line) => <li key={line}>{line}</li>)}
      {controls ? <li>{controls}</li> : null}
      {!contractDelivered ? <li>Success criteria weren't delivered with this result, so it can't serve as an acceptance test.</li> : null}
      {correctionApplied ? <li>Scoring was corrected after publication. The same fix applies to both policies, and the original scores are kept.</li> : null}
      {correctionRejected ? <li>A score correction didn't match this result, so the original scores are shown.</li> : null}
      {result.access_visibility === "unlisted_public" ? <li>Anyone with this link can view this result and its files.</li> : null}
      <li>Simulation only: no winner is declared, and this isn't evidence of real-world performance or safety.</li>
    </ul>

    <div role="group" aria-label="Primary result downloads" className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
      {downloads.map((download) => <PrimaryDownload
        key={download.key}
        artifact={download.artifact}
        label={download.label}
        recordId={result.record_id}
        user={user}
      />)}
    </div>
  </section>;
}
