import OpenAI from "openai";

import { logger } from "../logger";
import { OPENAI_API_BASE_URL, getOpenAiConfigurationIssue } from "../utils/openaiApiHost";
import { classifyProviderError } from "../agents/provider-errors";
import { isProviderCoolingDown, markProviderOutOfFunds } from "../agents/provider-funds";
import { NON_LANE_SENDS, privacyDecisionForClasses } from "../agents/provider-privacy";

const defaultModel = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

let openAiClient: OpenAI | null = null;

function getOpenAiClient() {
  if (openAiClient !== null) {
    return openAiClient;
  }

  const issue = getOpenAiConfigurationIssue();
  if (issue) {
    // The reason only, never the value of a setting.
    logger.warn({ reason: issue }, "OpenAI is not configured. Venue knowledge indexing will skip embedding generation.");
    openAiClient = null;
    return openAiClient;
  }

  openAiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!.trim(), baseURL: OPENAI_API_BASE_URL });
  return openAiClient;
}

/**
 * Embeddings are their own kind (`retrieval_embeddings` in the data-class
 * gate's table): OpenAI only, through the same gate, host pin and "no funds"
 * handling as the lanes. An empty embedding means "not available", and every
 * caller then ranks by plain text: when the gate does not permit the send,
 * when OpenAI is not configured, or when it answers "no funds". Any other
 * error is thrown as before.
 *
 * Embeddings have no second provider, so a cool-down after "no funds" never
 * blocks them: they always ask (a "no funds" answer is not billed), and the
 * first request after a top-up succeeds. A "no funds" answer still marks the
 * provider, so the lanes learn it. During the cool-down the request is sent
 * once, with no SDK retries, so a "no funds" answer falls back at once instead
 * of waiting for retries with backoff; otherwise the client's own retry
 * setting applies.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  const unavailable = () => texts.map(() => [] as number[]);

  const send = NON_LANE_SENDS.retrieval_embeddings;
  const decision = privacyDecisionForClasses(send.provider, send.classes);
  if (!decision.permitted) {
    logger.warn({ reason: "privacy_not_permitted", blocked_by: decision.blocked_by }, "Embeddings not sent: not permitted for this data.");
    return unavailable();
  }
  const client = getOpenAiClient();
  if (!client) {
    logger.warn("Embedding provider is not configured. Returning empty embeddings.");
    return unavailable();
  }

  try {
    const params = { model: defaultModel, input: texts };
    const response = await (isProviderCoolingDown(send.provider)
      ? client.embeddings.create(params, { maxRetries: 0 })
      : client.embeddings.create(params));
    return response.data.map((item) => item.embedding);
  } catch (error) {
    const classification = classifyProviderError(error, send.provider);
    if (classification.error_class !== "no_funds") throw error;
    markProviderOutOfFunds(send.provider, classification);
    logger.warn({ reason: "no_funds", http_status: classification.status, error_code: classification.code },
      "Embeddings not available: the provider has no funds; callers rank by plain text.");
    return unavailable();
  }
}
