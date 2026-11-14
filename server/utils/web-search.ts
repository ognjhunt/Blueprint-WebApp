export interface WebSearchResult {
  query: string;
  answer: string;
  citations: string[];
}

export interface WebSearchConfig {
  apiKey?: string;
  provider: string;
  parallelMcpUrl?: string;
  parallelSessionId?: string;
  modelName?: string;
}

export interface WebFetchResult {
  urls: string[];
  answer: string;
  citations: string[];
  errors: Array<{
    url: string;
    errorType: string;
    httpStatusCode?: number | null;
  }>;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function braveWebSearch(config: WebSearchConfig, query: string): Promise<WebSearchResult> {
  if (!config.apiKey) {
    throw new Error("Brave Search requires SEARCH_API_KEY to be configured.");
  }

  const params = new URLSearchParams({
    q: query,
    freshness: "py",
    count: "5",
    extra_snippets: "true",
    country: "US",
    search_lang: "en",
  });

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
    method: "GET",
    headers: {
      "X-Subscription-Token": config.apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brave Search API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    web?: {
      results?: Array<{
        title?: string;
        url?: string;
        description?: string;
        extra_snippets?: string[];
      }>;
    };
  };

  const results = (data.web?.results ?? []).filter((item) => item.url);
  const citations = results.map((item) => item.url!).slice(0, 5);
  const answer = results
    .slice(0, 5)
    .map((item) => {
      const title = stripHtml(item.title ?? "Untitled result");
      const description = stripHtml(item.description ?? "");
      const extra = (item.extra_snippets ?? []).slice(0, 2).map(stripHtml).join(" ");
      const summary = [description, extra].filter(Boolean).join(" ");
      return `- ${title}: ${summary || item.url}`;
    })
    .join("\n");

  return {
    query,
    answer,
    citations,
  };
}

function compactSearchQuery(query: string): string {
  const words = query
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1)
    .slice(0, 6);

  return (words.length > 0 ? words : [query.slice(0, 100)]).join(" ").slice(0, 100);
}

function parallelMcpUrl(config: WebSearchConfig) {
  return config.parallelMcpUrl?.trim() || "https://search.parallel.ai/mcp";
}

function parallelSessionId(config: WebSearchConfig) {
  return config.parallelSessionId?.trim() || "blueprint-paperclip";
}

function parallelModelName(config: WebSearchConfig) {
  return config.modelName?.trim() || "paperclip-agent";
}

function parseMcpPayload(result: unknown): unknown {
  if (!result || typeof result !== "object") {
    return result;
  }

  const record = result as Record<string, unknown>;
  if (record.structuredContent) {
    return record.structuredContent;
  }

  const content = Array.isArray(record.content) ? record.content : [];
  const firstText = content
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const contentRecord = entry as Record<string, unknown>;
      return contentRecord.type === "text" && typeof contentRecord.text === "string"
        ? contentRecord.text
        : "";
    })
    .find(Boolean);

  if (!firstText) {
    return result;
  }

  try {
    return JSON.parse(firstText);
  } catch {
    return { text: firstText };
  }
}

