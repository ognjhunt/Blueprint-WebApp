// @vitest-environment node
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENTS_PROJECT_ID, OFFICIAL_MCP_ENDPOINTS, prepareMcpConnections } from "../agents/mcp-connections";

const now = new Date("2026-10-01T01:00:00Z");
const notion = {
  schema_version: "blueprint.mcp-connection-observation.v1", project_id: AGENTS_PROJECT_ID,
  server: "notion", vault_id: "vault_test", credential_id: "cred_notion",
  auth_type: "mcp_oauth", credential_server_url: OFFICIAL_MCP_ENDPOINTS.notion,
  refresh_configured: true, provider_account_sha256: "a".repeat(64),
  consent_reference: "fixture:consent", observed_at: "2026-10-01T00:30:00Z",
  verified_tools: ["notion-get-tool-access", "notion-search", "notion-fetch", "notion-create-pages", "notion-update-page"],
  granted_scopes: [],
};
const gmail = {
  ...notion, server: "gmail", credential_id: "cred_gmail", credential_server_url: OFFICIAL_MCP_ENDPOINTS.gmail,
  verified_tools: ["get_message", "get_thread", "search_threads", "create_draft", "list_drafts", "send_message"],
  granted_scopes: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose"],
};

describe("portable Agents MCP setup preparation", () => {
  it("keeps research writes and unrelated connected tools outside the prepared agent", () => {
    const result = prepareMcpConnections("researcher", [notion], now);
    expect(result.tool_additions[0].allowed_tools).toEqual(["notion-get-tool-access", "notion-search", "notion-fetch"]);
    expect(result.tool_additions[0]).toMatchObject({ connection_origin: "service", required: true, credential_id: "cred_notion" });
    expect(result.session_attachment).toEqual({ vault_ids: ["vault_test"] });
    expect(result.model).toBe("gpt-6.1-sol");
    expect(result.status).toBe("prepared_only");
    expect(result.publication_ready).toBe(false);
    expect(result.live_connection_verified).toBe(false);
    expect(result.worker_activation_authorized).toBe(false);
    expect(result).not.toHaveProperty("instructions");
    expect(result).not.toHaveProperty("environment");
    expect(result).not.toHaveProperty("tools"); // additions cannot replace native web search
  });

  it("allows communications drafts while keeping send, label and delete tools excluded", () => {
    const result = prepareMcpConnections("communications_drafter", [gmail, notion], now);
    expect(result.tool_additions[0].allowed_tools).toEqual(["get_message", "get_thread", "search_threads", "create_draft", "list_drafts"]);
    expect(result.external_send_authorized).toBe(false);
    expect(result.model).toBe("gpt-6-luna");
    expect(result.session_attachment.vault_ids).toEqual(["vault_test"]);
  });

  it("permits read-only mailbox preparation with no compose grant", () => {
    const result = prepareMcpConnections("communications_reader", [notion, { ...gmail, granted_scopes: [gmail.granted_scopes[0]] }], now);
    expect(result.tool_additions[0].allowed_tools).not.toContain("create_draft");
  });

  it.each(["https://www.googleapis.com/auth/gmail.modify", "https://mail.google.com/", "https://www.googleapis.com/auth/gmail.send"])("refuses unexpected Google privilege %s", scope => {
    expect(() => prepareMcpConnections("communications_drafter", [notion, { ...gmail, granted_scopes: [...gmail.granted_scopes, scope] }], now)).toThrow("mcp_google_scope_mismatch");
  });

  it("requires separate scope review when reusing a broader draft grant for read-only mail", () => {
    expect(() => prepareMcpConnections("communications_reader", [notion, gmail], now)).toThrow("mcp_google_scope_mismatch");
  });

  it.each(["https://mcp.notion.com/mcp?token=secret", "https://mcp.notion.com.evil.example/mcp", "https://user:password@mcp.notion.com/mcp", "http://mcp.notion.com/mcp"])("refuses altered credential destination %s", endpoint => {
    expect(() => prepareMcpConnections("researcher", [{ ...notion, credential_server_url: endpoint }], now)).toThrow("mcp_credential_endpoint_mismatch");
  });

  it("refuses missing tools, incomplete or duplicated bindings, and wrong project receipts", () => {
    expect(() => prepareMcpConnections("researcher", [{ ...notion, verified_tools: ["notion-search"] }], now)).toThrow("mcp_required_tool_missing");
    expect(() => prepareMcpConnections("communications_drafter", [notion], now)).toThrow("mcp_connection_set_mismatch");
    expect(() => prepareMcpConnections("communications_drafter", [notion, notion], now)).toThrow("mcp_connection_set_mismatch");
    expect(() => prepareMcpConnections("researcher", [{ ...notion, project_id: "proj_other" }], now)).toThrow("mcp_connection_receipt_invalid");
  });

  it.each(["2026-09-29T00:30:00Z", "2026-10-02T00:30:00Z"])("refuses stale or future receipt %s", observed_at => {
    expect(() => prepareMcpConnections("researcher", [{ ...notion, observed_at }], now)).toThrow("mcp_connection_receipt_stale");
  });

  it.each(["access_token", "refresh_token", "authorization", "headers", "require_approval"])("refuses inline secret/unsupported field %s", field => {
    expect(() => prepareMcpConnections("researcher", [{ ...notion, [field]: "private-value" }], now)).toThrow("mcp_connection_receipt_invalid");
  });

  it("refuses expiring bearer-only setup and protects invalid roles", () => {
    expect(() => prepareMcpConnections("researcher", [{ ...notion, refresh_configured: false }], now)).toThrow("mcp_connection_receipt_invalid");
    expect(() => prepareMcpConnections("__proto__" as any, [notion], now)).toThrow("mcp_role_invalid");
  });

  it("does not present Drive read tools as Sheets cells or CRM writes", () => {
    const result = prepareMcpConnections("drive_reader", [{ ...notion, server: "drive", credential_id: "cred_drive",
      credential_server_url: OFFICIAL_MCP_ENDPOINTS.drive,
      verified_tools: ["get_file_metadata", "read_file_content", "search_files", "create_file"],
      granted_scopes: ["https://www.googleapis.com/auth/drive.readonly"] }], now);
    expect(result.tool_additions[0].allowed_tools).toEqual(["get_file_metadata", "read_file_content", "search_files"]);
    expect(result.publication_ready).toBe(false);
  });

  it("CLI rejects secret-bearing JSON without echoing content, path or raw parser errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "blueprint-mcp-"));
    const path = join(dir, "private-receipt.json");
    writeFileSync(path, JSON.stringify([{ ...notion, access_token: "do-not-echo-this-secret" }]));
    try {
      execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/agents/prepare-mcp-connections.ts", "researcher", path], { encoding: "utf8", stdio: "pipe" });
      throw new Error("expected refusal");
    } catch (error: any) {
      expect(error.status).toBe(2);
      expect(error.stdout).toBe("");
      expect(JSON.parse(error.stderr)).toEqual({ schema_version: "blueprint.mcp-setup.v1", status: "refused", error: "mcp_connection_receipt_invalid" });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
