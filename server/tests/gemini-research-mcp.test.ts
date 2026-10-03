// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryWorkStore } from "./helpers/work-memory-store";
import { executeGeminiResearchTool, GEMINI_RESEARCH_CONTROL_KEY, GEMINI_RESEARCH_START_SCOPE,
  GEMINI_RESEARCH_READ_SCOPE, type ResearchArtifacts } from "../utils/geminiResearchMcp";
import { createGeminiInteraction, extractGeminiInteractionText } from "../utils/geminiInteractions";
const actor = { uid: "founder", tenantId: null, authTime: 1000 };
const scopes = [GEMINI_RESEARCH_START_SCOPE, GEMINI_RESEARCH_READ_SCOPE];
const question = { request_key: "study-1", question: "Compare wheeled manipulation with fixed arm CNC tending; cite original sources." };
const control = { enabled: true, actorUid: actor.uid, tenantId: null, scopeRef: "retained-owner-scope",
  budgetRef: "retained-research-budget", expiresAt: "2026-10-10T00:00:00Z", dailySoftTargetMicros: 10000000, reservationMicros: 7000000 };
const output = { id: "gemini-owned-1", status: "completed", usage: { total_tokens: 197 },
  steps: [{ type: "model_output", content: [{ type: "text", text: "Source-backed report https://source.example/research" }],
    grounding_metadata: { citations: [{ uri: "https://source.example/research" }] } }] };
