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
  default: {}, dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  storageAdmin: { bucket: source.bucket },
}));
vi.mock("../config/env", () => ({ isSiteVideoEvidenceEnabled: () => true }));
vi.mock("../utils/siteTaskBrief", () => ({ getBrief: async () => source.brief }));
vi.mock("../utils/websiteBrowserPending", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/websiteBrowserPending")>(),
  loadBrowserPending: async () => source.pending,
}));
vi.mock("../agents/runtime", () => ({ runAgentTask: source.agent }));
vi.mock("../utils/taskUpdateCommitment", () => ({ commitTaskUpdate: vi.fn() }));

import { reviewCaptureCoverage } from "../utils/captureCoverageReview";
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
