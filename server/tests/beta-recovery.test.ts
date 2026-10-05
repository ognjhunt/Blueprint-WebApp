// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (value: string) => value }));
vi.mock("../logger", () => ({ logger: { warn: vi.fn() } }));
const mocks = vi.hoisted(() => ({ brief: vi.fn(), coverage: vi.fn(), site: vi.fn(), team: vi.fn(), save: vi.fn() }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: async () => null, saveBrief: mocks.save, draftBrief: (value: unknown) => value }));
vi.mock("../utils/siteTaskBriefReading", () => ({ readBriefFromDescription: mocks.brief }));
vi.mock("../utils/captureCoverageReview", () => ({ reviewCaptureCoverage: mocks.coverage }));
vi.mock("../config/env", () => ({ isSiteTaskBriefReadingEnabled: () => true, isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: mocks.site }));
vi.mock("../utils/robotTeamNotifications", () => ({ notifyTeamOfRunOutcome: mocks.team }));
import { recoverCaptureReviews } from "../utils/captureReviewRecovery";
import { reconcileAgentRunNotifications } from "../utils/agentRunNotificationRecovery";
beforeEach(() => {
  state.docs.clear(); Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.brief.mockResolvedValue(true); mocks.coverage.mockResolvedValue({ coversScene: true });
  mocks.site.mockResolvedValue({ enqueued: true }); mocks.team.mockResolvedValue({ enqueued: true });
});
describe("bounded capture recovery", () => {
  it("recovers an interrupted description read after its persisted lease", async () => {
    state.docs.set("inboundRequests/request", { request: { taskStatement: "Move boxes", capture_mode: "self_capture" },
      briefReviewPending: true, briefReviewWork: { state: "processing", attempts: 1, dueAtMs: Date.now() - 1 } });
    expect((await recoverCaptureReviews()).processedCount).toBe(1);
    expect(state.docs.get("inboundRequests/request")?.briefReviewWork.attempts).toBe(2);
    await recoverCaptureReviews();
    expect(mocks.brief).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it("does not steal a current lease and stops at the persisted attempt budget", async () => {
    state.docs.set("inboundRequests/request", { request: { taskStatement: "Move boxes" },
      briefReviewPending: true, briefReviewWork: { state: "processing", attempts: 2, dueAtMs: Date.now() + 10_000 } });
    await recoverCaptureReviews(); expect(mocks.brief).not.toHaveBeenCalled();
    state.docs.get("inboundRequests/request")!.briefReviewWork.dueAtMs = 0;
    mocks.brief.mockResolvedValue(false);
    await recoverCaptureReviews(); await recoverCaptureReviews();
    expect(mocks.brief).toHaveBeenCalledTimes(1);
    expect(state.docs.get("inboundRequests/request")?.briefReviewWork.state).toBe("needs_review");
    expect(state.docs.get("inboundRequests/request")?.briefReviewWork.attempts).toBe(3);
  });
});
describe("result notification intent recovery", () => {
  it("keeps an intent pending until both audience outboxes accept it", async () => {
    state.docs.set("evaluationRuns/run", { runId: "run", teamId: "team", sceneId: "scene", evaluationPurpose: "pilot",
      notificationPending: true, notificationIntent: { kind: "result", episodesRun: 1, episodesSucceeded: 0 } });
    mocks.team.mockResolvedValueOnce({ enqueued: false, reason: "contact_missing" });
    await reconcileAgentRunNotifications();
    expect(state.docs.get("evaluationRuns/run")?.notificationPending).toBe(true);
    await reconcileAgentRunNotifications();
    expect(state.docs.get("evaluationRuns/run")?.notificationPending).toBe(false);
    expect(mocks.site.mock.calls[0]).toEqual(mocks.site.mock.calls[1]);
    await reconcileAgentRunNotifications(); expect(mocks.team).toHaveBeenCalledTimes(2);
  });
  it("never sends a historical private outcome to the site", async () => {
    state.docs.set("evaluationRuns/run", { runId: "run", teamId: "team", sceneId: "scene", evaluationPurpose: "private",
      notificationPending: true, notificationIntent: { kind: "no_result" } });
    await reconcileAgentRunNotifications();
    expect(mocks.site).not.toHaveBeenCalled(); expect(mocks.team).toHaveBeenCalledTimes(1);
  });
});
