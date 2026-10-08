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


describe("known published facts require current knowledge applicability", () => {
  const sourceId = "knowledge:synthetic-corrected-spec";
  const record = (current?: unknown) => ({ source_id: sourceId, kind: "knowledge" as const,
    canonical_ref: "synthetic/specification", sha256: "c".repeat(64), checked_at: "2020-01-01",
    content: { ...(current === undefined ? {} : { current }), original_checked_at: "2020-01-01",
      content: { reachM: 2, correction: "Superseded: current model reach is 1 m" } } });
  const packet = (): SiteAssessment => ({ ...assessment(), job: [], known: [{ text: "The robot currently has a 2 m reach",
    basis: "published", evidence: [{ source_id: sourceId, at_seconds: null }] }] });
  it("rejects a known published claim from an explicitly non-current record without rewriting evidence", () => {
    const value = packet(), sourceRecord = record(false), original = structuredClone({ value, sourceRecord });
    expect(() => validateAssessmentEvidence(value, new Map([[sourceId, sourceRecord]]), null)).toThrow("assessment_known_published_source_not_current");
    expect({ value, sourceRecord }).toEqual(original);
  });
  it.each([true, undefined, "false"])("does not invent an applicability veto from %s", current => {
    const sourceRecord = record(current);
    // No age cutoff, missing-as-false coercion or string-to-boolean coercion.
    expect(() => validateAssessmentEvidence(packet(), new Map([[sourceId, sourceRecord]]), null)).not.toThrow();
  });
  it.each(["unknown", "estimate"] as const)("preserves explicit historical metadata and %s context", basis => {
    const value = packet(), sourceRecord = record(false);
    value.known = [{ text: "The historical 2 m record is superseded; current applicability is unknown", basis,
      evidence: [{ source_id: sourceId, at_seconds: null }] }];
    const original = structuredClone(sourceRecord);
    expect(() => validateAssessmentEvidence(value, new Map([[sourceId, sourceRecord]]), null)).not.toThrow();
    expect(sourceRecord).toEqual(original);
  });
  it("allows an independently current sibling while preserving superseded context", () => {
    const value = packet(), old = record(false), active = { ...record(true), source_id: "knowledge:synthetic-current-spec",
      content: { current: true, content: { reachM: 1 } } };
    value.known[0] = { text: "The current synthetic specification states 1 m reach", basis: "published",
      evidence: [{ source_id: active.source_id, at_seconds: null }] };
    value.missing = [{ text: "An older record said 2 m; why it differs remains unresolved", basis: "unknown",
      evidence: [{ source_id: sourceId, at_seconds: null }] }];
    expect(() => validateAssessmentEvidence(value, new Map([[sourceId, old], [active.source_id, active]]), null)).not.toThrow();
  });
});
