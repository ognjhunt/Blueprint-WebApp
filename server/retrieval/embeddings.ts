import OpenAI from "openai";

import { logger } from "../logger";

const defaultModel = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

let openAiClient: OpenAI | null = null;

function getOpenAiClient() {
  if (openAiClient !== null) {
    return openAiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn(
      "OPENAI_API_KEY is not configured. Venue knowledge indexing will skip embedding generation.",
    );
    openAiClient = null;
    return openAiClient;
  }

  openAiClient = new OpenAI({ apiKey });
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
