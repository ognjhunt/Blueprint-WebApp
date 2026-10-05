// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } }, storageAdmin: null,
}));
import { recordCoverageFinding } from "../utils/captureCoverageReview";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
const source = { kind: "app_bundle_completion", key: "immutable-source" };
const brief = { revision: 1 };
const binding = { source, capture_id: "capture", brief_digest: humanDecisionDigest(brief) };
const finding = { coversScene: true, missingCoverage: [], supplementWouldFinish: false, unreadableReasons: [], confidence: 0.9 };
beforeEach(() => {
  state.docs.clear();
  state.docs.set("inboundRequests/request", { request: { consent_attestation: {
    granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-01T00:00:00Z",
  } }, capture_privacy_source_bound_decision: { capture_id: "capture", producer_source: source, proceeded: true } });
  state.docs.set("siteTaskBriefs/request", brief);
});
it("publishes a finding for its current consent, source and brief", async () => {
  await recordCoverageFinding("request", "capture", finding, binding);
  expect(state.docs.get("inboundRequests/request")?.capture_coverage.covers_scene).toBe(true);
});
it("does not publish when recording permission was withdrawn during the review", async () => {
  state.docs.get("inboundRequests/request")!.request.consent_attestation.granted = false;
  await expect(recordCoverageFinding("request", "capture", finding, binding)).rejects.toThrow("recording_consent_required");
  expect(state.docs.get("inboundRequests/request")?.capture_coverage).toBeUndefined();
});
it("does not publish an old source or brief after a supplement or clarification", async () => {
  state.docs.set("siteTaskBriefs/request", { revision: 2 });
  await expect(recordCoverageFinding("request", "capture", finding, binding)).rejects.toThrow("coverage_source_changed");
  expect(state.docs.get("inboundRequests/request")?.capture_coverage).toBeUndefined();
});
