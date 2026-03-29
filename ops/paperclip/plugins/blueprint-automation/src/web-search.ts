export interface WebSearchResult {
  query: string;
  answer: string;
  citations: string[];
}

export interface WebSearchConfig {
  apiKey: string;
  provider: string;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function braveWebSearch(config: WebSearchConfig, query: string): Promise<WebSearchResult> {
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

export async function webSearch(
  config: WebSearchConfig,
  query: string,
): Promise<WebSearchResult> {
  if (config.provider === "brave") {
    return await braveWebSearch(config, query);
  }

  if (config.provider !== "perplexity") {
    throw new Error(`Unsupported search provider: ${config.provider}. Supported providers: "brave", "perplexity".`);
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
  };
}
