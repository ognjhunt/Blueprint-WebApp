import { ROBOT_TEAM_TOOLS, directoryDigest } from "./directory";
import type { IntelligenceControl } from "./contract";
import type { RobotTeamAgentRole } from "./instructions";

export class RobotAgentHttpError extends Error {
  constructor(readonly evidence: { status: number; path: string; method: string; requestId: string | null; body: string }) {
    super(`robot_agents_http_${evidence.status}`);
  }
}
export type SavedRobotBinding = { agentId: string; configuration: Record<string, any>; vaultIds: string[]; digest: string };

/** Use the same documented REST contract as the existing saved-agent workers,
 * without changing their definitions, credentials, SDK or charged snapshots. */
export class RobotAgentsClient {
  constructor(private options: { apiKey: string; projectId: string; fetch?: typeof fetch; requestMs?: number }) {}
  async json(path: string, init: RequestInit = {}) {
    const response = await (this.options.fetch ?? fetch)(`https://api.openai.com/v1${path}`, { ...init,
      signal: AbortSignal.timeout(this.options.requestMs ?? 30000), headers: {
        Authorization: `Bearer ${this.options.apiKey}`, "OpenAI-Project": this.options.projectId,
        "OpenAI-Beta": "agents=v1", "Content-Type": "application/json", ...init.headers } });
    const body = await response.text();
    if (!response.ok) throw new RobotAgentHttpError({ status: response.status, path, method: init.method ?? "GET",
      requestId: response.headers.get("x-request-id"), body }); // Persist privately, never log the body.
    return body ? JSON.parse(body) : null;
  }
  async list(path: string) {
    const rows: any[] = [], seen = new Set<string>(); let after: string | undefined;
    for (;;) {
      const page = await this.json(`${path}${path.includes("?") ? "&" : "?"}limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`);
      if (!Array.isArray(page?.data) || typeof page.has_more !== "boolean") throw Error("robot_agents_page_invalid");
      rows.push(...page.data);
      if (!page.has_more) return rows;
      if (!page.last_id || seen.has(page.last_id)) throw Error("robot_agents_cursor_not_advancing");
      seen.add(page.last_id); after = page.last_id;
    }
  }
  async binding(control: IntelligenceControl, role: RobotTeamAgentRole): Promise<SavedRobotBinding> {
    const agentId = control.agents[role], saved = await this.json(`/agents/${encodeURIComponent(agentId)}`);
    if (saved.id !== agentId || typeof saved.model !== "string" || typeof saved.instructions !== "string" || !Array.isArray(saved.tools)) {
      throw Error("robot_saved_agent_configuration_invalid");
    }
    // Owner MCP connections remain attached. Application functions are the
    // current host definitions; replacing tools must include native connections.
    const nativeTools: any[] = [];
    for (const tool of saved.tools) {
      if (tool.type === "function") continue;
      if (tool.type === "web_search") { nativeTools.push({ type: "web_search" }); continue; }
      if (tool.type !== "mcp" || tool.transport?.type !== "http" || tool.connection_origin !== "service"
        || Object.keys(tool.transport?.headers ?? {}).length || Object.keys(tool.request_metadata ?? {}).length) {
        throw Error("robot_native_tool_not_public_read_profile");
      }
      const approved = control.mcpReadTools[tool.server_label];
      // Raw mail/database writes would bypass the typed company directory.
      // Owner connections are preserved; prospective sessions use the exact
      // retained public-read tool subset, never all tools by omission.
      if (!approved?.length) throw Error("robot_mcp_public_read_tools_required");
      const serverUrl = new URL(tool.transport.server_url);
      if (serverUrl.protocol !== "https:" || serverUrl.username || serverUrl.password || serverUrl.search) throw Error("robot_mcp_endpoint_invalid");
      nativeTools.push({ type: "mcp", server_label: tool.server_label, transport: { type: "http", server_url: serverUrl.href },
        connection_origin: "service", required: tool.required === true, allowed_tools: approved,
        ...(tool.credential_id ? { credential_id: tool.credential_id } : {}) });
    }
    const configuration = { model: saved.model, instructions: saved.instructions,
      ...(saved.reasoning ? { reasoning: saved.reasoning } : {}), service_tier: saved.service_tier ?? "auto",
      multi_agent: { enabled: false }, tools: [...nativeTools, ...ROBOT_TEAM_TOOLS] };
    const connections = configuration.tools.filter((tool: any) => tool.type === "mcp");
    if (connections.some((tool: any) => Object.keys(tool.headers ?? {}).length || Object.keys(tool.request_metadata ?? {}).length)) {
      throw Error("robot_mcp_use_existing_vault_reference_required");
    }
    const credentials = new Set<string>(connections.map((tool: any) => tool.credential_id).filter(Boolean));
    const matches = new Map<string, string>();
    if (credentials.size) for (const vault of await this.list("/vaults")) {
      const entries = await this.list(`/vaults/${encodeURIComponent(vault.id)}/credentials`);
      for (const entry of entries) if (credentials.has(entry.id)) {
        if (entries.length !== 1 || matches.has(entry.id)) throw Error("robot_mcp_vault_binding_ambiguous");
        matches.set(entry.id, vault.id);
      }
    }
    if (matches.size !== credentials.size) throw Error("robot_mcp_vault_binding_missing");
    const vaultIds = [...new Set(matches.values())].sort();
    return { agentId, configuration, vaultIds, digest: directoryDigest({ agentId, configuration, vaultIds }) };
  }
  create(runId: string, binding: SavedRobotBinding, input: string, requestDigest: string) {
    return this.json("/agents/sessions", { method: "POST", body: JSON.stringify({ agent_id: binding.agentId,
      agent: binding.configuration, environment: { type: "none" }, input, vault_ids: binding.vaultIds, stream: false,
      metadata: { blueprint_robot_run: runId, blueprint_robot_request: requestDigest, blueprint_robot_binding: binding.digest } }) });
  }
  /** Unknown create is observed globally against the original immutable claim;
   * negative coverage is not permission for this worker to create again. */
  async reconcileCreate(runId: string, requestDigest: string) {
    const sessions = await this.list("/agents/sessions?order=asc");
    const matches = sessions.filter(session => session.metadata?.blueprint_robot_run === runId && session.metadata?.blueprint_robot_request === requestDigest);
    if (matches.length > 1) throw Error("robot_create_reconciliation_ambiguous");
    return matches[0]?.id ?? null;
  }
  result(sessionId: string, action: any, success: boolean, output: unknown) {
    const result = { type: "agent.session.input.tool_result", turn_id: action.turn_id, call_id: action.call_id,
      ...(success ? { success: true, output: JSON.stringify(output) } : { success: false, error: JSON.stringify(output) }) };
    return this.json(`/agents/sessions/${encodeURIComponent(sessionId)}/events`, { method: "POST",
      headers: { "Idempotency-Key": `robot-tool-${directoryDigest({ sessionId, action, result })}` }, body: JSON.stringify({ events: [result] }) });
  }
}

/** Provider-added defaults may coexist with the exact requested fields. */
function contains(requested: any, actual: any): boolean {
  if (Array.isArray(requested)) return Array.isArray(actual) && requested.length === actual.length && requested.every((value, i) => contains(value, actual[i]));
  if (requested && typeof requested === "object") return actual && typeof actual === "object" && Object.keys(requested).every(key => contains(requested[key], actual[key]));
  return requested === actual;
}
export function assertRobotSession(session: any, runId: string, requestDigest: string, binding: SavedRobotBinding) {
  if (session?.metadata?.blueprint_robot_run !== runId || session.metadata.blueprint_robot_request !== requestDigest
    || session.metadata.blueprint_robot_binding !== binding.digest || session.environment?.type !== "none"
    || directoryDigest([...(session.vault_ids ?? [])].sort()) !== directoryDigest(binding.vaultIds)
    || !contains(binding.configuration, session.agent)
    || session.agent?.tools?.some((tool: any) => tool.type === "mcp" && (Object.keys(tool.transport?.headers ?? {}).length
      || tool.transport?.authorization || Object.keys(tool.request_metadata ?? {}).length))) throw Error("robot_existing_session_binding_changed");
}
