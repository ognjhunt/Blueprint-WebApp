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
const loadedProjectDirectories = new Set<string>();
const loadedAgentDirectories = new Set<string>();
const pendingProjectDirectoryLoads = new Map<string, Promise<void>>();
const pendingAgentDirectoryLoads = new Map<string, Promise<void>>();

function normalizeProjectLookupKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function buildScopedLookupKey(scope: string, value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? `${scope}:${normalized}` : null;
}

async function ensurePaperclipProjectDirectoryLoaded(companyId: string) {
  if (loadedProjectDirectories.has(companyId)) {
    return;
  }

  const pending = pendingProjectDirectoryLoads.get(companyId);
  if (pending) {
    await pending;
    return;
  }

  const loadPromise = (async () => {
    const projects = await fetchPaperclipJsonWithRetry<PaperclipProject[]>(
      `/api/companies/${companyId}/projects`,
      {
        headers: buildHeaders(),
        timeoutMs: 12_000,
        retries: 2,
      },
    );
    for (const entry of projects) {
      for (const candidate of [entry.name, entry.slug || "", entry.urlKey || ""]) {
        const scopedKey = buildScopedLookupKey(
          companyId,
          normalizeProjectLookupKey(candidate),
        );
        if (scopedKey) {
          cachedProjectIds.set(scopedKey, entry.id);
        }
      }
    }
    loadedProjectDirectories.add(companyId);
  })();

  pendingProjectDirectoryLoads.set(companyId, loadPromise);
  try {
    await loadPromise;
  } finally {
    pendingProjectDirectoryLoads.delete(companyId);
  }
}

async function ensurePaperclipAgentDirectoryLoaded(companyId: string) {
  if (loadedAgentDirectories.has(companyId)) {
    return;
  }

  const pending = pendingAgentDirectoryLoads.get(companyId);
  if (pending) {
    await pending;
    return;
  }

  const loadPromise = (async () => {
    const agents = await fetchPaperclipJsonWithRetry<PaperclipAgent[]>(
      `/api/companies/${companyId}/agents`,
      {
        headers: buildHeaders(),
        timeoutMs: 12_000,
        retries: 2,
      },
    );
    for (const entry of agents) {
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

      for (const candidate of candidates) {
        const scopedKey = buildScopedLookupKey(companyId, candidate);
        if (scopedKey) {
          cachedAgentIds.set(scopedKey, entry.id);
        }
      }
    }
    loadedAgentDirectories.add(companyId);
  })();

  pendingAgentDirectoryLoads.set(companyId, loadPromise);
  try {
    await loadPromise;
  } finally {
    pendingAgentDirectoryLoads.delete(companyId);
  }
}

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

