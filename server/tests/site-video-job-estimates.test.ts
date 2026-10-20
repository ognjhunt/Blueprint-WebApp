// @vitest-environment node
/**
 * The video reader's job estimates, so a site is never asked to measure
 * (founder direction, 2026-10-20).
 *
 * What this pins:
 * - the estimates ride on the same reading that gates reconstruction, so a
 *   malformed estimate reads as null and never fails that reading;
 * - the summary keeps them, except off unusable footage;
 * - the site's own walkthrough reading is kept on the job, apart from the
 *   intake link's, and a failed write never blocks the review;
 * - the printable brief's link reads one job's brief and nothing else.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(() => { throw new Error("offline_only"); }) }));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
  };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { siteVideoEvidenceOutputSchema, siteVideoEvidenceTask } = await import("../agents/tasks/site-video-evidence");
const { summariseVideoEvidence } = await import("../utils/siteVideoEvidence");
const { recordWalkthroughEvidence } = await import("../utils/captureFootageReview");
const { createReadinessBriefToken, readinessBriefPathFor, verifyReadinessBriefToken } = await import("../utils/readinessBriefToken");
const { createCaptureUploadToken, verifyCaptureUploadToken } = await import("../utils/captureUploadToken");
const { createRequestReviewToken, verifyRequestReviewToken } = await import("../utils/request-review-auth");

const ESTIMATES = {
  object: "sealed carton", object_largest_side_m: 0.45, object_mass_kg_low: 3, object_mass_kg_high: 5, object_surface: "matte",
  pick_to_place_m: 0.9, pick_height_m: 0.8, place_height_m: 0.15, front_clearance_m: 1.3,
  other_items_likely: ["smaller cartons"], cycle_seconds: 40, basis: "Sized against a standard pallet.",
};

function output(extra: Record<string, unknown> = {}, footage = "usable") {
  return {
    footage_status: footage, footage_status_reason: footage === "usable" ? null : "Too dark.", summary: "Cartons move onto a pallet.",
    observations: [], cycle_measurement: { cycles: [], median_cycle_seconds: null, implied_band: null, note: "" },
    people_present: { max_visible_at_once: 0, relationship_to_work: "none_visible", note: "" },
    not_evidenced: [], privacy_flag: false, ...extra,
  };
}

describe("the reader's job estimates", () => {
  it("keeps estimates that fit the schema", () => {
    expect(siteVideoEvidenceOutputSchema.parse(output({ job_estimates: ESTIMATES })).job_estimates).toEqual(ESTIMATES);
  });

  it("reads a malformed estimate as null instead of failing the reading that gates reconstruction", () => {
    const parsed = siteVideoEvidenceOutputSchema.parse(output({ job_estimates: { ...ESTIMATES, object_largest_side_m: -2,
      object_mass_kg_high: "heavy", object_surface: "glittery", pick_to_place_m: 120, cycle_seconds: 0, object: "",
      other_items_likely: ["trays", 7, " lids ", "", "bags", "boxes", "bins", "extra"], unexpected_key: true } }));
    expect(parsed.job_estimates).toEqual({ ...ESTIMATES, object_largest_side_m: null, object_mass_kg_high: null, object_surface: null,
      pick_to_place_m: null, cycle_seconds: null, object: null, other_items_likely: ["trays", "lids", "bags", "boxes", "bins"] });
    for (const broken of ["about a metre", 42, ["a"], null]) {
      expect(siteVideoEvidenceOutputSchema.parse(output({ job_estimates: broken })).job_estimates).toBeNull();
    }
    expect(siteVideoEvidenceOutputSchema.parse(output()).job_estimates).toBeUndefined();
  });

  it("still refuses a reading with keys outside its contract", () => {
    expect(siteVideoEvidenceOutputSchema.safeParse(output({ verdict: "qualified" })).success).toBe(false);
  });

  it("keeps the estimates in the stored summary, except off unusable footage", () => {
    expect(summariseVideoEvidence(siteVideoEvidenceOutputSchema.parse(output({ job_estimates: ESTIMATES })), "gemini").job_estimates)
      .toEqual(ESTIMATES);
    expect(summariseVideoEvidence(siteVideoEvidenceOutputSchema.parse(output({ job_estimates: ESTIMATES }, "unusable")), "gemini")
      .job_estimates).toBeNull();
    expect(summariseVideoEvidence(siteVideoEvidenceOutputSchema.parse(output()), "gemini").job_estimates).toBeNull();
  });

  it("asks for estimates sized against what is in frame, kept apart from what was observed", () => {
    const prompt = JSON.stringify(siteVideoEvidenceTask.build_prompt({ requestId: "job-1", taskVideoUrl: "https://example.test/v.mp4",
      operatorAnswers: {} }));
    expect(prompt).toContain("Estimating the job (job_estimates)");
    expect(prompt).toContain("Blueprint never asks the site to measure anything");
    expect(prompt).toContain("They never change a stance, an implied_value, cycle_measurement or footage_status.");
    expect(prompt).toContain("other_items_likely");
    expect(prompt).toContain("A wild guess is worse than null.");
  });
});

describe("the site's own walkthrough reading", () => {
  beforeEach(() => {
    sharedFakeFirestoreState.docs.clear();
    sharedFakeFirestoreState.docs.set("inboundRequests/job-1", { requestId: "job-1", request: {},
      site_video_evidence: { status: "analysed", footage_status: "usable" } });
  });

  it("is kept on the job, apart from the intake link's reading, and replaced whole", async () => {
    sharedFakeFirestoreState.docs.set("inboundRequests/job-1", { ...sharedFakeFirestoreState.docs.get("inboundRequests/job-1"),
      walkthrough_video_evidence: { stale: true, job_estimates: { ...ESTIMATES, pick_to_place_m: 4 } } });
    await recordWalkthroughEvidence({ requestId: "job-1", captureId: "walkthrough-job-1", model: "gemini",
      output: siteVideoEvidenceOutputSchema.parse(output({ job_estimates: ESTIMATES })) });
    const stored = sharedFakeFirestoreState.docs.get("inboundRequests/job-1") as Record<string, any>;
    expect(stored.walkthrough_video_evidence).toMatchObject({ status: "analysed", footage_status: "usable", capture_id: "walkthrough-job-1",
      model: "gemini", job_estimates: ESTIMATES });
    expect(stored.walkthrough_video_evidence).not.toHaveProperty("stale");
    expect(stored.site_video_evidence).toEqual({ status: "analysed", footage_status: "usable" });
  });

  it("is never an added view's reading, and a failed write never blocks the review", async () => {
    await recordWalkthroughEvidence({ requestId: "job-1", captureId: "views-job-1-2", model: "gemini",
      output: siteVideoEvidenceOutputSchema.parse(output({ job_estimates: ESTIMATES })) });
    expect(sharedFakeFirestoreState.docs.get("inboundRequests/job-1")).not.toHaveProperty("walkthrough_video_evidence");
    await expect(recordWalkthroughEvidence({ requestId: "missing", captureId: "walkthrough-missing", model: "gemini",
      output: siteVideoEvidenceOutputSchema.parse(output()) })).resolves.toBeUndefined();
    expect(sharedFakeFirestoreState.docs.has("inboundRequests/missing")).toBe(false);
    const ref = { get: async () => ({ exists: true }), set: async () => { throw new Error("unavailable"); } };
    const store = await import("../../client/src/lib/firebaseAdmin");
    const collection = vi.spyOn(store.dbAdmin as never as { collection: (name: string) => unknown }, "collection")
      .mockReturnValueOnce({ doc: () => ref });
    await expect(recordWalkthroughEvidence({ requestId: "job-1", captureId: "walkthrough-job-1", model: "gemini",
      output: siteVideoEvidenceOutputSchema.parse(output()) })).resolves.toBeUndefined();
    collection.mockRestore();
  });
});

describe("the printable brief's read-only link", () => {
  it("names one job, and expires", () => {
    expect(verifyReadinessBriefToken(createReadinessBriefToken("job-1"))).toBe("job-1");
    expect(readinessBriefPathFor("job-1")).toMatch(/^\/capture-upload\/brief\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifyReadinessBriefToken(createReadinessBriefToken("job-1", -60))).toBeNull();
    const [payload, signature] = createReadinessBriefToken("job-1").split(".");
    const forged = Buffer.from(JSON.stringify({ kind: "readiness_brief", requestId: "job-2", exp: 9_999_999_999 })).toString("base64url");
    expect(verifyReadinessBriefToken(`${forged}.${signature}`)).toBeNull();
    expect(verifyReadinessBriefToken(`${payload}.`)).toBeNull();
    expect(verifyReadinessBriefToken("")).toBeNull();
  });

  it("is never read as a capture or review link, and neither is read as it", () => {
    const brief = createReadinessBriefToken("job-1");
    expect(verifyCaptureUploadToken(brief)).toBeNull();
    expect(verifyRequestReviewToken(brief, "job-1")).toBeNull();
    expect(verifyReadinessBriefToken(createCaptureUploadToken({ requestId: "job-1", captureId: "walkthrough-job-1", sceneId: "site-job-1" })))
      .toBeNull();
    expect(verifyReadinessBriefToken(createRequestReviewToken("job-1"))).toBeNull();
  });
});
