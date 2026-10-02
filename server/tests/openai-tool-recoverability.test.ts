// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z, ZodError } from "zod";

const mocks = vi.hoisted(() => ({ create: vi.fn(), tool: vi.fn() }));
vi.mock("openai", () => ({ default: class { responses = { create: mocks.create }; } }));
vi.mock("../agents/operator-tools", async (importOriginal) => ({
  ...await importOriginal<typeof import("../agents/operator-tools")>(),
  openAiResponsesOperatorTools: [
    { type: "function", name: "list_growth_campaigns" },
    { type: "function", name: "create_growth_campaign_draft" },
    { type: "function", name: "verify_growth_integrations" },
  ], runOperatorTool: mocks.tool,
}));

const call = (call_id: string, args = "{}", name = "list_growth_campaigns") =>
  ({ type: "function_call", call_id, name, arguments: args });
const response = (output: unknown[], output_text = "") => ({ id: "response-fixture", output, output_text,
  usage: { input_tokens: 100, output_tokens: 20 } });
const final = () => response([], JSON.stringify({ done: true }));
async function run(metadata: Record<string, unknown> = {}) {
  const { runOpenAIResponsesTask } = await import("../agents/adapters/openai-responses");
  return runOpenAIResponsesTask({ kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses",
    model: "gpt-5.6-sol", input: {}, metadata, session_policy: { lane: "task" },
    tool_policy: { mode: "mixed" }, definition: { build_prompt: () => "Inspect the authorized fixture.",
      output_schema: z.object({ done: z.boolean() }) } } as any);
}
const outputs = (requestIndex = 1) => mocks.create.mock.calls[requestIndex][0].input
  .filter((item: any) => item.type === "function_call_output")
  .map((item: any) => ({ id: item.call_id, result: JSON.parse(item.output) }));
