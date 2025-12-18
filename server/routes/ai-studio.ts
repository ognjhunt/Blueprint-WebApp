import express from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  cacheKey,
  getCachedAnswer,
  putCachedAnswer,
} from "../retrieval/answerCache";
import { embedTexts } from "../retrieval/embeddings";
import { searchVenue } from "../retrieval/venueIndexer";
import {
  STUDIO_CONNECTORS,
  STUDIO_FUNCTIONS,
  resolveProvider,
  type StudioConnector,
  type StudioFunctionCapability,
} from "../constants/ai-studio";
import type { KnowledgeSource } from "../types/knowledge";

const router = express.Router();

const DEFAULT_MODEL =
  process.env.GEMINI_STUDIO_MODEL ||
  process.env.GEMINI_FLASH_MODEL ||
  "gemini-3-flash-preview";
const FALLBACK_MODEL =
  process.env.GEMINI_STUDIO_FALLBACK_MODEL ||
  process.env.GEMINI_FLASH_FALLBACK_MODEL;

type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeminiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GeminiGenerateContentResponse = {
  modelVersion?: string | null;
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string | null;
      }>;
    };
  }>;
};

type StudioChatRequest = {
  blueprintId?: string;
  message?: string;
  history?: ChatHistoryMessage[];
  connectors?: Record<string, boolean>;
  functions?: Record<string, boolean>;
  persona?: string;
  providerId?: string;
};

type SourceReference = {
  title: string;
  url: string;
  snippet: string;
  distance?: number | null;
};

type CachedPayload = {
  content: string;
  sources?: SourceReference[];
  model?: string | null;
  fromCache?: boolean;
};

type ToolHint = {
  name: string;
  whenToUse?: string;
  metaCall?: string;
};

function sanitizeStateMap(state?: Record<string, unknown>) {
  if (!state || typeof state !== "object") {
    return {} as Record<string, boolean>;
  }

  const result: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(state)) {
    if (!key) continue;
    result[key] = Boolean(value);
  }
  return result;
}

function normalizeKnowledgeSources(value: any): KnowledgeSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const results: KnowledgeSource[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const title =
      typeof (entry as any).title === "string"
        ? (entry as any).title.trim()
        : "";
    const url =
      typeof (entry as any).url === "string" ? (entry as any).url.trim() : "";
    if (!title || !url) {
      continue;
    }
    results.push({
      title,
      url,
      category:
        typeof (entry as any).category === "string" &&
        (entry as any).category.trim()
          ? (entry as any).category.trim()
          : undefined,
      description:
        typeof (entry as any).description === "string" &&
        (entry as any).description.trim()
          ? (entry as any).description.trim()
          : undefined,
    });
  }
  return results;
}

function connectorSummary(
  connectors: StudioConnector[],
  state: Record<string, boolean>,
) {
  const lines = connectors.map((connector) => {
    const status = state[connector.id] ?? false;
    return `${connector.name} — ${status ? "enabled" : "disabled"}${
      connector.description ? ` (${connector.description})` : ""
    }`;
  });

  const unknown = Object.entries(state)
    .filter(([id]) => !connectors.some((connector) => connector.id === id))
    .map(([id, enabled]) => `${id} — ${enabled ? "enabled" : "disabled"}`);

  const combined = [...lines, ...unknown];
  return combined.length ? combined.join("\n") : "None";
}

function capabilitySummary(
  capabilities: StudioFunctionCapability[],
  state: Record<string, boolean>,
) {
  const lines = capabilities.map((capability) => {
    const status = state[capability.id] ?? false;
    return `${capability.name} — ${status ? "enabled" : "disabled"}${
      capability.description ? ` (${capability.description})` : ""
    }`;
  });

  const unknown = Object.entries(state)
    .filter(([id]) => !capabilities.some((capability) => capability.id === id))
    .map(([id, enabled]) => `${id} — ${enabled ? "enabled" : "disabled"}`);

  const combined = [...lines, ...unknown];
  return combined.length ? combined.join("\n") : "None";
}

