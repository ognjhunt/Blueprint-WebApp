export type FetchLike = typeof fetch;

export type AgentClientEnv = Partial<Record<string, string | undefined>>;

export type AgentClientOptions = {
  baseUrl?: string;
  authToken?: string;
  env?: AgentClientEnv;
  fetchImpl?: FetchLike;
};

export type CreateSessionInput = {
  siteWorldId: string;
  entitlementId?: string;
  orderId?: string;
  commerceMode?: "dry_run";
  robotProfileId: string;
  taskId: string;
  scenarioId: string;
  startStateId: string;
  sessionMode?: "runtime_only" | "presentation_demo";
  runtimeUi?: "neoverse_gradio" | null;
  requestedBackend?: string | null;
  requestedOutputs?: string[];
  exportModes?: string[];
  runtimeSessionConfig?: Record<string, unknown> | null;
  policy?: Record<string, unknown>;
  notes?: string;
};

export type ResetSessionInput = {
  taskId?: string;
  scenarioId?: string;
  startStateId?: string;
  seed?: number;
};

export type StepSessionInput = {
  episodeId?: string;
  action?: unknown[];
  autoPolicy?: boolean;
};

export type BatchSessionInput = {
  numEpisodes?: number;
  taskId?: string;
  scenarioId?: string;
  startStateId?: string;
  seed?: number;
  maxSteps?: number;
};

export type ExplorerRenderInput = {
  cameraId?: string;
  pose?: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
  };
  viewportWidth?: number;
  viewportHeight?: number;
  refineMode?: string | null;
};

export type SearchSiteWorldsInput = {
  q?: string;
  limit?: number;
  category?: string;
  industry?: string;
  city?: string;
  state?: string;
  siteType?: string;
  taskLane?: string;
  objectTags?: string[];
  robot?: string;
  availability?: string;
  readiness?: string;
  sort?: string;
};

export type AgentCommerceInput = {
  siteWorldId: string;
  product?: string;
  sessionHours?: number;
};

export type AgentDryRunCheckoutInput = AgentCommerceInput & {
  mode?: "dry_run";
  buyer?: {
    uid?: string;
    email?: string;
  };
};

const DEFAULT_BASE_URL = "http://localhost:5000";

function envValue(env: AgentClientEnv | undefined, key: string) {
  return env?.[key] ?? process.env[key];
}

