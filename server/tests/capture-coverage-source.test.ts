// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const source = vi.hoisted(() => ({
  pending: { schema_version: "website_browser_pending.v1", request_id: "r1", scene_id: "site-r1",
    capture_id: "walkthrough-r1", state: "published", completed_at_iso: "2026-10-07T00:00:00.000Z",
    video: { object_name: "scenes/site-r1/captures/walkthrough-r1/raw/walkthrough.mp4",
      generation: "90071992547409931", size_bytes: 7, crc32c: "AAAAAA==" },
    manifest: { generation: "90071992547409932" } },
  brief: { summary: "Slide the racks", proposed: [], confirmedAtIso: null },
  bucket: vi.fn(), file: vi.fn(), signedUrl: vi.fn(), agent: vi.fn(),
}));
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } },
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  storageAdmin: { bucket: source.bucket },
}));
vi.mock("../config/env", () => ({ isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/siteTaskBrief", async importOriginal => ({
  isPlaceholderSummary: (await importOriginal<typeof import("../utils/siteTaskBrief")>()).isPlaceholderSummary,
  getBrief: async () => source.brief, nameUnnamedTask: vi.fn(async () => null),
}));
vi.mock("../utils/websiteBrowserPending", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/websiteBrowserPending")>(),
  loadBrowserPending: async () => source.pending,
}));
vi.mock("../agents/runtime", () => ({ runAgentTask: source.agent }));
vi.mock("../utils/taskUpdateCommitment", () => ({ commitTaskUpdate: vi.fn() }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (value: string) => value }));

import { reviewCaptureCoverage } from "../utils/captureCoverageReview";
import { commitTaskUpdate } from "../utils/taskUpdateCommitment";
import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { browserPendingDecisionKey } from "../utils/websiteBrowserPending";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { getTaskDefinition } from "../agents/tasks";

