import OpenAI from "openai";

import { logger } from "../logger";
import { OPENAI_API_BASE_URL, getOpenAiConfigurationIssue } from "../utils/openaiApiHost";

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

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const client = getOpenAiClient();
  if (!client) {
    logger.warn("Embedding provider is not configured. Returning empty embeddings.");
    return texts.map(() => []);
  }

  const response = await client.embeddings.create({
    model: defaultModel,
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}
