import { Request, Response } from "express";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { attachRequestMeta, logger } from "../logger";
import {
  buildPostSignupDeepResearchPrompt,
  buildPostSignupSystemInstructionsPrompt,
  buildPostSignupWelcomeMessagesPrompt,
  type PostSignupWorkflowPromptInput,
} from "../utils/ai-prompts";

const parallelApiKey =
  process.env.PARALLEL_API_KEY || "V9xyphAxwfrJb1faYC5c_-x4T93eYzbZDWdenFEw";
const rawParallelBaseUrl =
  process.env.PARALLEL_API_BASE_URL || "https://api.parallel.ai";
const parallelBaseUrl = rawParallelBaseUrl.replace(/\/+$/, "");
const parallelProcessor = process.env.PARALLEL_PROCESSOR || "ultra";
const parallelResearchProcessor =
  process.env.PARALLEL_RESEARCH_PROCESSOR || parallelProcessor;
const parallelInstructionsProcessor =
  process.env.PARALLEL_INSTRUCTIONS_PROCESSOR || parallelProcessor;
const parallelWelcomeProcessor =
  process.env.PARALLEL_WELCOME_PROCESSOR || parallelInstructionsProcessor;
const parallelApiVersion = process.env.PARALLEL_API_VERSION;
const parallelHttpTimeoutMs = Number(
  process.env.PARALLEL_HTTP_TIMEOUT_MS ?? 120_000,
);
const parallelApiMaxAttempts = Math.max(
  1,
  Number(process.env.PARALLEL_API_MAX_ATTEMPTS ?? 3),
);
const parallelApiRetryBaseDelayMs = Math.max(
  100,
  Number(process.env.PARALLEL_API_RETRY_BASE_DELAY_MS ?? 1_000),
);
const parallelApiRetryMaxDelayMs = Math.max(
  parallelApiRetryBaseDelayMs,
  Number(process.env.PARALLEL_API_RETRY_MAX_DELAY_MS ?? 10_000),
);
const parallelMaxWaitMs = Number(
  process.env.PARALLEL_MAX_WAIT_MS ?? 60 * 60 * 1_000, // 60m; Deep Research can take ~45m
);
const parallelPollIntervalMs = Math.max(
  500,
  Number(process.env.PARALLEL_POLL_INTERVAL_MS ?? 5_000),
);
const parallelResultTimeoutSeconds = Math.max(
  30,
  Number(process.env.PARALLEL_RESULT_TIMEOUT_SECONDS ?? 240),
);
const parallelWebhookUrl = process.env.PARALLEL_WEBHOOK_URL;
const parallelWebhookSecret = process.env.PARALLEL_WEBHOOK_SECRET;
const parallelWebhookEvents = process.env.PARALLEL_WEBHOOK_EVENTS
  ? process.env.PARALLEL_WEBHOOK_EVENTS.split(",")
      .map((event) => event.trim())
      .filter(Boolean)
  : ["task.updated", "task.completed", "task.failed"];

const perplexityApiKey =
  process.env.PERPLEXITY_API_KEY ||
  "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";
const perplexityTimeoutMs = Number(process.env.PERPLEXITY_TIMEOUT_MS ?? 60_000);
const deepResearchModel =
  process.env.PERPLEXITY_DEEP_RESEARCH_MODEL || "sonar-reasoning-pro";
const instructionsModel =
  process.env.PERPLEXITY_INSTRUCTIONS_MODEL || deepResearchModel;
const reasoningEffort = (process.env.PERPLEXITY_REASONING_EFFORT ?? "high") as
  | "low"
  | "medium"
  | "high";
const PERPLEXITY_ENDPOINT = "https://api.perplexity.ai/chat/completions";
const PERPLEXITY_SYSTEM_MESSAGE =
  "You are Blueprint's automation copilot. Follow the user's instructions exactly and respond with valid JSON whenever a schema is provided.";

type AiProvider = "perplexity" | "parallel";

type PerplexityMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function callPerplexity({
  model,
  prompt,
  useReasoning = false,
  maxOutputTokens,
}: {
  model: string;
  prompt: string;
  useReasoning?: boolean;
  maxOutputTokens?: number;
}) {
  if (!perplexityApiKey) {
    throw new Error("Perplexity API key is not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    Math.max(1_000, perplexityTimeoutMs),
  );

  try {
    const messages: PerplexityMessage[] = [
      { role: "system", content: PERPLEXITY_SYSTEM_MESSAGE },
      { role: "user", content: prompt },
    ];

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.2,
      return_references: true,
      stream: false,
    };

    if (useReasoning) {
      body.reasoning = { effort: reasoningEffort };
    }

    if (typeof maxOutputTokens === "number") {
      body.max_output_tokens = maxOutputTokens;
    }

    const response = await fetch(PERPLEXITY_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${perplexityApiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Perplexity request failed: ${response.status} ${response.statusText}${
          errorText ? ` - ${errorText}` : ""
        }`,
      );
    }

    return (await response.json()) as any;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Perplexity request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

type ParallelFetchOptions = RequestInit & {
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
};

type ParallelTaskStatus =
  | "pending"
  | "queued"
  | "running"
  | "in_progress"
  | "processing"
  | "completed"
  | "succeeded"
  | "finished"
  | "failed"
  | "errored"
  | "error"
  | "cancelled"
  | "canceled"
  | "timeout";

function waitFor(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const parallelRetryableStatusCodes = new Set([
  408, 409, 425, 429, 500, 502, 503, 504, 522, 524,
]);

const parallelRetryableNodeErrorCodes = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "EPIPE",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

function isRetryableStatus(status?: number) {
  if (!status) {
    return false;
  }
  if (parallelRetryableStatusCodes.has(status)) {
    return true;
  }
  return status >= 500 && status < 600;
}

function shouldRetryParallelError(error: any) {
  const status = Number(error?.status ?? error?.statusCode);
  if (Number.isFinite(status) && isRetryableStatus(status)) {
    return true;
  }
  const errorCode =
    error?.code || error?.cause?.code || error?.err?.code || error?.errno;
  if (typeof errorCode === "string") {
    return parallelRetryableNodeErrorCodes.has(errorCode);
  }
  return false;
}

function describeParallelError(error: any) {
  if (!error) {
    return "Unknown error";
  }
  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function computeRetryDelay(attempt: number, baseDelayMs: number) {
  const exponentialDelay = baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  return Math.min(parallelApiRetryMaxDelayMs, Math.round(exponentialDelay));
}

async function parallelApiFetch<T = any>(
  path: string,
  options: ParallelFetchOptions = {},
): Promise<T> {
  if (!parallelApiKey) {
    throw new Error("Parallel API key is not configured");
  }

  const {
    timeoutMs,
    headers: requestHeaders,
    maxAttempts,
    retryDelayMs,
    ...init
  } = options;
  const url = path.startsWith("http") ? path : `${parallelBaseUrl}${path}`;

  const headers = new Headers(requestHeaders ?? undefined);
  headers.set("x-api-key", parallelApiKey);
  headers.set("Accept", "application/json");

  // Beta headers: always include SSE; add webhook token only if using webhooks
  {
    const existing = headers.get("parallel-beta");
    const tokens: string[] = ["events-sse-2025-07-24"]; // required for enable_events
    if (parallelWebhookUrl) tokens.push("webhook-2025-08-12"); // required when sending a webhook
    const value = tokens.join(",");
    headers.set("parallel-beta", existing ? `${existing},${value}` : value);
  }

  if (parallelApiVersion && !headers.has("parallel-version")) {
    headers.set("parallel-version", parallelApiVersion);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const resolvedMaxAttempts = Math.max(
    1,
    Number(maxAttempts ?? parallelApiMaxAttempts),
  );
  const resolvedBaseDelayMs = Math.max(
    100,
    Number(retryDelayMs ?? parallelApiRetryBaseDelayMs),
  );

  let attempt = 0;
  let lastError: any;

  while (attempt < resolvedMaxAttempts) {
    attempt += 1;
    const controller = new AbortController();
    const httpTimeout = Math.max(
      1_000,
      Number(timeoutMs ?? parallelHttpTimeoutMs),
    );
    const timeoutId = setTimeout(() => controller.abort(), httpTimeout);
    let shouldRetry = false;
    let retryDelay = resolvedBaseDelayMs;

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      const responseText = await response.text().catch(() => "");

      if (!response.ok) {
        const error = new Error(
          `Parallel API request failed: ${response.status} ${response.statusText}${
            responseText ? ` - ${responseText}` : ""
          }`,
        );
        (error as any).status = response.status;
        (error as any).statusCode = response.status;
        (error as any).body = responseText;

        if (attempt < resolvedMaxAttempts && shouldRetryParallelError(error)) {
          shouldRetry = true;
          lastError = error;
          retryDelay = computeRetryDelay(attempt, resolvedBaseDelayMs);
          logger.warn(
            {
              url,
              attempt,
              maxAttempts: resolvedMaxAttempts,
              delayMs: retryDelay,
              status: response.status,
            },
            `Parallel API request failed (attempt ${attempt}): ${describeParallelError(
              error,
            )}. Retrying...`,
          );
        } else {
          throw error;
        }
      } else {
        if (!responseText) {
          return undefined as T;
        }

        try {
          return JSON.parse(responseText) as T;
        } catch {
          return responseText as T;
        }
      }
    } catch (error: any) {
      let normalizedError = error;
      if (error?.name === "AbortError") {
        normalizedError = new Error(
          `Parallel API request to ${url} timed out after ${httpTimeout} ms`,
        );
        (normalizedError as any).status = 408;
        (normalizedError as any).statusCode = 408;
      }

      if (
        !shouldRetry &&
        attempt < resolvedMaxAttempts &&
        shouldRetryParallelError(normalizedError)
      ) {
        shouldRetry = true;
        lastError = normalizedError;
        retryDelay = computeRetryDelay(attempt, resolvedBaseDelayMs);
        logger.warn(
          {
            url,
            attempt,
            maxAttempts: resolvedMaxAttempts,
            delayMs: retryDelay,
            status: (normalizedError as any)?.status,
            code: (normalizedError as any)?.code,
          },
          `Parallel API request failed (attempt ${attempt}): ${describeParallelError(
            normalizedError,
          )}. Retrying...`,
        );
      } else if (!shouldRetry) {
        throw normalizedError;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (shouldRetry) {
      await waitFor(retryDelay);
      continue;
    }
  }

  throw (
    lastError ??
    new Error(
      `Parallel API request to ${url} failed after ${resolvedMaxAttempts} attempts`,
    )
  );
}

function normalizeParallelResult(result: any) {
  if (!result || typeof result !== "object") {
    return result;
  }

  const normalized: Record<string, any> = { ...result };

  const nestedCandidates = [result.result, result.data, result.output];
  for (const candidate of nestedCandidates) {
    if (!candidate || typeof candidate !== "object") continue;
    for (const key of [
      "output",
      "output_text",
      "text",
      "citations",
      "references",
      "messages",
      "choices",
    ]) {
      if (normalized[key] === undefined && candidate[key] !== undefined) {
        normalized[key] = candidate[key];
      }
    }
  }

  if (
    normalized.output_text === undefined &&
    Array.isArray(normalized.output)
  ) {
    const textBuffer = normalized.output
      .map((entry: any) => {
        if (!entry) return "";
        if (typeof entry === "string") return entry;
        if (typeof entry.text === "string") return entry.text;
        if (entry?.type === "output_text" && entry?.text?.value) {
          return entry.text.value;
        }
        if (entry?.text?.value) {
          return entry.text.value;
        }
        if (Array.isArray(entry.content)) {
          return entry.content
            .map((chunk: any) =>
              typeof chunk === "string"
                ? chunk
                : chunk?.text?.value || chunk?.text || "",
            )
            .filter(Boolean)
            .join("\n");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");

    if (textBuffer.trim()) {
      normalized.output_text = textBuffer;
    }
  }

  normalized.run_id = normalized.run_id || result.run_id || result.id;
  normalized._rawParallelResponse = result;

  return normalized;
}

type ParallelTaskMetadata = Record<string, unknown> & {
  blueprintId?: string;
};

async function callParallelTask({
  prompt,
  metadata,
  maxOutputTokens,
  requestMeta,
  processor,
}: {
  prompt: string;
  metadata?: ParallelTaskMetadata;
  maxOutputTokens?: number;
  requestMeta?: Record<string, unknown>;
  processor?: string;
}) {
  const taskProcessor = processor || parallelProcessor;
  // Auto schema triggers Deep Research with structured JSON by default on pro/ultra
  const taskSpec: Record<string, any> = {
    output_schema: { type: "auto" }, // or { type: "text" } for markdown reports
  };

  if (typeof maxOutputTokens === "number") {
    taskSpec.max_output_tokens = maxOutputTokens;
  }

  const body: Record<string, any> = {
    input: prompt,
    processor: taskProcessor,
    task_spec: taskSpec,
  };

  // NEW: attach metadata (keys ≤16 chars, values ≤512 chars, both strings)
  if (metadata && typeof metadata === "object") {
    const md: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (!k) continue;
      const key = String(k).slice(0, 16);
      if (v !== undefined && v !== null) {
        md[key] = String(v).slice(0, 512);
      }
    }
    if (Object.keys(md).length) {
      (body as any).metadata = md;
    }
  }

  // Stream progress + receive completion push
  body.enable_events = true;

  if (parallelWebhookUrl) {
    // Per docs: event_types must be provided; "task_run.status" is the standard signal
    body.webhook = {
      url: parallelWebhookUrl,
      event_types: ["task_run.status"],
    };
  }

  logger.info(
    attachRequestMeta({
      ...requestMeta,
      processor: taskProcessor,
    }),
    "Submitting Parallel deep research task",
  );

  const createResponse = await parallelApiFetch<any>("/v1/tasks/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const runId = createResponse?.run_id || createResponse?.id;
  if (!runId) {
    throw new Error("Parallel API response did not include a run identifier");
  }

  // Persist runId so we can fetch results even if this request stops waiting
  const firestore = db;
  const blueprintId =
    typeof metadata?.blueprintId === "string"
      ? (metadata.blueprintId as string)
      : null;

  if (blueprintId && !firestore) {
    logger.warn(
      attachRequestMeta({
        ...requestMeta,
        blueprintId,
        runId,
      }),
      "Firestore not configured; skipping runId persistence",
    );
  } else if (blueprintId && firestore) {
    try {
      await firestore
        .collection("blueprints")
        .doc(blueprintId)
        .set(
          {
            postSignupWorkflowStatus: {
              lastRunId: runId,
              lastProcessor: taskProcessor,
              lastSubmittedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
          { merge: true },
        );
    } catch (e) {
      logger.warn(
        { ...requestMeta, err: e, runId, blueprintId },
        "Failed to persist Parallel runId",
      );
    }
  }

  let latestStatus: ParallelTaskStatus | undefined =
    (createResponse?.status as ParallelTaskStatus | undefined) ||
    (createResponse?.run_status as ParallelTaskStatus | undefined);

  if (latestStatus) {
    latestStatus = latestStatus.toLowerCase() as ParallelTaskStatus;
    logger.info(
      attachRequestMeta({
        ...requestMeta,
        runId,
        status: latestStatus,
      }),
      "Parallel task status update",
    );
    if (["completed", "succeeded", "finished"].includes(latestStatus)) {
      return normalizeParallelResult(createResponse);
    }
    if (
      ["failed", "errored", "error", "cancelled", "canceled"].includes(
        latestStatus,
      )
    ) {
      throw new Error(`Parallel task ${runId} ${latestStatus}`);
    }
  }

  const startTime = Date.now();
  let attempt = 0;

  while (Date.now() - startTime < parallelMaxWaitMs) {
    attempt += 1;
    let shouldContinue = false;

    const elapsed = Date.now() - startTime;
    const remainingMs = Math.max(1_000, parallelMaxWaitMs - elapsed);
    const timeoutSeconds = Math.min(
      parallelResultTimeoutSeconds,
      Math.max(30, Math.floor(remainingMs / 1_000)),
    );

    try {
      const result = await parallelApiFetch<any>(
        `/v1/tasks/runs/${runId}/result?timeout=${timeoutSeconds}`,
        {
          method: "GET",
          timeoutMs: remainingMs + 5_000,
        },
      );

      latestStatus =
        (result?.status as ParallelTaskStatus | undefined) ||
        (result?.run_status as ParallelTaskStatus | undefined) ||
        (result?.result?.status as ParallelTaskStatus | undefined);

      if (latestStatus) {
        latestStatus = latestStatus.toLowerCase() as ParallelTaskStatus;
        logger.info(
          attachRequestMeta({
            ...requestMeta,
            runId,
            status: latestStatus,
            attempt,
          }),
          "Parallel task status update",
        );

        if (["completed", "succeeded", "finished"].includes(latestStatus)) {
          return normalizeParallelResult(result);
        }

        if (
          [
            "failed",
            "errored",
            "error",
            "cancelled",
            "canceled",
            "timeout",
          ].includes(latestStatus)
        ) {
          throw new Error(`Parallel task ${runId} ${latestStatus}`);
        }
      }

      shouldContinue = true;
    } catch (error: any) {
      if (error?.status === 408 || error?.statusCode === 408) {
        logger.info(
          attachRequestMeta({
            ...requestMeta,
            runId,
            attempt,
            status: "poll_timeout",
          }),
          "Parallel task poll timed out, retrying",
        );
        shouldContinue = true;
      } else {
        throw error;
      }
    }

    if (!shouldContinue) {
      break;
    }

    const waitMs = Math.min(parallelPollIntervalMs, remainingMs);
    await waitFor(waitMs);
  }

  throw new Error(
    `Parallel task ${
      (latestStatus && `${latestStatus} `) || ""
    }did not complete within ${Math.round(parallelMaxWaitMs / 1000)} seconds`,
  );
}

type PostSignupWorkflowRequest = PostSignupWorkflowPromptInput & {
  blueprintId: string;
  userId?: string;
};

type KnowledgeSource = {
  title: string;
  url: string;
  category?: string;
  description?: string;
};

function extractResponseText(response: any): string {
  if (!response) return "";

  // Parallel Task API returns { run, output: { type: "json"|"text", content: ... } }
  if (response?.output?.content !== undefined) {
    const c = response.output.content;
    return typeof c === "string" ? c : JSON.stringify(c);
  }

  if (Array.isArray(response)) {
    const buffer = response
      .map((item) => extractResponseText(item))
      .filter(Boolean)
      .join("\n");
    if (buffer.trim()) {
      return buffer;
    }
  }

  if (response && typeof response === "object") {
    for (const key of ["output_text", "result", "data", "response"]) {
      if (key === "output_text") continue;
      const nested = (response as any)[key];
      if (nested) {
        const nestedText = extractResponseText(nested);
        if (nestedText.trim()) {
          return nestedText;
        }
      }
    }
  }

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  if (Array.isArray(response.output)) {
    const buffer = response.output
      .map((item: any) => {
        if (!item) return "";
        if (typeof item.text === "string") return item.text;
        if (Array.isArray(item.content)) {
          return item.content
            .map((chunk: any) => {
              if (typeof chunk === "string") return chunk;
              if (chunk?.type === "output_text" && chunk?.text?.value) {
                return chunk.text.value;
              }
              if (chunk?.text?.value) return chunk.text.value;
              if (typeof chunk?.text === "string") return chunk.text;
              return "";
            })
            .filter(Boolean)
            .join("\n");
        }
        if (item?.message?.content) {
          if (Array.isArray(item.message.content)) {
            return item.message.content
              .map((chunk: any) => chunk?.text?.value || chunk?.text || "")
              .filter(Boolean)
              .join("\n");
          }
          if (typeof item.message.content === "string") {
            return item.message.content;
          }
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");

    if (buffer.trim()) {
      return buffer;
    }
  }

  if (Array.isArray(response.choices)) {
    const buffer = response.choices
      .map((choice: any) => {
        if (!choice) return "";
        if (choice?.message?.content) {
          if (Array.isArray(choice.message.content)) {
            return choice.message.content
              .map((chunk: any) => chunk?.text?.value || chunk?.text || "")
              .filter(Boolean)
              .join("\n");
          }
          if (typeof choice.message.content === "string") {
            return choice.message.content;
          }
        }
        if (typeof choice?.text === "string") {
          return choice.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");

    if (buffer.trim()) {
      return buffer;
    }
  }

  if (typeof response.text === "string" && response.text.trim()) {
    return response.text;
  }

  return "";
}

function extractJsonPayload(rawText: string): any | null {
  if (!rawText) return null;

  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const jsonCandidate = fencedMatch ? fencedMatch[1] : trimmed;

  const tryParse = (value: string) => {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  };

  let parsed = tryParse(jsonCandidate);
  if (parsed) return parsed;

  const startIndex = jsonCandidate.indexOf("{");
  const endIndex = jsonCandidate.lastIndexOf("}");
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    parsed = tryParse(jsonCandidate.slice(startIndex, endIndex + 1));
    if (parsed) return parsed;
  }

  return null;
}

function normalizeKnowledgeSources(value: any): KnowledgeSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const map = new Map<string, KnowledgeSource>();

  for (const entry of value) {
    if (!entry) continue;

    const title =
      typeof entry.title === "string" ? entry.title.trim() : undefined;
    let url = typeof entry.url === "string" ? entry.url.trim() : undefined;

    if (!title || !url) continue;

    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    const category =
      typeof entry.category === "string" && entry.category.trim()
        ? entry.category.trim()
        : undefined;
    const description =
      typeof entry.description === "string" && entry.description.trim()
        ? entry.description.trim()
        : typeof entry.notes === "string" && entry.notes.trim()
          ? entry.notes.trim()
          : undefined;

    map.set(url, {
      title,
      url,
      category,
      description,
    });
  }

  return Array.from(map.values()).slice(0, 16);
}

function knowledgeSourcesFromReferences(value: any): KnowledgeSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const map = new Map<string, KnowledgeSource>();

  for (const entry of value) {
    if (!entry) continue;

    const title =
      typeof entry.title === "string" && entry.title.trim()
        ? entry.title.trim()
        : typeof entry.heading === "string" && entry.heading.trim()
          ? entry.heading.trim()
          : undefined;
    let url =
      typeof entry.url === "string" && entry.url.trim()
        ? entry.url.trim()
        : typeof entry.link === "string" && entry.link.trim()
          ? entry.link.trim()
          : undefined;

    if (!title || !url) continue;

    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    const category =
      typeof entry.domain === "string" && entry.domain.trim()
        ? entry.domain.trim()
        : typeof entry.category === "string" && entry.category.trim()
          ? entry.category.trim()
          : undefined;
    const description =
      typeof entry.passage === "string" && entry.passage.trim()
        ? entry.passage.trim()
        : typeof entry.snippet === "string" && entry.snippet.trim()
          ? entry.snippet.trim()
          : undefined;

    map.set(url, {
      title,
      url,
      category,
      description,
    });
  }

  return Array.from(map.values()).slice(0, 16);
}

function mergeKnowledgeSources(
  ...collections: KnowledgeSource[][]
): KnowledgeSource[] {
  const map = new Map<string, KnowledgeSource>();

  for (const collection of collections) {
    for (const source of collection) {
      if (!source?.url) continue;
      const key = source.url.toLowerCase();
      if (!map.has(key)) {
        map.set(key, source);
      }
    }
  }

  return Array.from(map.values()).slice(0, 24);
}

function toCamelCase(input: string): string {
  const normalized = input
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean);

  if (normalized.length === 0) {
    return input.trim();
  }

  return (
    normalized[0] +
    normalized
      .slice(1)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join("")
  );
}

function normalizeWelcomeMessages(value: any): Record<string, string> {
  const messages: Record<string, string> = {};

  const assignMessage = (rawKey: string | undefined, rawValue: any) => {
    if (!rawKey) return;

    const message =
      typeof rawValue === "string"
        ? rawValue.trim()
        : rawValue && typeof rawValue === "object"
          ? (typeof rawValue.message === "string" && rawValue.message.trim()) ||
            (typeof rawValue.text === "string" && rawValue.text.trim()) ||
            (typeof rawValue.template === "string" &&
              rawValue.template.trim()) ||
            (typeof rawValue.body === "string" && rawValue.body.trim()) ||
            (typeof rawValue.content === "string" && rawValue.content.trim())
          : "";

    if (message) {
      messages[toCamelCase(rawKey)] = message;
    }
  };

  if (!value) {
    return messages;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry) continue;
      if (typeof entry === "string") {
        assignMessage("target_customer", entry);
        continue;
      }

      const keyCandidate =
        (typeof entry.persona === "string" && entry.persona) ||
        (typeof entry.audience === "string" && entry.audience) ||
        (typeof entry.key === "string" && entry.key) ||
        (typeof entry.id === "string" && entry.id) ||
        (typeof entry.type === "string" && entry.type);

      assignMessage(keyCandidate, entry);
    }

    return messages;
  }

  if (typeof value === "object") {
    for (const [key, raw] of Object.entries(value)) {
      assignMessage(key, raw);
    }
  }

  return messages;
}

export default async function postSignupWorkflowsHandler(
  req: Request,
  res: Response,
) {
  const requestMetaBase = attachRequestMeta({
    requestId: res.locals?.requestId,
    route: "post-signup-workflows",
  });

  const firestore = db;

  if (!firestore) {
    logger.error(
      requestMetaBase,
      "Firestore admin client is not configured for post-signup workflows",
    );

    return res.status(500).json({
      error: "Failed to process post-signup workflows",
      details: "Firestore is not configured",
    });
  }

  const canUseParallel = Boolean(parallelApiKey);
  const canUsePerplexity = Boolean(perplexityApiKey);
  const providerPreferenceRaw = process.env.POST_SIGNUP_AI_PROVIDER;
  const providerPreference = providerPreferenceRaw
    ? providerPreferenceRaw.toLowerCase().trim()
    : undefined;
  const preferPerplexity =
    providerPreference !== "parallel" && canUsePerplexity;

  if (!canUsePerplexity && !canUseParallel) {
    logger.error(
      requestMetaBase,
      "No AI provider configured for post-signup workflows",
    );
    return res.status(500).json({ error: "Service temporarily unavailable" });
  }

  const requestBody = req.body as PostSignupWorkflowRequest;
  const {
    blueprintId,
    userId,
    companyName,
    address,
    companyUrl,
    contactName,
    contactEmail,
    contactPhone,
    locationType,
    squareFootage,
    onboardingGoal,
    audienceType,
  } = requestBody;

  if (!blueprintId || !companyName || !address) {
    logger.warn(
      attachRequestMeta({
        ...requestMetaBase,
        blueprintId,
        hasCompanyName: Boolean(companyName),
        hasAddress: Boolean(address),
      }),
      "Post-signup workflow missing required fields",
    );

    return res.status(400).json({
      error: "Missing required fields",
      details: {
        blueprintIdPresent: Boolean(blueprintId),
        companyNamePresent: Boolean(companyName),
        addressPresent: Boolean(address),
      },
    });
  }

  const requestMeta = attachRequestMeta({
    ...requestMetaBase,
    blueprintId,
    userId,
    companyName,
  });

  async function runStage<T>({
    stage,
    usePerplexityFirst,
    requestMeta: stageMeta,
    perplexityCall,
    parallelCall,
  }: {
    stage: string;
    usePerplexityFirst: boolean;
    requestMeta: Record<string, unknown>;
    perplexityCall: () => Promise<T>;
    parallelCall: () => Promise<T>;
  }): Promise<{ response: T; provider: AiProvider }> {
    const attempts: Array<{ provider: AiProvider; fn: () => Promise<T> }> = [];

    if (usePerplexityFirst) {
      if (canUsePerplexity) {
        attempts.push({ provider: "perplexity", fn: perplexityCall });
      }
      if (canUseParallel) {
        attempts.push({ provider: "parallel", fn: parallelCall });
      }
    } else {
      if (canUseParallel) {
        attempts.push({ provider: "parallel", fn: parallelCall });
      }
      if (canUsePerplexity) {
        attempts.push({ provider: "perplexity", fn: perplexityCall });
      }
    }

    if (attempts.length === 0) {
      throw new Error(`No AI provider available for ${stage}`);
    }

    let lastError: any;

    for (let index = 0; index < attempts.length; index += 1) {
      const attempt = attempts[index];
      try {
        const response = await attempt.fn();
        return { response, provider: attempt.provider };
      } catch (error) {
        lastError = error;
        const meta = attachRequestMeta({
          ...stageMeta,
          provider: attempt.provider,
          err: error,
        });
        const message = `${
          attempt.provider === "perplexity" ? "Perplexity" : "Parallel"
        } ${stage} call failed${
          index < attempts.length - 1 ? ", attempting alternate provider" : ""
        }`;
        if (index < attempts.length - 1) {
          logger.warn(meta, message);
        } else {
          logger.error(meta, message);
        }
      }
    }

    throw (
      lastError ?? new Error(`Failed to execute ${stage} stage for workflows`)
    );
  }

  try {
    const promptInput: PostSignupWorkflowPromptInput = {
      companyName,
      address,
      companyUrl,
      contactName,
      contactEmail,
      contactPhone,
      locationType,
      squareFootage,
      onboardingGoal,
      audienceType,
    };

    const researchPrompt = buildPostSignupDeepResearchPrompt(promptInput);

    const { response: researchResponse, provider: researchProvider } =
      await runStage({
        stage: "deep research",
        usePerplexityFirst: preferPerplexity,
        requestMeta: { ...requestMeta, stage: "deepResearch" },
        perplexityCall: () =>
          callPerplexity({
            model: deepResearchModel,
            prompt: researchPrompt,
            useReasoning: true,
            maxOutputTokens: 4_096,
          }),
        parallelCall: () =>
          callParallelTask({
            prompt: researchPrompt,
            maxOutputTokens: 4_096,
            processor: parallelResearchProcessor,
            metadata: {
              blueprintId,
              workflow: "post-signup.deep-research",
              triggeredBy: userId || null,
            },
            requestMeta: {
              ...requestMeta,
              stage: "deepResearch",
            },
          }),
      });

    const researchText = extractResponseText(researchResponse);
    if (!researchText.trim()) {
      logger.error(requestMeta, "Deep research call returned empty response");
      return res.status(502).json({
        error: "Deep research response was empty",
      });
    }

    const researchJson = extractJsonPayload(researchText) ?? {};
    const structuredKnowledgeSources = normalizeKnowledgeSources(
      researchJson.knowledge_sources ||
        researchJson.knowledgeSources ||
        researchJson.urls,
    );
    const referenceKnowledgeSources = knowledgeSourcesFromReferences(
      (researchResponse &&
        (researchResponse.references ||
          researchResponse.citations ||
          researchResponse.result?.references ||
          researchResponse.result?.citations ||
          researchResponse.data?.references ||
          researchResponse.data?.citations)) ||
        researchJson.references,
    );
    const knowledgeSources = mergeKnowledgeSources(
      structuredKnowledgeSources,
      referenceKnowledgeSources,
    );
    const topQuestions = Array.isArray(researchJson.top_questions)
      ? researchJson.top_questions
          .map((q: any) => (typeof q === "string" ? q.trim() : ""))
          .filter(Boolean)
      : [];
    const operationalDetails =
      researchJson.operational_details &&
      typeof researchJson.operational_details === "object"
        ? researchJson.operational_details
        : undefined;
    const metaRuntimeNotes = Array.isArray(researchJson.meta_runtime_notes)
      ? researchJson.meta_runtime_notes
          .map((note: any) => (typeof note === "string" ? note.trim() : ""))
          .filter(Boolean)
      : [];
    const researchSummary =
      typeof researchJson.summary === "string"
        ? researchJson.summary.trim()
        : undefined;

    const instructionsPrompt = buildPostSignupSystemInstructionsPrompt(
      promptInput,
      {
        summary: researchSummary,
        knowledgeSources,
        topQuestions,
        operationalDetails,
        metaRuntimeNotes,
      },
    );

    const { response: instructionsResponse, provider: instructionsProvider } =
      await runStage({
        stage: "system instructions",
        usePerplexityFirst: preferPerplexity,
        requestMeta: { ...requestMeta, stage: "systemInstructions" },
        perplexityCall: () =>
          callPerplexity({
            model: instructionsModel,
            prompt: instructionsPrompt,
          }),
        parallelCall: () =>
          callParallelTask({
            prompt: instructionsPrompt,
            processor: parallelInstructionsProcessor,
            metadata: {
              blueprintId,
              workflow: "post-signup.system-instructions",
              triggeredBy: userId || null,
            },
            requestMeta: {
              ...requestMeta,
              stage: "systemInstructions",
            },
          }),
      });

    const instructionsText = extractResponseText(instructionsResponse);
    if (!instructionsText.trim()) {
      logger.error(
        requestMeta,
        "System instruction call returned empty response",
      );
      return res.status(502).json({
        error: "System instructions response was empty",
      });
    }

    const instructionsJson = extractJsonPayload(instructionsText) ?? {};
    const systemInstructions =
      typeof instructionsJson.system_instructions === "string"
        ? instructionsJson.system_instructions.trim()
        : instructionsText.trim();
    const assistantVoice =
      typeof instructionsJson.voice === "string"
        ? instructionsJson.voice.trim()
        : typeof instructionsJson.voice_and_tone === "string"
          ? instructionsJson.voice_and_tone.trim()
          : undefined;
    const toolHints = Array.isArray(instructionsJson.tool_hints)
      ? instructionsJson.tool_hints
          .map((entry: any) => entry)
          .filter(
            (entry: any) =>
              entry &&
              typeof entry === "object" &&
              Object.keys(entry).length > 0,
          )
      : [];
    const fallbackMessages = Array.isArray(instructionsJson.fallback_messages)
      ? instructionsJson.fallback_messages
          .map((msg: any) => (typeof msg === "string" ? msg.trim() : ""))
          .filter(Boolean)
      : [];
    const metaRuntimeExpectations = Array.isArray(
      instructionsJson.meta_runtime_expectations,
    )
      ? instructionsJson.meta_runtime_expectations
          .map((entry: any) => (typeof entry === "string" ? entry.trim() : ""))
          .filter(Boolean)
      : [];

    let welcomeMessagesProvider: AiProvider | undefined;
    let welcomeMessages: Record<string, string> = {};

    try {
      const welcomeMessagesPrompt = buildPostSignupWelcomeMessagesPrompt(
        promptInput,
        {
          summary: researchSummary,
          knowledgeSources,
          topQuestions,
          operationalDetails,
          metaRuntimeNotes,
          systemInstructions,
          assistantVoice,
        },
      );

      const { response: welcomeMessagesResponse, provider: welcomeProvider } =
        await runStage({
          stage: "welcome messages",
          usePerplexityFirst: preferPerplexity,
          requestMeta: { ...requestMeta, stage: "welcomeMessages" },
          perplexityCall: () =>
            callPerplexity({
              model: instructionsModel,
              prompt: welcomeMessagesPrompt,
            }),
          parallelCall: () =>
            callParallelTask({
              prompt: welcomeMessagesPrompt,
              processor: parallelWelcomeProcessor,
              metadata: {
                blueprintId,
                workflow: "post-signup.welcome-messages",
                triggeredBy: userId || null,
              },
              requestMeta: {
                ...requestMeta,
                stage: "welcomeMessages",
              },
            }),
        });

      welcomeMessagesProvider = welcomeProvider;

      const welcomeMessagesText = extractResponseText(welcomeMessagesResponse);
      const welcomeMessagesJson = extractJsonPayload(welcomeMessagesText) ?? {};

      welcomeMessages = normalizeWelcomeMessages(
        welcomeMessagesJson.welcome_messages ||
          welcomeMessagesJson.messages ||
          welcomeMessagesJson.templates ||
          welcomeMessagesJson,
      );

      if (Object.keys(welcomeMessages).length === 0) {
        logger.warn(
          attachRequestMeta({
            ...requestMeta,
            welcomeMessagesRaw: welcomeMessagesText?.slice(0, 500) ?? null,
          }),
          "Welcome messages response contained no parsable entries",
        );
      }
    } catch (welcomeError) {
      logger.error(
        { ...requestMeta, err: welcomeError },
        "Failed to generate welcome messages",
      );
    }

    const blueprintRef = firestore.collection("blueprints").doc(blueprintId);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const postSignupWorkflowStatus: Record<string, any> = {
      lastRunAt: timestamp,
      triggeredBy: userId || null,
      researchProvider,
      instructionsProvider,
    };

    if (researchProvider === "perplexity") {
      postSignupWorkflowStatus.deepResearchModel = deepResearchModel;
    } else {
      postSignupWorkflowStatus.researchProcessor = parallelResearchProcessor;
    }

    if (instructionsProvider === "perplexity") {
      postSignupWorkflowStatus.instructionsModel = instructionsModel;
    } else {
      postSignupWorkflowStatus.instructionsProcessor =
        parallelInstructionsProcessor;
    }

    if (welcomeMessagesProvider) {
      postSignupWorkflowStatus.welcomeProvider = welcomeMessagesProvider;
      if (welcomeMessagesProvider === "perplexity") {
        postSignupWorkflowStatus.welcomeModel = instructionsModel;
      } else {
        postSignupWorkflowStatus.welcomeProcessor = parallelWelcomeProcessor;
      }
    }

    const updateData: Record<string, any> = {
      postSignupWorkflowStatus,
      aiResearchRawReport: researchText,
    };

    if (knowledgeSources.length > 0) {
      updateData.knowledgeSourceUrls = knowledgeSources;
      updateData.knowledgeSourceUrlsUpdatedAt = timestamp;
    }

    if (researchSummary) {
      updateData.aiResearchSummary = researchSummary;
    }

    if (topQuestions.length > 0) {
      updateData.aiTopVisitorQuestions = topQuestions;
    }

    if (operationalDetails) {
      updateData.aiOperationalDetails = operationalDetails;
    }

    if (metaRuntimeNotes.length > 0) {
      updateData.aiMetaRuntimeNotes = metaRuntimeNotes;
    }

    if (systemInstructions) {
      updateData.aiAssistantSystemInstructions = systemInstructions;
      updateData.aiAssistantInstructionsUpdatedAt = timestamp;
    }

    if (assistantVoice) {
      updateData.aiAssistantVoice = assistantVoice;
    }

    if (toolHints.length > 0) {
      updateData.aiAssistantToolHints = toolHints;
    }

    if (fallbackMessages.length > 0) {
      updateData.aiAssistantFallbackMessages = fallbackMessages;
    }

    if (metaRuntimeExpectations.length > 0) {
      updateData.aiAssistantMetaRuntimeExpectations = metaRuntimeExpectations;
    }

    if (Object.keys(welcomeMessages).length > 0) {
      updateData.aiAssistantWelcomeMessages = welcomeMessages;
      updateData.aiAssistantWelcomeMessagesUpdatedAt = timestamp;
    }

    await blueprintRef.set(updateData, { merge: true });

    logger.info(
      attachRequestMeta({
        ...requestMeta,
        knowledgeSourceCount: knowledgeSources.length,
        hasInstructions: Boolean(systemInstructions),
        welcomeMessageCount: Object.keys(welcomeMessages).length,
      }),
      "Post-signup workflows completed",
    );

    res.json({
      success: true,
      blueprintId,
      knowledgeSourceCount: knowledgeSources.length,
      topQuestionCount: topQuestions.length,
      storedInstructions: Boolean(systemInstructions),
      welcomeMessageCount: Object.keys(welcomeMessages).length,
    });
  } catch (error: any) {
    logger.error(
      { ...requestMeta, err: error },
      "Post-signup workflows failed",
    );

    res.status(500).json({
      error: "Failed to process post-signup workflows",
      details: error?.message || "Unknown error",
    });
  }
}
