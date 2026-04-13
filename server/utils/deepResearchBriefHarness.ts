import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  createNotionClient,
  upsertKnowledgeEntry,
  upsertWorkQueueItem,
} from "../../ops/paperclip/plugins/blueprint-automation/src/notion";
import { getConfiguredEnvValue } from "../config/env";
import { logger } from "../logger";
import {
  createGeminiInteraction,
  extractGeminiInteractionText,
  GEMINI_DEEP_RESEARCH_AGENT,
  GEMINI_PLANNING_MODEL,
  pollGeminiInteractionUntilComplete,
  type GeminiInteraction,
} from "./geminiInteractions";
import {
  buildDeepResearchTools,
  resolveDeepResearchFileSearchStoreNames,
} from "./deepResearchFileSearch";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const DEFAULT_REPORTS_ROOT = path.join(
  REPO_ROOT,
  "ops/paperclip/reports/deep-research-briefs",
);

export interface DeepResearchBriefOptions {
  title: string;
  brief: string;
  owner?: string | null;
  businessLane?: "Executive" | "Ops" | "Growth" | "Buyer" | "Capturer" | "Experiment" | "Risk";
  system?: "Cross-System" | "WebApp" | "Capture" | "Pipeline" | "Validation";
  fileSearchStoreNames?: string[];
  critiqueRounds?: number;
  reportsRoot?: string;
  slug?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

export interface DeepResearchBriefResult {
  title: string;
  slug: string;
  startedAt: string;
  completedAt: string;
  runDirectory: string;
  finalArtifactPath: string;
  notion?: {
    knowledgePageId?: string;
    knowledgePageUrl?: string;
    workQueuePageId?: string;
    workQueuePageUrl?: string;
  };
  stages: Array<{
    key: string;
    interactionId: string;
    status: string;
    artifactPath: string;
  }>;
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replaceAll(":", "-");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getNotionToken() {
  return getConfiguredEnvValue("NOTION_API_TOKEN", "NOTION_API_KEY");
}

async function writeTextArtifact(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

function buildInitialPrompt(input: DeepResearchBriefOptions) {
  return [
    `You are Blueprint's Deep Research analyst.`,
    ``,
    `Produce a long-form, source-cited research brief for the following work item:`,
    `Title: ${input.title}`,
    input.owner ? `Owner lane: ${input.owner}` : null,
    input.businessLane ? `Business lane: ${input.businessLane}` : null,
    ``,
    `Requirements:`,
    `- use web research aggressively but cite concrete sources`,
    `- separate evidence, inference, and recommendation`,
    `- do not invent traction, legal posture, rights status, or product capability`,
    `- if evidence is missing, say it is missing`,
    `- bias toward operator-useful detail instead of generic summary`,
    `- output Markdown`,
    ``,
    `Research brief:`,
    input.brief,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCritiquePrompt(title: string, research: string) {
  return [
    `You are Blueprint's critique agent for research briefs.`,
    `Review the prior research brief for: ${title}`,
    ``,
    `Find weak evidence, unsupported assumptions, missing comparisons, fuzzy recommendations, or places where the brief drifts from Blueprint doctrine or real operating constraints.`,
    ``,
    `Return Markdown with these sections:`,
    `1. Fatal gaps`,
    `2. Weak evidence or unsupported claims`,
    `3. Missing comparisons or questions`,
    `4. Recommended revisions`,
    ``,
    `Prior brief:`,
    research,
  ].join("\n");
}

function buildFollowUpResearchPrompt(title: string, priorResearch: string, critique: string) {
  return [
    `Continue the research brief for: ${title}`,
    `Resolve the critique findings below with tighter evidence and clearer operating implications.`,
    ``,
    `Prior research:`,
    priorResearch,
    ``,
    `Critique to resolve:`,
    critique,
  ].join("\n");
}

function buildSynthesisPrompt(title: string, research: string, critiques: string[]) {
  return [
    `You are Blueprint's synthesis editor.`,
    `Turn the accumulated research into a final reusable research brief for: ${title}`,
    ``,
    `Output Markdown with:`,
    `- Executive summary`,
    `- Evidence`,
    `- Key inferences`,
    `- Recommendations`,
    `- Risks and unknowns`,
    `- What needs human review`,
    ``,
    `Primary research:`,
    research,
    ``,
    `Critiques resolved:`,
    critiques.join("\n\n---\n\n"),
  ].join("\n");
}

async function persistInteractionArtifact(input: {
  artifactPath: string;
  title: string;
  interaction: GeminiInteraction;
  prompt: string;
}) {
  const text = extractGeminiInteractionText(input.interaction);
  await writeTextArtifact(
    input.artifactPath,
    [
      `# ${input.title}`,
      ``,
      `- interaction_id: ${input.interaction.id}`,
      `- status: ${input.interaction.status}`,
      ``,
      `## Prompt`,
      "",
      "```text",
      input.prompt,
      "```",
      "",
      `## Output`,
      "",
      text || "_No text output returned._",
    ].join("\n"),
  );
  return text;
}

async function syncBriefToNotion(input: {
  title: string;
  slug: string;
  finalText: string;
  completedAt: string;
  canonicalSource: string;
  system: "Cross-System" | "WebApp" | "Capture" | "Pipeline" | "Validation";
  businessLane?: "Executive" | "Ops" | "Growth" | "Buyer" | "Capturer" | "Experiment" | "Risk";
}) {
  const notionToken = getNotionToken();
  if (!notionToken) {
    return null;
  }

  const client = createNotionClient({ token: notionToken });
  const knowledgeTitle = `Deep Research Brief - ${input.title}`;
  const knowledgeEntry = await upsertKnowledgeEntry(
    client,
    {
      title: knowledgeTitle,
      type: "Reference",
      system: input.system,
      content: input.finalText,
      sourceOfTruth: "Repo",
      canonicalSource: input.canonicalSource,
      reviewCadence: "Weekly",
      lifecycleStage: "Planning",
      naturalKey: `deep-research-brief::${input.slug}`,
    },
    { archiveDuplicates: true },
  );
  const workQueueEntry = await upsertWorkQueueItem(
    client,
    {
      title: `Review deep research brief - ${input.title}`,
      priority: "P1",
      system: input.system,
      businessLane: input.businessLane,
      lifecycleStage: "Open",
      workType: "Research",
      lastStatusChange: input.completedAt,
      naturalKey: `deep-research-brief-review::${input.slug}`,
      substage: [
        "Deep research brief refreshed.",
        knowledgeEntry.pageUrl
          ? `Knowledge page: ${knowledgeEntry.pageUrl}`
          : `Knowledge page ID: ${knowledgeEntry.pageId}`,
      ].join(" "),
    },
    { archiveDuplicates: true },
  );

  return {
    knowledgePageId: knowledgeEntry.pageId,
    knowledgePageUrl: knowledgeEntry.pageUrl,
    workQueuePageId: workQueueEntry.pageId,
    workQueuePageUrl: workQueueEntry.pageUrl,
  };
}

export async function runDeepResearchBrief(
  options: DeepResearchBriefOptions,
) {
  const title = options.title.trim();
  const brief = options.brief.trim();
  if (!title || !brief) {
    throw new Error("Deep research brief requires both title and brief.");
  }

  const slug = options.slug?.trim() || slugify(title);
  const startedAt = new Date();
  const reportsRoot = options.reportsRoot || DEFAULT_REPORTS_ROOT;
  const runDirectory = path.join(reportsRoot, slug, timestampForFile(startedAt));
  const stages: DeepResearchBriefResult["stages"] = [];
  const critiqueRounds = Math.max(1, options.critiqueRounds ?? 1);
  const deepResearchTools = buildDeepResearchTools(
    resolveDeepResearchFileSearchStoreNames({
      explicitStoreNames: options.fileSearchStoreNames,
    }),
  );

  logger.info({ title, slug }, "Starting generic Deep Research brief");

  const initialPrompt = buildInitialPrompt(options);
  const initialInteraction = await createGeminiInteraction({
    input: initialPrompt,
    agent: GEMINI_DEEP_RESEARCH_AGENT,
    background: true,
    store: true,
    tools: deepResearchTools,
  });
  const initialComplete = await pollGeminiInteractionUntilComplete({
    interactionId: initialInteraction.id,
    pollIntervalMs: options.pollIntervalMs,
    timeoutMs: options.timeoutMs,
  });
  let latestResearch = await persistInteractionArtifact({
    artifactPath: path.join(runDirectory, "01-initial-research.md"),
    title: `${title} Initial Research`,
    interaction: initialComplete,
    prompt: initialPrompt,
  });
  stages.push({
    key: "initial_research",
    interactionId: initialComplete.id,
    status: initialComplete.status,
    artifactPath: path.join(runDirectory, "01-initial-research.md"),
  });

  const critiques: string[] = [];
  for (let round = 1; round <= critiqueRounds; round += 1) {
    const critiquePrompt = buildCritiquePrompt(title, latestResearch);
    const critiqueInteraction = await createGeminiInteraction({
      input: critiquePrompt,
      model: GEMINI_PLANNING_MODEL,
      previousInteractionId: stages[stages.length - 1]?.interactionId,
      store: true,
    });
    const critiqueArtifactPath = path.join(runDirectory, `10-critique-${round}.md`);
    const critiqueText = await persistInteractionArtifact({
      artifactPath: critiqueArtifactPath,
      title: `${title} Critique ${round}`,
      interaction: critiqueInteraction,
      prompt: critiquePrompt,
    });
    critiques.push(critiqueText);
    stages.push({
      key: `critique_${round}`,
      interactionId: critiqueInteraction.id,
      status: critiqueInteraction.status,
      artifactPath: critiqueArtifactPath,
    });

    const followUpPrompt = buildFollowUpResearchPrompt(
      title,
      latestResearch,
      critiqueText,
    );
    const followUpInteraction = await createGeminiInteraction({
      input: followUpPrompt,
      agent: GEMINI_DEEP_RESEARCH_AGENT,
      background: true,
      store: true,
      tools: deepResearchTools,
    });
    const followUpComplete = await pollGeminiInteractionUntilComplete({
      interactionId: followUpInteraction.id,
      pollIntervalMs: options.pollIntervalMs,
      timeoutMs: options.timeoutMs,
    });
    const followUpArtifactPath = path.join(
      runDirectory,
      `20-follow-up-research-${round}.md`,
    );
    latestResearch = await persistInteractionArtifact({
      artifactPath: followUpArtifactPath,
      title: `${title} Follow-Up Research ${round}`,
      interaction: followUpComplete,
      prompt: followUpPrompt,
    });
    stages.push({
      key: `follow_up_research_${round}`,
      interactionId: followUpComplete.id,
      status: followUpComplete.status,
      artifactPath: followUpArtifactPath,
    });
  }

  const synthesisPrompt = buildSynthesisPrompt(title, latestResearch, critiques);
  const synthesisInteraction = await createGeminiInteraction({
    input: synthesisPrompt,
    model: GEMINI_PLANNING_MODEL,
    previousInteractionId: stages[stages.length - 1]?.interactionId,
    store: true,
  });
  const finalArtifactPath = path.join(runDirectory, "99-final-brief.md");
  const finalText = await persistInteractionArtifact({
    artifactPath: finalArtifactPath,
    title: `${title} Final Brief`,
    interaction: synthesisInteraction,
    prompt: synthesisPrompt,
  });
  stages.push({
    key: "final_brief",
    interactionId: synthesisInteraction.id,
    status: synthesisInteraction.status,
    artifactPath: finalArtifactPath,
  });

  const canonicalSource = path.join(
    REPO_ROOT,
    "ops/paperclip/reports/deep-research-briefs",
    slug,
    "latest.md",
  );
  await writeTextArtifact(canonicalSource, finalText);

  const result: DeepResearchBriefResult = {
    title,
    slug,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    runDirectory,
    finalArtifactPath,
    stages,
  };

  try {
    const notion = await syncBriefToNotion({
      title,
      slug,
      finalText,
      completedAt: result.completedAt,
      canonicalSource,
      system: options.system || "WebApp",
      businessLane: options.businessLane,
    });
    if (notion) {
      result.notion = notion;
    }
  } catch (error) {
    logger.warn(
      { title, error: error instanceof Error ? error.message : String(error) },
      "Deep research brief Notion sync failed",
    );
  }

  await writeTextArtifact(
    path.join(runDirectory, "manifest.json"),
    JSON.stringify(result, null, 2),
  );
  logger.info({ title, slug }, "Completed generic Deep Research brief");
  return result;
}
