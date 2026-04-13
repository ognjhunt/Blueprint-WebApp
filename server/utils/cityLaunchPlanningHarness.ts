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
import { CITY_LAUNCH_RESEARCH_SCHEMA_VERSION } from "./cityLaunchResearchParser";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const DEFAULT_REPORTS_ROOT = path.join(
  REPO_ROOT,
  "ops/paperclip/reports/city-launch-deep-research",
);

const DEFAULT_CONTEXT_FILES = [
  "PLATFORM_CONTEXT.md",
  "WORLD_MODEL_STRATEGY_CONTEXT.md",
  "AUTONOMOUS_ORG.md",
  "DEPLOYMENT.md",
  "ops/paperclip/playbooks/city-launch-template.md",
  "ops/paperclip/playbooks/capturer-supply-playbook.md",
  "ops/paperclip/playbooks/robot-team-demand-playbook.md",
  "ops/paperclip/programs/city-launch-agent-program.md",
  "ops/paperclip/programs/city-demand-agent-program.md",
];

export interface CityLaunchHarnessRunOptions {
  city: string;
  citySlug?: string;
  region?: string | null;
  similarCompanies?: string[];
  fileSearchStoreNames?: string[];
  critiqueRounds?: number;
  pollIntervalMs?: number;
  timeoutMs?: number;
  reportsRoot?: string;
}

export interface CityLaunchHarnessArtifacts {
  runDirectory: string;
  manifestPath: string;
  initialResearchPath: string;
  finalPlaybookPath: string;
  canonicalPlaybookPath: string;
  stageArtifacts: string[];
  notionKnowledgePageUrl?: string;
  notionWorkQueuePageUrl?: string;
}

export interface CityLaunchHarnessResult {
  city: string;
  citySlug: string;
  startedAt: string;
  completedAt: string;
  artifacts: CityLaunchHarnessArtifacts;
  stages: Array<{
    key: string;
    interactionId: string;
    status: string;
    artifactPath: string;
  }>;
  notion?: {
    knowledgePageId?: string;
    knowledgePageUrl?: string;
    workQueuePageId?: string;
    workQueuePageUrl?: string;
  };
}

export function slugifyCityName(city: string) {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function trimContext(text: string, maxChars = 20_000) {
  const normalized = text.trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}\n\n[Truncated for prompt budget]`;
}

async function readRepoFile(relativePath: string) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  const content = await fs.readFile(absolutePath, "utf8");
  return {
    relativePath,
    absolutePath,
    content,
  };
}

async function loadPlanningContext(citySlug: string) {
  const contextualFiles = [...DEFAULT_CONTEXT_FILES];
  const cityLaunchPath = `ops/paperclip/playbooks/city-launch-${citySlug}.md`;
  const cityDemandPath = `ops/paperclip/playbooks/city-demand-${citySlug}.md`;

  for (const file of [cityLaunchPath, cityDemandPath]) {
    try {
      await fs.access(path.join(REPO_ROOT, file));
      contextualFiles.push(file);
    } catch {
      // Skip missing city-specific context.
    }
  }

  const contents = await Promise.all(contextualFiles.map(readRepoFile));
  return contents
    .map((entry) => `## ${entry.relativePath}\n\n${trimContext(entry.content)}`)
    .join("\n\n");
}

