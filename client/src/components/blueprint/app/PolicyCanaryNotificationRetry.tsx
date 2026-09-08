import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User as FirebaseUser } from "firebase/auth";
import { Button } from "@/components/blueprint";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { withCsrfHeader } from "@/lib/csrf";
import { boundedResultArtifactRequest, resultPostWithCsrfRecovery } from "@/lib/resultArtifactRequest";
import type { TaskEvaluationResultSiteRecord } from "@/lib/taskEvaluationResults";

class EmailRetryRefusal extends Error {}

export function PolicyCanaryNotificationRetry({ result, user }: { result: TaskEvaluationResultSiteRecord; user: FirebaseUser }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<"idle" | "loading" | "check" | "failed" | "blocked">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function retry() {
    if (state === "loading") return;
    request.current?.abort(); request.current = new AbortController();
    const controller = request.current;
    requestId.current ||= crypto.randomUUID();
    setState("loading"); setMessage(null);
    try {
      const receipt = await boundedResultArtifactRequest(async (signal) => {
        const response = await resultPostWithCsrfRecovery(async (refreshCsrf) => {
          const headers = await withFirebaseAuthHeaders(user, await withCsrfHeader({ "Content-Type": "application/json" }, { refresh: refreshCsrf }));
          signal.throwIfAborted();
          return fetch(`/api/task-evaluation-results/${encodeURIComponent(result.record_id)}/notification-retries`, {
            method: "POST", credentials: "include", headers, signal,
            body: JSON.stringify({ request_id: requestId.current, expected_result_digest: result.publication.policy_canary_result?.projection_digest, authorize_email_retry: true }),
          });
        }, signal);
        if (!response.ok) {
          if (response.status === 401) throw new EmailRetryRefusal("Sign in again to retry the result email.");
          if (response.status === 403) throw new EmailRetryRefusal("Only the run owner or operations can retry this email.");
          if (response.status === 429) throw new EmailRetryRefusal("The bounded email retry limit has been reached. Review the delivery receipts before another send.");
          if (response.status === 409) throw new EmailRetryRefusal("The retry needs receipt reconciliation or a refreshed result. No new email was authorized by this request.");
          throw new Error("The retry could not be confirmed. Check its status using the same request.");
        }
        const value = await response.json();
        if (value.record_id !== result.record_id || value.request_id !== requestId.current
          || value.run_result_digest !== result.publication.policy_canary_result?.projection_digest
          || !["dispatching", "accepted", "failed", "unknown"].includes(value.status)) throw new Error("Retry receipt binding is invalid");
        return value as { status: "dispatching" | "accepted" | "failed" | "unknown" };
      }, controller.signal);
      if (controller.signal.aborted) return;
      if (receipt.status === "accepted") setMessage("The email transport accepted the retry. Inbox delivery is not yet confirmed.");
      else if (receipt.status === "failed") { setMessage("Email delivery failed. The result remains available."); requestId.current = null; }
      else setMessage("Delivery outcome is pending or unknown. No additional email is sent automatically.");
      setState(receipt.status === "failed" ? "failed" : "check");
      void queryClient.invalidateQueries({ queryKey: ["task-evaluation-result"] });
    } catch (reason) {
      if (controller.signal.aborted) return;
      if (reason instanceof EmailRetryRefusal) {
        setState("blocked"); setMessage(reason.message);
        void queryClient.invalidateQueries({ queryKey: ["task-evaluation-result"] });
        return;
      }
      setState("check"); setMessage("The retry response was unavailable. Check the same request before attempting another email.");
    }
  }
  return <div className="mt-3 flex flex-col items-start gap-2">
    <p className="text-caption text-ink-600">Send one result email to the originally verified recipient. This does not rerun the evaluation.</p>
    <Button type="button" variant="secondary" size="sm" disabled={state === "loading" || state === "blocked"} onClick={() => void retry()}>
      {state === "loading" ? "Checking delivery…" : state === "check" ? "Check email retry status" : "Retry result email"}
    </Button>
    {message ? <p role="status" className="text-caption text-ink-600">{message}</p> : null}
  </div>;
}
