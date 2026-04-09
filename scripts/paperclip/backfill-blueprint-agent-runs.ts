import { Client } from "@notionhq/client";
import { syncBlueprintAgentRuns, type HeartbeatRunRecord } from "../../ops/paperclip/plugins/blueprint-automation/src/agent-run-sync.js";

type LiveAgentRecord = {
  adapterType?: string | null;
  id: string;
  name?: string | null;
  urlKey?: string | null;
};

const notionToken = process.env.NOTION_API_TOKEN;
const paperclipApiUrl = process.env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100";
const companyName = process.env.COMPANY_NAME ?? "Blueprint Autonomous Operations";
const onlyAgentKeys = (process.env.BLUEPRINT_AGENT_RUN_KEYS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
const pauseMs = Math.max(0, Number(process.env.BLUEPRINT_AGENT_RUN_PAUSE_MS || "250") || 250);
const runLimit = Number(process.env.BLUEPRINT_AGENT_RUN_LIMIT || "");
const runMode = (process.env.BLUEPRINT_AGENT_RUN_MODE || "all").trim().toLowerCase();

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
  const heartbeatRunsPath = Number.isFinite(runLimit) && runLimit > 0
    ? `/api/companies/${company.id}/heartbeat-runs?limit=${runLimit}`
    : `/api/companies/${company.id}/heartbeat-runs`;
  const heartbeatRunsRaw = await fetchJson<HeartbeatRunRecord[]>(heartbeatRunsPath);
  const heartbeatRuns =
    runMode === "latest_per_agent"
      ? [...heartbeatRunsRaw]
        .sort((left, right) =>
          (Date.parse(right.finishedAt ?? right.startedAt ?? right.createdAt ?? "") || 0)
          - (Date.parse(left.finishedAt ?? left.startedAt ?? left.createdAt ?? "") || 0),
        )
        .filter((run, index, all) => all.findIndex((candidate) => candidate.agentId === run.agentId) === index)
      : heartbeatRunsRaw;
  const notionClient = new Client({
    auth: notionToken,
    timeoutMs: Number(process.env.BLUEPRINT_NOTION_TIMEOUT_MS || "180000"),
  });

  const result = await syncBlueprintAgentRuns({
    heartbeatRuns,
    liveAgents,
    notionClient,
    onlyAgentKeys,
    pauseMs,
  });
  console.log(JSON.stringify(result, null, 2));
}

await main();
