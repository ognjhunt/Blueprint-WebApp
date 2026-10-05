// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (value: string) => value }));
vi.mock("../logger", () => ({ logger: { warn: vi.fn() } }));
const mocks = vi.hoisted(() => ({ brief: vi.fn(), coverage: vi.fn(), site: vi.fn(), team: vi.fn(), save: vi.fn() }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: async (id: string) => state.docs.get(`siteTaskBriefs/${id}`) || null, saveBrief: mocks.save, draftBrief: (value: unknown) => value }));
vi.mock("../utils/siteTaskBriefReading", () => ({ readBriefFromDescription: mocks.brief, mergeFootageIntoBrief: vi.fn() }));
vi.mock("../utils/captureFootageReview", () => ({ findPriorFootageReview: async () => ({ state: "none" }) }));
vi.mock("../utils/captureUploadAuthorization", () => ({ authorizeCaptureUpload: async () => ({ allowed: true }) }));
vi.mock("../utils/captureOutbox", () => ({ CAPTURE_OUTBOX_COLLECTION: "captureOutbox" }));
vi.mock("../utils/captureCoverageReview", () => ({ reviewCaptureCoverage: mocks.coverage }));
vi.mock("../config/env", () => ({ isSiteTaskBriefReadingEnabled: () => true, isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: mocks.site }));
vi.mock("../utils/robotTeamNotifications", () => ({ notifyTeamOfRunOutcome: mocks.team }));
import { reconcileCoverageReviews } from "../utils/captureCoverageQueue";
import { recoverCaptureReviews, queueCoverageReview } from "../utils/captureReviewRecovery";
import { reconcileAgentRunNotifications } from "../utils/agentRunNotificationRecovery";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
beforeEach(() => {
  state.docs.clear(); Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.brief.mockResolvedValue(true); mocks.coverage.mockResolvedValue({ coversScene: true });
  mocks.site.mockImplementation(async () => { state.docs.set("captureOutbox/scene:results_ready:run", {}); return { enqueued: true }; });
  mocks.team.mockImplementation(async () => { state.docs.set("captureOutbox/team:team:result:run", {}); return { enqueued: true }; });
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
  it("queues one source-bound coverage review and holds a withdrawn grant", async () => {
    state.docs.set("inboundRequests/request", { request: { consent_attestation: { granted: true,
      statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-01T00:00:00Z" } },
      capture_privacy_source_bound_decision: { capture_id: "capture", proceeded: true, producer_source: { key: "source-1" } } });
    state.docs.set("siteTaskBriefs/request", { summary: "Move boxes" });
    const input = { requestId: "request", sceneId: "scene", captureId: "capture" };
    await queueCoverageReview(input); await queueCoverageReview(input);
    await reconcileCoverageReviews();
    await queueCoverageReview(input); await reconcileCoverageReviews(); await reconcileCoverageReviews();
    expect(mocks.coverage).toHaveBeenCalledTimes(1);
    expect(mocks.coverage).toHaveBeenCalledWith(expect.objectContaining({ ...input, binding: expect.objectContaining({ source: { key: "source-1" } }) }));
    const record = state.docs.get("inboundRequests/request")!;
    record.capture_privacy_source_bound_decision.producer_source.key = "source-2";
    await queueCoverageReview(input);
    state.docs.get("inboundRequests/request")!.request.consent_attestation.granted = false;
    await reconcileCoverageReviews();
    expect(mocks.coverage).toHaveBeenCalledTimes(1);
    expect(state.docs.get("inboundRequests/request")?.capture_coverage_pending).toBe(true);
    await expect(queueCoverageReview(input)).rejects.toThrow("current_clearance_required");
  });
});
describe("result notification intent recovery", () => {
  it("keeps an intent pending until both audience outboxes accept it", async () => {
    state.docs.set("evaluationRuns/run", { runId: "run", teamId: "team", sceneId: "scene", evaluationPurpose: "pilot",
      result: { observed: { episodesRun: 1, episodesSucceeded: 0 } },
      notificationPending: true, notificationIntent: { kind: "result", episodesRun: 1, episodesSucceeded: 0 } });
    mocks.team.mockResolvedValueOnce({ enqueued: false, reason: "contact_missing" });
    await reconcileAgentRunNotifications();
    expect(state.docs.get("evaluationRuns/run")?.notificationPending).toBe(false);
    expect(state.docs.get("evaluationRuns/run")?.result_notification_pending).toBe(true);
    await reconcileAgentRunNotifications(); await reconcileAgentRunNotifications();
    expect(state.docs.get("evaluationRuns/run")?.result_notification_pending).toBe(false);
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
