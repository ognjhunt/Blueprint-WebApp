/** One selected ADP worker operates the task bound to its current Paperclip issue. */
export type AdpRunContext = { agentId: string; runId: string };
type RecordValue = Record<string, any>;
export type AdpExecutionSettings = { agentId: string; companyId: string; token: string; origin: string };

export async function resolveAdpExecutionSettings(raw: Record<string, unknown>, agentId: string,
  resolveSecret: (reference: string) => Promise<string | null>): Promise<AdpExecutionSettings | null | undefined> {
  if (!("adpExecution" in raw)) return undefined;
  const value = raw.adpExecution;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("paperclip_adp_configuration_invalid");
  const config = value as Record<string, unknown>;
  if (config.enabled === false) return null;
  if (config.enabled !== true || ["agentId", "companyId", "webappUrl", "bridgeTokenRef"].some(
    (key) => typeof config[key] !== "string" || !(config[key] as string).trim())) {
    throw new Error("paperclip_adp_configuration_invalid");
  }
  if (config.agentId !== agentId) return null;
  // Resolve each action through the host secret store so rotation/revocation
  // takes effect without restarting the plugin or granting the tool a key.
  const token = await resolveSecret(config.bridgeTokenRef as string);
  if (!token?.trim()) throw new Error("paperclip_adp_bridge_secret_unavailable");
  return { agentId, companyId: config.companyId as string, origin: config.webappUrl as string, token: token.trim() };
}

export async function runAdpExecutionTool(params: RecordValue, context: AdpRunContext, deps: {
  loadRun: (runId: string) => Promise<RecordValue | null>;
  loadIssue: (companyId: string, issueId: string) => Promise<RecordValue | null>;
  retain: (companyId: string, runId: string, record: RecordValue) => Promise<void>;
  fetcher?: typeof fetch;
  settings?: AdpExecutionSettings | null;
}) {
  const settings = deps.settings === undefined ? {
    agentId: process.env.BLUEPRINT_PAPERCLIP_ADP_AGENT_ID?.trim(),
    companyId: process.env.BLUEPRINT_PAPERCLIP_ADP_COMPANY_ID?.trim(),
    token: process.env.BLUEPRINT_PAPERCLIP_ADP_BRIDGE_TOKEN?.trim(),
    origin: process.env.BLUEPRINT_PAPERCLIP_ADP_WEBAPP_URL?.trim(),
  } : deps.settings;
  const { agentId, companyId, token, origin } = settings ?? {};
  if (!agentId || !companyId || !token || !origin || agentId !== context.agentId) throw new Error("paperclip_adp_worker_not_selected");
  if (Object.keys(params).some((key) => key !== "action") || !["inspect", "start", "cancel", "cleanup"].includes(params.action)) {
    throw new Error("paperclip_adp_action_invalid");
  }
  const base = new URL(origin);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || base.pathname !== "/") {
    throw new Error("paperclip_adp_origin_invalid");
  }
  const run = await deps.loadRun(context.runId);
  const issueId = run?.contextSnapshot?.issueId;
  if (!run || run.agentId !== agentId || run.companyId !== companyId || typeof issueId !== "string") {
    throw new Error("paperclip_adp_run_binding_missing");
  }
  const issue = await deps.loadIssue(companyId, issueId);
  if (!issue || issue.id !== issueId || issue.companyId !== companyId || issue.assigneeAgentId !== agentId) {
    throw new Error("paperclip_adp_issue_binding_missing");
  }
  // Paperclip's issue API has no general metadata field. The trusted Website
  // binding selects the task; neither issue prose nor tool arguments do so.
  const body = { company_id: companyId, agent_id: agentId,
    issue_id: issueId, run_id: context.runId, action: params.action };
  // The action intent lives in Paperclip even if the HTTP response is lost.
  await deps.retain(companyId, context.runId, { ...body, state: "requested", provider_owner: "blueprint_pipeline" });
  const response = await (deps.fetcher ?? fetch)(new URL("/api/internal/paperclip/adp-execution", base), {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  if (!response.ok || text.length > 64000) throw new Error("paperclip_adp_request_unresolved");
  const result = JSON.parse(text);
  if (result.schema_version !== "blueprint_paperclip_adp_execution.v1"
      || typeof result.task_id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/.test(result.task_id)
      || result.paperclip_run_id !== context.runId
      || result.company_id !== companyId || result.agent_id !== agentId || result.issue_id !== issueId
      || result.scientific_acceptance_granted !== false || result.product_completion_inferred !== false) {
    throw new Error("paperclip_adp_result_identity_mismatch");
  }
  await deps.retain(companyId, context.runId, { ...body, state: "observed", observation: result });
  return { content: `ADP task ${result.task_id}: ${result.status}. Product completion requires its own evidence closeout.`, data: result };
}
