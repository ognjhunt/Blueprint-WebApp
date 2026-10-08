// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { Usage, type Model, type ModelResponse } from "@openai/agents";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createSiteAssessmentAgent, type SiteAssessment } from "../agents/site-assessment";
import type { RobotTeamRecord } from "../types/robot-team-registry";

// Synthetic source primitives and scripted provider output. These are SDK
// admission/publication diagnostics, never real model or video accuracy labels.
const scenarios = [
  { id: "V2-empty-search-invented-source", mode: "empty_search", steps: ["search", "fetch"], expectedError: "assessment_unknown_source_id", semanticOnly: false },
  { id: "V2-unknown-registry-invented-reach", mode: "unknown_registry", steps: ["registry"], expectedError: "assessment_registry_source_basis_required", semanticOnly: false },
  { id: "V2-inferred-registry-published-reach", mode: "inferred_registry", steps: ["registry"], expectedError: "assessment_registry_source_basis_required", semanticOnly: false },
  { id: "V2-empty-knowledge-published-reach", mode: "empty_knowledge", steps: ["search", "fetch"], expectedError: "assessment_knowledge_content_required", semanticOnly: false },
  { id: "V2-corrected-knowledge-current-spec", mode: "stale_knowledge", steps: ["search", "fetch"], expectedError: null, semanticOnly: true },
  { id: "V2-conflicting-owner-spec-video", mode: "conflict", steps: ["video", "search", "fetch"], expectedError: null, semanticOnly: true },
  { id: "V2-invented-video-measurement", mode: "measurement", steps: ["video"], expectedError: "assessment_measured_source_required", semanticOnly: false },
  { id: "V2-empty-search-unknown-exclusion", mode: "empty_exclusion", steps: ["search", "registry"], expectedError: "assessment_exclusion_evidence_required", semanticOnly: false },
  { id: "V2-unknown-registry-exclusion", mode: "unknown_exclusion", steps: ["registry"], expectedError: "assessment_exclusion_evidence_required", semanticOnly: false },
  { id: "V2-no-reasons-exclusion", mode: "no_reasons", steps: ["registry"], expectedError: "assessment_exclusion_evidence_required", semanticOnly: false },
  { id: "V2-sourced-estimate-exclusion-control", mode: "estimate_control", steps: ["registry"], expectedError: null, semanticOnly: false },
  { id: "V2-no-robot-unknown-control", mode: "manual_control", steps: ["search"], expectedError: null, semanticOnly: false },
  { id: "V2-published-registry-control", mode: "published_control", steps: ["registry"], expectedError: null, semanticOnly: false },
  { id: "V5-measured-registry-control", mode: "measured_control", steps: ["registry"], expectedError: null, semanticOnly: false },
  { id: "V5-self-reported-registry-control", mode: "self_reported_control", steps: ["registry"], expectedError: null, semanticOnly: false },
  { id: "V5-inferred-estimate-control", mode: "inferred_estimate_control", steps: ["registry"], expectedError: null, semanticOnly: false },
  { id: "V5-unknown-context-control", mode: "unknown_context_control", steps: ["registry"], expectedError: null, semanticOnly: false },
  { id: "V5-nonempty-knowledge-published-control", mode: "knowledge_published_control", steps: ["search", "fetch"], expectedError: null, semanticOnly: false },
  { id: "V5-nonempty-knowledge-measured-control", mode: "knowledge_measured_control", steps: ["search", "fetch"], expectedError: null, semanticOnly: false },
  { id: "V5-published-is-not-measured", mode: "published_as_measured", steps: ["registry"], expectedError: "assessment_registry_source_basis_required", semanticOnly: false },
  { id: "V5-missing-named-provenance", mode: "missing_named_provenance", steps: ["registry"], expectedError: "assessment_registry_source_basis_required", semanticOnly: false },
  { id: "V5-admitted-field-wrong-claim", mode: "wrong_field_claim", steps: ["registry"], expectedError: null, semanticOnly: true },
  { id: "V5-malformed-object-capability", mode: "object_capability", steps: ["registry"], expectedError: "assessment_registry_source_basis_required", semanticOnly: false },
  { id: "V5-malformed-array-capability", mode: "array_capability", steps: ["registry"], expectedError: "assessment_registry_source_basis_required", semanticOnly: false },
  { id: "V5-malformed-boolean-capability", mode: "boolean_capability", steps: ["registry"], expectedError: "assessment_registry_source_basis_required", semanticOnly: false },
  { id: "V8-operator-measurement-basis", mode: "operator_measured", steps: [], expectedError: "assessment_measured_source_required", semanticOnly: false },
  { id: "V8-owner-stated-measurement-control", mode: "operator_stated_control", steps: [], expectedError: null, semanticOnly: false },
  { id: "V8-observed-timing-control", mode: "timing_control", steps: ["video"], expectedError: null, semanticOnly: false },
  { id: "V8-observed-ruler-control", mode: "ruler_control", steps: ["video"], expectedError: null, semanticOnly: false },
  { id: "V8-estimated-dimension-control", mode: "dimension_estimate_control", steps: ["video"], expectedError: null, semanticOnly: false },
];
const codeSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const results: Array<Record<string, unknown>> = [];
const historyRecord = (content: unknown, current = true) => ({ record_id: "fixture-spec", kind: "robot_capability", source_ref: "synthetic/specification",
  source_sha256: createHash("sha256").update(JSON.stringify(content)).digest("hex"), original_checked_at: "2020-01-01",
  current, city: null, industry: null, task: null, company: null, content });
