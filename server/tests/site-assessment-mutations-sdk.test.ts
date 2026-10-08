// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { Usage, type Model, type ModelResponse } from "@openai/agents";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createSiteAssessmentAgent, type SiteAssessment } from "../agents/site-assessment";
import { makeJudgmentMutations } from "./fixtures/site-assessment-mutations";

// Supplemental layer for the unchanged 120 PROVISIONAL fixture states. Scripted
// outputs test SDK/tool/source admission, never model reasoning or video truth.
const codeSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const cases = makeJudgmentMutations(codeSha);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const results: Array<Record<string, unknown>> = [];

afterAll(() => {
  const output = process.env.RELIABILITY_C_SDK_OUTPUT;
  if (!output) return;
  writeFileSync(`${output}/results.json`, JSON.stringify({
    schema: "blueprint.judgment-sdk-supplement.v1", codeSha,
    runtimeSourceSha256: createHash("sha256").update(readFileSync(new URL("../agents/site-assessment.ts", import.meta.url))).digest("hex"),
    fixtureSha256: createHash("sha256").update(readFileSync(new URL("./fixtures/site-assessment-mutations.ts", import.meta.url))).digest("hex"),
    labelVersion: "judgment-rubric.v1", labelStatus: "PROVISIONAL", truthLabelsChanged: false,
    originalFamiliesRelationshipsSplitsAndSemanticHashesUnchanged: true,
    layer: "actual_SDK_runner_tool_loop_no_storage", providerMode: "scripted_model_video_history_callbacks",
    generated: cases.length, deduplicated: new Set(cases.map(row => row.semanticHash)).size,
    attempted: new Set(results.map(row => row.caseId)).size,
    structuralPassed: new Set(results.filter(row => row.status === "passed").map(row => row.caseId)).size,
    structuralFailed: new Set(results.filter(row => row.status === "failed").map(row => row.caseId)).size,
    semanticPartial: new Set(results.filter(row => row.status === "partial").map(row => row.caseId)).size,
    skipped: 0, blocked: 0, invocationCount: results.length,
    actualInputUnique: new Set(results.map(row => row.actualInputHash)).size,
    acceptedPackets: results.filter(row => row.actual === "accept").length,
    rejectedAttempts: results.filter(row => row.actual === "reject").length,
    liveProviderCalls: 0, newKnownDispatchCostUsd: 0, simulatedProviderCostUsd: null,
    scoredAccuracySamples: 0, originalCaseCountNotAdditionalIndependentSamples: true,
    publicationMeaning: "Runner finalOutput parsed and admitted/rejected into a portable packet; no database, adapter, customer UI or notification publication", results,
  }, null, 2) + "\n");
});