beforeEach(() => { vi.resetModules(); vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
  mocks.create.mockReset(); mocks.tool.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe("OpenAI operator tool feedback", () => {
  it("returns malformed argument feedback to the same loop, retains sibling results, then accepts corrected arguments", async () => {
    mocks.create.mockResolvedValueOnce(response([call("bad", "{bad PRIVATE_SENTINEL"), call("sibling")]))
      .mockResolvedValueOnce(response([call("corrected", '{"city":"Sacramento"}')])).mockResolvedValueOnce(final());
    mocks.tool.mockResolvedValue({ rows: [] });
    expect((await run()).status).toBe("completed");
    expect(outputs()).toEqual([
      { id: "bad", result: expect.objectContaining({ status: "recoverable_issue", code: "tool_arguments_invalid_json",
        issues: [{ path: "/arguments", code: "invalid_json" }] }) },
      { id: "sibling", result: { rows: [] } },
    ]);
    expect(mocks.tool).toHaveBeenCalledTimes(2);
    expect(mocks.tool).toHaveBeenLastCalledWith("list_growth_campaigns", { city: "Sacramento" });
    expect(JSON.stringify(outputs())).not.toContain("PRIVATE_SENTINEL");
  });

  it("returns exact schema paths without reflecting private validation messages", async () => {
    mocks.create.mockResolvedValueOnce(response([call("invalid")])).mockResolvedValueOnce(final());
    mocks.tool.mockRejectedValueOnce(new ZodError([{ code: "custom", path: ["recipient", "email"], message: "PRIVATE_SENTINEL" }]));
    await run();
    expect(outputs()[0].result).toMatchObject({ status: "recoverable_issue", code: "tool_arguments_invalid",
      issues: [{ path: "/recipient/email", code: "custom" }] });
    expect(JSON.stringify(outputs())).not.toContain("PRIVATE_SENTINEL");
  });

  it("keeps permission failures denied and uncertain mutation failures reconciliation-only", async () => {
    mocks.create.mockResolvedValueOnce(response([call("denied"), call("unknown", "{}", "create_growth_campaign_draft")]))
      .mockResolvedValueOnce(final());
    mocks.tool.mockRejectedValueOnce(Object.assign(new Error("PRIVATE_ACCESS_TOKEN"), { status: 403 }))
      .mockRejectedValueOnce(new Error("PRIVATE_UNKNOWN_ACK"));
    await run();
    expect(outputs().map((item: any) => item.result.status)).toEqual(["control_denied", "reconciliation_required"]);
    expect(outputs()[1].result.retryAllowed).toBe(false);
    expect(JSON.stringify(outputs())).not.toContain("PRIVATE_");
    expect(mocks.tool).toHaveBeenCalledTimes(2);
  });

  it.each(["missing", "duplicate"])("refuses %s call identity before any tool in the batch executes", async kind => {
    mocks.create.mockResolvedValueOnce(response([call("same"), call(kind === "missing" ? "" : "same")]));
    await expect(run()).rejects.toThrow("tool_call_identity");
    expect(mocks.tool).not.toHaveBeenCalled(); expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("returns an explicit denial for an undeclared tool without executing it", async () => {
    mocks.create.mockResolvedValueOnce(response([call("outside", "{}", "unapproved_tool")])).mockResolvedValueOnce(final());
    await run();
    expect(outputs()[0].result).toMatchObject({ status: "control_denied", code: "tool_not_allowed", retryAllowed: false });
    expect(mocks.tool).not.toHaveBeenCalled();
  });

  it.each(["same_batch", "next_turn"])("quarantines uncertain mutations across fresh call IDs in %s while allowing reads", async timing => {
    const mutation = (id: string) => call(id, '{"name":"fixture"}', "create_growth_campaign_draft");
    mocks.create.mockResolvedValueOnce(response(timing === "same_batch"
      ? [mutation("first"), mutation("repeat"), call("read")] : [mutation("first")])) ;
    if (timing === "next_turn") mocks.create.mockResolvedValueOnce(response([mutation("repeat"), call("read")]));
    mocks.create.mockResolvedValueOnce(final());
    mocks.tool.mockRejectedValueOnce(new Error("unknown acknowledgment after mutation")).mockResolvedValue({ rows: [] });
    await run();
    expect(mocks.tool.mock.calls.filter(([name]) => name === "create_growth_campaign_draft")).toHaveLength(1);
    expect(mocks.tool).toHaveBeenLastCalledWith("list_growth_campaigns", {});
    const feedback = outputs(timing === "same_batch" ? 1 : 2).find((item: any) => item.id === "repeat");
    expect(feedback?.result).toMatchObject({ status: "reconciliation_required", code: "tool_mutation_reconciliation_required", retryAllowed: false });
  });

  it("returns schema feedback in the captured conversation and retains the original output while repairing", async () => {
    mocks.create.mockResolvedValueOnce(response([{ type: "message", content: [{ type: "output_text", text: '{"done":"unknown"}' }] }], '{"done":"unknown"}'))
      .mockResolvedValueOnce(final());
    const result = await run();
    expect(result.status).toBe("completed"); expect(result.output).toEqual({ done: true });
    expect(mocks.create.mock.calls[1][0]).toMatchObject({ store: false, tools: [] });
    expect(JSON.stringify(mocks.create.mock.calls[1][0].input)).toContain('/done');
    expect(result.artifacts).toMatchObject({ output_repair_iterations: 1,
      output_repairs: [{ rawOutput: '{"done":"unknown"}', issues: [{ path: "/done", code: "invalid_type",
        expectations: { expected: "boolean", received: "string" } }] }] });
    expect(mocks.create.mock.calls[1][0].prompt_cache_options).toEqual({ mode: "explicit", ttl: "30m" });
    expect(mocks.tool).not.toHaveBeenCalled();
  });

  it("returns meaningful failure and original artifacts when repeated invalid output reaches the shared iteration bound", async () => {
    mocks.create.mockResolvedValue(response([], '{"done":"unknown"}'));
    const result = await run();
    expect(result.status).toBe("failed"); expect(result.error).toContain("repair limit reached: /done:invalid_type");
    expect(mocks.create).toHaveBeenCalledTimes(6);
    expect(result.artifacts).toMatchObject({ output_repair_iterations: 5 });
    expect((result.artifacts?.output_repairs as unknown[]).length).toBe(6);
    expect(mocks.tool).not.toHaveBeenCalled();
  });

  it("retains the uncertain mutation barrier on an authorized context replay with fresh call IDs", async () => {
    const cache = { expected_prompt_cache_reuse_count: 1, expected_prompt_cache_reuse_probability: 1 };
    mocks.create.mockResolvedValueOnce(response([call("original", "{}", "create_growth_campaign_draft")])).mockResolvedValueOnce(final());
    mocks.tool.mockRejectedValueOnce(new Error("unknown write acknowledgment"));
    const first = await run(cache);
    expect(first.continuation_state).toMatchObject({ mutation_reconciliation_required: true });
    mocks.create.mockResolvedValueOnce(response([call("new-id", "{}", "create_growth_campaign_draft"), call("read-after-replay")]))
      .mockResolvedValueOnce(final());
    mocks.tool.mockResolvedValue({ rows: [] });
    const resumed = await run({ ...cache, openai_replay_input: first.continuation_state?.openai_replay_input });
    expect(resumed.status).toBe("completed");
    expect(mocks.tool.mock.calls.filter(([name]) => name === "create_growth_campaign_draft")).toHaveLength(1);
    expect(mocks.tool).toHaveBeenLastCalledWith("list_growth_campaigns", {});
  });

  it("preserves explicit cached request controls on output correction", async () => {
    mocks.create.mockResolvedValueOnce(response([], '{"done":"unknown"}')).mockResolvedValueOnce(final());
    await run({ expected_prompt_cache_reuse_count: 1, expected_prompt_cache_reuse_probability: 1 });
    const initial = mocks.create.mock.calls[0][0], repair = mocks.create.mock.calls[1][0];
    expect(repair.prompt_cache_options).toEqual(initial.prompt_cache_options);
    expect(repair.prompt_cache_key).toBe(initial.prompt_cache_key);
  });

  it("treats integration verification as a mutation because it writes receipts", async () => {
    mocks.create.mockResolvedValueOnce(response([call("unknown", "{}", "create_growth_campaign_draft"),
      call("verification", "{}", "verify_growth_integrations"), call("read")])).mockResolvedValueOnce(final());
    mocks.tool.mockRejectedValueOnce(new Error("unknown acknowledgment")).mockResolvedValue({ rows: [] });
    await run();
    expect(mocks.tool.mock.calls.map(([name]) => name)).toEqual(["create_growth_campaign_draft", "list_growth_campaigns"]);
    expect(outputs().find((item: any) => item.id === "verification")?.result.code).toBe("tool_mutation_reconciliation_required");
  });

  it("reports a known transient read code without private exception prose", async () => {
    mocks.create.mockResolvedValueOnce(response([call("read")])).mockResolvedValueOnce(final());
    mocks.tool.mockRejectedValueOnce(Object.assign(new Error("PRIVATE_ENDPOINT"), { code: 14 }));
    await run();
    expect(outputs()[0].result).toMatchObject({ status: "recoverable_issue", diagnosticCode: "unavailable", retryAllowed: true });
    expect(JSON.stringify(outputs())).not.toContain("PRIVATE_ENDPOINT");
  });

  it("does not mistake literal values for safe expected or received types", async () => {
    mocks.create.mockResolvedValueOnce(response([call("invalid")])).mockResolvedValueOnce(final());
    const issue = z.literal("private_literal").safeParse("private_received");
    if (issue.success) throw new Error("expected invalid literal fixture");
    mocks.tool.mockRejectedValueOnce(issue.error); await run();
    expect(outputs()[0].result.issues).toEqual([{ path: "/", code: "invalid_literal" }]);
    expect(JSON.stringify(outputs())).not.toContain("private_");
  });
});
