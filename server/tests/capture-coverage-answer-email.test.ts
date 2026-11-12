// @vitest-environment node
/**
 * The site's answer email rides on the coverage review: once the walkthrough's
 * estimates are stored, a settled answer queues exactly one `answer_ready`
 * notice, a video that did not show the job clearly queues none (the job page
 * already asks for one line), and nothing about the email can fail the review.
 * OFFLINE: the real composer and outbox against the fake Firestore; no email is sent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const source = vi.hoisted(() => ({
  pending: { schema_version: "website_browser_pending.v1", request_id: "r1", scene_id: "site-r1",
    capture_id: "walkthrough-r1", state: "published", completed_at_iso: "2026-10-07T00:00:00.000Z",
    video: { object_name: "scenes/site-r1/captures/walkthrough-r1/raw/walkthrough.mp4",
      generation: "90071992547409931", size_bytes: 7, crc32c: "AAAAAA==" },
    manifest: { generation: "90071992547409932" } },
  brief: { requestId: "r1", summary: "Move totes from the rack to the cart", proposed: [], confirmedAtIso: null },
  agent: vi.fn(), composerFails: false,
}));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } },
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  storageAdmin: { bucket: () => ({ file: () => ({ getSignedUrl: async () => ["https://synthetic.invalid/video"] }) }) },
}));
vi.mock("../config/env", async importOriginal => ({ ...await importOriginal<typeof import("../config/env")>(),
  isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/siteTaskBrief", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/siteTaskBrief")>(),
  getBrief: async () => source.brief, nameUnnamedTask: vi.fn(async () => null),
}));
vi.mock("../utils/websiteBrowserPending", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/websiteBrowserPending")>(),
  loadBrowserPending: async () => source.pending,
}));
vi.mock("../agents/runtime", () => ({ runAgentTask: source.agent }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (value: string) => value }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const send = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail: send }));
vi.mock("../utils/siteAnswer", async importOriginal => {
  const actual = await importOriginal<typeof import("../utils/siteAnswer")>();
  return { ...actual, loadSiteAnswer: async (...args: Parameters<typeof actual.loadSiteAnswer>) => {
    if (source.composerFails) throw new Error("composer_unavailable");
    return actual.loadSiteAnswer(...args);
  } };
});

import { reviewCaptureCoverage } from "../utils/captureCoverageReview";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { browserPendingDecisionKey } from "../utils/websiteBrowserPending";
import { humanDecisionDigest } from "../utils/human-reply-admission";

const ESTIMATES = { object: "tote", object_largest_side_m: 0.6, object_mass_kg_low: 2, object_mass_kg_high: 6, object_surface: "matte",
  pick_to_place_m: 1.1, pick_height_m: 0.9, place_height_m: 0.7, front_clearance_m: 1.2, other_items_likely: [],
  cycle_seconds: 30, basis: "Sized against the rack." };
const UNSIZED = { object: null, object_largest_side_m: null, object_mass_kg_low: null, object_mass_kg_high: null, object_surface: null,
  pick_to_place_m: null, pick_height_m: null, place_height_m: null, front_clearance_m: null, other_items_likely: [],
  cycle_seconds: null, basis: "The job was not in view." };
const output = (jobEstimates: unknown) => ({ covers_scene: true,
  views: [{ id: "work-area", status: "seen", timestamp_seconds: 4, note: "" }], missing_views: [], supplement_would_finish: false,
  unreadable_reasons: [], confidence: 0.9, job_estimates: jobEstimates });
const params = () => ({ requestId: "r1", sceneId: "site-r1", captureId: "walkthrough-r1",
  binding: { source: { kind: "browser_pending", key: browserPendingDecisionKey(source.pending as never) },
    brief_digest: humanDecisionDigest(source.brief), capture_id: "walkthrough-r1" } });
const outboxRows = () => [...sharedFakeFirestoreState.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"));

beforeEach(() => {
  source.agent.mockReset();
  source.composerFails = false;
  send.mockReset();
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set("siteTaskBriefs/r1", source.brief);
  sharedFakeFirestoreState.docs.set("inboundRequests/r1", {
    contact: { email: "site@synthetic.invalid" },
    request: { buyerType: "site_operator", consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION,
      recorded_at_iso: "2026-10-07T00:00:00Z" } },
    capture_privacy_source_bound_decision: { proceeded: true, capture_id: "walkthrough-r1", producer_source: params().binding.source },
  });
});

describe("the answer email after the coverage review", () => {
  // Rewritten in round 7 (owner, 2026-11-11): the first message is the upload receipt, and the one answer email is
  // the test result, or the paper check when no test can run. A ready paper check is never emailed on its own.
  it("queues no answer email for a ready paper check, on the first review or a second", async () => {
    source.agent.mockResolvedValue({ status: "completed", output: output(ESTIMATES) });
    await reviewCaptureCoverage(params());
    await reviewCaptureCoverage(params());
    expect(outboxRows().map(([key]) => key)).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  // Rewritten (review, 2026-11-11): an unsized video is an ending with no test, so the review that records it queues
  // the one answer email saying why; before, it queued none.
  it("queues the one answer email when the video did not show the job clearly enough to size it", async () => {
    source.agent.mockResolvedValue({ status: "completed", output: output(UNSIZED) });
    await reviewCaptureCoverage(params());
    expect(sharedFakeFirestoreState.docs.get("inboundRequests/r1")?.capture_coverage).toBeDefined();
    expect(outboxRows()).toHaveLength(1);
    expect(outboxRows()[0][1]).toMatchObject({ kind: "answer_ready" });
    expect(String((outboxRows()[0][1] as { body?: unknown }).body)).toContain("The video did not show the job clearly enough for us to size it.");
  });

  it("never fails the review when the answer cannot be composed", async () => {
    source.composerFails = true;
    source.agent.mockResolvedValue({ status: "completed", output: output(ESTIMATES) });
    await expect(reviewCaptureCoverage(params())).resolves.toMatchObject({ coversScene: true });
    expect((sharedFakeFirestoreState.docs.get("inboundRequests/r1") as Record<string, any>).walkthrough_job_estimates)
      .toMatchObject({ job_estimates: ESTIMATES });
    expect(outboxRows()).toHaveLength(0);
  });
});

// Reference job, 2026-11-11: a read refused because another call for the same capture holds the one-at-a-time budget
// is a wait, not a failed read; the queue is told so it does not spend an attempt on it.
describe("a read that meets another call in flight for the same capture", () => {
  it("tells the queue it waited, and stores nothing", async () => {
    source.agent.mockRejectedValue(new Error("gemini_video_failed: coverage_budget_call_in_flight"));
    const onWaiting = vi.fn();
    await expect(reviewCaptureCoverage({ ...params(), onWaiting })).resolves.toBeNull();
    expect(onWaiting).toHaveBeenCalledWith("coverage_budget_call_in_flight");
    expect(sharedFakeFirestoreState.docs.get("inboundRequests/r1")).not.toHaveProperty("capture_coverage");
  });

  it("does not call a real model failure a wait", async () => {
    source.agent.mockRejectedValue(new Error("gemini_video_failed: provider_timeout"));
    const onWaiting = vi.fn();
    await expect(reviewCaptureCoverage({ ...params(), onWaiting })).resolves.toBeNull();
    expect(onWaiting).not.toHaveBeenCalled();
  });
});