function buildResearchPrompt(input: {
  city: string;
  region?: string | null;
  similarCompanies: string[];
  context: string;
}) {
  const marketComparables = input.similarCompanies.join(", ");
  return [
    `You are Blueprint's city launch research director.`,
    ``,
    `Objective: produce the most expansive, detailed, operator-ready city launch playbook possible for ${input.city}${input.region ? `, ${input.region}` : ""}.`,
    `This is not a generic startup memo. Build a launch system that humans and agents can execute.`,
    ``,
    `Blueprint doctrine and operating context:`,
    `- capture-first and world-model-product-first`,
    `- Exact-Site Hosted Review is the active wedge`,
    `- do not invent traction, sites, rights, providers, or readiness states`,
    `- keep rights, privacy, provenance, hosted-session truth, and human gates explicit`,
    `- city launch planning must stay useful in 2026 with AI agents and human operators working together`,
    ``,
    `Research brief:`,
    `1. Study city-launch mechanics used by analogous companies such as ${marketComparables}.`,
    `2. Identify the transferable patterns behind how those companies seeded supply, demand, trust, operations, referral loops, and city sequencing.`,
    `3. Separate what transfers cleanly to Blueprint from what does not, given Blueprint is a capture-first, exact-site world-model product rather than rideshare or delivery.`,
    `4. Translate that into a Blueprint-specific launch playbook for ${input.city}.`,
    `5. Explicitly account for the 2026 AI era: agent-assisted planning, agent-prepared outbound, operator review lanes, instrumentation, and workflow automation.`,
    `6. Bias toward first-principles and concrete operating mechanics instead of generic growth advice.`,
    ``,
    `Required deliverable shape:`,
    `- Executive summary`,
    `- City thesis and why now`,
    `- Analog comparison table: Uber / DoorDash / Instacart / Airbnb / one robotics-infra analog`,
    `- What Blueprint should copy, adapt, reject`,
    `- Supply-side launch design: first 25, first 100, first 250 capturers`,
    `- Demand-side launch design: first 10, first 25, first 50 robot-team conversations`,
    `- Proof-asset design: what exact proof packs, hosted reviews, and site assets must exist before scale`,
    `- Human and agent operating model by lane`,
    `- Funnel instrumentation and launch gates`,
    `- Weekly execution plan for the first 12 weeks`,
    `- Outreach playbooks, referral loops, and city-specific channel strategy`,
    `- Ops readiness checklist and failure modes`,
    `- Spend tiers: zero-budget, low-budget, and funded`,
    `- Research gaps and what must be validated locally before any public-beta claim`,
    ``,
    `Formatting requirements:`,
    `- write in Markdown`,
    `- include tables where useful`,
    `- cite specific sources throughout`,
    `- call out unsupported assumptions explicitly instead of smoothing them over`,
    `- if data is missing, say it is missing`,
    ``,
    `Repo context to ground the work:`,
    input.context,
  ].join("\n");
}

export function buildCritiquePrompt(previousResearch: string) {
  return [
    `You are Blueprint's launch-strategy critique agent.`,
    `Review the previous city launch research dossier with a hostile-but-accurate operating lens.`,
    ``,
    `Your job is to find where the research is still generic, unsupported, operationally thin, or mismatched to Blueprint doctrine.`,
    `Be especially strict about:`,
    `- fake transfer from Uber / DoorDash-style patterns that do not fit Blueprint`,
    `- weak treatment of rights, provenance, privacy, or hosted proof`,
    `- missing city-specific channel and trust mechanics`,
    `- missing operator-vs-agent ownership splits`,
    `- missing instrumentation and go/no-go thresholds`,
    `- outreach plans that assume volume before proof`,
    ``,
    `Return Markdown with exactly these sections:`,
    `1. Fatal gaps`,
    `2. Unsupported or weak analogies`,
    `3. Missing local evidence`,
    `4. Missing operating mechanics`,
    `5. Follow-up research questions`,
    `6. Required playbook revisions`,
    ``,
    `Previous research dossier:`,
    previousResearch,
  ].join("\n");
}

function buildFollowUpResearchPrompt(input: {
  city: string;
  critique: string;
  priorResearch: string;
}) {
  return [
    `Continue the city launch research for ${input.city}.`,
    `You are resolving critique findings from a prior research pass.`,
    ``,
    `Instructions:`,
    `- focus only on the unresolved gaps and critiques below`,
    `- add new evidence and tighter operating detail`,
    `- do not repeat unchanged background unless needed for clarity`,
    `- keep citations and call out uncertainty explicitly`,
    ``,
    `Prior research summary:`,
    input.priorResearch,
    ``,
    `Critique to resolve:`,
    input.critique,
  ].join("\n");
}