describe("unchanged provisional semantic cases through scripted SDK tool loop", () => {
  it.each(cases)("$caseId", async c => {
    const p = c.parameters;
    let observations = [{ category: "motion" as const, finding: p.visible, basis: p.sourceBasis as "observed" | "estimate" | "not_visible",
      start_seconds: p.start, end_seconds: p.end, uncertainty: p.sourceBasis === "observed" ? null : "Occluded or inferred; event not established" }];
    if (c.family === "reordered_evidence") observations = c.structuralExpectation === "accept"
      ? [{ ...observations[0], start_seconds: p.end + 1, end_seconds: p.end + 2 }, ...observations]
      : [{ ...observations[0], start_seconds: p.end, end_seconds: p.start }];
    if (p.context === "partial cycle before occlusion") observations[0].uncertainty = "Only the start is visible; completion is occluded";
    if (p.context === "recovery after initially undone result") observations.push(
      { category: "motion", finding: `${p.object} returns to its initial position; apparent result is undone`, basis: "observed", start_seconds: p.end + 1, end_seconds: p.end + 2, uncertainty: null },
      { category: "motion", finding: `${p.object} is moved again after a manual recovery`, basis: "observed", start_seconds: p.end + 3, end_seconds: p.end + 4, uncertainty: null });
    const videoReading = { summary: p.context, observations,
      not_observable: [p.absent, `${p.constraint} measurement`, ...(p.context === "partial cycle before occlusion" ? ["Full cycle completion"] : [])] };
    const knowledgeContent = c.family === "stale_specifications"
      ? { current: false, original_checked_at: "2020-01-01", corrections: [`The ${p.constraint} claim is superseded`], content: { spec: p.value } }
      : { current: true, specification: `Required outcome is ${p.absent}; ${p.visible} is insufficient` };
    const text = c.family === "unsupported_dimensions" ? `${p.object} ${p.constraint} is measured at ${p.value}`
      : c.family === "unsupported_robot_capability" ? `Published robot ${p.constraint} is ${p.value}`
      : c.family === "citation_non_entailment" || c.family === "absent_action" ? p.absent
      : c.family === "conflicting_statements" ? `Owner says ${p.absent}; specification requires a different result; video proves success`
      : c.family === "stale_specifications" ? `Current robot ${p.constraint} is ${p.value}` : p.visible;
    // Source IDs acquire SDK namespaces. Relationships, facts, timestamps, claim
    // prose and claim placement (including stale facts in job) stay unchanged.
    const steps = c.family === "unsupported_robot_capability" ? []
      : c.family === "stale_specifications" ? ["search", "fetch"]
      : c.family === "conflicting_statements" ? ["video", "search", "fetch"] : ["video"];
    const operatorText = c.family === "unsupported_robot_capability" ? `Owner: I guess this robot achieves ${p.value}`
      : c.family === "conflicting_statements" ? `Owner says ${p.absent}` : "No operator facts beyond this synthetic source context are supplied.";
    const actualInputHash = hash({ parameters: p, videoReading, knowledgeContent, operatorText, scriptedClaim: { text, basis: p.assertedBasis, at: p.citationSeconds }, steps, placement: "job" });
    for (let repeat = 1; repeat <= c.repeats; repeat++) {
      let turn = 0, modelCalls = 0, videoCalls = 0, historyCalls = 0;
      const providerOutputs: unknown[] = [];
      let instance: Awaited<ReturnType<typeof createSiteAssessmentAgent>>;
      const model: Model = {
        async getResponse(): Promise<ModelResponse> {
          const step = steps[turn++];
          let output: ModelResponse["output"];
          if (step) {
            const name = step === "video" ? "analyze_site_video" : step === "search" ? "search_robot_knowledge" : "fetch_robot_knowledge";
            const args = step === "video" ? { question: "What actions are visible?", processing: "auto", sampling_fps: 2 }
              : step === "search" ? { query: p.constraint, city: null, task: null, company: null, kind: null, cursor: null } : { record_id: c.sourceId };
            output = [{ type: "function_call", callId: `fixture-call-${turn}`, name, arguments: JSON.stringify(args) }];
          } else {
            const source = instance.evidence().sources.find(row => row.kind === (c.family === "unsupported_robot_capability" ? "operator" : c.family === "stale_specifications" ? "knowledge" : "video"));
            const assessment: SiteAssessment = { status: "assessment", job: [{ text, basis: p.assertedBasis as SiteAssessment["job"][number]["basis"],
              evidence: [{ source_id: source?.source_id ?? "video:failed-tool-source-not-admitted", at_seconds: p.citationSeconds }] }],
              objects_motions_conditions_variations: [], operator_success: [], known: [], estimates: [], missing: [], approaches: [],
              next_action: { kind: "research", action: "Resolve missing evidence", why: { text: "Decision remains uncertain", basis: "unknown", evidence: [] } }, questions: [] };
            output = [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(assessment) }] }];
          }
          providerOutputs.push(output);
          return { output, usage: new Usage() };
        },
        async *getStreamedResponse() { throw new Error("streaming_not_used"); },
      };
      instance = await createSiteAssessmentAgent({ request_id: `synthetic-${c.caseId}`,
        operator_messages: [{ id: c.sourceId, text: operatorText, source_ref: `synthetic/${c.sourceId}` }],
        video: { source_id: c.sourceId, source_ref: `synthetic/${c.sourceId}`, url: "https://example.invalid/not-fetched", sha256: "b".repeat(64), duration_seconds: 60 },
        site_requirement: { spec: {}, serviceArea: null, location: { label: null, city: null, state: null, country: null }, taskFamily: null } },
        { model, history_access: { principalId: "synthetic-owner", expiresAt: "2099-01-01T00:00:00Z" },
          allowed_tools: ["analyze_site_video", "search_robot_knowledge", "fetch_robot_knowledge"],
          authorize_model_call: async () => { modelCalls++; }, read_robot_teams: async () => [],
          history_tool: async name => { historyCalls++; return name === "search_company_history"
            ? { ok: true, rows: [{ record_id: c.sourceId }], next_cursor: null }
            : { ok: true, record: { record_id: c.sourceId, source_ref: `synthetic/${c.sourceId}`, source_sha256: hash(knowledgeContent),
              original_checked_at: c.family === "stale_specifications" ? "2020-01-01" : null,
              current: c.family !== "stale_specifications", content: knowledgeContent } }; },
          analyze_video: async () => { videoCalls++; return { evidence: videoReading, receipt: { fixtureOnly: true, noVideoBytesRead: true } }; } });
      const start = performance.now();
      let error: string | null = null, packet: unknown = null;
      try { packet = await instance.run(); } catch (failure) { error = failure instanceof Error ? failure.message : "non_error"; }
      const actual = error ? "reject" : "accept";
      const status = c.semanticOnly ? "partial" : actual === c.structuralExpectation ? "passed" : "failed";
      results.push({ caseId: c.caseId, semanticHash: c.semanticHash, actualInputHash, sourceId: c.sourceId, split: c.split,
        family: c.family, expectedRelationship: p.expectedRelationship, structuralExpectation: c.structuralExpectation,
        labelStatus: c.labelStatus, status, actual, error, repeat, latencyMs: performance.now() - start,
        scriptedModelCalls: modelCalls, scriptedVideoCallbacks: videoCalls, scriptedHistoryCallbacks: historyCalls,
        sourcesAndToolReceipts: instance.evidence(), scriptedProviderOutputs: providerOutputs, packet,
        interpretation: c.semanticOnly ? "SDK admission executed; semantic relationship remains unscored; no accuracy denominator" : "SDK source-admission regression; no model or video quality proof" });
      if (!c.semanticOnly) expect(actual).toBe(c.structuralExpectation);
    }
  });
});
