// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { Usage, type Model, type ModelResponse } from "@openai/agents";
import { createSiteAssessmentAgent, validateAssessmentEvidence, type SiteAssessment } from "../agents/site-assessment";

describe("site assessment agent", () => {
  it("uses the SDK tool loop to inspect video and fetch authorized evidence, then returns questions with retained sources", async () => {
    const authorize = vi.fn(async () => undefined);
    const analyze = vi.fn(async () => ({ evidence: { summary: "Rack movement", observations: [
      { category: "motion" as const, finding: "Rack slides outward", basis: "observed" as const,
        start_seconds: 8, end_seconds: 10, uncertainty: null },
    ], not_observable: ["Dish loading", "Required success rate"] }, receipt: { model_version: "scripted-fixture" } }));
    let turn = 0;
    const question = "What actually moves?";
    const model: Model = {
      async getResponse(request): Promise<ModelResponse> {
        expect(request.modelSettings.providerData).toMatchObject({ service_tier: "default" });
        turn++;
        const call = (name: string, args: unknown) => ({ type: "function_call" as const, callId: `call-${turn}`,
          name, arguments: JSON.stringify(args) });
        const response = (output: ModelResponse["output"]): ModelResponse => ({ output, usage: new Usage() });
        if (turn === 1 || turn === 2) return response([call("analyze_site_video", { question, processing: "auto", sampling_fps: 2 })]);
        if (turn === 3) return response([call("search_robot_knowledge", { query: "rack manipulation", city: null, task: null, company: null, kind: null, cursor: null })]);
        if (turn === 4) return response([call("fetch_robot_knowledge", { record_id: "capability:one" })]);
        if (turn === 5) return response([call("read_robot_registry", {})]);
        const state = JSON.stringify(request.input);
        const source_id = state.match(/video:capture-one:[a-f0-9]{12}/)![0];
        const assessment: SiteAssessment = {
          status: "needs_operator_input",
          job: [{ text: "The rack slides; dish loading is not shown.", basis: "observed", evidence: [{ source_id, at_seconds: 8 }] }],
          objects_motions_conditions_variations: [], operator_success: [], known: [], estimates: [],
          missing: [{ text: "Operator acceptance threshold", basis: "unknown", evidence: [] }], approaches: [],
          next_action: { kind: "ask_operator", action: "Confirm the intended job and acceptance threshold.",
            why: { text: "The intended job is not established by rack movement alone.", basis: "estimate", evidence: [{ source_id, at_seconds: 8 }] } },
          questions: [{ question: "Is the job rack operation or loading dishes, and what counts as acceptable?", decision_it_changes: "Task boundary and success criteria" }],
        };
        return response([{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(assessment) }] }]);
      },
      async *getStreamedResponse() { throw new Error("streaming_not_used"); },
    };
    const history = vi.fn(async (name: string) => name === "search_company_history"
      ? { ok: true, rows: [{ record_id: "capability:one" }], next_cursor: null }
      : { ok: true, record: { record_id: "capability:one", source_ref: "sourceSnapshots/one", source_sha256: "a".repeat(64),
        original_checked_at: "2026-09-01", current: true, content: { published_reach: "vendor claim" } } });
    const instance = await createSiteAssessmentAgent({ request_id: "request-one",
      operator_messages: [{ id: "one", text: "Help with the dishwasher job", source_ref: "inboundRequests/request-one/request/taskDescription" }],
      video: { source_id: "capture-one", source_ref: "gs://fixture/capture-one/video.mp4#generation-one",
        url: "https://example.com/admitted.mp4", sha256: "b".repeat(64), duration_seconds: 30.1 },
      site_requirement: { spec: {}, serviceArea: null, location: { label: null, city: null, state: null, country: null }, taskFamily: null },
    }, { model, authorize_model_call: authorize, analyze_video: analyze, history_tool: history,
      read_robot_teams: async () => [], history_access: { principalId: "fixture-owner", expiresAt: "2099-01-01T00:00:00Z" } });
    const result = await instance.run();
    expect(result.assessment.status).toBe("needs_operator_input");
    expect(analyze).toHaveBeenCalledTimes(1); // Identical probes reuse the retained reading.
    expect(history).toHaveBeenCalledTimes(2);
    expect(authorize).toHaveBeenCalledTimes(6);
    expect(result.sources.map(row => row.kind)).toEqual(["operator", "video", "knowledge"]);
    expect(result.sources.find(row => row.kind === "knowledge")?.checked_at).toBe("2026-09-01");
    expect(result.tool_receipts).toHaveLength(5);
    const invented = structuredClone(result.assessment);
    invented.job[0].evidence[0].source_id = "unseen-source";
    expect(() => validateAssessmentEvidence(invented, new Map(result.sources.map(row => [row.source_id, row])), 30.1)).toThrow("assessment_unknown_source_id");
  });
});