export function buildSynthesisPrompt(input: {
  city: string;
  research: string;
  critiqueOutputs: string[];
}) {
  return [
    `You are Blueprint's launch playbook synthesizer.`,
    `Turn the accumulated research and critique outputs into a single operator-ready city launch playbook for ${input.city}.`,
    ``,
    `The playbook must be usable by both humans and agents.`,
    `It must be more specific and more operational than a strategy memo.`,
    ``,
    `Required sections:`,
    `- Executive summary`,
    `- Blueprint-specific launch doctrine for this city`,
    `- What analogous companies teach us and what they do not`,
    `- Supply launch system`,
    `- Demand and outreach system`,
    `- Proof-asset system`,
    `- Human vs agent ownership model`,
    `- Instrumentation spec`,
    `- 12-week execution schedule`,
    `- Go / no-go criteria for public beta`,
    `- Checklists`,
    `- Sample prompts for agents`,
    `- Open research gaps`,
    `- Structured launch data appendix`,
    ``,
    `Formatting rules:`,
    `- output Markdown only`,
    `- include a "Truth constraints" section near the top`,
    `- include a "What not to say publicly yet" section`,
    `- include tables and numbered steps where useful`,
    `- preserve uncertainty labels`,
    `- end the document with a fenced JSON block using \`\`\`city-launch-records`,
    `- the JSON block must parse cleanly and use schema_version "${CITY_LAUNCH_RESEARCH_SCHEMA_VERSION}"`,
    `- only include entries supported by the research; if a field is inferred, list it under inferred_fields instead of presenting it as ground truth`,
    ``,
    `Structured launch data schema:`,
    "```json",
    JSON.stringify(
      {
        schema_version: CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
        generated_at: "2026-04-12T00:00:00.000Z",
        capture_location_candidates: [
          {
            name: "Example warehouse",
            source_bucket: "industrial_warehouse",
            channel: "operator_intro",
            status: "identified",
            site_address: "123 Example St, Austin, TX",
            location_summary: "Del Valle logistics corridor",
            lat: 30.0,
            lng: -97.0,
            site_category: "warehouse",
            workflow_fit: "dock handoff and pallet movement",
            priority_note: "Strong early exact-site capture wedge.",
            source_urls: ["https://example.com"],
            explicit_fields: ["name", "site_address", "source_bucket"],
            inferred_fields: ["lat", "lng"],
          },
        ],
        buyer_target_candidates: [
          {
            company_name: "Example Robotics",
            contact_name: "Jane Doe",
            status: "researched",
            workflow_fit: "warehouse autonomy",
            proof_path: "hosted_review",
            notes: "Cited buyer fit from current robotics deployment work.",
            source_bucket: "warehouse_robotics",
            source_urls: ["https://example.com"],
            explicit_fields: ["company_name", "workflow_fit"],
            inferred_fields: [],
          },
        ],
        first_touch_candidates: [
          {
            reference_type: "buyer_target",
            reference_name: "Example Robotics",
            channel: "email",
            touch_type: "first_touch",
            status: "queued",
            campaign_id: null,
            issue_id: null,
            notes: "Reference a cited warehouse proof path.",
            source_urls: ["https://example.com"],
            explicit_fields: ["reference_name", "channel"],
            inferred_fields: [],
          },
        ],
        budget_recommendations: [
          {
            category: "outbound",
            amount_usd: 250,
            note: "Explicit recommendation from the final playbook.",
            source_urls: ["https://example.com"],
            explicit_fields: ["category", "amount_usd"],
            inferred_fields: [],
          },
        ],
      },
      null,
      2,
    ),
    "```",
    ``,
    `Primary research dossier:`,
    input.research,
    ``,
    `Critique outputs:`,
    input.critiqueOutputs.join("\n\n---\n\n"),
  ].join("\n");
}