async function callParallelMcpTool(
  config: WebSearchConfig,
  name: "web_search" | "web_fetch",
  args: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(parallelMcpUrl(config), {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      method: "tools/call",
      params: {
        name,
        arguments: {
          ...args,
          session_id: parallelSessionId(config),
          model_name: parallelModelName(config),
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Parallel Search MCP error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    error?: { message?: string };
    result?: unknown;
  };
  if (data.error) {
    throw new Error(`Parallel Search MCP error: ${data.error.message ?? "unknown error"}`);
  }

  return parseMcpPayload(data.result);
}

async function parallelMcpWebSearch(
  config: WebSearchConfig,
  query: string,
): Promise<WebSearchResult> {
  const payload = await callParallelMcpTool(config, "web_search", {
    objective: query,
    search_queries: [compactSearchQuery(query)],
  });

  const results = Array.isArray((payload as Record<string, unknown>)?.results)
    ? ((payload as Record<string, unknown>).results as Array<Record<string, unknown>>)
    : [];
  const citations = results
    .map((item) => (typeof item.url === "string" ? item.url : ""))
    .filter(Boolean)
    .slice(0, 10);
  const answer = results
    .slice(0, 10)
    .map((item) => {
      const title = typeof item.title === "string" ? item.title : "Untitled result";
      const url = typeof item.url === "string" ? item.url : "";
      const excerpts = Array.isArray(item.excerpts)
        ? item.excerpts.map((entry) => String(entry)).filter(Boolean)
        : [];
      return `- ${title}: ${excerpts.join(" ").trim() || url}`;
    })
    .join("\n");

  return {
    query,
    answer,
    citations,
  };
}

export async function parallelMcpWebFetch(
  config: WebSearchConfig,
  input: {
    urls: string[];
    objective?: string;
    searchQueries?: string[];
    fullContent?: boolean;
  },
): Promise<WebFetchResult> {
  const urls = input.urls.map((url) => url.trim()).filter(Boolean).slice(0, 10);
  if (urls.length === 0) {
    throw new Error("web-fetch requires at least one URL.");
  }

  const payload = await callParallelMcpTool(config, "web_fetch", {
    urls,
    objective: input.objective,
    search_queries: input.searchQueries?.map((query) => query.trim()).filter(Boolean),
    full_content: input.fullContent ?? false,
  });

  const record = payload as Record<string, unknown>;
  const results = Array.isArray(record.results)
    ? (record.results as Array<Record<string, unknown>>)
    : [];
  const errors = Array.isArray(record.errors)
    ? (record.errors as Array<Record<string, unknown>>)
    : [];
  const citations = results
    .map((item) => (typeof item.url === "string" ? item.url : ""))
    .filter(Boolean);
  const answer = results
    .map((item) => {
      const title = typeof item.title === "string" ? item.title : "Untitled page";
      const url = typeof item.url === "string" ? item.url : "";
      const excerpts = Array.isArray(item.excerpts)
        ? item.excerpts.map((entry) => String(entry)).filter(Boolean)
        : [];
      const fullContent = typeof item.full_content === "string" ? item.full_content : "";
      return `- ${title} (${url}): ${excerpts.join(" ").trim() || fullContent.slice(0, 4000)}`;
    })
    .join("\n");

  return {
    urls,
    answer,
    citations,
    errors: errors.map((entry) => ({
      url: typeof entry.url === "string" ? entry.url : "",
      errorType: typeof entry.error_type === "string" ? entry.error_type : "unknown",
      httpStatusCode:
        typeof entry.http_status_code === "number" ? entry.http_status_code : null,
    })),
  };
}

export async function webSearch(
  config: WebSearchConfig,
  query: string,
): Promise<WebSearchResult> {
  if (config.provider === "parallel_mcp" || config.provider === "parallel") {
    return await parallelMcpWebSearch(config, query);
  }

  if (config.provider === "brave") {
    return await braveWebSearch(config, query);
  }

  if (config.provider !== "perplexity") {
    throw new Error(`Unsupported search provider: ${config.provider}. Supported providers: "brave", "perplexity", "parallel_mcp".`);
  }
  if (!config.apiKey) {
    throw new Error("Perplexity search requires SEARCH_API_KEY to be configured.");
  }

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant for Blueprint, a capture-first world-model platform for robotics. " +
            "Return concise, factual answers with source URLs. Focus on actionable intelligence.",
        },
        { role: "user", content: query },
      ],
      max_tokens: 1024,
      return_citations: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Perplexity API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    citations?: string[];
  };

  return {
    query,
    answer: data.choices?.[0]?.message?.content ?? "",
    citations: data.citations ?? [],
  };
}

export function buildWebSearchToolHandler(config: WebSearchConfig) {
  return {
    "web-search": async (params: { query: string }) => {
      const result = await webSearch(config, params.query);
      return result;
    },
    "web-fetch": async (params: {
      urls: string[];
      objective?: string;
      searchQueries?: string[];
      fullContent?: boolean;
    }) => {
      if (config.provider !== "parallel_mcp" && config.provider !== "parallel") {
        throw new Error("web-fetch is currently available through SEARCH_API_PROVIDER=parallel_mcp.");
      }
      return await parallelMcpWebFetch(config, params);
    },
  };
}
