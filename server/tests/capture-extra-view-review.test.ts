// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
const seams = vi.hoisted(() => ({ review: vi.fn(), brief: vi.fn(), merge: vi.fn(), headroom: vi.fn(), footage: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../config/env", () => ({ isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/captureCoverageReview", () => ({ reviewCaptureCoverage: seams.review }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: seams.brief }));
vi.mock("../utils/siteTaskBriefReading", () => ({ mergeFootageIntoBrief: seams.merge }));
vi.mock("../utils/betaAbuseCaps", () => ({ modelReviewHeadroom: seams.headroom }));
vi.mock("../utils/captureFootageReview", () => ({ findPriorFootageReview: seams.footage }));
vi.mock("../utils/captureUploadAuthorization", () => ({ authorizeCaptureUpload: async () => ({ allowed: true }) }));
import { enqueueCoverageReview, reconcileCoverageReviews } from "../utils/captureCoverageQueue";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
const params = { requestId: "extra-view", sceneId: "site-extra-view", captureId: `supplement-${"e".repeat(40)}` };
const path = `inboundRequests/${params.requestId}`;
const record = () => ({ request: { consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION,
  recorded_at_iso: "2026-10-28T00:00:00.000Z" } }, active_capture_id: params.captureId, active_recording_scope: "additional_views",
  capture_privacy_source_bound_decision: { capture_id: params.captureId, proceeded: true, producer_source: { key: "retained-source" } } });
beforeEach(() => {
  state.docs.clear(); Object.values(seams).forEach(fn => fn.mockReset());
  state.docs.set(path, record());
  state.docs.set(`captureSupplements/${params.captureId}`, { ...params, recording_scope: "additional_views",
    supplement: { recording_scope: "additional_views" } });
});
it("does not queue a duplicate whole-job coverage review of an optional extra clip", async () => {
  await enqueueCoverageReview(params);
  expect(state.docs.get(path)).not.toHaveProperty("capture_coverage_pending");
  expect(seams.review).not.toHaveBeenCalled();
});
it("retires only the obsolete fragment work flag and retains the original findings, attempts and costs", async () => {
  const prior = { ...record(), capture_coverage_pending: true, capture_coverage_request: params,
    capture_coverage: { capture_id: "walkthrough-extra-view", missing_coverage: ["retained observation"] },
    capture_coverage_legacy_budget: { attempts: 2, source_key: "retained-source" } };
  state.docs.set(path, prior);
  const receipt = { attempts: 2, actual_cost_usd: .5, reservations: ["original-paid-review"] };
  state.docs.set("captureCoverageReviews/retained", receipt);
  await reconcileCoverageReviews();
  expect(state.docs.get(path)).toEqual({ ...prior, capture_coverage_pending: false });
  expect(state.docs.get("captureCoverageReviews/retained")).toEqual(receipt);
  for (const fn of Object.values(seams)) expect(fn).not.toHaveBeenCalled();
});
it("keeps the existing full-walkthrough coverage path available", async () => {
  state.docs.set(`captureSupplements/${params.captureId}`, { ...params, recording_scope: "complete_walkthrough", supplement: {} });
  await enqueueCoverageReview(params);
  expect(state.docs.get(path)).toMatchObject({ capture_coverage_pending: true, capture_coverage_request: params });
});
it("still requires current recording permission before handling an extra clip", async () => {
  const raw = record(); raw.request.consent_attestation.granted = false; state.docs.set(path, raw);
  await expect(enqueueCoverageReview(params)).rejects.toThrow("capture_review_current_clearance_required");
});
