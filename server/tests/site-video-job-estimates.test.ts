// @vitest-environment node
/**
 * The video reader's job estimates, so a site is never asked to measure
 * (founder direction, 2026-10-20).
 *
 * What this pins:
 * - the estimates ride on the same reading that gates reconstruction, so a
 *   malformed estimate reads as null and never fails that reading;
 * - the summary keeps them, except off unusable footage;
 * - the coverage review, the one reading every uploaded walkthrough gets,
 *   carries the same estimates under the same leniency, and a supplement
 *   estimates nothing;
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
const { captureCoverageOutputSchema, captureCoverageTask } = await import("../agents/tasks/capture-coverage");
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
    expect(prompt).toContain("never change a stance, an implied_value, cycle_measurement or footage_status.");
    expect(prompt).toContain("other_items_likely");
    expect(prompt).toContain("A wild guess is worse than null.");
  });
});

describe("the coverage review carries the estimates for every uploaded walkthrough", () => {
  const coverage = (extra: Record<string, unknown> = {}) => ({ covers_scene: true,
    views: [{ id: "work-area", status: "seen", timestamp_seconds: 3, note: "Whole station." }], missing_views: [],
    supplement_would_finish: false, unreadable_reasons: [], confidence: 0.9, ...extra });

  it("keeps estimates that fit, reads malformed ones as null, and never fails the coverage verdict over them", () => {
    expect(captureCoverageOutputSchema.parse(coverage({ job_estimates: ESTIMATES })).job_estimates).toEqual(ESTIMATES);
    expect(captureCoverageOutputSchema.parse(coverage({ job_estimates: "wide" }))).toMatchObject({ covers_scene: true, job_estimates: null });
    expect(captureCoverageOutputSchema.parse(coverage({ job_estimates: { ...ESTIMATES, pick_height_m: 9 } })).job_estimates?.pick_height_m).toBeNull();
    expect(captureCoverageOutputSchema.parse(coverage()).job_estimates).toBeUndefined();
    expect(captureCoverageOutputSchema.safeParse(coverage({ verdict: "qualified" })).success).toBe(false);
  });

  it("asks for estimates on the walkthrough, and none on a supplement that shows part of the work", () => {
    const prompt = (supplementaryViewsOnly: boolean) => JSON.stringify(captureCoverageTask.build_prompt({ videoUrl: "https://example.test/v.mp4",
      supplementaryViewsOnly, taskSummary: "Move cartons", requestedViews: [{ id: "work-area", label: "The whole work area" }] }));
    expect(prompt(false)).toContain("Estimating the job (job_estimates)");
    expect(prompt(false)).toContain("they never change covers_scene, views, missing_views or supplement_would_finish");
    expect(prompt(false)).toContain("Never a brand, company or robot.");
    expect(prompt(true)).not.toContain("Estimating the job");
    expect(prompt(true)).toContain("job_estimates: null.");
  });
});

describe("the printable brief's read-only link", () => {
  it("names one job, and expires", () => {
    expect(verifyReadinessBriefToken(createReadinessBriefToken("job-1"))).toBe("job-1");
    expect(readinessBriefPathFor("job-1")).toMatch(/^\/readiness-brief\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
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