beforeEach(() => {
  vi.stubEnv("BLUEPRINT_CAPTURE_BUCKET", "");
  vi.stubEnv("FIREBASE_STORAGE_BUCKET", "");
  source.bucket.mockReset().mockImplementation((name: string) => {
    if (!name) throw new Error("Bucket name not specified");
    return { file: source.file };
  });
  source.file.mockReset().mockReturnValue({ getSignedUrl: source.signedUrl });
  source.signedUrl.mockReset().mockResolvedValue(["https://synthetic.invalid/generation-bound-video"]);
  source.agent.mockReset().mockResolvedValue(null);
  vi.mocked(commitTaskUpdate).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

function params(key = browserPendingDecisionKey(source.pending as never)) {
  return { requestId: "r1", sceneId: "site-r1", captureId: "walkthrough-r1",
    binding: { source: { kind: "browser_pending", key }, brief_digest: humanDecisionDigest(source.brief), capture_id: "walkthrough-r1" } };
}

describe("coverage reads the selected browser upload", () => {
  it("sends replayable task data while the registry restores executable validation", async () => {
    let replay: any;
    source.agent.mockImplementationOnce(async task => { replay = structuredClone(task); return null; });
    expect(await reviewCaptureCoverage(params())).toBeNull();
    expect(replay).toBeDefined();
    expect(replay.kind).toBe("capture_coverage");
    expect(replay.session_key).toBe("capture_coverage:walkthrough-r1");
    expect(replay.metadata).toEqual({ capture_id: "walkthrough-r1", review_id: null, coverage_claim_token: null });
    expect(replay.input).toEqual({ videoUrl: "https://synthetic.invalid/generation-bound-video", supplementaryViewsOnly: false,
      taskSummary: "Slide the racks", requestedViews: [{ id: "work-area", label: "The whole work area, from a few steps back" }] });
    expect(Object.keys(replay).sort()).toEqual(["input", "kind", "metadata", "session_key"]);
    const definition = getTaskDefinition(replay.kind);
    expect(definition.default_provider).toBe("gemini_video");
    expect(definition.build_prompt(replay.input)).toContain("Slide the racks");
    expect(() => definition.output_schema.parse({ covers_scene: true })).toThrow();
  });
  it.each([
    ["", "", "blueprint-8c1ca.appspot.com"],
    ["", "existing-firebase-bucket", "existing-firebase-bucket"],
    ["existing-capture-bucket", "existing-firebase-bucket", "existing-capture-bucket"],
  ])("uses the supported bucket resolution without credential changes (%s, %s)", async (capture, firebase, expected) => {
    vi.stubEnv("BLUEPRINT_CAPTURE_BUCKET", capture);
    vi.stubEnv("FIREBASE_STORAGE_BUCKET", firebase);
    expect(await reviewCaptureCoverage(params())).toBeNull();
    expect(source.bucket).toHaveBeenCalledWith(expected);
    expect(source.file).toHaveBeenCalledWith(source.pending.video.object_name, { generation: source.pending.video.generation });
    expect(source.signedUrl).toHaveBeenCalledWith(expect.objectContaining({ action: "read",
      queryParams: { generation: source.pending.video.generation } }));
    expect(source.agent).toHaveBeenCalledTimes(1);
    expect(source.brief.confirmedAtIso).toBeNull();
  });
  it("refuses a changed source before signing or starting another review", async () => {
    await reviewCaptureCoverage(params("sha256:stale-source"));
    expect(source.signedUrl).not.toHaveBeenCalled();
    expect(source.agent).not.toHaveBeenCalled();
  });
});

describe("the walkthrough's job estimates ride on its coverage review", () => {
  const ESTIMATES = { object: "tote", object_largest_side_m: 0.6, object_mass_kg_low: 2, object_mass_kg_high: 6, object_surface: "matte",
    pick_to_place_m: 1.1, pick_height_m: 0.9, place_height_m: 0.7, front_clearance_m: 1.2, other_items_likely: ["smaller totes"],
    cycle_seconds: 30, basis: "Sized against the rack." };
  const output = (extra: Record<string, unknown> = {}) => ({ covers_scene: true,
    views: [{ id: "work-area", status: "seen", timestamp_seconds: 4, note: "" }], missing_views: [], supplement_would_finish: false,
    unreadable_reasons: [], confidence: 0.9, job_estimates: ESTIMATES, ...extra });

  beforeEach(() => {
    sharedFakeFirestoreState.docs.clear();
    const { binding } = params();
    sharedFakeFirestoreState.docs.set("siteTaskBriefs/r1", source.brief);
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", {
      request: { consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-07T00:00:00Z" } },
      capture_privacy_source_bound_decision: { proceeded: true, capture_id: "walkthrough-r1", producer_source: binding.source },
    });
  });

  it("keeps them on the job beside the finding, replaced whole on the next reading", async () => {
    source.agent.mockResolvedValueOnce({ status: "completed", output: output() });
    expect(await reviewCaptureCoverage(params())).toMatchObject({ coversScene: true });
    const stored = sharedFakeFirestoreState.docs.get("inboundRequests/r1") as Record<string, any>;
    expect(stored.capture_coverage).toMatchObject({ capture_id: "walkthrough-r1", covers_scene: true });
    expect(stored.walkthrough_job_estimates).toMatchObject({ capture_id: "walkthrough-r1", job_estimates: ESTIMATES });
    source.agent.mockResolvedValueOnce({ status: "completed", output: output({ job_estimates: { ...ESTIMATES, other_items_likely: [] } }) });
    await reviewCaptureCoverage(params());
    expect((sharedFakeFirestoreState.docs.get("inboundRequests/r1") as Record<string, any>).walkthrough_job_estimates.job_estimates
      .other_items_likely).toEqual([]);
  });

  it.each([false, true])("keeps a useful shortfall internal even with legacy notifyOwner=%s", async notifyOwner => {
    const record = sharedFakeFirestoreState.docs.get("inboundRequests/r1")!;
    sharedFakeFirestoreState.docs.set("inboundRequests/r1", { ...record, contact: { email: "site@synthetic.invalid" } });
    source.agent.mockResolvedValueOnce({ status: "completed", output: output({ covers_scene: false,
      missing_views: ["The destination"], views: [] }) });
    expect(await reviewCaptureCoverage({ ...params(), notifyOwner })).toMatchObject({ coversScene: false,
      missingCoverage: ["The destination"] });
    expect(sharedFakeFirestoreState.docs.get("inboundRequests/r1")?.capture_coverage).toMatchObject({
      covers_scene: false, missing_coverage: ["The destination"] });
    expect(commitTaskUpdate).not.toHaveBeenCalled();
  });

  it("keeps none from a clip it could not read, while the finding still lands", async () => {
    source.agent.mockResolvedValueOnce({ status: "completed", output: output({ covers_scene: false, unreadable_reasons: ["Too dark"] }) });
    await reviewCaptureCoverage(params());
    const stored = sharedFakeFirestoreState.docs.get("inboundRequests/r1") as Record<string, any>;
    expect(stored.capture_coverage).toMatchObject({ covers_scene: false });
    expect(stored).not.toHaveProperty("walkthrough_job_estimates");
  });
});
