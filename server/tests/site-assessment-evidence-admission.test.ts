// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSiteAssessmentAgent, validateAssessmentEvidence, type SiteAssessment } from "../agents/site-assessment";

const observation = { category: "motion", finding: "Rack slides outward", basis: "observed", start_seconds: 8, end_seconds: 10, uncertainty: null };
const videoContent = { question: "What moves?", processing: "auto", sampling_fps: 2,
  evidence: { summary: "Rack movement", observations: [observation], not_observable: ["Dish loading"] }, receipt: {} };
const source = { source_id: "video:fixture:reading", kind: "video" as const, canonical_ref: "fixture/video", sha256: "b".repeat(64), checked_at: null, content: videoContent };
const assessment = (basis: "observed" | "published" = "observed", at_seconds: number | null = 8): SiteAssessment => ({ status: "assessment",
  job: [{ text: "Rack slides outward", basis, evidence: [{ source_id: source.source_id, at_seconds }] }],
  objects_motions_conditions_variations: [], operator_success: [], known: [], estimates: [], missing: [], approaches: [],
  next_action: { kind: "research", action: "Check requirements", why: { text: "Fit remains unknown", basis: "unknown", evidence: [] } }, questions: [] });

describe("assessment source admission", () => {
  it.each(["estimate", "not_visible"])("does not promote a %s video finding to observed", basis => {
    const row = { ...source, content: { ...videoContent, evidence: { ...videoContent.evidence, observations: [{ ...observation, basis }] } } };
    expect(() => validateAssessmentEvidence(assessment(), new Map([[row.source_id, row]]), 30)).toThrow("assessment_observation_not_supported");
  });
  it("requires the citation time to overlap a supplied observed interval", () => {
    expect(() => validateAssessmentEvidence(assessment("observed", 20), new Map([[source.source_id, source]]), 30)).toThrow("assessment_observation_not_supported");
  });
  it("preserves supported interval boundaries", () => {
    for (const time of [8, 9, 10]) expect(() => validateAssessmentEvidence(assessment("observed", time), new Map([[source.source_id, source]]), 30)).not.toThrow();
  });
  it("does not relabel an owner assertion as a published robot specification", () => {
    const row = { ...source, kind: "operator" as const, content: "I think this robot can carry 50 kg" };
    expect(() => validateAssessmentEvidence(assessment("published", null), new Map([[row.source_id, row]]), 30)).toThrow("assessment_published_source_required");
  });
  it("rejects an invalid retained video interval before constructing the SDK agent", async () => {
    await expect(createSiteAssessmentAgent({ request_id: "fixture-request", operator_messages: [{ id: "one", text: "What moves?", source_ref: "fixture/operator" }],
      video: { source_id: "fixture", source_ref: source.canonical_ref, url: "https://example.invalid/no-fetch", sha256: source.sha256, duration_seconds: 30 },
      site_requirement: { spec: {}, serviceArea: null, location: { label: null, city: null, state: null, country: null }, taskFamily: null } },
    { history_access: null, authorize_model_call: async () => { throw new Error("paid_dispatch_forbidden"); }, retained_video_sources: [
      { ...source, content: { ...videoContent, evidence: { ...videoContent.evidence, observations: [{ ...observation, end_seconds: 99 }] } } } ] }))
      .rejects.toThrow("assessment_video_timestamp_invalid");
  });
});