function truncate(text: string, limit = 520) {
  if (!text) {
    return "";
  }
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 1).trim()}…`;
}

function formatRuntimeNotes(notes: unknown) {
  if (!Array.isArray(notes)) {
    return [] as string[];
  }
  return notes
    .map((note) => (typeof note === "string" ? note.trim() : ""))
    .filter((note) => note.length > 0);
}

function formatFallbackMessages(messages: unknown) {
  if (!Array.isArray(messages)) {
    return [] as string[];
  }
  return messages
    .map((message) => (typeof message === "string" ? message.trim() : ""))
    .filter((message) => message.length > 0);
}

function formatToolHints(hints: unknown): ToolHint[] {
  if (!Array.isArray(hints)) {
    return [];
  }

  const results: ToolHint[] = [];
  for (const hint of hints) {
    if (!hint || typeof hint !== "object") {
      continue;
    }

    const name =
      typeof (hint as any).name === "string" ? (hint as any).name.trim() : "";
    if (!name) {
      continue;
    }

    const whenToUse =
      typeof (hint as any).when_to_use === "string"
        ? (hint as any).when_to_use.trim()
        : typeof (hint as any).whenToUse === "string"
          ? (hint as any).whenToUse.trim()
          : undefined;
    const metaCall =
      typeof (hint as any).meta_call === "string"
        ? (hint as any).meta_call.trim()
        : undefined;

    results.push({
      name,
      whenToUse,
      metaCall,
    });
  }

  return results;
}

function safeJsonStringify(value: unknown, indent = 2, limit = 1_200) {
  try {
    const serialized = JSON.stringify(value, null, indent);
    if (!serialized) {
      return null;
    }
    return serialized.length > limit
      ? `${serialized.slice(0, limit)}…`
      : serialized;
  } catch (error) {
    logger.warn({ err: error }, "Failed to serialize JSON for prompt context");
    return null;
  }
}

function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.protocol = u.protocol === "http:" ? "https:" : u.protocol;
    u.hostname = u.hostname.toLowerCase(); // safe; leave path/query case as-is
    u.hash = "";
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
    ].forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return raw;
  }
}

function curatedUrlList(sources: KnowledgeSource[], max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of sources) {
    const url = typeof s?.url === "string" ? s.url.trim() : "";
    if (!/^https?:\/\//i.test(url)) continue;
    const canon = canonicalizeUrl(url);
    if (!seen.has(canon)) {
      seen.add(canon);
      out.push(canon);
      if (out.length >= max) break;
    }
  }
  return out;
}

function buildSystemInstruction(options: {
  baseInstruction: string | null;
  providerName: string;
  persona: string;
  summary: string | null;
  knowledgeSources: KnowledgeSource[];
  runtimeNotes: string[];
  fallbackMessages: string[];
  operationalDetails: Record<string, unknown> | null;
  connectorsState: Record<string, boolean>;
  functionState: Record<string, boolean>;
  toolHints: ToolHint[];
}) {
  const {
    baseInstruction,
    providerName,
    persona,
    summary,
    knowledgeSources,
    runtimeNotes,
    fallbackMessages,
    operationalDetails,
    connectorsState,
    functionState,
    toolHints,
  } = options;

  const knowledgeLines = knowledgeSources
    .slice(0, 12)
    .map((source) =>
      [
        `- ${source.title}`,
        source.category ? ` [${source.category}]` : "",
        `: ${source.url}`,
        source.description ? ` — ${source.description}` : "",
      ].join(""),
    )
    .join("\n");

  const opsText = safeJsonStringify(operationalDetails);

  const instructionParts = [
    baseInstruction?.trim() ||
      "You are the on-location assistant for this venue. Answer in a friendly, precise, voice-first tone (1–2 sentences) and offer relevant follow-up actions when available.",
    "---",
    `Simulation persona: ${persona}. Runtime provider: ${providerName}.`,
    summary ? `Research summary: ${summary}` : null,
    "---",
    "Connector availability:",
    connectorSummary(STUDIO_CONNECTORS, connectorsState),
    "---",
    "Function capabilities:",
    capabilitySummary(STUDIO_FUNCTIONS, functionState),
    knowledgeLines ? `---\nKnowledge sources:\n${knowledgeLines}` : null,
    opsText ? `---\nOperational details:\n${opsText}` : null,
    runtimeNotes.length
      ? `---\nRuntime guardrails:\n${runtimeNotes.map((note) => `- ${note}`).join("\n")}`
      : null,
    toolHints.length
      ? `---\nTool call hints:\n${toolHints
          .map(
            (hint) =>
              `- ${hint.name}${hint.whenToUse ? `: ${hint.whenToUse}` : ""}${
                hint.metaCall ? ` (runtime: ${hint.metaCall})` : ""
              }`,
          )
          .join("\n")}`
      : null,
    fallbackMessages.length
      ? `If information is missing, respond with one of these fallbacks: ${fallbackMessages.join(" | ")}`
      : null,
    "Always cite factual statements using the format (Source: Title). Keep answers concise for audio playback and optionally suggest an action (open link, navigation, staff request) when it adds value.",
  ];

  return instructionParts.filter((part) => Boolean(part)).join("\n");
}

function formatRetrievedSources(chunks: any[]): SourceReference[] {
  return chunks.map((chunk) => ({
    title: chunk.sourceTitle || chunk.sourceUrl,
    url: chunk.sourceUrl,
    snippet: truncate(typeof chunk.text === "string" ? chunk.text : "", 420),
    distance: typeof chunk.distance === "number" ? chunk.distance : null,
  }));
}

function buildRetrievalContext(sources: SourceReference[]) {
  if (!sources.length) {
    return "No semantic matches were retrieved from the venue knowledge index.";
  }

  return sources
    .map((source, index) => {
      const header = `Source ${index + 1}: ${source.title} (${source.url})`;
      const distance =
        typeof source.distance === "number"
          ? ` — similarity ${(1 - source.distance).toFixed(3)}`
          : "";
      return `${header}${distance}\n${source.snippet}`;
    })
    .join("\n\n");
}

router.post("/chat", async (req, res) => {
  const payload = req.body as StudioChatRequest;
  const blueprintId =
    typeof payload.blueprintId === "string" ? payload.blueprintId.trim() : "";
  const message =
    typeof payload.message === "string" ? payload.message.trim() : "";

  if (!blueprintId) {
    return res.status(400).json({ error: "blueprintId is required" });
  }
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }
  if (!db) {
    return res.status(500).json({ error: "Firestore is not configured" });
  }

  const connectorsState = sanitizeStateMap(payload.connectors);
  const functionState = sanitizeStateMap(payload.functions);
  const persona = payload.persona?.trim() || "Operations Concierge";
  const provider = resolveProvider(payload.providerId);

  const cacheSignatureParts = [
    message,
    persona,
    provider?.id || "",
    Object.keys(connectorsState)
      .filter((key) => connectorsState[key])
      .sort()
      .join("|"),
    Object.keys(functionState)
      .filter((key) => functionState[key])
      .sort()
      .join("|"),
  ];

  const key = cacheKey(blueprintId, cacheSignatureParts.join("::"));

  try {
    const cached = (await getCachedAnswer(key)) as CachedPayload | null;
    if (cached && cached.content) {
      return res.json({ ...cached, fromCache: true });
    }
  } catch (error) {
    logger.warn({ blueprintId, err: error }, "Answer cache lookup failed");
  }

  try {
    const doc = await db.collection("blueprints").doc(blueprintId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Blueprint not found" });
    }

    const data = doc.data() || {};
    const systemInstruction = buildSystemInstruction({
      baseInstruction:
        typeof data.aiAssistantSystemInstructions === "string"
          ? data.aiAssistantSystemInstructions
          : null,
      providerName: provider.name,
      persona,
      summary:
        typeof data.aiResearchSummary === "string"
          ? data.aiResearchSummary
          : typeof data.aiResearchRawReport === "string"
            ? truncate(data.aiResearchRawReport, 800)
            : null,
      knowledgeSources: normalizeKnowledgeSources(
        data.knowledgeSourceUrls || data.aiKnowledgeSources,
      ),
      runtimeNotes: formatRuntimeNotes(data.aiAssistantMetaRuntimeExpectations),
      fallbackMessages: formatFallbackMessages(
        data.aiAssistantFallbackMessages,
      ),
      operationalDetails:
        typeof data.aiOperationalDetails === "object" &&
        data.aiOperationalDetails
          ? (data.aiOperationalDetails as Record<string, unknown>)
          : null,
      connectorsState,
      functionState,
      toolHints: formatToolHints(data.aiAssistantToolHints),
    });

    const historyMessages: GeminiChatMessage[] = Array.isArray(payload.history)
      ? payload.history
          .filter(
            (item): item is ChatHistoryMessage =>
              Boolean(item) &&
              (item.role === "user" || item.role === "assistant") &&
              typeof item.content === "string" &&
              item.content.trim().length > 0,
          )
          .map(
            (item): GeminiChatMessage => ({
              role: item.role === "assistant" ? "assistant" : "user",
              content: item.content.trim(),
            }),
          )
      : [];

    let retrievedSources: SourceReference[] = [];
    try {
      const embeddings = await embedTexts([message]);
      if (embeddings.length > 0) {
        const results = await searchVenue(blueprintId, embeddings[0], 6);
        retrievedSources = formatRetrievedSources(results);
      }
    } catch (error) {
      logger.warn({ blueprintId, err: error }, "Venue knowledge search failed");
    }

    const retrievalContext = buildRetrievalContext(retrievedSources);

    const knowledgeList = normalizeKnowledgeSources(
      data.knowledgeSourceUrls || data.aiKnowledgeSources,
    );
    const urlContextList = curatedUrlList(knowledgeList, 12);

    const userPromptSections = [
      `You are responding from within the Blueprint AI Studio simulation for ${provider.name}.`,
      `Visitor persona focus: ${persona}.`,
      `Knowledge excerpts:\n${retrievalContext}`,
      `Question: ${message}`,
      "Provide an actionable, voice-ready answer in <=2 sentences and mention a relevant follow-up action if the connectors/functions allow it.",
    ];

    if (urlContextList.length) {
      userPromptSections.push(
        `Use these URLs as authoritative context (you may open and read them):\n` +
          urlContextList.join("\n"),
      );
    }

    const messages: GeminiChatMessage[] = [];

    const trimmedInstruction = systemInstruction?.trim();
    if (trimmedInstruction) {
      messages.push({ role: "system", content: trimmedInstruction });
    }

    messages.push(...historyMessages);

    messages.push({
      role: "user",
      content: userPromptSections.join("\n\n"),
    });

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const systemInstructionContent = trimmedInstruction
      ? { role: "system", parts: [{ text: trimmedInstruction }] }
      : null;

    const geminiContents = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));

    const runModel = async (
      model: string,
    ): Promise<{ content: string; modelVersion?: string | null }> => {
      const requestBody: Record<string, unknown> = {
        contents: geminiContents,
        generationConfig: { temperature: 0.3 },
        tools: [
          { url_context: {} }, // URL Context tool
          { google_search: {} }, // Grounding with Google Search
        ],
      };

      if (systemInstructionContent) {
        requestBody.systemInstruction = systemInstructionContent;
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `Gemini API request failed (${response.status}): ${errorBody}`,
        );
      }

      const data = (await response.json()) as GeminiGenerateContentResponse;
      const candidate = data.candidates?.find((item) =>
        item?.content?.parts?.some(
          (part) => typeof part?.text === "string" && part.text.trim(),
        ),
      );
      const content = candidate?.content?.parts
        ?.map((part) =>
          typeof part?.text === "string" ? part.text.trim() : "",
        )
        .filter((part) => part.length > 0)
        .join("\n\n");

      const trimmedContent = content?.trim();
      if (!trimmedContent) {
        throw new Error("No response returned from Gemini API");
      }

      return {
        content: trimmedContent,
        modelVersion: data.modelVersion ?? model,
      };
    };

    let response: { content: string; modelVersion?: string | null };
    let modelUsed = DEFAULT_MODEL;
    try {
      response = await runModel(DEFAULT_MODEL);
    } catch (primaryError) {
      logger.warn(
        { blueprintId, err: primaryError },
        "Primary Gemini model failed; attempting fallback",
      );
      if (!FALLBACK_MODEL || FALLBACK_MODEL === DEFAULT_MODEL) {
        throw primaryError;
      }
      response = await runModel(FALLBACK_MODEL);
      modelUsed = FALLBACK_MODEL;
    }

    const text = response.content ? response.content.trim() : "";
    const finalText = text
      ? text
      : formatFallbackMessages(data.aiAssistantFallbackMessages)[0] ||
        "I'm still syncing the venue details. Please check with an associate for now.";

    const payloadToCache: CachedPayload = {
      content: finalText,
      sources: retrievedSources,
      model: response.modelVersion || modelUsed,
      fromCache: false,
    };

    void putCachedAnswer(key, payloadToCache, 180);

    return res.json(payloadToCache);
  } catch (error) {
    logger.error(
      { blueprintId, err: error },
      "Failed to process AI Studio chat",
    );
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to generate response",
    });
  }
});

export default router;
