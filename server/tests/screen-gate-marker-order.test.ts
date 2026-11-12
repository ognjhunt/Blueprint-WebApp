// @vitest-environment node
/**
 * The screen-gate cutover marker (owner decision 2026-11-11) must exist before
 * anything the Pipeline can act on: the completion marker in storage is what
 * starts its work, and a grant request in the gap would be refused as unscreened.
 */
import { beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

const seen = vi.hoisted(() => ({ markerAtDelivery: undefined as unknown, failPublish: false }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } },
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  storageAdmin: { bucket: () => ({ name: "fixture-bucket" }) },
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/captureUploadAuthorization", () => ({ authorizeCaptureUpload: vi.fn(async () => ({ allowed: true })) }));
vi.mock("../utils/websiteTaskContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/websiteTaskContext")>()),
  loadWebsiteCaptureRights: vi.fn(async () => ({ derived_scene_generation_allowed: true })),
}));
vi.mock("../utils/captureCoverageQueue", () => ({ enqueueCoverageReview: vi.fn(async () => undefined) }));
vi.mock("../utils/websiteBrowserUploadStatus", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/websiteBrowserUploadStatus")>()),
  verifiedPendingManifest: vi.fn(async () => "{}"), originalManifestConsent: vi.fn(() => true),
}));
vi.mock("../utils/websiteCaptureDelivery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/websiteCaptureDelivery")>()),
  publishBrowserDelivery: vi.fn(async () => {
    const { sharedFakeFirestoreState } = await import("./helpers/fake-firestore");
    seen.markerAtDelivery = sharedFakeFirestoreState.docs.get("inboundRequests/order-1")?.scene_screen_gate_ended;
  }),
}));
vi.mock("../utils/websiteBrowserPending", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/websiteBrowserPending")>();
  return { ...actual, publishBrowserPending: vi.fn(async (pending: any) => {
    if (seen.failPublish) throw new Error("capture_update_superseded");
    return actual.publishBrowserPending(pending);
  }) };
});

import { writeCompletionMarker } from "../utils/browserCaptureProcessing";
import { browserPendingDecisionKey, type BrowserPending } from "../utils/websiteBrowserPending";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";

const pending: BrowserPending = { schema_version: "website_browser_pending.v1", request_id: "order-1", scene_id: "site-order-1",
  capture_id: "walkthrough-order-1", state: "held", completed_at_iso: "2026-11-12T00:00:00.000Z",
  video: { object_name: "scenes/site-order-1/captures/walkthrough-order-1/raw/walkthrough.mp4", generation: "11", size_bytes: 7, crc32c: "AAAAAA==" },
  manifest: { object_name: "scenes/site-order-1/captures/walkthrough-order-1/raw/manifest.json", generation: "12", size_bytes: 500, crc32c: "AAAAAA==", sha256: `sha256:${"a".repeat(64)}` } };

beforeEach(() => {
  seen.markerAtDelivery = undefined; seen.failPublish = false; state.docs.clear();
  state.docs.set("inboundRequests/order-1", { requestId: "order-1", request: { buyerType: "site_operator", capture_mode: "self_capture", taskDescription: "Move a bin",
    consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-11-10T00:00:00Z" } },
    capture_privacy_source_bound_decision: { capture_id: pending.capture_id, proceeded: true, eligibility: "unscreened",
      producer_source: { kind: "browser_pending", key: browserPendingDecisionKey(pending) } } });
  state.docs.set(`captureUploadSessions/${pending.capture_id}`, { browser_pending_delivery: pending });
});

it("writes the marker before the Pipeline can see the video", async () => {
  await writeCompletionMarker(pending);
  expect(seen.markerAtDelivery).toMatchObject({ schema_version: "scene_screen_gate_ended.v1", capture_id: pending.capture_id });
});

it("keeps the marker when publication then fails for good", async () => {
  seen.failPublish = true;
  await expect(writeCompletionMarker(pending)).rejects.toThrow("capture_update_superseded");
  expect(state.docs.get("inboundRequests/order-1")?.scene_screen_gate_ended).toMatchObject({ capture_id: pending.capture_id });
});

it("does not mark an old job whose newer capture is active", async () => {
  state.docs.get("inboundRequests/order-1")!.active_capture_id = `supplement-${"f".repeat(40)}`;
  await expect(writeCompletionMarker(pending)).rejects.toThrow();
  expect(state.docs.get("inboundRequests/order-1")).not.toHaveProperty("scene_screen_gate_ended");
});
