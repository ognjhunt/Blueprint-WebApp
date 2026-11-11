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
  it("queues exactly one answer_ready for a ready answer, and none on a second review", async () => {
    source.agent.mockResolvedValue({ status: "completed", output: output(ESTIMATES) });
    await reviewCaptureCoverage(params());
    await reviewCaptureCoverage(params());
    const rows = outboxRows();
    expect(rows.map(([key]) => key)).toEqual(["captureOutbox/r1:answer_ready"]);
    const row = rows[0][1] as Record<string, string>;
    expect(row).toMatchObject({ kind: "answer_ready", to: "site@synthetic.invalid", subject: "Your Blueprint answer is ready" });
    expect(row.body).toMatch(/^(Most likely to fit: |No robot clearly fits yet\. |None of the )/);
    expect(row.body).toMatch(/How sure we are: (Good|Fair|Low)\./);
    expect(row.body).toMatch(/\/capture-upload\//);
    expect(send).not.toHaveBeenCalled();
  });

  it("queues none when the video did not show the job clearly enough to size it", async () => {
    source.agent.mockResolvedValue({ status: "completed", output: output(UNSIZED) });
    await reviewCaptureCoverage(params());
    expect(sharedFakeFirestoreState.docs.get("inboundRequests/r1")?.capture_coverage).toBeDefined();
    expect(outboxRows()).toHaveLength(0);
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
