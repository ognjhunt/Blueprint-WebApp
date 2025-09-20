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
  process.env.PARALLEL_API_KEY ||
  "V9xyphAxwfrJb1faYC5c_-x4T93eYzbZDWdenFEw";
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
const parallelMaxWaitMs = Number(
  process.env.PARALLEL_MAX_WAIT_MS ?? 30 * 60 * 1_000,
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

type ParallelFetchOptions = RequestInit & { timeoutMs?: number };

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

async function parallelApiFetch<T = any>(
  path: string,
  options: ParallelFetchOptions = {},
): Promise<T> {
  if (!parallelApiKey) {
    throw new Error("Parallel API key is not configured");
  }

  const { timeoutMs, headers: requestHeaders, ...init } = options;
  const url = path.startsWith("http") ? path : `${parallelBaseUrl}${path}`;

  const headers = new Headers(requestHeaders ?? undefined);
  headers.set("x-api-key", parallelApiKey);
  headers.set("Accept", "application/json");
  if (parallelApiVersion && !headers.has("parallel-version")) {
    headers.set("parallel-version", parallelApiVersion);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const httpTimeout = Math.max(1_000, Number(timeoutMs ?? parallelHttpTimeoutMs));
  const timeoutId = setTimeout(() => controller.abort(), httpTimeout);

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
      throw error;
    }

    if (!responseText) {
      return undefined as T;
    }

    try {
      return JSON.parse(responseText) as T;
    } catch {
      return responseText as T;
    }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      const abortError = new Error(
        `Parallel API request to ${url} timed out after ${httpTimeout} ms`,
      );
      (abortError as any).status = 408;
      (abortError as any).statusCode = 408;
      throw abortError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

async function callParallelTask({
  prompt,
  metadata,
  maxOutputTokens,
  requestMeta,
  processor,
}: {
  prompt: string;
  metadata?: Record<string, unknown>;
  maxOutputTokens?: number;
  requestMeta?: Record<string, unknown>;
  processor?: string;
}) {
  const taskProcessor = processor || parallelProcessor;
  const taskSpec: Record<string, any> = {
    output_schema: {
      type: "text",
      description:
        "Return a concise yet comprehensive JSON object that follows the schema described in the prompt.",
    },
  };

  if (typeof maxOutputTokens === "number") {
    taskSpec.max_output_tokens = maxOutputTokens;
  }

  const body: Record<string, any> = {
    input: prompt,
    processor: taskProcessor,
    task_spec: taskSpec,
  };

  if (metadata && Object.keys(metadata).length > 0) {
    body.metadata = metadata;
  }

  if (parallelWebhookUrl) {
    body.webhook = {
      url: parallelWebhookUrl,
      events: parallelWebhookEvents,
      ...(parallelWebhookSecret ? { secret: parallelWebhookSecret } : {}),
    };
    body.webhook_url = parallelWebhookUrl;
    if (parallelWebhookSecret) {
      body.webhook_secret = parallelWebhookSecret;
    }
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
    if (["failed", "errored", "error", "cancelled", "canceled"].includes(latestStatus)) {
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

  if (!db) {
    logger.error(
      requestMetaBase,
      "Firestore admin client is not configured for post-signup workflows",
    );

    return res.status(500).json({
      error: "Failed to process post-signup workflows",
      details: "Firestore is not configured",
    });
  }

  if (!parallelApiKey) {
    logger.error(
      requestMetaBase,
      "Parallel API key not configured for post-signup workflows",
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

    const researchResponse = await callParallelTask({
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

    const instructionsResponse = await callParallelTask({
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

      const welcomeMessagesResponse = await callParallelTask({
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
      });

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

    const blueprintRef = db.collection("blueprints").doc(blueprintId);
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    const updateData: Record<string, any> = {
      postSignupWorkflowStatus: {
        lastRunAt: timestamp,
        triggeredBy: userId || null,
        researchProcessor: parallelResearchProcessor,
        instructionsProcessor: parallelInstructionsProcessor,
        welcomeProcessor: parallelWelcomeProcessor,
      },
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
