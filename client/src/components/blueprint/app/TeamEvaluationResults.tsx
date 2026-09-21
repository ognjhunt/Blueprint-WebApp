import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchEvaluationReadyRun } from "@/lib/evaluationReadyRuns";
import { useTaskEvaluationResult } from "@/lib/taskEvaluationResults";
import { ResultContent } from "@/pages/app/TaskEvaluationResultDetail";

function PublishedResult({ recordId, runId }: { recordId: string; runId: string }) {
  const { result, error, isLoading, currentUser } = useTaskEvaluationResult(recordId);
  if (error) return <p role="alert">Results could not be loaded. Reload this page to retry.</p>;
  if (isLoading) return <p>Loading results…</p>;
  if (!result) return <p>The result report is not available yet.</p>;
  if (result.publication.run_id !== runId) return <p role="alert">The result does not match this evaluation.</p>;
  return <ResultContent result={result} user={currentUser} />;
}

/** Follow authenticated run -> result identity; never derive a URL from storage. */
export function TeamEvaluationResults({ runId, sourceLaunchId }: { runId: string; sourceLaunchId: string }) {
  const { currentUser } = useAuth();
  const [recordId, setRecordId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!currentUser) return;
    const controller = new AbortController();
    void fetchEvaluationReadyRun(currentUser, runId, controller.signal).then(run => {
      if (controller.signal.aborted) return;
      if (!run || run.run_id !== runId || run.source_launch_id !== sourceLaunchId || !run.result) {
        setError(true); return;
      }
      setRecordId(run.result.record_id);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [currentUser, runId, sourceLaunchId]);
  if (error) return <p role="alert" className="mt-4">Results could not be loaded. Reload this page to retry.</p>;
  return <details className="mt-5 border-t border-line pt-4">
    <summary className="cursor-pointer font-medium">Results and episode videos</summary>
    <div className="mt-5">{recordId ? <PublishedResult recordId={recordId} runId={runId} /> : <p>Loading results…</p>}</div>
  </details>;
}