async function fixture() {
  const store = new MemoryWorkStore(); await store.set(GEMINI_RESEARCH_CONTROL_KEY, control);
  const evidence = new Map<string, unknown>();
  const artifacts: ResearchArtifacts = {
    retain: vi.fn(async value => {
      const bytes = JSON.stringify(value), sha256 = createHash("sha256").update(bytes).digest("hex"); evidence.set(sha256, structuredClone(value));
      return { artifactRef: `gs://company/research/${sha256}.json`, sha256, bytes: Buffer.byteLength(bytes), generation: "1" };
    }),
    read: vi.fn(async receipt => structuredClone(evidence.get(receipt.sha256))),
  };
  const create = vi.fn(async () => output), get = vi.fn(async () => output);
  return { store, artifacts, create, get, clock: () => new Date("2026-10-03T13:00:00Z") };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Gemini Max delegated research MCP", () => {
  it("claims once across concurrent requests, retains complete citations, and pages company evidence without another provider call", async () => {
    const f = await fixture();
    const [first, concurrent] = await Promise.all([executeGeminiResearchTool("start_gemini_deep_research", question, actor, scopes, f),
      executeGeminiResearchTool("start_gemini_deep_research", question, actor, scopes, f)]);
    expect(f.create).toHaveBeenCalledTimes(1); expect(first).toMatchObject({ status: "completed", cost_micros: null, reserved_micros: 7000000 });
    expect(concurrent).toBeDefined(); expect(f.create.mock.calls[0][0]).toMatchObject({ agent: "deep-research-max-preview-04-2026", background: true });
    const page = await executeGeminiResearchTool("get_gemini_deep_research", { request_key: "study-1", view: "provider_record", characters: 20 }, actor, scopes, f);
    expect(page).toMatchObject({ report: JSON.stringify(output).slice(0, 20), next_cursor: 20 });
    expect(f.get).not.toHaveBeenCalled(); expect(f.artifacts.retain).toHaveBeenCalledWith(output);
    const budget = [...f.store.rows.values()].find(v => v.schema === "blueprint.gemini-research-budget.v1");
    expect(budget).toMatchObject({ reservedMicros: 7000000, actualTotalMicros: null, scheduledDay: "2026-10-03" });
  });
  it("leaves a lost create acknowledgement observe-only, reserves its unknown charge and refuses changed question/new exposure", async () => {
    const f = await fixture(); f.create.mockRejectedValue(new Error("network disconnected after POST"));
    expect(await executeGeminiResearchTool("start_gemini_deep_research", question, actor, scopes, f)).toMatchObject({ status: "create_ack_unknown" });
    await executeGeminiResearchTool("start_gemini_deep_research", question, actor, scopes, f);
    await executeGeminiResearchTool("get_gemini_deep_research", { request_key: "study-1" }, actor, scopes, f);
    expect(f.create).toHaveBeenCalledTimes(1); expect(f.get).not.toHaveBeenCalled();
    await expect(executeGeminiResearchTool("start_gemini_deep_research", { ...question, question: "different" }, actor, scopes, f)).rejects.toThrow("question_changed");
    await expect(executeGeminiResearchTool("start_gemini_deep_research", { ...question, request_key: "study-2" }, actor, scopes, f)).rejects.toThrow("reservation_exhausted");
  });
  it("retains a real HTTP400 transport diagnosis privately on the original claim and never resubmits it", async () => {
    const f = await fixture();
    vi.stubEnv("GOOGLE_GENAI_API_KEY", "nonsecret-fixture-key");
    const payload = { error: { code: 400, status: "INVALID_ARGUMENT", message: "Private original body detail", details: [{ field: "agent_config" }] } };
    const fetch = vi.fn(async () => new Response(JSON.stringify(payload), { status: 400,
      headers: { "x-goog-request-id": "req-google-one", "x-other-private-header": "must-not-retain" } }));
    vi.stubGlobal("fetch", fetch);
    f.create.mockImplementation(createGeminiInteraction as any);
    const rejected = await executeGeminiResearchTool("start_gemini_deep_research", question, actor, scopes, f);
    expect(rejected).toMatchObject({ status: "create_http_error", provider_http_status: 400, provider_error_code: "INVALID_ARGUMENT", cost_micros: null });
    expect(JSON.stringify(rejected)).not.toContain("Private original body detail");
    expect(rejected).toHaveProperty("private_diagnostic.sha256");
    await executeGeminiResearchTool("start_gemini_deep_research", question, actor, scopes, f);
    const observed = await executeGeminiResearchTool("get_gemini_deep_research", { request_key: "study-1", view: "provider_record" }, actor, scopes, f);
    const diagnosis = JSON.parse((observed as any).report);
    expect(diagnosis).toMatchObject({ requestKey: question.request_key, claimedAt: "2026-10-03T13:00:00.000Z",
      httpStatus: 400, requestId: "req-google-one", operation: "create", payload });
    expect(JSON.stringify(diagnosis)).not.toContain("must-not-retain");
    expect(diagnosis.questionSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(fetch).toHaveBeenCalledTimes(1); expect(f.get).not.toHaveBeenCalled();
    expect([...f.store.rows.values()].find(v => v.requestKey === "study-1")).toMatchObject({ providerId: null, reservationMicros: 7000000, costMicros: null });
  });
  it("does not infer scope/budget access from GPU grants, missing/disabled/expired control, or another actor", async () => {
    const f = await fixture();
    await expect(executeGeminiResearchTool("start_gemini_deep_research", question, actor, ["blueprint:runs:launch"], f)).rejects.toThrow("research_scope_required");
    for (const bad of [undefined, { ...control, enabled: false }, { ...control, expiresAt: "2026-10-02T00:00:00Z" }, { ...control, actorUid: "other" }]) {
      if (!bad) f.store.rows.delete(GEMINI_RESEARCH_CONTROL_KEY); else await f.store.set(GEMINI_RESEARCH_CONTROL_KEY, bad);
      await expect(executeGeminiResearchTool("start_gemini_deep_research", question, actor, scopes, f)).rejects.toThrow("research_");
    }
    expect(f.create).not.toHaveBeenCalled(); expect([...f.store.rows.keys()].filter(k => k.startsWith("request-"))).toHaveLength(0);
  });
  it("retains accepted provider identity before a failed private archive, then recovers by GET without creating again", async () => {
    const f = await fixture(); vi.mocked(f.artifacts.retain).mockRejectedValueOnce(new Error("archive unavailable"));
    await expect(executeGeminiResearchTool("start_gemini_deep_research", question, actor, scopes, f)).rejects.toThrow("archive");
    expect([...f.store.rows.values()].find(v => v.requestKey === "study-1")).toMatchObject({ providerId: output.id, status: "accepted" });
    await f.store.set(GEMINI_RESEARCH_CONTROL_KEY, { ...control, enabled: false });
    expect(await executeGeminiResearchTool("get_gemini_deep_research", { request_key: "study-1" }, actor, scopes, f)).toMatchObject({ status: "completed" });
    expect(f.create).toHaveBeenCalledTimes(1); expect(f.get).toHaveBeenCalledWith(output.id, 45000);
  });
  it("reports exact field repair feedback, denies foreign request access, and never reports missing usage as zero", async () => {
    const f = await fixture(); f.create.mockResolvedValue({ ...output, usage: undefined } as any);
    expect(await executeGeminiResearchTool("start_gemini_deep_research", { request_key: "../unsafe", question: "" }, actor, scopes, f))
      .toMatchObject({ isError: true, fields: [{ field: "request_key" }, { field: "question" }] });
    expect(await executeGeminiResearchTool("start_gemini_deep_research", question, actor, scopes, f))
      .toMatchObject({ usage_retained: false, cost_micros: null, usage_complete: false });
    await expect(executeGeminiResearchTool("get_gemini_deep_research", { request_key: "study-1" }, { ...actor, uid: "foreign" }, scopes, f)).rejects.toThrow("not_found");
  });
  it("keeps a newer terminal receipt when an older GET observer returns late", async () => {
    const f = await fixture(); f.create.mockResolvedValue({ ...output, status: "in_progress" });
    await executeGeminiResearchTool("start_gemini_deep_research", question, actor, scopes, f);
    let finishStale!: (value: typeof output) => void;
    f.get.mockImplementationOnce(() => new Promise(resolve => { finishStale = resolve; }));
    const stale = executeGeminiResearchTool("get_gemini_deep_research", { request_key: "study-1" }, actor, scopes, f);
    while (!finishStale) await Promise.resolve();
    const final = await executeGeminiResearchTool("get_gemini_deep_research", { request_key: "study-1" }, actor, scopes, f);
    expect(final).toMatchObject({ status: "completed" });
    finishStale({ ...output, status: "in_progress" });
    expect(await stale).toMatchObject({ status: "completed", full_raw_evidence: (final as any).full_raw_evidence });
    expect([...f.store.rows.values()].find(v => v.requestKey === "study-1")?.status).toBe("completed");
    expect(f.create).toHaveBeenCalledTimes(1);
  });
  it("supports complete current reports and older outputs without adding thinking summaries or stripping original whitespace", () => {
    expect(extractGeminiInteractionText({ id: "x", status: "completed", steps: [
      { type: "thought", content: [{ type: "text", text: "private reasoning" }] },
      { type: "model_output", content: [{ type: "text", text: "  exact report\n" }, { type: "image", uri: "irrelevant" }] },
    ], outputs: [{ text: "stale duplicate" }] })).toBe("  exact report\n");
    expect(extractGeminiInteractionText({ id: "x", status: "completed", outputs: [{ text: "legacy citation\n" }] })).toBe("legacy citation\n");
  });
});