async function fetchPaperclipJsonWithRetry<T>(
  pathname: string,
  init?: RequestInit & { timeoutMs?: number; retries?: number },
): Promise<T> {
  const retries = Math.max(0, init?.retries ?? 2);
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchPaperclipJson<T>(pathname, init);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isRetryable =
        /aborted due to timeout/i.test(message)
        || /AbortError/i.test(message)
        || /fetch failed/i.test(message)
        || /ECONNRESET/i.test(message)
        || /ECONNREFUSED/i.test(message)
        || /socket hang up/i.test(message);
      if (!isRetryable || attempt >= retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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

  const companies = await fetchPaperclipJsonWithRetry<PaperclipCompany[]>("/api/companies", {
    headers: buildHeaders(),
    timeoutMs: 5_000,
    retries: 2,
  });
  const match = companies.find((entry) => entry.name === companyName());
  cachedCompanyId = match?.id || null;
  return cachedCompanyId;
}

export async function resolvePaperclipProjectId(projectName: string) {
  const companyId = await resolvePaperclipCompanyId();
  if (!companyId) {
    return null;
  }

  const normalizedProjectName = normalizeProjectLookupKey(projectName);
  const cacheKey = buildScopedLookupKey(companyId, normalizedProjectName);
  if (!cacheKey) {
    return null;
  }

  const cached = cachedProjectIds.get(cacheKey);
  if (cached) {
    return cached;
  }

  await ensurePaperclipProjectDirectoryLoaded(companyId);

  return cachedProjectIds.get(cacheKey) || null;
}

export async function resolvePaperclipAgentId(agentKey: string) {
  const companyId = await resolvePaperclipCompanyId();
  if (!companyId) {
    return null;
  }

  const normalizedAgentKey = normalizeAgentLookupKey(agentKey) || agentKey.trim().toLowerCase();
  const cacheKey = buildScopedLookupKey(companyId, normalizedAgentKey);
  if (!cacheKey) {
    return null;
  }

  const cached = cachedAgentIds.get(cacheKey);
  if (cached) {
    return cached;
  }

  await ensurePaperclipAgentDirectoryLoaded(companyId);

  return cachedAgentIds.get(cacheKey) || null;
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

  return await fetchPaperclipJsonWithRetry<PaperclipIssueRecord[]>(
    `/api/companies/${params.companyId}/issues${suffix}`,
    {
      headers: buildHeaders(),
      timeoutMs: 8_000,
      retries: 2,
    },
  );
}

export async function getPaperclipIssue(issueId: string) {
  return await fetchPaperclipJsonWithRetry<PaperclipIssueRecord>(`/api/issues/${issueId}`, {
    headers: buildHeaders(),
    timeoutMs: 8_000,
    retries: 2,
  });
}

export async function updatePaperclipIssue(
  issueId: string,
  input: Partial<Pick<PaperclipIssueRecord, "title" | "status" | "priority" | "assigneeAgentId">> & {
    description?: string | null;
    parentId?: string | null;
  },
) {
  return await fetchPaperclipJsonWithRetry<PaperclipIssueRecord>(`/api/issues/${issueId}`, {
    method: "PATCH",
    headers: buildHeaders(true),
    body: JSON.stringify(input),
    timeoutMs: 12_000,
    retries: 2,
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
  existingIssueId?: string | null;
  onBoundConflict?: {
    strategy: "reuse_existing" | "create_fresh";
    originId?: string | null;
  };
}) {
  const companyId = await resolvePaperclipCompanyId();
  if (!companyId) {
    throw new Error("Blueprint Paperclip company is not configured.");
  }

  const assigneeAgentId = await resolvePaperclipAgentId(input.assigneeKey);
  if (!assigneeAgentId) {
    throw new Error(`Paperclip agent not found: ${input.assigneeKey}`);
  }

  async function recoverExistingIssue(issueId: string) {
    const issue = await getPaperclipIssue(issueId);
    return {
      companyId,
      projectId: null,
      assigneeAgentId,
      issue,
      created: false,
    };
  }

  async function createFreshIssue(conflictOriginId?: string | null) {
    const projectId = await resolvePaperclipProjectId(input.projectName);
    if (!projectId) {
      throw new Error(`Paperclip project not found: ${input.projectName}`);
    }

    const created = await fetchPaperclipJsonWithRetry<PaperclipIssueRecord>(
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
          originId: conflictOriginId || input.originId,
        }),
        timeoutMs: 12_000,
        retries: 2,
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

  async function recoverFromBoundConflict(issueId: string) {
    if (input.onBoundConflict?.strategy === "create_fresh") {
      return await createFreshIssue(input.onBoundConflict.originId);
    }
    return await recoverExistingIssue(issueId);
  }

  if (input.existingIssueId) {
    try {
      const updated = await updatePaperclipIssue(input.existingIssueId, {
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        assigneeAgentId,
        parentId: input.parentId ?? null,
      });
      return {
        companyId,
        projectId: null,
        assigneeAgentId,
        issue: updated,
        created: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/Paperclip 409\b/.test(message) && /bound to a different issue/i.test(message)) {
        return await recoverFromBoundConflict(input.existingIssueId);
      }
      if (!(error instanceof Error) || !/Paperclip 404\b/.test(error.message)) {
        throw error;
      }
    }
  }

  let issue: PaperclipIssueRecord | null = null;
  if (!issue) {
    const existing = await listPaperclipIssues({
      companyId,
      originKind: input.originKind,
      originId: input.originId,
    });
    issue = existing[0] || null;
  }

  if (issue) {
    try {
      const updated = await fetchPaperclipJsonWithRetry<PaperclipIssueRecord>(`/api/issues/${issue.id}`, {
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
        timeoutMs: 12_000,
        retries: 2,
      });
      return {
        companyId,
        projectId: null,
        assigneeAgentId,
        issue: updated,
        created: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/Paperclip 409\b/.test(message) && /bound to a different issue/i.test(message)) {
        return await recoverFromBoundConflict(issue.id);
      }
      throw error;
    }
  }

  return await createFreshIssue();
}

export async function createPaperclipIssueComment(issueId: string, body: string) {
  return await fetchPaperclipJsonWithRetry<{ ok?: boolean }>(`/api/issues/${issueId}/comments`, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify({ body }),
    timeoutMs: 8_000,
    retries: 2,
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
  return await fetchPaperclipJsonWithRetry<PaperclipWakeupResult | { status: "skipped" }>(
    `/api/agents/${encodeURIComponent(input.agentId)}/wakeup${scope ? `?companyId=${encodeURIComponent(scope)}` : ""}`,
    {
      method: "POST",
      headers: buildHeaders(true),
      signal: AbortSignal.timeout(timeoutMs),
      timeoutMs,
      retries: 2,
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