async function writeTextArtifact(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

function timestampForFile(date = new Date()) {
  return date.toISOString().replaceAll(":", "-");
}

function buildCanonicalPlaybookPath(citySlug: string) {
  return path.join(
    REPO_ROOT,
    `ops/paperclip/playbooks/city-launch-${citySlug}-deep-research.md`,
  );
}

function getNotionToken() {
  return getConfiguredEnvValue("NOTION_API_TOKEN", "NOTION_API_KEY");
}

async function syncCityLaunchPlaybookToNotion(input: {
  city: string;
  canonicalPlaybookPath: string;
  finalPlaybookText: string;
  completedAt: string;
}) {
  const notionToken = getNotionToken();
  if (!notionToken) {
    return null;
  }

  const notionClient = createNotionClient({ token: notionToken });
  const knowledgeTitle = `City Launch Deep Research Playbook - ${input.city}`;
  const knowledgeEntry = await upsertKnowledgeEntry(
    notionClient,
    {
      title: knowledgeTitle,
      type: "Reference",
      system: "WebApp",
      content: input.finalPlaybookText,
      sourceOfTruth: "Repo",
      canonicalSource: input.canonicalPlaybookPath,
      reviewCadence: "Weekly",
      lifecycleStage: "Planning",
    },
    { archiveDuplicates: true },
  );

  const workQueueEntry = await upsertWorkQueueItem(
    notionClient,
    {
      title: `Review city launch deep research playbook - ${input.city}`,
      priority: "P1",
      system: "WebApp",
      businessLane: "Growth",
      lifecycleStage: "Open",
      workType: "Research",
      lastStatusChange: input.completedAt,
      naturalKey: `city-launch-deep-research::${slugifyCityName(input.city)}`,
      substage: [
        "Deep research playbook refreshed.",
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

async function persistInteractionArtifact(input: {
  artifactPath: string;
  title: string;
  interaction: GeminiInteraction;
  prompt: string;
}) {
  const text = extractGeminiInteractionText(input.interaction);
  const content = [
    `# ${input.title}`,
    ``,
    `- interaction_id: ${input.interaction.id}`,
    `- status: ${input.interaction.status}`,
    ``,
    `## Prompt`,
    ``,
    "```text",
    input.prompt,
    "```",
    ``,
    `## Output`,
    ``,
    text || "_No text output returned._",
  ].join("\n");

  await writeTextArtifact(input.artifactPath, content);
  return text;
}

export async function runCityLaunchPlanningHarness(
  options: CityLaunchHarnessRunOptions,
) {
  const city = options.city.trim();
  if (!city) {
    throw new Error("City is required.");
  }

  const citySlug = options.citySlug?.trim() || slugifyCityName(city);
  const startedAt = new Date();
  const runTimestamp = timestampForFile(startedAt);
  const reportsRoot = options.reportsRoot || DEFAULT_REPORTS_ROOT;
  const runDirectory = path.join(reportsRoot, citySlug, runTimestamp);
  const initialResearchPath = path.join(runDirectory, "01-initial-research.md");
  const finalPlaybookPath = path.join(runDirectory, "99-final-playbook.md");
  const canonicalPlaybookPath = buildCanonicalPlaybookPath(citySlug);
  const manifestPath = path.join(runDirectory, "manifest.json");
  const stageArtifacts: string[] = [];
  const stages: CityLaunchHarnessResult["stages"] = [];
  const similarCompanies = options.similarCompanies?.length
    ? options.similarCompanies
    : ["Uber", "DoorDash", "Instacart", "Airbnb", "Lime"];
  const deepResearchTools = buildDeepResearchTools(
    resolveDeepResearchFileSearchStoreNames({
      explicitStoreNames: options.fileSearchStoreNames,
      envKeys: [
        "BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE",
        "BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE",
      ],
    }),
  );
  const critiqueRounds = Math.max(1, options.critiqueRounds ?? 1);
  const context = await loadPlanningContext(citySlug);
  let latestResearchText = "";
  const critiqueOutputs: string[] = [];

  const initialResearchPrompt = buildResearchPrompt({
    city,
    region: options.region || null,
    similarCompanies,
    context,
  });

  logger.info({ city, citySlug }, "Starting city launch Deep Research harness");

  const initialResearch = await createGeminiInteraction({
    input: initialResearchPrompt,
    agent: GEMINI_DEEP_RESEARCH_AGENT,
    background: true,
    store: true,
    tools: deepResearchTools,
  });
  const initialResearchComplete = await pollGeminiInteractionUntilComplete({
    interactionId: initialResearch.id,
    pollIntervalMs: options.pollIntervalMs,
    timeoutMs: options.timeoutMs,
  });
  latestResearchText = await persistInteractionArtifact({
    artifactPath: initialResearchPath,
    title: `${city} Initial Deep Research`,
    interaction: initialResearchComplete,
    prompt: initialResearchPrompt,
  });
  stageArtifacts.push(initialResearchPath);
  stages.push({
    key: "initial_research",
    interactionId: initialResearchComplete.id,
    status: initialResearchComplete.status,
    artifactPath: initialResearchPath,
  });

  for (let round = 1; round <= critiqueRounds; round += 1) {
    const critiquePrompt = buildCritiquePrompt(latestResearchText);
    const critique = await createGeminiInteraction({
      input: critiquePrompt,
      model: GEMINI_PLANNING_MODEL,
      previousInteractionId: stages[stages.length - 1]?.interactionId,
      store: true,
    });
    const critiqueArtifactPath = path.join(
      runDirectory,
      `10-critique-round-${round}.md`,
    );
    const critiqueText = await persistInteractionArtifact({
      artifactPath: critiqueArtifactPath,
      title: `${city} Critique Round ${round}`,
      interaction: critique,
      prompt: critiquePrompt,
    });
    critiqueOutputs.push(critiqueText);
    stageArtifacts.push(critiqueArtifactPath);
    stages.push({
      key: `critique_round_${round}`,
      interactionId: critique.id,
      status: critique.status,
      artifactPath: critiqueArtifactPath,
    });

    const followUpPrompt = buildFollowUpResearchPrompt({
      city,
      critique: critiqueText,
      priorResearch: latestResearchText,
    });
    const followUpResearch = await createGeminiInteraction({
      input: followUpPrompt,
      agent: GEMINI_DEEP_RESEARCH_AGENT,
      background: true,
      store: true,
      tools: deepResearchTools,
    });
    const followUpResearchComplete = await pollGeminiInteractionUntilComplete({
      interactionId: followUpResearch.id,
      pollIntervalMs: options.pollIntervalMs,
      timeoutMs: options.timeoutMs,
    });
    const followUpArtifactPath = path.join(
      runDirectory,
      `20-follow-up-research-round-${round}.md`,
    );
    latestResearchText = await persistInteractionArtifact({
      artifactPath: followUpArtifactPath,
      title: `${city} Follow-Up Deep Research Round ${round}`,
      interaction: followUpResearchComplete,
      prompt: followUpPrompt,
    });
    stageArtifacts.push(followUpArtifactPath);
    stages.push({
      key: `follow_up_research_round_${round}`,
      interactionId: followUpResearchComplete.id,
      status: followUpResearchComplete.status,
      artifactPath: followUpArtifactPath,
    });
  }

  const synthesisPrompt = buildSynthesisPrompt({
    city,
    research: latestResearchText,
    critiqueOutputs,
  });
  const finalSynthesis = await createGeminiInteraction({
    input: synthesisPrompt,
    model: GEMINI_PLANNING_MODEL,
    previousInteractionId: stages[stages.length - 1]?.interactionId,
    store: true,
  });
  const finalPlaybookText = await persistInteractionArtifact({
    artifactPath: finalPlaybookPath,
    title: `${city} Final Launch Playbook`,
    interaction: finalSynthesis,
    prompt: synthesisPrompt,
  });
  await writeTextArtifact(canonicalPlaybookPath, finalPlaybookText);
  stageArtifacts.push(finalPlaybookPath);
  stages.push({
    key: "final_playbook",
    interactionId: finalSynthesis.id,
    status: finalSynthesis.status,
    artifactPath: finalPlaybookPath,
  });

  const result: CityLaunchHarnessResult = {
    city,
    citySlug,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    artifacts: {
      runDirectory,
      manifestPath,
      initialResearchPath,
      finalPlaybookPath,
      canonicalPlaybookPath,
      stageArtifacts,
    },
    stages,
  };

  try {
    const notion = await syncCityLaunchPlaybookToNotion({
      city,
      canonicalPlaybookPath,
      finalPlaybookText,
      completedAt: result.completedAt,
    });
    if (notion) {
      result.notion = notion;
      result.artifacts.notionKnowledgePageUrl = notion.knowledgePageUrl;
      result.artifacts.notionWorkQueuePageUrl = notion.workQueuePageUrl;
    }
  } catch (error) {
    logger.warn(
      {
        city,
        error: error instanceof Error ? error.message : String(error),
      },
      "City launch playbook Notion sync failed",
    );
  }

  await writeTextArtifact(manifestPath, JSON.stringify(result, null, 2));
  logger.info(
    { city, citySlug, canonicalPlaybookPath },
    "Completed city launch Deep Research harness",
  );

  return result;
}

export async function runCityLaunchFollowUpQuestion(input: {
  previousInteractionId: string;
  question: string;
  artifactPath?: string;
}) {
  const interaction = await createGeminiInteraction({
    input: input.question,
    model: GEMINI_PLANNING_MODEL,
    previousInteractionId: input.previousInteractionId,
    store: true,
  });

  const text = extractGeminiInteractionText(interaction);
  if (input.artifactPath) {
    await writeTextArtifact(
      input.artifactPath,
      [
        `# City Launch Follow-Up`,
        ``,
        `- previous_interaction_id: ${input.previousInteractionId}`,
        `- interaction_id: ${interaction.id}`,
        ``,
        `## Question`,
        input.question,
        ``,
        `## Output`,
        text || "_No text output returned._",
      ].join("\n"),
    );
  }

  return {
    interaction,
    text,
  };
}
