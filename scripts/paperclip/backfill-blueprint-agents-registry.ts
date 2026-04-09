import { Client } from "@notionhq/client";
import { syncBlueprintAgentRegistryWithRetries, type LiveAgentRecord } from "../../ops/paperclip/plugins/blueprint-automation/src/agent-registry-sync.js";

const notionToken = process.env.NOTION_API_TOKEN;
const paperclipApiUrl = process.env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100";
const companyName = process.env.COMPANY_NAME ?? "Blueprint Autonomous Operations";
const skipBody = /^(1|true|yes)$/i.test(process.env.BLUEPRINT_AGENT_REGISTRY_SKIP_BODY ?? "");

if (!notionToken) {
  throw new Error("NOTION_API_TOKEN is required.");
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${paperclipApiUrl}${path}`);
  if (!response.ok) {
    throw new Error(`Paperclip API ${response.status} for ${path}: ${await response.text()}`);
  }
  return await response.json() as T;
}

async function main() {
  const companies = await fetchJson<Array<{ id: string; name: string }>>("/api/companies");
  const company = companies.find((entry) => entry.name === companyName);
  if (!company) {
    throw new Error(`Company not found: ${companyName}`);
  }

  const liveAgents = await fetchJson<LiveAgentRecord[]>(
    `/api/companies/${company.id}/agents?limit=200&offset=0`,
  );
  const notionClient = new Client({
    auth: notionToken,
    timeoutMs: Number(process.env.BLUEPRINT_NOTION_TIMEOUT_MS || "180000"),
  });
  const result = await syncBlueprintAgentRegistryWithRetries({
    archiveDuplicates: true,
    liveAgents,
    maxAttempts: 4,
    notionClient,
    skipBody,
  });
  console.log(JSON.stringify(result, null, 2));
}

await main();
