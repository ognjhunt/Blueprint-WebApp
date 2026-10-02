// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z, ZodError } from "zod";

const mocks = vi.hoisted(() => ({ create: vi.fn(), tool: vi.fn(), requests: [] as any[] }));
vi.mock("openai", () => ({ default: class { chat = { completions: { create: (input:any) => { mocks.requests.push(structuredClone(input)); return mocks.create(input); } } }; } }));
vi.mock("../agents/operator-tools", () => ({
  chatCompletionOperatorTools: [
    { type: "function", function: { name: "list_growth_campaigns" } },
    { type: "function", function: { name: "create_growth_campaign_draft" } },
    { type: "function", function: { name: "verify_growth_integrations" } },
  ], runOperatorTool: mocks.tool,
}));

const call = (call_id: string, args = "{}", name = "list_growth_campaigns") =>
  ({ type: "function", id:call_id, function:{name, arguments:args} });
const response = (output: unknown[], output_text = "") => ({ id: "response-fixture", choices:[{message:{role:"assistant",content:output_text,tool_calls:output}}],
  usage: { prompt_tokens: 100, completion_tokens: 20 } });
const final = () => response([], JSON.stringify({ done: true }));
async function run(metadata: Record<string, unknown> = {}) {
  const { runDeepSeekChatTask } = await import("../agents/adapters/deepseek-chat");
  return runDeepSeekChatTask({ kind: "operator_thread", provider: "deepseek_chat", runtime: "deepseek_chat",
    model: "deepseek-v4-pro", input: {}, metadata, session_policy: { lane: "task" },
    tool_policy: { mode: "mixed" }, definition: { build_prompt: () => "Inspect the authorized fixture.",
      output_schema: z.object({ done: z.boolean() }) } } as any);
}
const outputs = (requestIndex = 1) => mocks.requests[requestIndex].messages
  .filter((item:any) => item.role === "tool")
  .map((item:any) => ({id:item.tool_call_id, result:JSON.parse(item.content)}));
beforeEach(() => { vi.resetModules(); vi.stubEnv("DEEPSEEK_API_KEY", "offline-fixture");
  mocks.create.mockReset(); mocks.tool.mockReset(); mocks.requests.length=0; });
afterEach(() => vi.unstubAllEnvs());

describe("DeepSeek/Z.ai operator tool feedback", () => {
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
    expect(await run()).toMatchObject({status:"failed",error:"tool_call_identity_invalid"});
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


});

it("runs Z.ai with only its configured key and preserves tool feedback in that provider conversation", async()=>{
 vi.stubEnv("DEEPSEEK_API_KEY", "");vi.stubEnv("ZAI_API_KEY", "offline-zai-fixture");
 mocks.create.mockResolvedValueOnce(response([call("bad", "[]"),call("read")])).mockResolvedValueOnce(final());
 mocks.tool.mockResolvedValue({rows:[]});
 const {runDeepSeekChatTask}=await import("../agents/adapters/deepseek-chat");
 const result=await runDeepSeekChatTask({kind:"operator_thread",provider:"zai_glm",runtime:"zai_glm",model:"glm-5",
 input:{},metadata:{},session_policy:{lane:"task"},tool_policy:{mode:"mixed"},definition:{build_prompt:()=>"Inspect authorized state.",output_schema:z.object({done:z.boolean()})}} as any);
 expect(result.status).toBe("completed");expect(result.provider).toBe("zai_glm");
 expect(outputs()[0].result).toMatchObject({status:"recoverable_issue",code:"tool_arguments_invalid_json"});expect(mocks.tool).toHaveBeenCalledTimes(1);
});

it("inherits persisted mutation quarantine and still permits read-only reconciliation",async()=>{
 mocks.create.mockResolvedValueOnce(response([call("blocked","{}","verify_growth_integrations"),call("read")])).mockResolvedValueOnce(final());
 mocks.tool.mockResolvedValue({rows:[]});const result=await run({mutation_reconciliation_required:true});
 expect(outputs()[0].result).toMatchObject({status:"reconciliation_required",retryAllowed:false});
 expect(mocks.tool).toHaveBeenCalledTimes(1);expect(mocks.tool).toHaveBeenCalledWith("list_growth_campaigns",{});
 expect(result.artifacts).toMatchObject({mutation_reconciliation_required:true});
});

it.each(["provider", "schema"])("retains uncertain write quarantine and successful siblings after a later %s failure",async kind=>{
 mocks.create.mockResolvedValueOnce(response([call("good"),call("unknown","{}","create_growth_campaign_draft")]));
 if(kind==="provider")mocks.create.mockRejectedValueOnce(new Error("PRIVATE_TRANSPORT_TOKEN"));
 else mocks.create.mockResolvedValueOnce(response([],JSON.stringify({done:"PRIVATE_BAD_TYPE"})));
 mocks.tool.mockResolvedValueOnce({rows:[{id:"canonical-fixture"}]}).mockRejectedValueOnce(new Error("PRIVATE_UNKNOWN_ACK"));
 const result=await run();expect(result).toMatchObject({status:"failed",artifacts:{mutation_reconciliation_required:true,calls:kind==="provider"?1:2}});
 expect(result.logs).toEqual(expect.arrayContaining([expect.objectContaining({event_type:"tool.result",status:"success",tool_result:{rows:[{id:"canonical-fixture"}]}})]));
 expect(result.artifacts?.deepseek_conversation_input).toEqual(expect.arrayContaining([expect.objectContaining({role:"tool",tool_call_id:"unknown"})]));
 expect(JSON.stringify(result.artifacts?.recovery_feedback)).not.toMatch(/PRIVATE/);
 if(kind==="schema")expect(result.artifacts?.recovery_feedback).toMatchObject({code:"output_schema_invalid",issues:[{path:"/done",code:"invalid_type",expectations:{expected:"boolean",received:"string"}}]});
 expect(mocks.tool).toHaveBeenCalledTimes(2);
});
