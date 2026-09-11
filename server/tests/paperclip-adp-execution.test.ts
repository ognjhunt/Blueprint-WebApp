// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resolveAdpExecutionSettings, runAdpExecutionTool } from "../../ops/paperclip/plugins/blueprint-automation/src/adp-execution";

const context = { agentId: "selected-worker", runId: "paperclip-run" };
const observation = { schema_version: "blueprint_paperclip_adp_execution.v1", task_id: "admitted-task",
  task_digest: `sha256:${"a".repeat(64)}`, paperclip_run_id: context.runId, company_id: "company",
  agent_id: context.agentId, issue_id: "issue", status: "running",
  scientific_acceptance_granted: false, product_completion_inferred: false };
function dependencies() {
  return {
    loadRun: vi.fn(async () => ({ id: context.runId, agentId: context.agentId, companyId: "company", contextSnapshot: { issueId: "issue" } })),
    loadIssue: vi.fn(async () => ({ id: "issue", companyId: "company", assigneeAgentId: context.agentId })),
    retain: vi.fn(async () => undefined),
    fetcher: vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(observation))),
  };
}
beforeEach(() => {
  process.env.BLUEPRINT_PAPERCLIP_ADP_AGENT_ID = context.agentId;
  process.env.BLUEPRINT_PAPERCLIP_ADP_COMPANY_ID = "company";
  process.env.BLUEPRINT_PAPERCLIP_ADP_BRIDGE_TOKEN = "fixture-secret";
  process.env.BLUEPRINT_PAPERCLIP_ADP_WEBAPP_URL = "https://tryblueprint.io";
});
afterEach(() => {
  for (const key of ["AGENT_ID", "COMPANY_ID", "BRIDGE_TOKEN", "WEBAPP_URL"]) delete process.env[`BLUEPRINT_PAPERCLIP_ADP_${key}`];
});

it("uses only the selected worker's authoritative run and issue task binding", async () => {
  const deps = dependencies();
  const result = await runAdpExecutionTool({ action: "start" }, context, deps);
  expect(result.data).toEqual(observation);
  expect(deps.retain.mock.invocationCallOrder[0]).toBeLessThan(deps.fetcher.mock.invocationCallOrder[0]);
  const options = deps.fetcher.mock.calls[0][1] as RequestInit;
  expect(JSON.parse(options.body as string)).toEqual({ company_id: "company",
    agent_id: context.agentId, issue_id: "issue", run_id: context.runId, action: "start" });
  expect(deps.retain).toHaveBeenLastCalledWith("company", context.runId, expect.objectContaining({ state: "observed" }));
});

it("rejects an unselected worker or caller-supplied task, issue, prompt or authority", async () => {
  const deps = dependencies();
  await expect(runAdpExecutionTool({ action: "start" }, { ...context, agentId: "other-worker" }, deps)).rejects.toThrow("not_selected");
  await expect(runAdpExecutionTool({ action: "start", taskId: "other-task" }, context, deps)).rejects.toThrow("action_invalid");
  expect(deps.fetcher).not.toHaveBeenCalled();
});

it("preserves the requested execution after an uncertain transport outcome", async () => {
  const deps = dependencies(); deps.fetcher.mockRejectedValueOnce(new Error("lost response"));
  await expect(runAdpExecutionTool({ action: "start" }, context, deps)).rejects.toThrow("lost response");
  expect(deps.retain).toHaveBeenCalledExactlyOnceWith("company", context.runId, expect.objectContaining({ state: "requested" }));
});

it("uses the selected plugin configuration and current secret reference without host environment", async () => {
  const deps = dependencies();
  const raw = { adpExecution: { enabled: true, agentId: context.agentId, companyId: "company",
    webappUrl: "https://www.tryblueprint.io", bridgeTokenRef: "adp-secret-ref" } };
  const resolveSecret = vi.fn(async () => "rotated-token");
  const settings = await resolveAdpExecutionSettings(raw, context.agentId, resolveSecret);
  await runAdpExecutionTool({ action: "inspect" }, context, { ...deps, settings });
  expect(resolveSecret).toHaveBeenCalledExactlyOnceWith("adp-secret-ref");
  expect(deps.fetcher.mock.calls[0][0].toString()).toBe("https://www.tryblueprint.io/api/internal/paperclip/adp-execution");
  expect(deps.fetcher.mock.calls[0][1]?.headers).toMatchObject({ authorization: "Bearer rotated-token" });
  expect(JSON.stringify(deps.retain.mock.calls)).not.toContain("rotated-token");
  resolveSecret.mockResolvedValueOnce("second-token");
  expect((await resolveAdpExecutionSettings(raw, context.agentId, resolveSecret))?.token).toBe("second-token");
});

it("revokes environment fallback when plugin configuration is disabled and hides secrets from other workers", async () => {
  const deps = dependencies(); const secret = vi.fn(async () => "unused");
  const settings = await resolveAdpExecutionSettings({ adpExecution: { enabled: false } }, context.agentId, secret);
  await expect(runAdpExecutionTool({ action: "start" }, context, { ...deps, settings })).rejects.toThrow("not_selected");
  expect(await resolveAdpExecutionSettings({ adpExecution: { enabled: true, agentId: "other-worker",
    companyId: "company", webappUrl: "https://www.tryblueprint.io", bridgeTokenRef: "secret-ref" } }, context.agentId, secret)).toBeNull();
  expect(secret).not.toHaveBeenCalled(); expect(deps.fetcher).not.toHaveBeenCalled();
});