const baseAssessment = (): SiteAssessment => ({ status: "assessment", job: [], objects_motions_conditions_variations: [], operator_success: [],
  known: [], estimates: [], missing: [], approaches: [], questions: [],
  next_action: { kind: "research", action: "Resolve missing task evidence", why: { text: "Fit remains unknown", basis: "unknown", evidence: [] } } });

afterAll(() => {
  const output = process.env.RELIABILITY_C_V2_OUTPUT;
  if (output) writeFileSync(`${output}/${process.env.RELIABILITY_C_V2_RUN ?? "results"}.json`, JSON.stringify({ codeSha,
    sourceCodeSha256: createHash("sha256").update(readFileSync(new URL("../agents/site-assessment.ts", import.meta.url))).digest("hex"),
    labelVersion: "C-semantic-sdk.v8", labelStatus: "PROVISIONAL synthetic fixture expectations; v2 expectations amended explicitly in C/v5 and C/v8 manifests", layer: "actual_SDK_runner_tool_loop_no_storage",
    providerMode: "scripted_model_and_video_callbacks", liveProviderCalls: 0, knownCostUsd: 0,
    publicationMeaning: "Actual Runner finalOutput parsed and accepted into portable assessment packet; no adapter/database/customer publication executed",
    results }, null, 2) + "\n");
});

