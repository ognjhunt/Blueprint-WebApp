import type { Client } from "@notionhq/client";
import {
  queryDatabase,
  updatePageMetadata,
  upsertAgentRunEntry,
  type AgentRunEntry,
} from "./notion.js";

type LiveAgentRecord = {
  adapterType?: string | null;
  id: string;
  name?: string | null;
  urlKey?: string | null;
};

export type HeartbeatRunRecord = {
  id: string;
  agentId: string;
  companyId?: string;
  contextSnapshot?: Record<string, unknown> | null;
  createdAt?: string | null;
  error?: string | null;
  finishedAt?: string | null;
  invocationSource?: string | null;
  resultJson?: Record<string, unknown> | null;
  startedAt?: string | null;
  status?: string | null;
  triggerDetail?: string | null;
  updatedAt?: string | null;
};

type AgentPageRecord = {
  canonicalKey?: string;
  id: string;
  paperclipKey?: string;
  title: string;
};

type SyncedRun = {
  agentKey?: string;
  agentPageId?: string;
  endedAt?: string;
  pageId: string;
  startedAt?: string;
  status: NonNullable<AgentRunEntry["status"]>;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function safeDateRank(value: string | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function readAgentPageRecords(pages: any[]): AgentPageRecord[] {
  return pages.map((page) => ({
    id: page.id,
    title: page.properties?.Agent?.title?.map((entry: any) => entry.plain_text ?? "").join("") ?? "",
    canonicalKey:
      page.properties?.["Canonical Key"]?.rich_text?.map((entry: any) => entry.plain_text ?? "").join("")
      ?? "",
    paperclipKey:
      page.properties?.["Paperclip Agent Key"]?.rich_text?.map((entry: any) => entry.plain_text ?? "").join("")
      ?? "",
  }));
}

function mapAgentRuntime(adapterType: string | undefined): AgentRunEntry["runtime"] {
  if (adapterType === "codex_local") return "Paperclip/Codex";
  if (adapterType === "hermes_local") return "Paperclip/Hermes";
  return "External Coding Agent";
}

function mapRunStatus(status: string | undefined): NonNullable<AgentRunEntry["status"]> {
  switch (normalizeText(status)) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "cancelled":
      return "Canceled";
    case "failed":
    case "timed_out":
      return "Failed";
    case "succeeded":
      return "Done";
    default:
      return "Queued";
  }
}

function mapTriggerSource(run: HeartbeatRunRecord): AgentRunEntry["triggerSource"] {
  const invocationSource = normalizeText(run.invocationSource);
  const triggerDetail = normalizeText(run.triggerDetail);
  const wakeReason = normalizeText(asString(run.contextSnapshot?.wakeReason));

  if (invocationSource === "timer") return "Schedule";
  if (invocationSource === "assignment") return "Task Assignment";
  if (invocationSource === "on_demand") return "Manual";
  if (wakeReason.includes("comment")) return "Comment Mention";
  if (wakeReason.includes("database") || wakeReason.includes("page")) return "Database Update";
  if (triggerDetail === "manual") return "Manual";
  return "Webhook";
}

function deriveErrorSummary(run: HeartbeatRunRecord) {
  return (
    asString(run.error)
    ?? asString(run.resultJson?.summary)
    ?? asString(run.resultJson?.message)
    ?? (normalizeText(run.status) === "failed" || normalizeText(run.status) === "timed_out"
      ? asString(run.resultJson?.result)
      : undefined)
  );
}

function buildRunTitle(agentName: string, startedAt: string | undefined, runId: string) {
  const base = startedAt
    ? new Date(startedAt).toISOString().replace(".000Z", "Z")
    : runId;
  return `${agentName} Run - ${base}`;
}

function buildRunNotes(run: HeartbeatRunRecord) {
  const notes: string[] = [];
  const wakeReason = asString(run.contextSnapshot?.wakeReason);
  const issueId = asString(run.contextSnapshot?.issueId);
  const triggerDetail = asString(run.triggerDetail);
  const invocationSource = asString(run.invocationSource);

  if (invocationSource || triggerDetail) {
    notes.push(`Invocation: ${[invocationSource, triggerDetail].filter(Boolean).join(" / ")}`);
  }
  if (wakeReason) {
    notes.push(`Wake reason: ${wakeReason}`);
  }
  if (issueId) {
    notes.push(`Issue ID: ${issueId}`);
  }

  return notes.length > 0 ? notes.join(" | ") : undefined;
}

function buildPaperclipRunUrl(agentId: string, runId: string) {
  const base = (process.env.PAPERCLIP_PUBLIC_URL || process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100").replace(/\/+$/, "");
  return `${base}/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(runId)}`;
}

function findAgentPage(agentPages: AgentPageRecord[], agentKey: string | undefined) {
  const normalizedKey = normalizeText(agentKey);
  if (!normalizedKey) return undefined;
  return agentPages.find((page) =>
    normalizeText(page.canonicalKey) === normalizedKey
    || normalizeText(page.paperclipKey) === normalizedKey,
  );
}

function pickLatestRun(left: SyncedRun | undefined, right: SyncedRun) {
  if (!left) return right;
  const leftRank = Math.max(safeDateRank(left.endedAt), safeDateRank(left.startedAt));
  const rightRank = Math.max(safeDateRank(right.endedAt), safeDateRank(right.startedAt));
  return rightRank >= leftRank ? right : left;
}

export async function syncBlueprintAgentRuns(input: {
  heartbeatRuns: HeartbeatRunRecord[];
  liveAgents: LiveAgentRecord[];
  notionClient: Client;
  onlyAgentKeys?: string[];
  pauseMs?: number;
}) {
  const requestedKeys = new Set(
    (input.onlyAgentKeys ?? [])
      .map((value) => asString(value))
      .filter((value): value is string => Boolean(value)),
  );
  const liveAgentsById = new Map(
    input.liveAgents
      .filter((agent) => asString(agent.id))
      .map((agent) => [agent.id, agent]),
  );
  const agentPages = readAgentPageRecords(await queryDatabase(input.notionClient, "agents", 200));
  const runs = [...input.heartbeatRuns]
    .filter((run) => asString(run.id) && asString(run.agentId))
    .filter((run) => {
      const agent = liveAgentsById.get(run.agentId);
      const agentKey = asString(agent?.urlKey);
      return requestedKeys.size === 0 || (agentKey ? requestedKeys.has(agentKey) : false);
    })
    .sort((left, right) => safeDateRank(left.createdAt ?? undefined) - safeDateRank(right.createdAt ?? undefined));

  const latestRunByAgentKey = new Map<string, SyncedRun>();
  const synced: Array<{ agentKey?: string; pageId: string; runId: string }> = [];

  for (const run of runs) {
    const agent = liveAgentsById.get(run.agentId);
    const agentKey = asString(agent?.urlKey);
    const agentName = asString(agent?.name) ?? agentKey ?? run.agentId;
    const agentPage = findAgentPage(agentPages, agentKey);
    const startedAt = asString(run.startedAt) ?? asString(run.createdAt);
    const endedAt = asString(run.finishedAt);
    const entry: AgentRunEntry = {
      title: buildRunTitle(agentName, startedAt, run.id),
      runId: run.id,
      agentKey,
      agentPageIds: agentPage ? [agentPage.id] : [],
      runtime: mapAgentRuntime(asString(agent?.adapterType)),
      status: mapRunStatus(asString(run.status)),
      triggerSource: mapTriggerSource(run),
      startedAt,
      endedAt,
      paperclipUrl: buildPaperclipRunUrl(run.agentId, run.id),
      errorSummary: deriveErrorSummary(run),
      requiresHumanReview: false,
      notes: buildRunNotes(run),
    };

    const upserted = await upsertAgentRunEntry(input.notionClient, entry, { archiveDuplicates: true });
    synced.push({ agentKey, pageId: upserted.pageId, runId: run.id });

    if (agentKey) {
      latestRunByAgentKey.set(
        agentKey,
        pickLatestRun(latestRunByAgentKey.get(agentKey), {
          agentKey,
          agentPageId: agentPage?.id,
          endedAt,
          pageId: upserted.pageId,
          startedAt,
          status: entry.status ?? "Queued",
        }),
      );
    }

    if ((input.pauseMs ?? 0) > 0) {
      await new Promise((resolve) => setTimeout(resolve, input.pauseMs));
    }
  }

  for (const [agentKey, latestRun] of latestRunByAgentKey.entries()) {
    const agentPage = findAgentPage(agentPages, agentKey);
    if (!agentPage) {
      continue;
    }
    await updatePageMetadata(input.notionClient, agentPage.id, "agents", {
      latestRunPageIds: [latestRun.pageId],
      lastActive: latestRun.endedAt ?? latestRun.startedAt,
      lastRunStatus: latestRun.status,
    });

    if ((input.pauseMs ?? 0) > 0) {
      await new Promise((resolve) => setTimeout(resolve, input.pauseMs));
    }
  }

  return {
    count: synced.length,
    latestRunAgentCount: latestRunByAgentKey.size,
    runs: synced,
  };
}
