import { readFileSync } from "node:fs";
import { prepareMcpConnections, McpSetupRefusal, type McpRole } from "../../server/agents/mcp-connections";

// Offline only: no credentials, environment bootstrap or SDK/network calls.
try {
  const [role, receiptPath, ...extra] = process.argv.slice(2);
  if (!role || !receiptPath || extra.length) throw new McpSetupRefusal("usage_role_and_receipt_file_required");
  const input = readFileSync(receiptPath);
  if (input.length > 32000) throw new McpSetupRefusal("mcp_connection_receipt_too_large");
  console.log(JSON.stringify(prepareMcpConnections(role as McpRole, JSON.parse(input.toString("utf8"))), null, 2));
} catch (error) {
  // Never echo a rejected record, path, JSON parse excerpt or raw error message.
  console.error(JSON.stringify({ schema_version: "blueprint.mcp-setup.v1", status: "refused",
    error: error instanceof McpSetupRefusal ? error.message : "mcp_connection_receipt_unavailable" }));
  process.exitCode = 2;
}