describe("actual SDK source-primitive semantic diagnostics", () => {
  it.each(scenarios)("$id", async scenario => {
    const mode = scenario.mode;
    const knownRegistry = ["estimate_control", "published_control", "measured_control", "self_reported_control", "published_as_measured", "missing_named_provenance", "wrong_field_claim", "object_capability", "array_capability", "boolean_capability"].includes(mode);
    const inferred = ["inferred_registry", "inferred_estimate_control"].includes(mode);
    const team: RobotTeamRecord = { id: "fixture-team", name: "Synthetic Team", status: "prospect",
      capability: { reachM: knownRegistry ? 1 : inferred ? 3 : null, payloadCapacity: null },
      fieldProvenance: knownRegistry || inferred ? { reachM: { grade: inferred ? "inferred" : mode === "measured_control" ? "measured" : mode === "self_reported_control" ? "self_reported" : "published", source: mode === "missing_named_provenance" ? "" : "synthetic/specification", observedAt: "2026-01-01" } } : {},
      createdAt: "2026-01-01", updatedAt: "2026-01-01", capabilityDescription: "Synthetic registry record; no physical trial" };
    if (["object_capability", "array_capability", "boolean_capability"].includes(mode)) team.capability.reachM = (mode === "object_capability" ? {} : mode === "array_capability" ? [] : true) as unknown as number;
    const record = mode === "empty_knowledge" ? historyRecord({})
      : mode === "stale_knowledge" ? historyRecord({ reachM: 2, correction: "Superseded: current model reach is 1 m; original 2 m must not be treated as current" }, false)
      : ["knowledge_published_control", "knowledge_measured_control"].includes(mode) ? historyRecord({ reachM: 1, basis: mode === "knowledge_measured_control" ? "measured synthetic fixture" : "published synthetic fixture" })
      : historyRecord({ task_success: "The task requires bin stacking; moving the bin onto a table does not establish completion" });
    let turn = 0, modelCalls = 0, videoCalls = 0;
    const providerOutputs: unknown[] = [];
    const model: Model = {
      async getResponse(request): Promise<ModelResponse> {
        const step = scenario.steps[turn++];
        let output: ModelResponse["output"];
        if (step) {
          const name = step === "video" ? "analyze_site_video" : step === "search" ? "search_robot_knowledge" : step === "fetch" ? "fetch_robot_knowledge" : "read_robot_registry";
          const args = step === "video" ? { question: "What actions are visible?", processing: "auto", sampling_fps: 2 }
            : step === "search" ? { query: "task capability", city: null, task: null, company: null, kind: null, cursor: null }
            : step === "fetch" ? { record_id: "fixture-spec" } : {};
          output = [{ type: "function_call", callId: `fixture-call-${turn}`, name, arguments: JSON.stringify(args) }];
        } else {
          const assessment = baseAssessment();
          const videoSource = JSON.stringify(request.input).match(/video:fixture-video:[a-f0-9]{12}/)?.[0] ?? "video:missing";
          const registryRef = { source_id: "robotTeam:fixture-team", at_seconds: null };
          const knowledgeRef = { source_id: "knowledge:fixture-spec", at_seconds: null };
          if (["unknown_registry", "inferred_registry"].includes(mode)) assessment.known = [{ text: "The robot has a published 50 m reach", basis: "published", evidence: [registryRef] }];
          if (["empty_knowledge", "empty_search", "stale_knowledge"].includes(mode)) assessment.known = [{ text: mode === "stale_knowledge" ? "The robot currently has a 2 m reach" : "The robot has a published 50 m reach", basis: "published", evidence: [knowledgeRef] }];
          if (mode === "conflict") assessment.job = [{ text: "The bin stacking task visibly completed successfully", basis: "observed", evidence: [{ source_id: videoSource, at_seconds: 8 }] }];
          if (mode === "measurement") assessment.known = [{ text: "The bin mass is measured at 12 kg", basis: "measured", evidence: [{ source_id: videoSource, at_seconds: 8 }] }];
          if (["operator_measured", "operator_stated_control"].includes(mode)) assessment.known = [{ text: "The owner reports measuring a 12 kg mass; this has not been independently verified", basis: mode === "operator_measured" ? "measured" : "operator_stated", evidence: [{ source_id: "operator:fixture-message", at_seconds: null }] }];
          if (mode === "timing_control") assessment.job = [{ text: "The bin is visibly moving during the observed 8 to 12 second interval", basis: "observed", evidence: [{ source_id: videoSource, at_seconds: 8 }] }];
          if (mode === "ruler_control") assessment.known = [{ text: "A ruler is visible beside the bin; calibration and a metric measurement remain unknown", basis: "observed", evidence: [{ source_id: videoSource, at_seconds: 8 }] }];
          if (mode === "dimension_estimate_control") assessment.estimates = [{ text: "The bin may span about 1.3 m; no calibrated dimensions are available", basis: "estimate", evidence: [{ source_id: videoSource, at_seconds: 8 }] }];
          if (["empty_exclusion", "unknown_exclusion", "no_reasons"].includes(mode)) assessment.approaches = [{ approach: "Any robot", disposition: "excluded",
            reasons: mode === "no_reasons" ? [] : [{ text: "No robot can perform this job because capability is unknown", basis: "unknown", evidence: mode === "unknown_exclusion" ? [registryRef] : [] }], remaining_checks: [] }];
          if (mode === "estimate_control") assessment.approaches = [{ approach: "Direct reach with the current fixture", disposition: "excluded",
            reasons: [{ text: "Assuming the owner's 2 m reach requirement, the published 1 m reach leaves a gap; confirm a fixture alternative", basis: "estimate", evidence: [registryRef, { source_id: "operator:fixture-message", at_seconds: null }] }], remaining_checks: ["Check the owner's measurement and fixture alternatives"] }];
          if (mode === "manual_control") assessment.next_action = { kind: "no_robot", action: "Keep the task manual while requirements are clarified", why: { text: "Available robot capability is unknown", basis: "unknown", evidence: [] } };
          if (mode === "published_control") assessment.known = [{ text: "The synthetic record publishes a 1 m reach", basis: "published", evidence: [registryRef] }];
          if (["measured_control", "published_as_measured"].includes(mode)) assessment.known = [{ text: "The synthetic record measures a 1 m reach", basis: "measured", evidence: [registryRef] }];
          if (mode === "self_reported_control") assessment.known = [{ text: "The team reports a 1 m reach; no measurement is established", basis: "published", evidence: [registryRef] }];
          if (mode === "inferred_estimate_control") assessment.estimates = [{ text: "A 3 m reach is inferred and needs verification", basis: "estimate", evidence: [registryRef] }];
          if (mode === "unknown_context_control") assessment.missing = [{ text: "The registry reach is unknown", basis: "unknown", evidence: [registryRef] }];
          if (["knowledge_published_control", "knowledge_measured_control"].includes(mode)) assessment.known = [{ text: "The synthetic record gives a 1 m reach", basis: mode === "knowledge_measured_control" ? "measured" : "published", evidence: [knowledgeRef] }];
          if (["missing_named_provenance", "wrong_field_claim", "object_capability", "array_capability", "boolean_capability"].includes(mode)) assessment.known = [{ text: mode === "wrong_field_claim" ? "The robot has a published 50 m reach" : "The robot has a published 1 m reach", basis: "published", evidence: [registryRef] }];
          output = [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(assessment) }] }];
        }
        providerOutputs.push(output);
        return { output, usage: new Usage() };
      },
      async *getStreamedResponse() { throw new Error("streaming_not_used"); },
    };
    const instance = await createSiteAssessmentAgent({ request_id: "fixture-request", operator_messages: [{ id: "fixture-message",
      text: ["operator_measured", "operator_stated_control"].includes(mode) ? "Owner: I measured the bin mass at 12 kg; no calibration or measurement receipt is supplied."
        : "Owner: the task is bin stacking; stacking is absent from the clip. A separate task may require 2 m reach, not verified by a measurement receipt.", source_ref: "synthetic/operator" }],
      video: { source_id: "fixture-video", source_ref: "synthetic/video-no-bytes", url: "https://example.invalid/not-fetched", sha256: "b".repeat(64), duration_seconds: 30 },
      site_requirement: { spec: { payloadWeight: "ten_to_twentyfive" }, serviceArea: null, location: { label: null, city: null, state: null, country: null }, taskFamily: null } },
    { model, history_access: { principalId: "fixture-owner", expiresAt: "2099-01-01T00:00:00Z" }, authorize_model_call: async () => { modelCalls++; },
      read_robot_teams: async () => ["empty_exclusion", "no_reasons"].includes(mode) ? [] : [team],
      history_tool: async name => name === "search_company_history" ? { ok: true, rows: ["empty_search", "empty_exclusion", "manual_control"].includes(mode) ? [] : [{ record_id: "fixture-spec" }], next_cursor: null, coverage: ["bounded synthetic corpus; not robot universe"] }
        : mode === "empty_search" ? { ok: false, error: "company_history_record_missing_or_not_authorized" } : { ok: true, record },
      analyze_video: async () => { videoCalls++; return { evidence: { summary: "Only bin movement is visible", observations: [{ category: "motion", finding: mode === "ruler_control" ? "Bin moves beside a visible ruler; calibration is unknown" : "Bin moves onto table", basis: "observed", start_seconds: 8, end_seconds: 12, uncertainty: "Stacking and measurement are not shown" }], not_observable: ["Bin stacking", "Bin mass", "Metric calibration", "Task completion"] }, receipt: { fixtureOnly: true, noVideoBytesRead: true } }; },
    });
    const start = performance.now();
    let error: string | null = null, packet: unknown = null;
    try { packet = await instance.run(); } catch (e) { error = e instanceof Error ? e.message : "non_error"; }
    const semanticHash = createHash("sha256").update(JSON.stringify({ scenario, admittedEvidence: instance.evidence(), structuredProviderOutputs: providerOutputs })).digest("hex");
    results.push({ caseId: scenario.id, semanticHash, status: scenario.semanticOnly ? "partial" : error === scenario.expectedError ? "passed" : "failed",
      actual: error ? "rejected" : "assessment_packet_accepted", error, expectedError: scenario.expectedError,
      semanticOnly: scenario.semanticOnly, attempted: true, repeat: 1, latencyMs: performance.now() - start,
      codeSha, providerMode: "scripted_model_and_video_callbacks", modelCallsScripted: modelCalls, videoCallbacksScripted: videoCalls,
      liveProviderCalls: 0, knownCostUsd: 0, sourcesAndToolReceipts: instance.evidence(), packet, structuredProviderOutputs: providerOutputs });
    expect(error).toBe(scenario.expectedError);
  });
});
