import { z } from "zod";

// Configuration preparation only. Nothing here saves an agent, acquires a grant,
// creates a session, or enables a worker. Inputs are nonsecret operator receipts.
export const AGENTS_PROJECT_ID = "proj_F2tFJuxLaovJru8RrtXRaqNj";
export const RESEARCH_AGENT_ID = "agent_5a01ec367d1042ef8632bb5f2e6af8b4919909d2abed48ed95";
export const OFFICIAL_MCP_ENDPOINTS = {
  notion: "https://mcp.notion.com/mcp",
  drive: "https://drivemcp.googleapis.com/mcp/v1",
  gmail: "https://gmailmcp.googleapis.com/mcp/v1",
} as const;

const NOTION_READ = ["notion-get-tool-access", "notion-search", "notion-fetch"];
const GMAIL_READ = ["get_message", "get_thread", "search_threads"];
const GMAIL_DRAFT = [...GMAIL_READ, "create_draft", "list_drafts"];
const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";
const DRIVE_READ_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const DRIVE_READ = ["get_file_metadata", "read_file_content", "search_files"];

export const MCP_ROLES = {
  researcher: { model: "gpt-6.1-sol", servers: { notion: NOTION_READ } },
  communications_reader: { model: "gpt-6-luna", servers: { notion: NOTION_READ, gmail: GMAIL_READ } },
  communications_drafter: { model: "gpt-6-luna", servers: { notion: NOTION_READ, gmail: GMAIL_DRAFT } },
  // Optional knowledge files. This role provides no Sheets cell operations.
  drive_reader: { model: null, servers: { drive: DRIVE_READ } },
} as const;
export type McpRole = keyof typeof MCP_ROLES;
type Server = keyof typeof OFFICIAL_MCP_ENDPOINTS;

const opaqueReference = z.string().regex(/^[A-Za-z0-9_.:-]{1,200}$/);
const observation = z.object({
  schema_version: z.literal("blueprint.mcp-connection-observation.v1"),
  project_id: z.literal(AGENTS_PROJECT_ID),
  server: z.enum(["notion", "drive", "gmail"]),
  vault_id: z.string().regex(/^vault_[A-Za-z0-9_-]{1,150}$/),
  credential_id: z.string().regex(/^cred_[A-Za-z0-9_-]{1,150}$/),
  auth_type: z.literal("mcp_oauth"),
  credential_server_url: z.string(),
  refresh_configured: z.literal(true),
  provider_account_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  consent_reference: opaqueReference,
  observed_at: z.string().datetime(),
  // Actual authenticated tools/list result, not a copied vendor catalog.
  verified_tools: z.array(z.string().regex(/^[A-Za-z0-9_-]{1,120}$/)).min(1).max(100),
  granted_scopes: z.array(z.string().max(200)).max(20),
}).strict();

export type McpConnectionObservation = z.infer<typeof observation>;
export type PreparedMcpTool = {
  type: "mcp";
  server_label: Server;
  transport: { type: "http"; server_url: string };
  connection_origin: "service";
  required: true;
  credential_id: string;
  allowed_tools: string[];
};

export class McpSetupRefusal extends Error {
  constructor(code: string) { super(code); this.name = "McpSetupRefusal"; }
}

/** Converts checked connection receipts into additive Agents API configuration.
 * Receipts remain attestations: preparation never certifies live connectivity,
 * OAuth ownership, publication readiness, or an approved saved-agent change. */
export function prepareMcpConnections(role: McpRole, input: unknown, now = new Date()) {
  if (!Object.hasOwn(MCP_ROLES, role)) throw new McpSetupRefusal("mcp_role_invalid");
  const parsed = z.array(observation).max(3).safeParse(input);
  if (!parsed.success) throw new McpSetupRefusal("mcp_connection_receipt_invalid");
  const definition = MCP_ROLES[role];
  const requested = Object.keys(definition.servers) as Server[];
  if (parsed.data.length !== requested.length) throw new McpSetupRefusal("mcp_connection_set_mismatch");
  const vaults = new Set<string>(), credentials = new Set<string>(), servers = new Set<Server>();
  const tools: PreparedMcpTool[] = [];
  const receipts: { server: Server; observed_at: string; consent_reference: string; provider_account_sha256: string }[] = [];
  for (const record of parsed.data) {
    const age = now.getTime() - Date.parse(record.observed_at);
    if (!Number.isFinite(age) || age < 0 || age > 86400000) throw new McpSetupRefusal("mcp_connection_receipt_stale");
    if (!requested.includes(record.server) || servers.has(record.server) || credentials.has(record.credential_id)) {
      throw new McpSetupRefusal("mcp_connection_set_mismatch");
    }
    if (record.credential_server_url !== OFFICIAL_MCP_ENDPOINTS[record.server]) {
      throw new McpSetupRefusal("mcp_credential_endpoint_mismatch");
    }
    const allowlist = (definition.servers as Partial<Record<Server, readonly string[]>>)[record.server]!;
    if (allowlist.some(tool => !record.verified_tools.includes(tool))) throw new McpSetupRefusal("mcp_required_tool_missing");
    if (record.server === "gmail") {
      const allowed = role === "communications_drafter" ? [GMAIL_READ_SCOPE, GMAIL_COMPOSE_SCOPE] : [GMAIL_READ_SCOPE];
      if (allowed.some(scope => !record.granted_scopes.includes(scope)) || record.granted_scopes.some(scope => !allowed.includes(scope))) {
        throw new McpSetupRefusal("mcp_google_scope_mismatch");
      }
    }
    if (record.server === "drive" && (record.granted_scopes.length !== 1 || record.granted_scopes[0] !== DRIVE_READ_SCOPE)) {
      throw new McpSetupRefusal("mcp_google_scope_mismatch");
    }
    servers.add(record.server); credentials.add(record.credential_id); vaults.add(record.vault_id);
    tools.push({ type: "mcp", server_label: record.server,
      transport: { type: "http", server_url: OFFICIAL_MCP_ENDPOINTS[record.server] },
      connection_origin: "service", required: true, credential_id: record.credential_id,
      allowed_tools: [...allowlist] });
    receipts.push({ server: record.server, observed_at: record.observed_at,
      consent_reference: record.consent_reference, provider_account_sha256: record.provider_account_sha256 });
  }
  tools.sort((a, b) => a.server_label.localeCompare(b.server_label));
  receipts.sort((a, b) => a.server.localeCompare(b.server));
  return {
    schema_version: "blueprint.mcp-setup.v1" as const,
    status: "prepared_only" as const,
    project_id: AGENTS_PROJECT_ID, role, model: definition.model,
    ...(role === "researcher" ? { agent_id: RESEARCH_AGENT_ID } : {}),
    // Append only after independently reviewing the existing agent definition.
    // Preserve its instructions, native web search, skills and runtime template.
    tool_additions: tools,
    session_attachment: { vault_ids: [...vaults].sort() },
    connection_receipts: receipts,
    live_connection_verified: false as const,
    worker_activation_authorized: false as const,
    publication_ready: false as const,
    external_send_authorized: false as const,
    required_boundaries: ["blueprint_research_qa_and_digest_bound_publication", "blueprint_outreach_approval_and_send"],
  };
}
