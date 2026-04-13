import { getConfiguredEnvValue } from "../config/env";

type PaperclipCompany = {
  id: string;
  name: string;
};

type PaperclipProject = {
  id: string;
  name: string;
  slug?: string | null;
  urlKey?: string | null;
};

type PaperclipAgent = {
  id: string;
  name: string;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
};

type PaperclipWakeupResult = {
  id?: string;
  status?: string;
  runId?: string | null;
};

export type PaperclipIssueRecord = {
  id: string;
  identifier?: string | null;
  title: string;
  status: string;
  priority: string;
  parentId?: string | null;
  assigneeAgentId?: string | null;
  originKind?: string | null;
  originId?: string | null;
};

const DEFAULT_API_URL = "http://127.0.0.1:3100";
const DEFAULT_COMPANY_NAME = "Blueprint Autonomous Operations";

let cachedCompanyId: string | null | undefined;
const cachedProjectIds = new Map<string, string>();
const cachedAgentIds = new Map<string, string>();

function normalizeAgentLookupKey(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : null;
}

function paperclipApiUrl() {
  return (getConfiguredEnvValue("PAPERCLIP_API_URL") || DEFAULT_API_URL).replace(/\/+$/, "");
}

function companyName() {
  return process.env.COMPANY_NAME?.trim() || DEFAULT_COMPANY_NAME;
}

function buildHeaders(includeJson = false) {
  const headers = new Headers();
  const apiKey = getConfiguredEnvValue("PAPERCLIP_API_KEY");
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
  if (includeJson) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function fetchPaperclipJson<T>(
  pathname: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = Math.max(1_000, init?.timeoutMs ?? 8_000);
  const { timeoutMs: _timeoutMs, ...requestInit } = init || {};
  const response = await fetch(`${paperclipApiUrl()}${pathname}`, {
    ...requestInit,
    headers: requestInit?.headers || buildHeaders(Boolean(requestInit?.body)),
    signal: requestInit?.signal ?? AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Paperclip ${response.status} for ${pathname}${text ? `: ${text.slice(0, 300)}` : ""}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function resolvePaperclipCompanyId() {
  if (cachedCompanyId !== undefined) {
    return cachedCompanyId;
  }

  const pinned = process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID?.trim();
  if (pinned) {
    cachedCompanyId = pinned;
    return cachedCompanyId;
  }

  const companies = await fetchPaperclipJson<PaperclipCompany[]>("/api/companies", {
    headers: buildHeaders(),
    timeoutMs: 5_000,
  });
  const match = companies.find((entry) => entry.name === companyName());
  cachedCompanyId = match?.id || null;
  return cachedCompanyId;
}

export async function resolvePaperclipProjectId(projectName: string) {
  const cacheKey = projectName.trim().toLowerCase();
  const cached = cachedProjectIds.get(cacheKey);
  if (cached) {
    return cached;
  }

  const companyId = await resolvePaperclipCompanyId();
  if (!companyId) {
    return null;
  }

  const projects = await fetchPaperclipJson<PaperclipProject[]>(
    `/api/companies/${companyId}/projects`,
    {
      headers: buildHeaders(),
      timeoutMs: 5_000,
    },
  );
  const match = projects.find((entry) => {
    const names = [entry.name, entry.slug || "", entry.urlKey || ""]
      .map((value) => value.trim().toLowerCase());
    return names.includes(cacheKey);
  });
  if (!match) {
    return null;
  }
  cachedProjectIds.set(cacheKey, match.id);
  return match.id;
}

export async function resolvePaperclipAgentId(agentKey: string) {
  const cacheKey = normalizeAgentLookupKey(agentKey) || agentKey.trim().toLowerCase();
  const cached = cachedAgentIds.get(cacheKey);
  if (cached) {
    return cached;
  }

  const companyId = await resolvePaperclipCompanyId();
  if (!companyId) {
    return null;
  }

  const agents = await fetchPaperclipJson<PaperclipAgent[]>(
    `/api/companies/${companyId}/agents`,
    {
      headers: buildHeaders(),
      timeoutMs: 5_000,
    },
  );
  const match = agents.find((entry) => {
    const metadata = entry.metadata && typeof entry.metadata === "object"
      ? (entry.metadata as Record<string, unknown>)
      : {};
    const candidates = [
      entry.name,
      entry.title || "",
      typeof metadata.agentKey === "string" ? metadata.agentKey : "",
      typeof metadata.slug === "string" ? metadata.slug : "",
      typeof (entry as Record<string, unknown>).urlKey === "string"
        ? ((entry as Record<string, unknown>).urlKey as string)
        : "",
    ]
      .map((value) => normalizeAgentLookupKey(value) || value.trim().toLowerCase())
      .filter(Boolean);
    return candidates.includes(cacheKey);
  });
  if (!match) {
    return null;
  }
  cachedAgentIds.set(cacheKey, match.id);
  return match.id;
}

export async function listPaperclipIssues(params: {
  companyId: string;
  originKind?: string | null;
  originId?: string | null;
  parentId?: string | null;
}) {
  const searchParams = new URLSearchParams();
  if (params.originKind) searchParams.set("originKind", params.originKind);
  if (params.originId) searchParams.set("originId", params.originId);
  if (params.parentId) searchParams.set("parentId", params.parentId);
  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : "";

  return await fetchPaperclipJson<PaperclipIssueRecord[]>(
    `/api/companies/${params.companyId}/issues${suffix}`,
    {
      headers: buildHeaders(),
      timeoutMs: 6_000,
    },
  );
}

export async function getPaperclipIssue(issueId: string) {
  return await fetchPaperclipJson<PaperclipIssueRecord>(`/api/issues/${issueId}`, {
    headers: buildHeaders(),
    timeoutMs: 6_000,
  });
}

export async function updatePaperclipIssue(
  issueId: string,
  input: Partial<Pick<PaperclipIssueRecord, "title" | "status" | "priority" | "assigneeAgentId">> & {
    description?: string | null;
    parentId?: string | null;
  },
) {
  return await fetchPaperclipJson<PaperclipIssueRecord>(`/api/issues/${issueId}`, {
    method: "PATCH",
    headers: buildHeaders(true),
    body: JSON.stringify(input),
    timeoutMs: 8_000,
  });
}

export async function upsertPaperclipIssue(input: {
  projectName: string;
  assigneeKey: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  originKind: string;
  originId: string;
  parentId?: string | null;
}) {
  const companyId = await resolvePaperclipCompanyId();
  if (!companyId) {
    throw new Error("Blueprint Paperclip company is not configured.");
  }

  const [projectId, assigneeAgentId] = await Promise.all([
    resolvePaperclipProjectId(input.projectName),
    resolvePaperclipAgentId(input.assigneeKey),
  ]);

  if (!projectId) {
    throw new Error(`Paperclip project not found: ${input.projectName}`);
  }
  if (!assigneeAgentId) {
    throw new Error(`Paperclip agent not found: ${input.assigneeKey}`);
  }

  const existing = await listPaperclipIssues({
    companyId,
    originKind: input.originKind,
    originId: input.originId,
  });
  const issue = existing[0];

  if (issue) {
    const updated = await fetchPaperclipJson<PaperclipIssueRecord>(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: buildHeaders(true),
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        assigneeAgentId,
        parentId: input.parentId ?? null,
      }),
      timeoutMs: 8_000,
    });
    return {
      companyId,
      projectId,
      assigneeAgentId,
      issue: updated,
      created: false,
    };
  }

  const created = await fetchPaperclipJson<PaperclipIssueRecord>(
    `/api/companies/${companyId}/issues`,
    {
      method: "POST",
      headers: buildHeaders(true),
      body: JSON.stringify({
        projectId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        assigneeAgentId,
        parentId: input.parentId ?? null,
        originKind: input.originKind,
        originId: input.originId,
      }),
      timeoutMs: 8_000,
    },
  );
  return {
    companyId,
    projectId,
    assigneeAgentId,
    issue: created,
    created: true,
  };
}

export async function createPaperclipIssueComment(issueId: string, body: string) {
  return await fetchPaperclipJson<{ ok?: boolean }>(`/api/issues/${issueId}/comments`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ body }),
    timeoutMs: 4_000,
  });
}

