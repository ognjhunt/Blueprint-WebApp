// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state, sharedFakeFirestore as db } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } } }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../agents/ops-action-logs", () => ({ recordOpsActionLog: vi.fn() }));
vi.mock("../config/env", () => ({ isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/captureUploadAuthorization", () => ({ authorizeCaptureUpload: async () => ({ allowed: true }) }));
const review = vi.hoisted(() => vi.fn());
vi.mock("../utils/captureCoverageReview", () => ({ reviewCaptureCoverage: review }));
vi.mock("../utils/captureFootageReview", () => ({ findPriorFootageReview: async () => ({ state: "none" }) }));
vi.mock("../utils/siteTaskBriefReading", () => ({ mergeFootageIntoBrief: vi.fn() }));
vi.mock("../utils/siteTaskBrief", async () => ({ getBrief: async (id: string) =>
  (await import("./helpers/fake-firestore")).sharedFakeFirestoreState.docs.get(`siteTaskBriefs/${id}`) || null }));

import { humanDecisionDigest } from "../utils/human-reply-admission";
import { recordHumanReplyEvent, claimHumanReplyResume, reconcileHumanReplyResumes } from "../utils/human-reply-store";
import { recordCohortCostReceipt, getCohort, cohortContribution, type CohortCostReceipt } from "../utils/cohortEconomics";
import { enqueueCoverageReview, reconcileCoverageReviews } from "../utils/captureCoverageQueue";
import { issueCaptureSupplement, validateCaptureSupplement } from "../utils/captureSupplement";
import { verifyCaptureUploadToken } from "../utils/captureUploadToken";
import { readSiteClarification, submitSiteClarification } from "../utils/siteTaskClarifications";

beforeEach(() => { state.docs.clear(); review.mockReset(); });
const put = (path: string, value: any) => state.docs.set(path, value);
const read = (path: string): any => state.docs.get(path);

function thread() {
  const now = Date.now();
  put("action_ledger/action", { status: "pending_approval", action_type: "send_email", action_payload: { subject: "Bound scope" } });
  put("humanBlockerThreads/blocker", { id: "blocker", blocker_id: "blocker", approved_identity: "owner@example.com",
    status: "awaiting_reply", correlation: {}, decision_expires_at: new Date(now + 3600000).toISOString(),
    decision_issued_at: new Date(now - 3600000).toISOString(), last_human_reply_event_id: null,
    record_of_truth: { ops_work_item_id: "action" }, resume_action: { kind: "manual_followup" },
    action_digest: humanDecisionDigest({ type: "send_email", payload: { subject: "Bound scope" } }) });
}
function event(id: string, age = 0, approve = true): any {
  return { blocker_id: "blocker", channel: "email", external_message_id: id, external_thread_id: "thread",
    sender: "owner@example.com", body: approve ? "Approved" : "No", received_at: new Date(Date.now() - age).toISOString(),
    classification: approve ? "approval" : "rejection", should_resume_now: approve };
}
describe("durable human decisions", () => {
  it("allows one concurrent claim and preserves duplicate replies", async () => {
    thread(); const input = event("one"); const first = await recordHumanReplyEvent(input);
    expect((await recordHumanReplyEvent(input)).id).toBe(first.id);
    const claims = await Promise.all([claimHumanReplyResume(first.id), claimHumanReplyResume(first.id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    await expect(recordHumanReplyEvent({ ...input, body: "No" })).rejects.toThrow("reply_event_conflict");
  });
  it("rejects the wrong sender before creating an executable event", async () => {
    thread(); await expect(recordHumanReplyEvent({ ...event("spoof"), sender: "other@example.com" })).rejects.toThrow("wrong_principal");
    expect(read("humanReplyEvents/email:spoof")).toBeUndefined();
  });
  it("does not let a delayed approval supersede a rejection", async () => {
    thread(); await recordHumanReplyEvent(event("no", 0, false));
    const old = await recordHumanReplyEvent(event("old", 10000));
    expect(await claimHumanReplyResume(old.id)).toBeNull();
    expect(read("humanBlockerThreads/blocker").last_human_reply_event_id).toBe("email:no");
  });
  it.each([true, false])("lets a simultaneous refusal dominate regardless of arrival order (%s)", async approvalFirst => {
    thread(); const approval = event("tie-yes"), refusal = { ...event("tie-no", 0, false), received_at: approval.received_at };
    for (const input of approvalFirst ? [approval, refusal] : [refusal, approval]) await recordHumanReplyEvent(input);
    expect(read("humanBlockerThreads/blocker").last_human_reply_event_id).toBe("email:tie-no");
    expect(await claimHumanReplyResume("email:tie-yes")).toBeNull();
  });
  it("rejects a changed action and replays only a provably unclaimed action", async () => {
    thread(); const row = await recordHumanReplyEvent(event("yes"));
    await claimHumanReplyResume(row.id);
    read(`humanReplyEvents/${row.id}`).resume_started_at = Date.now() - 600000;
    await reconcileHumanReplyResumes();
    expect(read(`humanReplyEvents/${row.id}`).resume_state).toBe("pending");
    read("action_ledger/action").action_payload.subject = "Different action";
    expect(await claimHumanReplyResume(row.id)).toBeNull();
  });
  it.each(["executing", "sent"])("reconciles a lost %s acknowledgement without executing again", async status => {
    thread(); const row = await recordHumanReplyEvent(event("yes")); await claimHumanReplyResume(row.id);
    read(`humanReplyEvents/${row.id}`).resume_started_at = Date.now() - 600000;
    read("action_ledger/action").status = status;
    await reconcileHumanReplyResumes();
    expect(read(`humanReplyEvents/${row.id}`).resume_state).toBe(status === "sent" ? "completed" : "unknown");
  });
});

describe("cost receipts", () => {
  const base: CohortCostReceipt = { receiptId: "prep", sceneId: "scene", sourceDigest: `sha256:${"a".repeat(64)}`,
    sourceUri: "gs://receipt", allocation: "shared_preparation", allocationId: "configuration", currency: "USD", status: "unknown", amountUsd: null };
  it("keeps unknown costs unknown and settles one shared allocation once", async () => {
    await recordCohortCostReceipt(base); await recordCohortCostReceipt(base);
    const unknown = (await getCohort("scene"))!;
    expect(unknown.unknownCostReceipts).toBe(1);
    expect(cohortContribution({ cohort: unknown, screeningEpisodeCostUsd: 1, finalistEpisodeCostUsd: 1 }).contributionUsd).toBeNull();
    const settled = { ...base, receiptId: "invoice", sourceDigest: `sha256:${"b".repeat(64)}`, status: "settled" as const, amountUsd: 12, supersedesReceiptId: "prep" };
    await recordCohortCostReceipt(settled); await recordCohortCostReceipt(settled);
    expect(await getCohort("scene")).toMatchObject({ siteCostUsd: 12, unknownCostReceipts: 0 });
    await expect(recordCohortCostReceipt({ ...settled, receiptId: "duplicate" })).rejects.toThrow("cohort_cost_allocation_conflict");
  });
  it("does not add policy cost to shared preparation", async () => {
    await recordCohortCostReceipt({ ...base, allocation: "incremental_policy", status: "settled", amountUsd: 3 });
    expect(await getCohort("scene")).toMatchObject({ siteCostUsd: 0, incrementalPolicyCostUsd: 3 });
  });
});

describe("coverage continuation", () => {
  const params = { requestId: "req", sceneId: "scene", captureId: "capture" };
  function privacy() { return { capture_id: "capture", proceeded: true, producer_source: { kind: "app_bundle_completion", key: "source" } }; }
  it("waits for a late brief, then completes only once", async () => {
    put("inboundRequests/req", { capture_privacy_source_bound_decision: privacy() });
    await enqueueCoverageReview(params); await reconcileCoverageReviews(); expect(review).not.toHaveBeenCalled();
    put("siteTaskBriefs/req", { summary: "Task" }); review.mockResolvedValue({ coversScene: true });
    await reconcileCoverageReviews(); await reconcileCoverageReviews();
    expect(review).toHaveBeenCalledTimes(1); expect(read("inboundRequests/req").capture_coverage_pending).toBe(false);
    await enqueueCoverageReview(params); await reconcileCoverageReviews(); await reconcileCoverageReviews();
    expect(review).toHaveBeenCalledTimes(1);
  });
  it("never clears a newer source after an old review returns", async () => {
    put("inboundRequests/req", { capture_privacy_source_bound_decision: privacy() }); put("siteTaskBriefs/req", { summary: "Task" });
    review.mockImplementation(async () => { read("inboundRequests/req").capture_privacy_source_bound_decision.producer_source.key = "changed"; return { coversScene: true }; });
    await enqueueCoverageReview(params); await reconcileCoverageReviews();
    expect(read("inboundRequests/req").capture_coverage_pending).toBe(true);
  });
});

describe("supplementary evidence and owner clarification", () => {
  it("reuses the child identity, preserves parent bytes, and keeps film-only scope and expiry", async () => {
    const parent = { requestId: "req", sceneId: "scene", captureId: "capture", scope: "film" as const, exp: Math.floor(Date.now() / 1000) + 1000 };
    const source = { site_capture_bundle: { request_id: "req", scene_id: "scene" }, immutable_upload_identity: {
      raw_bundle_digest: `sha256:${"a".repeat(64)}`, raw_manifest_uri: "gs://bucket/scenes/scene/captures/capture/raw/manifest.json" } };
    put("captureUploadSessions/capture", source); put("inboundRequests/req", { capture_coverage: { capture_id: "capture", covers_scene: false, missing_coverage: ["Side view"] } });
    const first = await issueCaptureSupplement(parent), second = await issueCaptureSupplement(parent);
    expect(first.captureId).toBe(second.captureId); expect(first.captureId).not.toBe(parent.captureId);
    const child = verifyCaptureUploadToken(first.token)!;
    expect(child.scope).toBe("film"); expect(child.exp).toBeLessThanOrEqual(parent.exp);
    await validateCaptureSupplement(child); expect(read("captureUploadSessions/capture")).toEqual(source);
    await expect(validateCaptureSupplement({ ...child, requestId: "other" })).rejects.toThrow("supplement_parent_changed");
    put(`captureUploadSessions/${child.captureId}`, { ...source, immutable_upload_identity: {
      raw_bundle_digest: `sha256:${"b".repeat(64)}`, raw_manifest_uri: `gs://bucket/scenes/scene/captures/${child.captureId}/raw/manifest.json` } });
    put("inboundRequests/req", { capture_coverage: { capture_id: child.captureId, covers_scene: false, missing_coverage: ["Top view"] } });
    const next = verifyCaptureUploadToken((await issueCaptureSupplement(parent)).token)!;
    expect(next.supplement?.parent_capture_id).toBe(child.captureId);
    await validateCaptureSupplement(next);
    put("inboundRequests/req", { capture_coverage: { capture_id: "unrelated", covers_scene: false, missing_coverage: ["Top view"] } });
    await expect(issueCaptureSupplement(parent)).rejects.toThrow("supplement_parent_mismatch");
  });
  it("retains a written explanation without clearing marginal gates and rejects a stale revision", async () => {
    put("siteTaskBriefs/req", { summary: "Pack cartons" }); put("inboundRequests/req", {
      site_task_brief_confirmed_at: "now", site_task_triage: { disposition: "needs_conversation", open_questions: ["Explain the layout changes"] } });
    const before = await readSiteClarification("req");
    const saved = await submitSiteClarification("req", before.revision, "The fixtures remain in place across shifts.");
    expect(await submitSiteClarification("req", before.revision, "The fixtures remain in place across shifts.")).toEqual(saved);
    expect(read("inboundRequests/req").site_task_triage.disposition).toBe("needs_conversation");
    read("siteTaskBriefs/req").summary = "Different task";
    await expect(submitSiteClarification("req", before.revision, "A different answer for old questions.")).rejects.toThrow("clarification_revision_changed");
  });
});
