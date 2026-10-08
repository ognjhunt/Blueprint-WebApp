// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSiteAssessmentAgent, renderSourceBoundAssessment, type SiteAssessment } from "../agents/site-assessment";
import { Usage, type Model, type ModelResponse } from "@openai/agents";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const videoSelector = { kind: "video_observation" as const, observation_index: 0, field_path: null };
const fieldSelector = (field: string) => ({ kind: "qualified_field" as const, observation_index: null, field_path: [field] });
const video = { source_id: "video:fixture", kind: "video" as const, canonical_ref: "synthetic/video", sha256: "b".repeat(64), checked_at: null,
  content: { evidence: { summary: "Rack movement", observations: [
    { category: "motion", finding: "Rack slides outward", basis: "observed", start_seconds: 8, end_seconds: 10, uncertainty: "Full cycle completion is not established" },
    { category: "apparent_result", finding: "Dish loading may have occurred", basis: "estimate", start_seconds: 8, end_seconds: 10, uncertainty: "Occluded" },
  ], not_observable: ["Dish loading", "Physical dimensions", "Robot suitability"] } } };
const registry = { source_id: "robotTeam:fixture", kind: "robot_registry" as const, canonical_ref: "robotTeams/fixture", sha256: "c".repeat(64), checked_at: null,
  content: { capability: { reachM: 1, payloadCapacity: 99 }, fieldProvenance: { reachM: { grade: "published", source: "synthetic/spec" } } } };
type Source = Parameters<typeof renderSourceBoundAssessment>[1] extends ReadonlyMap<string, infer T> ? T : never;
const sources = () => new Map<string, Source>([[video.source_id, structuredClone(video)], [registry.source_id, structuredClone(registry)]]);
const packet = (): SiteAssessment => ({ status: "assessment", job: [], objects_motions_conditions_variations: [], operator_success: [], known: [], estimates: [], missing: [], approaches: [], questions: [],
  next_action: { kind: "research", action: "Resolve evidence gaps", why: { text: "Fit remains unknown", basis: "unknown", evidence: [] } } });