export function normalizeBlueprintApiBaseUrl(value?: string) {
  const raw = String(value || DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

function appendQuery(path: string, params: Record<string, string | number | boolean | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function compactBody<T extends Record<string, unknown>>(body: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export class BlueprintAgentApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly payload: unknown;

  constructor(message: string, status: number, code: string | null, payload: unknown) {
    super(message);
    this.name = "BlueprintAgentApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export class BlueprintAgentApiClient {
  readonly baseUrl: string;
  readonly authToken: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: AgentClientOptions = {}) {
    const env = options.env;
    this.baseUrl = normalizeBlueprintApiBaseUrl(
      options.baseUrl || envValue(env, "BLUEPRINT_API_BASE_URL"),
    );
    this.authToken = String(
      options.authToken || envValue(env, "BLUEPRINT_AGENT_AUTH_TOKEN") || envValue(env, "BLUEPRINT_FIREBASE_ID_TOKEN") || "",
    ).trim();
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async requestJson(path: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {};
    const inputHeaders = options.headers || {};
    if (inputHeaders instanceof Headers) {
      inputHeaders.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
    } else if (Array.isArray(inputHeaders)) {
      inputHeaders.forEach(([key, value]) => {
        headers[String(key).toLowerCase()] = String(value);
      });
    } else {
      Object.entries(inputHeaders).forEach(([key, value]) => {
        if (value !== undefined) headers[key.toLowerCase()] = String(value);
      });
    }

    if (this.authToken) {
      headers.authorization = `Bearer ${this.authToken}`;
    }
    if (options.body && !headers["content-type"]) {
      headers["content-type"] = "application/json";
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method || "GET",
      ...options,
      headers,
    });
    const contentType = String(response.headers.get("content-type") || "");
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

    if (!response.ok) {
      const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
      throw new BlueprintAgentApiError(
        String(body.error || body.message || `Blueprint API request failed with status ${response.status}`),
        response.status,
        String(body.code || "").trim() || null,
        payload,
      );
    }
    return payload;
  }

  discover() {
    return this.requestJson("/api/site-content");
  }

  listCatalog(limit = 24) {
    return this.requestJson(appendQuery("/api/site-worlds", { limit }));
  }

  searchSiteWorlds(input: SearchSiteWorldsInput = {}) {
    return this.requestJson(appendQuery("/api/site-worlds/search", {
      q: input.q,
      limit: input.limit,
      category: input.category,
      industry: input.industry,
      city: input.city,
      state: input.state,
      siteType: input.siteType,
      taskLane: input.taskLane,
      objectTags: input.objectTags?.join(","),
      robot: input.robot,
      availability: input.availability,
      readiness: input.readiness,
      sort: input.sort,
    }));
  }

  getSiteWorld(siteWorldId: string) {
    return this.requestJson(`/api/site-worlds/${encodeURIComponent(siteWorldId)}`);
  }

  readiness(siteWorldId: string) {
    return this.requestJson(appendQuery("/api/site-worlds/sessions/launch-readiness", { siteWorldId }));
  }

  quoteCommerce(input: AgentCommerceInput) {
    return this.requestJson(appendQuery("/api/agent-access/commerce/quote", {
      siteWorldId: input.siteWorldId,
      product: input.product,
      sessionHours: input.sessionHours,
    }));
  }

  createDryRunCheckout(input: AgentDryRunCheckoutInput) {
    return this.requestJson("/api/agent-access/commerce/dry-run-checkout", {
      method: "POST",
      body: JSON.stringify(compactBody({
        ...input,
        mode: "dry_run",
      })),
    });
  }

  getCommerceOrder(orderId: string) {
    return this.requestJson(`/api/agent-access/commerce/orders/${encodeURIComponent(orderId)}`);
  }

  getCommerceEntitlement(entitlementId: string) {
    return this.requestJson(`/api/agent-access/commerce/entitlements/${encodeURIComponent(entitlementId)}`);
  }

  entitlementReadiness(input: { siteWorldId: string; entitlementId: string; buyerUserId?: string; product?: string }) {
    return this.requestJson(appendQuery("/api/agent-access/commerce/entitlement-readiness", {
      siteWorldId: input.siteWorldId,
      entitlementId: input.entitlementId,
      buyerUserId: input.buyerUserId,
      product: input.product,
    }));
  }

  createSession(input: CreateSessionInput) {
    return this.requestJson("/api/site-worlds/sessions", {
      method: "POST",
      body: JSON.stringify(compactBody({
        ...input,
        sessionMode: input.sessionMode || "runtime_only",
      })),
    });
  }

  getSession(sessionId: string) {
    return this.requestJson(`/api/site-worlds/sessions/${encodeURIComponent(sessionId)}`);
  }

  resetSession(sessionId: string, input: ResetSessionInput = {}) {
    return this.requestJson(`/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/reset`, {
      method: "POST",
      body: JSON.stringify(compactBody(input as Record<string, unknown>)),
    });
  }

  stepSession(sessionId: string, input: StepSessionInput = {}) {
    return this.requestJson(`/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/step`, {
      method: "POST",
      body: JSON.stringify(compactBody(input as Record<string, unknown>)),
    });
  }

  runBatch(sessionId: string, input: BatchSessionInput = {}) {
    return this.requestJson(`/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/run-batch`, {
      method: "POST",
      body: JSON.stringify(compactBody(input as Record<string, unknown>)),
    });
  }

  controlSession(sessionId: string, input: Record<string, unknown> = {}) {
    return this.requestJson(`/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/control`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  renderExplorer(sessionId: string, input: ExplorerRenderInput = {}) {
    return this.requestJson(`/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/explorer-render`, {
      method: "POST",
      body: JSON.stringify(compactBody(input as Record<string, unknown>)),
    });
  }

  exportSession(sessionId: string, input: Record<string, unknown> = {}) {
    return this.requestJson(`/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/export`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
