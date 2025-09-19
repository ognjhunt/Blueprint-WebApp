import { Request, Response } from "express";
import OpenAI from "openai";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { attachRequestMeta, logger } from "../logger";
import {
  buildPostSignupDeepResearchPrompt,
  buildPostSignupSystemInstructionsPrompt,
  type PostSignupWorkflowPromptInput,
} from "../utils/ai-prompts";

const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 60_000);
const deepResearchModel =
  process.env.OPENAI_DEEP_RESEARCH_MODEL || "o4-mini-deep-research";
const instructionsModel =
  process.env.OPENAI_SYSTEM_INSTRUCTION_MODEL || "o4-mini";

const openai = openAiApiKey
  ? new OpenAI({
      apiKey: openAiApiKey,
      maxRetries: 2,
      timeout: openAiTimeoutMs,
    })
  : null;

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

    const title = typeof entry.title === "string" ? entry.title.trim() : undefined;
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

export default async function postSignupWorkflowsHandler(
  req: Request,
  res: Response,
) {
  const requestMetaBase = attachRequestMeta({
    requestId: res.locals?.requestId,
    route: "post-signup-workflows",
  });

  if (!openai) {
    logger.error(requestMetaBase, "OpenAI client not configured for post-signup workflows");
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

    const researchResponse = await openai.responses.create({
      model: deepResearchModel,
      input: researchPrompt,
      tools: [
        { type: "web_search_preview" },
        { type: "code_interpreter", container: { type: "auto" } },
      ],
      max_output_tokens: 4_096,
    });

    const researchText = extractResponseText(researchResponse);
    if (!researchText.trim()) {
      logger.error(
        requestMeta,
        "Deep research call returned empty response",
      );
      return res.status(502).json({
        error: "Deep research response was empty",
      });
    }

    const researchJson = extractJsonPayload(researchText) ?? {};
    const knowledgeSources = normalizeKnowledgeSources(
      researchJson.knowledge_sources ||
        researchJson.knowledgeSources ||
        researchJson.urls,
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

    const instructionsResponse = await openai.responses.create({
      model: instructionsModel,
      input: instructionsPrompt,
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
          .filter((entry: any) =>
            entry && typeof entry === "object" && Object.keys(entry).length > 0,
          )
      : [];
    const fallbackMessages = Array.isArray(
      instructionsJson.fallback_messages,
    )
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

    await blueprintRef.set(updateData, { merge: true });

    logger.info(
      attachRequestMeta({
        ...requestMeta,
        knowledgeSourceCount: knowledgeSources.length,
        hasInstructions: Boolean(systemInstructions),
      }),
      "Post-signup workflows completed",
    );

    res.json({
      success: true,
      blueprintId,
      knowledgeSourceCount: knowledgeSources.length,
      topQuestionCount: topQuestions.length,
      storedInstructions: Boolean(systemInstructions),
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