describe("v2 source-derived factual rendering; provenance is not truth", () => {
  it("derives observed wording and limits from the selected observation, preserving original bytes", () => {
    const raw = packet(), admitted = sources();
    raw.job = [{ text: "Dish loading completed perfectly", basis: "observed", evidence: [{ source_id: video.source_id, at_seconds: 8, selector: videoSelector }] }];
    const before = structuredClone({ raw, admitted });
    const result = renderSourceBoundAssessment(raw, admitted, 30);
    expect(result.assessment.job[0]).toMatchObject({ basis: "observed", verification_status: "source_bound" });
    expect(result.assessment.job[0].text).toContain("Rack slides outward");
    expect(result.assessment.job[0].text).toContain("Not established by this reading: Dish loading; Physical dimensions; Robot suitability");
    expect(result.assessment.job[0].text).not.toContain("completed perfectly");
    expect({ raw, admitted }).toEqual(before);
  });
  it.each([1, 99])("cannot use observation index %s to launder another observed interval", index => {
    const raw = packet();
    raw.job = [{ text: "Dish loading completed", basis: "observed", evidence: [{ source_id: video.source_id, at_seconds: 8, selector: { ...videoSelector, observation_index: index } }] }];
    expect(renderSourceBoundAssessment(raw, sources(), 30).assessment.job[0]).toMatchObject({ basis: "unknown", verification_status: "unverified" });
  });
  it("derives the published value from the selected qualified registry field, never original prose", () => {
    const raw = packet();
    raw.known = [{ text: "This robot has a 50 m reach and guarantees success", basis: "published", evidence: [{ source_id: registry.source_id, at_seconds: null, selector: fieldSelector("reachM") }] }];
    const result = renderSourceBoundAssessment(raw, sources(), null);
    expect(result.assessment.known[0].text).toBe("Registry published field reachM: 1. This specification does not establish site suitability.");
    expect(result.verification.source_bound_claims).toBe(1);
    expect(raw.known[0].text).toContain("50 m");
  });
  it("a qualified sibling does not qualify the selected field", () => {
    const raw = packet();
    raw.known = [{ text: "Published payload 99 kg", basis: "published", evidence: [{ source_id: registry.source_id, at_seconds: null, selector: fieldSelector("payloadCapacity") }] }];
    expect(renderSourceBoundAssessment(raw, sources(), null).assessment.known[0]).toMatchObject({ basis: "unknown", verification_status: "unverified" });
  });
  it("a measured sibling cannot upgrade a selected published field to measured", () => {
    const raw = packet(), admitted = sources(), record = admitted.get(registry.source_id)!.content as any;
    record.fieldProvenance.payloadCapacity = { grade: "measured", source: "synthetic/receipt" };
    raw.known = [{ text: "Reach independently measured", basis: "measured", evidence: [{ source_id: registry.source_id, at_seconds: null, selector: fieldSelector("reachM") }] }];
    expect(renderSourceBoundAssessment(raw, admitted, null).assessment.known[0]).toMatchObject({ basis: "unknown", verification_status: "unverified" });
  });
  it("requires bindings at nested factual locations and keeps unknown interpretations intact", () => {
    const raw = packet();
    raw.approaches = [{ approach: "Investigate fixture alternatives", disposition: "needs_evidence", remaining_checks: ["Run a bounded trial"],
      reasons: [{ text: "A published 50 m reach proves fit", basis: "published", evidence: [{ source_id: registry.source_id, at_seconds: null }] }] }];
    raw.next_action.why = { text: "A 50 m reach proves fit", basis: "published", evidence: [{ source_id: registry.source_id, at_seconds: null }] };
    raw.missing = [{ text: "Capability remains unknown; unknown does not establish inability", basis: "unknown", evidence: [] }];
    const result = renderSourceBoundAssessment(raw, sources(), null);
    expect(result.assessment.approaches[0].reasons[0].basis).toBe("unknown");
    expect(result.assessment.next_action.why.basis).toBe("unknown");
    expect(result.assessment.missing[0].text).toBe(raw.missing[0].text);
    expect(result.verification.unverified_claims).toBe(2);
  });
  it.each(["unknown", "estimate"] as const)("preserves historical %s interpretation and superseded source metadata", basis => {
    const raw = packet(), old: Source = { source_id: "knowledge:old", kind: "knowledge", canonical_ref: "synthetic/old", sha256: "d".repeat(64), checked_at: "2020-01-01",
      content: { current: false, content: { reachM: 2, correction: "Superseded" } } };
    raw.estimates = [{ text: "Historical reach was 2 m; current applicability is unknown", basis, evidence: [{ source_id: old.source_id, at_seconds: null }] }];
    const before = structuredClone(old), result = renderSourceBoundAssessment(raw, new Map([[old.source_id, old]]), null);
    expect(result.assessment.estimates[0].text).toBe(raw.estimates[0].text);
    expect(old).toEqual(before);
  });
  it("selects an actual current knowledge leaf; objects and inherited paths are unverified", () => {
    const raw = packet(), current: Source = { source_id: "knowledge:current", kind: "knowledge", canonical_ref: "synthetic/current", sha256: "d".repeat(64), checked_at: null,
      content: { current: true, content: { reachM: 1 } } };
    for (const field of ["reachM", "toString", "missing"]) {
      raw.known = [{ text: "Published 50 m reach", basis: "published", evidence: [{ source_id: current.source_id, at_seconds: null, selector: fieldSelector(field) }] }];
      const result = renderSourceBoundAssessment(raw, new Map([[current.source_id, current]]), null);
      expect(result.assessment.known[0].basis).toBe(field === "reachM" ? "published" : "unknown");
      expect(result.assessment.known[0].text).not.toContain("50 m");
    }
  });
  it("cannot turn video into a calibrated measurement even with a valid observation selector", () => {
    const raw = packet();
    raw.known = [{ text: "Measured dimension 1.3 m", basis: "measured", evidence: [{ source_id: video.source_id, at_seconds: 8, selector: videoSelector }] }];
    expect(() => renderSourceBoundAssessment(raw, sources(), 30)).toThrow("assessment_measured_source_required");
  });
  it("a truthful selected field does not establish universal robot exclusion or a no-robot verdict", () => {
    const raw = packet();
    raw.approaches = [{ approach: "Any robot", disposition: "excluded", remaining_checks: [], reasons: [{ text: "A 1 m reach means no robot can do this job", basis: "published",
      evidence: [{ source_id: registry.source_id, at_seconds: null, selector: fieldSelector("reachM") }] }] }];
    raw.next_action = { kind: "no_robot", action: "No robot can do this job", why: structuredClone(raw.approaches[0].reasons[0]) };
    const result = renderSourceBoundAssessment(raw, sources(), null);
    expect(result.assessment.approaches[0].disposition).toBe("needs_evidence");
    expect(result.assessment.next_action.kind).toBe("research");
    expect(result.assessment.next_action.action).toBe("Keep manual work as an option while clarifying unresolved requirements.");
    expect(result.assessment.next_action.why.text).toContain("reachM: 1");
    expect(result.verification.decision_status).toBe("advisory_review_required");
    expect(raw.next_action.action).toBe("No robot can do this job");
  });
  it("unbound factual claims cannot retain an apparently complete recommendation", () => {
    const raw = packet();
    raw.known = [{ text: "Guaranteed 50 m reach", basis: "published", evidence: [{ source_id: registry.source_id, at_seconds: null }] }];
    raw.next_action = { kind: "robot_trial", action: "Deploy immediately", why: { text: "Fit is proven", basis: "unknown", evidence: [] } };
    const result = renderSourceBoundAssessment(raw, sources(), null);
    expect(result.assessment.status).toBe("needs_operator_input");
    expect(result.assessment.next_action.kind).toBe("research");
    expect(result.assessment.next_action.action).not.toBe("Deploy immediately");
    expect(result.assessment.questions).toHaveLength(1);
  });
  it("actual SDK preserves raw false prose while rendering selected source facts in v2", async () => {
    let turn = 0;
    const model: Model = {
      async getResponse(request): Promise<ModelResponse> {
        const schema = request.outputType as any;
        expect(schema.schema.properties.job.items.properties.evidence.items.properties.selector).toBeDefined();
        turn++;
        const output: ModelResponse["output"] = turn === 1
          ? [{ type: "function_call", callId: "video", name: "analyze_site_video", arguments: JSON.stringify({ question: "What moves?", processing: "auto", sampling_fps: 2 }) }]
          : turn === 2 ? [{ type: "function_call", callId: "registry", name: "read_robot_registry", arguments: "{}" }]
          : [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify({ ...packet(),
            job: [{ text: "Dish loading completed perfectly", basis: "observed", evidence: [{ source_id: JSON.stringify(request.input).match(/video:fixture:[a-f0-9]{12}/)![0], at_seconds: 8, selector: videoSelector }] }],
            known: [{ text: "Published 50 m reach", basis: "published", evidence: [{ source_id: "robotTeam:fixture", at_seconds: null, selector: fieldSelector("reachM") }] }],
          }) }] }];
        return { output, usage: new Usage() };
      },
      async *getStreamedResponse() { throw new Error("stream_not_used"); },
    };
    const instance = await createSiteAssessmentAgent({ request_id: "fixture", operator_messages: [{ id: "owner", text: "Task remains unspecified", source_ref: "synthetic/operator" }],
      video: { source_id: "fixture", source_ref: "synthetic/video", url: "https://example.invalid/not-fetched", sha256: video.sha256, duration_seconds: 30 },
      site_requirement: { spec: {}, serviceArea: null, location: { label: null, city: null, state: null, country: null }, taskFamily: null } },
    { model, history_access: null, authorize_model_call: async () => {}, analyze_video: async () => ({ evidence: video.content.evidence as any, receipt: { fixtureOnly: true, noVideoBytesRead: true } }),
      read_robot_teams: async () => [{ id: "fixture", name: "Synthetic team", status: "prospect", createdAt: "2026-01-01", updatedAt: "2026-01-01", ...registry.content }] as any });
    const result = await instance.run();
    expect(result.schema_version).toBe("site_assessment.v2");
    expect(result.assessment.job[0].text).toContain("Rack slides outward");
    expect(result.assessment.known[0].text).toContain("reachM: 1");
    expect(result.raw_model_assessment.job[0].text).toBe("Dish loading completed perfectly");
    expect(result.raw_model_assessment.known[0].text).toBe("Published 50 m reach");
    expect(result.verification.source_bound_claims).toBe(2);
    if (process.env.RELIABILITY_BINDING_OUTPUT) writeFileSync(`${process.env.RELIABILITY_BINDING_OUTPUT}/results.json`, JSON.stringify({
      regression: "selected_observation_and_registry_field_source_rendering", labelStatus: "PROVISIONAL scripted regression; no accuracy label",
      layer: "actual_SDK_runner_scripted_tools_no_storage", liveProviderCalls: 0, newIndependentCases: 0,
      sourceSha256: createHash("sha256").update(readFileSync(new URL("../agents/site-assessment.ts", import.meta.url))).digest("hex"),
      fixtureSha256: createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex"), result,
    }, null, 2) + "\n");
  });
});
