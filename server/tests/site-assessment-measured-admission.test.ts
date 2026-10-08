// @vitest-environment node
// Real SDK/core/Gemini adapter, scripted model and HTTP only. No perception proof.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { OpenAIProvider, Usage, type Model, type ModelResponse } from "@openai/agents";
import { createSiteAssessmentAgent, type SiteAssessment } from "../agents/site-assessment";

const bytes = Buffer.from("owned-synthetic-video-source");
const sourceSha = createHash("sha256").update(bytes).digest("hex");
const videoInput = { source_id: "fixture-capture", source_ref: "gs://fixture/video.mp4#generation-1",
  url: "https://fixture.invalid/video.mp4", sha256: sourceSha, duration_seconds: 8 };
const input = { request_id: "fixture-request", operator_messages: [{ id: "owner", text: "Inspect the synthetic pattern; real task success is unknown.",
  source_ref: "inboundRequests/fixture-request/request/taskDescription" }], video: videoInput,
  site_requirement: { spec: {}, serviceArea: null, location: { label: null, city: null, state: null, country: null }, taskFamily: null } };

function fixture(options: { probes?: number; beforeUpload?: "withdrawn" | "stale"; revokeAfterUpload?: boolean } = {}) {
  const events: string[] = [], bounds: any[] = [], providerResponses: any[] = [];
  const probes = options.probes ?? 1;
  let turn = 0, uploads = 0, sourceCurrent = true;
  const fetcher = vi.fn(async (raw: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(raw);
    if (!url.startsWith("https://generativelanguage.googleapis.com/")) throw Error("external_network_refused");
    if (url.endsWith("/upload/v1beta/files")) {
      events.push("upload:start");uploads++;
      return new Response("{}", { status: 200, headers: { "x-goog-upload-url": `https://generativelanguage.googleapis.com/upload?fixture=${uploads}` } });
    }
    if (url.includes("/upload?fixture=")) {
      events.push("upload:bytes");expect(init.body).toBeInstanceOf(ReadableStream);
      expect(init).toMatchObject({ duplex: "half", headers: expect.objectContaining({ "Content-Length": String(bytes.length) }) });
      const reader = (init.body as ReadableStream<Uint8Array>).getReader();
      const uploadedHash = createHash("sha256");
      let uploadedBytes = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        expect(value.byteLength).toBeLessThanOrEqual(64 * 1024);
        expect(value.buffer).toBe(bytes.buffer);
        expect(value.byteOffset).toBe(bytes.byteOffset + uploadedBytes);
        uploadedHash.update(value);
        uploadedBytes += value.byteLength;
      }
      expect(uploadedBytes).toBe(bytes.length);
      expect(uploadedHash.digest("hex")).toBe(sourceSha);
      if (options.revokeAfterUpload) sourceCurrent = false;
      return new Response(JSON.stringify({ file: { name: `files/fixture-${uploads}`, state: "ACTIVE", mimeType: "video/mp4",
        uri: `https://generativelanguage.googleapis.com/v1beta/files/fixture-${uploads}` } }), { status: 200 });
    }
    if (url.includes(":countTokens")) throw Error("unexpected_budget_prerequisite");
    if (url.includes(":generateContent")) {
      events.push("generate");expect(events.at(-2)).toBe("source:guard");
      const index = uploads - 1;
      return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({
        summary: `Scripted synthetic marker ${index}`, observations: [{ category: "motion", finding: `Synthetic marker ${index} changes position`,
          basis: "observed", start_seconds: index, end_seconds: index + 0.5, uncertainty: "Scripted transport fixture, not real perception" }],
        not_observable: ["Real task success", "Robot capability"],
      }) }] } }], usageMetadata: { promptTokenCount: 111, candidatesTokenCount: 7, totalTokenCount: 118 } }), { status: 200 });
    }
    if (url.includes("/v1beta/files/fixture-") && init.method === "DELETE") {
      events.push("delete");return new Response("{}", { status: 200 });
    }
    throw Error("unexpected_fixture_http_request");
  });
  const model: Model = {
    async getResponse(request): Promise<ModelResponse> {
      events.push("sol");turn++;
      if (turn <= probes) return { output: [{ type: "function_call", callId: `fixture-${turn}`, name: "analyze_site_video",
        arguments: JSON.stringify({ question: `At ${turn - 1} seconds, what changes the interpretation of synthetic marker ${turn - 1}?`, processing: "static", sampling_fps: 2 }) }], usage: new Usage() };
      const ids = [...new Set(JSON.stringify(request.input).match(/video:fixture-capture:[a-f0-9]{12}/g) ?? [])];
      const assessment: SiteAssessment = { status: "needs_operator_input", job: ids.map((source_id, index) => ({
        text: "Unverified model wording retained privately", basis: "observed", evidence: [{ source_id, at_seconds: index,
          selector: { kind: "video_observation", observation_index: 0, field_path: null } }],
      })), objects_motions_conditions_variations: [], operator_success: [], known: [], estimates: [], approaches: [],
        missing: [{ text: "Real task success remains unknown", basis: "unknown", evidence: [] }], questions: [],
        next_action: { kind: "ask_operator", action: "Provide real task evidence", why: { text: "Task success is unknown", basis: "unknown", evidence: [] } } };
      return { output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(assessment) }] }], usage: new Usage() };
    }, async *getStreamedResponse() { throw Error("unexpected_stream"); },
  };
  vi.stubEnv("GEMINI_API_KEY", "synthetic-offline-key");vi.stubEnv("OPENAI_API_KEY", "synthetic-offline-key");
  vi.stubGlobal("fetch", fetcher);vi.spyOn(OpenAIProvider.prototype, "getModel").mockResolvedValue(model);
  const authorize = vi.fn(async (provider: string, _model: string, request?: any) => {
    events.push(`authorize:${provider}`);
    if (provider === "gemini") {
      if (!sourceCurrent) throw Error("fixture_authority_revoked");
      expect(request).toMatchObject({ bytes: bytes.length, duration_seconds: videoInput.duration_seconds });
      bounds.push(request);
    }
  });
  return { events, bounds, fetcher, authorize, providerResponses,
    async run() {
      const instance = await createSiteAssessmentAgent(input, { history_access: null, authorize_model_call: authorize,
        video_bytes: { body: bytes, byteLength: bytes.length, contentType: "video/mp4" },
        assert_video_processing_allowed: async () => {
          events.push("source:guard");if (options.beforeUpload) throw Error(`fixture_${options.beforeUpload}`);
          if (!sourceCurrent) throw Error("fixture_authority_revoked");
        }, record_model_response: async (provider, _model, response) => {
          events.push(`record:${provider}`);if (provider === "gemini") providerResponses.push(response);
        } });
      return { instance, result: await instance.run() };
    } };
}

