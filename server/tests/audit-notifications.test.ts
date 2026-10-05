// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state, sharedFakeFirestore as db } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore }));
vi.mock("../utils/captureOutbox", () => ({ CAPTURE_OUTBOX_COLLECTION: "captureOutbox" }));
const site = vi.hoisted(() => vi.fn());
const team = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: site }));
vi.mock("../utils/robotTeamNotifications", () => ({ notifyTeamOfRunOutcome: team }));
vi.mock("../utils/transactional-notifications", () => ({ dispatchTransactionalEmailNotification: send }));
import { resultNotificationIntent, reconcileAgentRunResultNotifications } from "../utils/agentRunResultNotifications";
import { reconcileTaskEvaluationNotificationRetries } from "../utils/taskEvaluationNotificationRetry";
beforeEach(() => { state.docs.clear(); vi.clearAllMocks(); });

describe("notification durability", () => {
  it("reconciles a saved result after enqueue failure without changing the result", async () => {
    const run: any = { runId: "run", sceneId: "site", teamId: "team", evaluationPurpose: "pilot",
      result: { observed: { episodesRun: 10, episodesSucceeded: 8 } } };
    state.docs.set("evaluationRuns/run", { ...run, result_notification_intent: resultNotificationIntent(run, run.result), result_notification_pending: true });
    site.mockRejectedValueOnce(new Error("injected outbox outage"));
    await expect(reconcileAgentRunResultNotifications()).rejects.toThrow("outbox outage");
    expect(state.docs.get("evaluationRuns/run")?.result_notification_pending).toBe(true);
    site.mockImplementation(async () => state.docs.set("captureOutbox/site:results_ready:run", {}));
    team.mockImplementation(async () => state.docs.set("captureOutbox/team:team:result:run", {}));
    await reconcileAgentRunResultNotifications(); await reconcileAgentRunResultNotifications();
    expect(state.docs.get("evaluationRuns/run")).toMatchObject({ result: run.result, result_notification_pending: false });
    expect(send).not.toHaveBeenCalled();
  });
  it.each(["valid", "wrong_digest", "changed_owner", "no_provider_id"])("observes %s provider evidence without another send", async condition => {
    const digest = `sha256:${"a".repeat(64)}`;
    state.docs.set("taskEvaluationResultNotificationRetries/retry", { receipt: { status: "unknown", run_id: "run", record_id: "result", run_result_digest: digest, attempt: 2 },
      owner_user_id: "owner", prior_notification: { status: "failed" } });
    state.docs.set("taskEvaluationPolicyRuns/run", { owner_user_id: condition === "changed_owner" ? "other" : "owner", notification_retry: { retry_id: "retry", status: "unknown" } });
    state.docs.set("captureTaskEvaluationRuns/result", { owner_user_id: "owner", publication: { policy_canary_result: { projection_digest: digest } } });
    state.docs.set("transactionalNotifications/email", { source_doc_id: "retry", source_collection: "taskEvaluationResultNotificationRetries",
      source_event_id: "result-email-retry:retry", subject_id: "run", channel: "email", event_type: "evaluation_results_ready", status: "sent",
      recipient_user_id: "owner", delivery_provider: "resend", provider_message_id: condition === "no_provider_id" ? null : "provider-ack",
      sent_at: "2026-10-05T12:00:00Z", data: { run_result_digest: condition === "wrong_digest" ? "wrong" : digest } });
    await reconcileTaskEvaluationNotificationRetries(db as never);
    expect((state.docs.get("taskEvaluationResultNotificationRetries/retry")?.receipt as any).status).toBe(condition === "valid" ? "accepted" : "unknown");
    expect(send).not.toHaveBeenCalled();
  });
});