export async function resetPaperclipAgentSession(
  agentId: string,
  taskKey?: string | null,
  companyId?: string | null,
) {
  const scope =
    companyId
    || await resolvePaperclipCompanyId()
    || undefined;
  return await fetchPaperclipJson<{ ok?: boolean }>(
    `/api/agents/${encodeURIComponent(agentId)}/runtime-state/reset-session${scope ? `?companyId=${encodeURIComponent(scope)}` : ""}`,
    {
      method: "POST",
      headers: buildHeaders(true),
      body: JSON.stringify({ taskKey: taskKey ?? null }),
    },
  );
}

export async function wakePaperclipAgent(input: {
  agentId: string;
  companyId?: string | null;
  reason?: string | null;
  payload?: Record<string, unknown> | null;
  idempotencyKey?: string | null;
  timeoutMs?: number | null;
}) {
  const scope =
    input.companyId
    || await resolvePaperclipCompanyId()
    || undefined;
  const timeoutMs = Math.max(1_000, input.timeoutMs ?? 10_000);
  return await fetchPaperclipJson<PaperclipWakeupResult | { status: "skipped" }>(
    `/api/agents/${encodeURIComponent(input.agentId)}/wakeup${scope ? `?companyId=${encodeURIComponent(scope)}` : ""}`,
    {
      method: "POST",
      headers: buildHeaders(true),
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        source: "automation",
        triggerDetail: "system",
        reason: input.reason ?? null,
        payload: input.payload ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      }),
    },
  );
}