afterEach(() => { vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs(); });
describe("SDK source-bound Gemini accounting bridge", () => {
  it("retains four distinct source readings without a spending quota through real SDK and Gemini generation", async () => {
    const f = fixture({ probes: 4 });const { result } = await f.run();
    expect(f.events.filter(event => event === "sol")).toHaveLength(5);
    expect(f.bounds).toHaveLength(4);expect(f.providerResponses).toHaveLength(4);
    expect(f.events.filter(event => ["source:guard", "upload:start", "upload:bytes", "authorize:gemini", "generate", "delete", "record:gemini"].includes(event)))
      .toEqual(Array.from({ length: 4 }, () => ["authorize:gemini", "source:guard", "upload:start", "upload:bytes", "source:guard", "generate", "delete", "record:gemini"]).flat());
    const videos = result.sources.filter(source => source.kind === "video");expect(videos).toHaveLength(4);
    expect(videos.every(source => source.sha256 === sourceSha && source.canonical_ref === videoInput.source_ref)).toBe(true);
    expect(result.assessment.job).toHaveLength(4);expect(result.verification.source_bound_claims).toBe(4);
    expect(result.assessment.job[0].text).toContain("Synthetic marker 0 changes position");
    expect(result.assessment.job[0].text).toContain("does not establish calibrated measurements or robot capability");
    expect(result.raw_model_assessment.job[0].text).toBe("Unverified model wording retained privately");
    expect(f.providerResponses.every(response => response.usage.totalTokenCount === 118)).toBe(true);
  });

  it.each(["withdrawn", "stale"] as const)("refuses %s authority before uploading a source", async beforeUpload => {
    const f = fixture({ beforeUpload });const { result } = await f.run();
    expect(f.events).toContain("source:guard");expect(f.fetcher).not.toHaveBeenCalled();
    expect(f.bounds).toHaveLength(1);expect(f.providerResponses).toHaveLength(0);
    expect(result.assessment.status).toBe("needs_operator_input");expect(result.assessment.job).toEqual([]);
    expect(result.assessment.known).toEqual([]);expect(result.assessment.approaches).toEqual([]);
    expect(result.sources.filter(source => source.kind === "video")).toHaveLength(0);
    expect(result.verification.source_bound_claims).toBe(0);
  });

  it("refuses authority revoked during upload, prevents generation and deletes the upload", async () => {
    const f = fixture({ revokeAfterUpload: true });const { result } = await f.run();
    expect(f.events).toContain("upload:bytes");expect(f.events).toContain("authorize:gemini");expect(f.events).not.toContain("generate");
    expect(f.events.filter(event => event === "delete")).toHaveLength(1);
    expect(f.bounds).toHaveLength(1);expect(f.providerResponses).toHaveLength(0);
    expect(result.assessment.status).toBe("needs_operator_input");expect(result.assessment.job).toEqual([]);
    expect(result.assessment.known).toEqual([]);expect(result.assessment.approaches).toEqual([]);
    expect(result.sources.filter(source => source.kind === "video")).toHaveLength(0);
    expect(result.verification.source_bound_claims).toBe(0);
  });
});
