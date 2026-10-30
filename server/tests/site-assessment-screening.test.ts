// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { Usage, type Model, type ModelResponse } from "@openai/agents";
import { createSiteAssessmentAgent, renderSourceBoundAssessment, type SiteAssessment } from "../agents/site-assessment";
import { assessmentReadActions } from "../agents/tasks/site-assessment";
import { taskScreeningEvidence, readCurrentTaskScreening } from "../utils/taskScreeningEvidence";
import type { ManagedJobEvidenceSummary } from "../utils/jobManagedEvaluation";
import { allCandidateFamilyScreeningFixture } from "./fixtures/beta-policy-screening";

const input = { request_id: "job-one", operator_messages: [{ id: "owner", text: "Compare the candidates for this task.", source_ref: "synthetic/operator" }],
  video: null, site_requirement: { spec: {}, serviceArea: null,
    location: { label: null, city: null, state: null, country: null }, taskFamily: null } };
const assessment = (): SiteAssessment => ({ status: "assessment", job: [], objects_motions_conditions_variations: [],
  operator_success: [], known: [], estimates: [], missing: [], approaches: [], questions: [],
  next_action: { kind: "research", action: "Read the recorded outcomes.", why: { text: "", basis: "unknown", evidence: [] } } });

function fixture() {
  const { publication } = allCandidateFamilyScreeningFixture();
  const row: ManagedJobEvidenceSummary = { runId: publication.campaign_id, state: "queued", current: true,
    resultDigest: null, summary: "", nextAction: "", limitations: [], href: "",
    screening: { provenance: { schema_version: publication.schema_version, claim_ceiling: publication.claim_ceiling,
      source: publication.source, generated_at: publication.generated_at, publication_digest: publication.publication_digest,
      catalog_digest: publication.catalog_digest, plan_digest: publication.plan_digest },
      candidates: publication.candidates.map(item => ({ candidateId: item.candidate_id, name: item.display_name,
        configurationDigest: item.configuration_digest, state: item.status, planned: item.episodes_planned,
        scored: item.episodes_scored, succeeded: item.episodes_succeeded, failed: item.episodes_failed,
        void: item.episodes_void, blockers: item.blockers })) } };
  // Newly registered runtime identities must need no WebApp model-name list.
  row.screening!.candidates.push({ ...row.screening!.candidates[0], candidateId: "molmoact2_bimanual_yam",
    name: "MolmoAct 2 on bimanual YAM", state: "pending", blockers: [] });
  const scope = { requestId: "job-one", briefDigest: "sha256:" + "a".repeat(64), captureId: publication.source.capture_id };
  return { scope, row, readback: taskScreeningEvidence(scope, [row], "2026-10-30T00:00:00Z") };
}

describe("task-bound screening readback for the assessment agent", () => {
  it("uses the real SDK tool with all delivered candidates and source-bound limits", async () => {
    const { readback } = fixture(), source = readback.evidence_source!;
    const reader = vi.fn(async () => readback);
    const result = assessment();
    result.known = [{ text: "All robots have already succeeded on this task and can be deployed.", basis: "published", evidence: [{
      source_id: source.source_id, at_seconds: null, selector: { kind: "qualified_field", observation_index: null,
        field_path: ["candidate_statements", "campaign-one:molmoact2_bimanual_yam"] },
    }] }];
    let turn = 0;
    const model: Model = { async getResponse(request): Promise<ModelResponse> {
      if (++turn === 1) return { usage: new Usage(), output: [{ type: "function_call", callId: "screening", name: "read_current_task_screening", arguments: "{}" }] };
      expect(JSON.stringify(request.input)).toContain("molmoact2_bimanual_yam");
      expect(JSON.stringify(request.input)).toContain("No scored task outcome is established");
      return { usage: new Usage(), output: [{ type: "message", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(result) }] }] };
    }, async *getStreamedResponse() { throw new Error("unused"); } };
    const instance = await createSiteAssessmentAgent(input, { model, history_access: null, authorize_model_call: async () => {},
      allowed_tools: assessmentReadActions, read_current_task_screening: reader });
    const tool = instance.agent.tools.find(item => item.name === "read_current_task_screening")!;
    expect(tool).toMatchObject({ parameters: { properties: {}, additionalProperties: false } });
    const delivered = await instance.run();
    expect(reader).toHaveBeenCalledWith();
    expect((delivered.tool_receipts[0].result as typeof readback).runs[0].candidates).toHaveLength(85);
    expect(delivered.assessment.known[0].text).toContain("status pending");
    expect(delivered.assessment.known[0].text).toContain("No scored task outcome is established");
    expect(delivered.assessment.known[0].text).toContain("does not establish physical performance");
    expect(delivered.assessment.known[0].text).toContain(readback.runs[0].provenance!.generated_at);
    expect(delivered.assessment.known[0].text).not.toContain("All robots have already succeeded");
    const measured = structuredClone(result); measured.known[0].basis = "measured";
    expect(renderSourceBoundAssessment(measured, new Map([[source.source_id, source]]), null).assessment.known[0].basis).toBe("unknown");
  });

  it("keeps historical and other-capture results out and reads the latest current campaign for each task", () => {
    const { scope, row } = fixture();
    const previous = { ...structuredClone(row), runId: "previous-campaign" };
    const historical = { ...structuredClone(row), current: false, runId: "historical-campaign" };
    const otherCapture = structuredClone(row); otherCapture.screening!.provenance!.source.capture_id = "another-capture";
    const result = taskScreeningEvidence(scope, [historical, otherCapture, row, previous], "2026-10-30T00:00:00Z");
    expect(result.runs.map(run => run.run_id)).toEqual([row.runId]);
    expect(result.coverage).toContain("across_job_history");
  });

  it("does not infer runtime support when no current task brief or result exists", async () => {
    const { scope } = fixture();
    expect(taskScreeningEvidence(scope, [], "2026-10-30T00:00:00Z")).toMatchObject({ status: "unavailable", runs: [], evidence_source: null });
    expect(await readCurrentTaskScreening({ ...scope, briefDigest: null })).toMatchObject({ status: "unavailable",
      unavailable_reason: "current_task_brief_unavailable", runs: [], evidence_source: null });
  });

  it.each(["model_scope_argument", "wrong_host_scope"])("does not expose another task through %s", async mode => {
    const { readback } = fixture();
    const reader = vi.fn(async () => mode === "wrong_host_scope" ? { ...readback, request_id: "other-job" } : readback);
    let turn = 0;
    const model: Model = { async getResponse(): Promise<ModelResponse> {
      if (++turn === 1) return { usage: new Usage(), output: [{ type: "function_call", callId: "screening",
        name: "read_current_task_screening", arguments: mode === "model_scope_argument" ? '{"request_id":"other-job"}' : "{}" }] };
      return { usage: new Usage(), output: [{ type: "message", role: "assistant", status: "completed",
        content: [{ type: "output_text", text: JSON.stringify(assessment()) }] }] };
    }, async *getStreamedResponse() { throw new Error("unused"); } };
    const instance = await createSiteAssessmentAgent(input, { model, history_access: null, authorize_model_call: async () => {},
      allowed_tools: assessmentReadActions, read_current_task_screening: reader });
    const result = await instance.run();
    expect(reader).toHaveBeenCalledTimes(mode === "model_scope_argument" ? 0 : 1);
    expect(result.sources.some(source => source.source_id.startsWith("taskScreening:"))).toBe(false);
    expect(result.tool_receipts).toHaveLength(0);
  });
});
