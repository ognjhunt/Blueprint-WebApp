import { Request, Response } from "express";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { attachRequestMeta, logger } from "../logger";
import {
  buildPostSignupDeepResearchPrompt,
  buildPostSignupSystemInstructionsPrompt,
  buildPostSignupWelcomeMessagesPrompt,
  type PostSignupWorkflowPromptInput,
} from "../utils/ai-prompts";

const perplexityApiKey =
  process.env.PERPLEXITY_API_KEY ||
  "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";
const perplexityTimeoutMs = Number(process.env.PERPLEXITY_TIMEOUT_MS ?? 60_000);
const deepResearchModel =
  process.env.PERPLEXITY_DEEP_RESEARCH_MODEL || "sonar-deep-research";
const instructionsModel =
  process.env.PERPLEXITY_INSTRUCTIONS_MODEL || deepResearchModel;
const reasoningEffort = (process.env.PERPLEXITY_REASONING_EFFORT ?? "high") as
  | "low"
  | "medium"
  | "high";
const PERPLEXITY_ENDPOINT = "https://api.perplexity.ai/chat/completions";
const PERPLEXITY_SYSTEM_MESSAGE =
  "You are Blueprint's automation copilot. Follow the user's instructions exactly and respond with valid JSON whenever a schema is provided.";

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

  if (!perplexityApiKey) {
    logger.error(
      requestMetaBase,
      "Perplexity API key not configured for post-signup workflows",
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

    const researchResponse = await callPerplexity({
      model: deepResearchModel,
      prompt: researchPrompt,
      useReasoning: true,
      maxOutputTokens: 4_096,
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
        (researchResponse.references || researchResponse.citations)) ||
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

    const instructionsResponse = await callPerplexity({
      model: instructionsModel,
      prompt: instructionsPrompt,
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

      const welcomeMessagesResponse = await callPerplexity({
        model: instructionsModel,
        prompt: welcomeMessagesPrompt,
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
        deepResearchModel,
        instructionsModel,
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
