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
  buildGeminiDeepResearchAgentConfig,
  createGeminiInteraction,
  extractGeminiInteractionText,
  GEMINI_PLANNING_MODEL,
  pollGeminiInteractionUntilComplete,
  resolveGeminiDeepResearchAgent,
  type GeminiInteraction,
} from "./geminiInteractions";
import {
  buildDeepResearchTools,
  resolveDeepResearchFileSearchStoreNames,
  resolveDeepResearchMcpServers,
} from "./deepResearchFileSearch";
import {
  CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
  parseCityLaunchResearchArtifact,
} from "./cityLaunchResearchParser";
import {
  CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
  CITY_LAUNCH_CONTROL_PLANE_RULES,
  CITY_LAUNCH_LAWFUL_ACCESS_MODE_VALUES,
  CITY_LAUNCH_MACHINE_POLICY_VERSION,
  CITY_LAUNCH_REQUIRED_METRIC_DEPENDENCY_KEYS,
  CITY_LAUNCH_REQUIRED_PROOF_MOTION_MILESTONES,
} from "./cityLaunchDoctrine";
import {
  CITY_LAUNCH_APPROVED_ANALYTICS_EVENTS,
  CITY_LAUNCH_APPROVED_ANALYTICS_REFERENCES,
  CITY_LAUNCH_BANNED_MESSAGING_PATTERNS,
  CITY_LAUNCH_BUDGET_CATEGORY_VALUES,
  CITY_LAUNCH_BUYER_PROOF_PATH_VALUES,
  CITY_LAUNCH_BUYER_TARGET_STATUS_VALUES,
  CITY_LAUNCH_PROSPECT_STATUS_VALUES,
  CITY_LAUNCH_TOUCH_STATUS_VALUES,
  CITY_LAUNCH_TOUCH_TYPE_VALUES,
} from "./cityLaunchResearchContracts";

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
  "server/utils/cityLaunchDoctrine.ts",
  "server/utils/cityLaunchResearchContracts.ts",
];

export interface CityLaunchHarnessRunOptions {
  city: string;
  citySlug?: string;
  region?: string | null;
  similarCompanies?: string[];
  fileSearchStoreNames?: string[];
  deepResearchAgent?: string;
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
  activationPayloadPath: string;
  canonicalPlaybookPath: string;
  canonicalActivationPayloadPath: string;
  stageArtifacts: string[];
  notionKnowledgePageUrl?: string;
  notionWorkQueuePageUrl?: string;
}

export interface CityLaunchHarnessResult {
  city: string;
  citySlug: string;
  status: "in_progress" | "completed";
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

export interface CityLaunchPlaybookValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function buildPlaybookRepairPrompt(input: {
  city: string;
  previousPlaybook: string;
  validationErrors: string[];
  validationWarnings?: string[];
}) {
  const warningLines = (input.validationWarnings || []).length > 0
    ? input.validationWarnings!.map((warning) => `- ${warning}`)
    : ["- none"];

  return [
    `You are repairing a Blueprint city proof-motion playbook for ${input.city}.`,
    `Return a full corrected Markdown playbook, not a diff.`,
    ``,
    `Hard requirements:`,
    `- preserve the Blueprint proof-motion framing and the city-specific substance that is still valid`,
    `- fix every validation error listed below`,
    `- keep the exact section headings "## Machine-readable activation payload" and "## Structured launch data appendix"`,
    `- include a valid \`\`\`city-launch-activation-payload fence under the first heading`,
    `- include a valid \`\`\`city-launch-records fence under the second heading`,
    `- do not emit placeholder URLs such as example.com`,
    `- if a source URL is unknown, leave source_urls empty and keep validation_required=true where appropriate`,
    `- keep unsupported claims labeled verify-before-outreach rather than turning hypotheses into facts`,
    `- output Markdown only`,
    ``,
    `Validation errors to fix:`,
    ...input.validationErrors.map((error) => `- ${error}`),
    ``,
    `Validation warnings to preserve or improve on:`,
    ...warningLines,
    ``,
    `Previous playbook to repair:`,
    input.previousPlaybook,
  ].join("\n");
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

function renderAllowedValues(values: readonly string[]) {
  return values.map((value) => `\`${value}\``).join(", ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasHeading(markdown: string, heading: string) {
  return new RegExp(`^##+\\s+${escapeRegExp(heading)}\\s*$`, "im").test(markdown);
}

function extractSection(markdown: string, heading: string) {
  const pattern = new RegExp(
    `^##+\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=^##+\\s+|$)`,
    "im",
  );
  return pattern.exec(markdown)?.[1] || "";
}

export function validateCityLaunchPlaybookMarkdown(input: {
  city: string;
  markdown: string;
}) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const placeholderUrlMatches = [
    ...input.markdown.matchAll(/https?:\/\/example\.com(?:\/[^\s`"')]+)?/gi),
  ]
    .map((match) => match[0])
    .filter((value): value is string => Boolean(value));
  const requiredHeadings = [
    "Truth constraints",
    "Evidence-backed claims",
    "Inferred claims",
    "Hypotheses needing validation",
    "What Must Be Validated Before Live Outreach",
    "What not to say publicly yet",
    "Instrumentation spec",
    "Machine-readable activation payload",
    "Structured launch data appendix",
  ];

  for (const heading of requiredHeadings) {
    if (!hasHeading(input.markdown, heading)) {
      errors.push(`Missing required section heading: "${heading}".`);
    }
  }

  if (placeholderUrlMatches.length > 0) {
    errors.push(
      `Structured playbook includes placeholder source URLs: ${[...new Set(placeholderUrlMatches)].join(", ")}.`,
    );
  }

  if (!/verify before outreach|validation required/i.test(input.markdown)) {
    errors.push(
      'The playbook must explicitly label buyer-stack, delivery, security, or partner assumptions as "verify before outreach" or "validation required".',
    );
  }

  for (const entry of CITY_LAUNCH_BANNED_MESSAGING_PATTERNS) {
    if (entry.pattern.test(input.markdown)) {
      errors.push(`Manipulative or posture-drifting language detected: ${entry.reason}`);
    }
  }

  const instrumentationSection = extractSection(input.markdown, "Instrumentation spec");
  if (!instrumentationSection.trim()) {
    errors.push('The "Instrumentation spec" section is required.');
  } else {
    const tokenMatches = [...instrumentationSection.matchAll(/`([^`]+)`/g)]
      .map((match) => match[1]?.trim())
      .filter((token): token is string => Boolean(token))
      .filter((token) => token.includes("_") || token.includes("."));
    const unexpectedTokens = [...new Set(tokenMatches)].filter(
      (token) => !CITY_LAUNCH_APPROVED_ANALYTICS_REFERENCES.includes(
        token as (typeof CITY_LAUNCH_APPROVED_ANALYTICS_REFERENCES)[number],
      ),
    );

    if (unexpectedTokens.length > 0) {
      errors.push(
        `Instrumentation section includes unsupported analytics vocabulary: ${unexpectedTokens.join(", ")}.`,
      );
    }
  }

  const parsed = parseCityLaunchResearchArtifact({
    city: input.city,
    artifactPath: `/tmp/${slugifyCityName(input.city)}-validation.md`,
    markdown: input.markdown,
  });

  for (const warning of parsed.warnings) {
    if (
      /No structured city-launch research appendix/i.test(warning)
      || /schema_version did not match/i.test(warning)
      || /could not be parsed as valid JSON/i.test(warning)
    ) {
      errors.push(warning);
    } else {
      warnings.push(warning);
    }
  }

  for (const error of parsed.errors) {
    errors.push(error);
  }

  if (!parsed.activationPayload) {
    errors.push(
      `The playbook must include a valid machine-readable activation payload using schema "${CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION}".`,
    );
  } else {
    const metrics = parsed.activationPayload.metricsDependencies.map((entry) => entry.key);
    for (const requiredMetric of CITY_LAUNCH_REQUIRED_METRIC_DEPENDENCY_KEYS) {
      if (!metrics.includes(requiredMetric)) {
        errors.push(
          `Activation payload is missing required metrics_dependencies key "${requiredMetric}".`,
        );
      }
    }
    if (parsed.activationPayload.issueSeeds.length === 0) {
      errors.push("Activation payload must include issue_seeds mapped to named lanes.");
    }
    if (parsed.activationPayload.namedClaims.length === 0) {
      errors.push(
        "Activation payload must include named_claims for company, stack, or delivery assertions.",
      );
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  } satisfies CityLaunchPlaybookValidationResult;
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

export function buildResearchPrompt(input: {
  city: string;
  region?: string | null;
  similarCompanies: string[];
  context: string;
}) {
  const marketComparables = input.similarCompanies.join(", ");
  return [
    `You are Blueprint's city proof-motion research director.`,
    ``,
    `Objective: produce the most expansive, detailed, operator-safe Blueprint city proof-motion architecture possible for ${input.city}${input.region ? `, ${input.region}` : ""}.`,
    `This is not a generic startup memo or city marketplace launcher. Build one city-specific, truthful proof-motion system that humans and agents can execute without drifting from repo contracts or product truth.`,
    ``,
    `Blueprint doctrine and operating context:`,
    `- capture-first and world-model-product-first`,
    `- ${CITY_LAUNCH_CONTROL_PLANE_RULES.priorityWedge.label} is the active wedge`,
    `- optimize for one narrow commercial wedge at a time: one site lane, one workflow lane, one buyer proof path`,
    `- treat city launch as a coordinated proof-motion buildout, not a broad marketplace coverage exercise`,
    `- anchor all recommendations to BlueprintCapture -> BlueprintCapturePipeline -> Blueprint-WebApp plus Paperclip, Hermes, and named operator/agent lanes`,
    `- do not invent traction, sites, rights, providers, or readiness states`,
    `- keep rights, privacy, provenance, hosted-session truth, and human gates explicit`,
    `- city launch planning must stay useful in 2026 with AI agents and human operators working together`,
    `- private industrial or controlled-access interior capture requires explicit operator authorization before dispatching capturers`,
    `- do not suggest proactive capture of private facilities without consent, trespass-like tactics, or public-bounty mechanics for private interiors`,
    `- use only repo-approved analytics vocabulary with city/source tags instead of inventing city-specific event schemas`,
    `- cap early supply plans to a small, rights-cleared cohort until the first proof assets and hosted reviews exist`,
    `- treat defense, export-controlled, or air-gapped review requirements as explicit constraints, not footnotes`,
    `- do not assume public-cloud compatibility, security posture, or delivery readiness for defense, aerospace, or regulated buyers`,
    `- do not use manipulative, hypey, deceptive, or posture-changing language`,
    `- do not imply unstated rights, site access, partner, integration, buyer-stack, or approval assumptions`,
    ``,
    `Anti-pattern bans:`,
    `- no invented telemetry event names`,
    `- no manipulative scarcity or exclusivity framing`,
    `- no scaling supply before proof-ready assets and hosted reviews are real`,
    `- no unstated rights/access assumptions`,
    `- no treating defense, export-control, air-gap, or public-cloud compatibility as assumed`,
    ``,
    `Research brief:`,
    `1. Build Blueprint city proof-motion architecture for ${input.city}.`,
    `2. Identify one narrow wedge inside the city: one site lane, one workflow lane, one buyer proof path, and one realistic first proof motion.`,
    `3. Research lawful access and capture feasibility, capturer supply lanes, site-operator incentives where relevant, buyer clusters, proof-pack requirements, hosted-review requirements, and city-specific blockers to truthful proof motion.`,
    `4. Use analogous companies such as ${marketComparables} only as a secondary sanity check. Extract what Blueprint should copy, adapt, or reject; do not let marketplace analogies become the organizing frame.`,
    `5. Explicitly account for the 2026 AI era: agent-assisted planning, agent-prepared outbound, operator review lanes, instrumentation, bounded automation, and workflow orchestration through the current org.`,
    `6. Bias toward first-principles and concrete operating mechanics instead of generic growth or marketplace advice.`,
    ``,
    `Required deliverable shape:`,
    `- Executive summary`,
    `- Truth constraints`,
    `- City proof-motion thesis`,
    `- Why this city now for Blueprint`,
    `- Narrow wedge definition`,
    `- Analog sanity check: Uber / DoorDash / Airbnb / one robotics-infra analog as a secondary comparison section only`,
    `- What Blueprint should copy, adapt, reject`,
    `- Evidence-backed claims`,
    `- Inferred claims`,
    `- Hypotheses needing validation`,
    `- Lawful capture supply acquisition system: capturer profile, source channels, access paths, and first lawful capture mechanics using only these access modes where applicable: ${renderAllowedValues(CITY_LAUNCH_LAWFUL_ACCESS_MODE_VALUES)}`,
    `- Rights / provenance / privacy clearance system: trust packet, rights stamps, operator review, and pipeline stop conditions`,
    `- Proof-asset system: first proof-ready sites, proof-pack requirements, hosted-review prerequisites, and artifact formats`,
    `- Buyer proof-path routing system using only exact_site, adjacent_site, scoped_follow_up vocabulary`,
    `- Hosted-review conversion system: review readiness, follow-up triggers, stall reasons, and human commercial handoff conditions`,
    `- Human vs agent operating model split by founder-only, human operator-owned, agent-prepared/autonomous, and exception-only escalation`,
    `- Instrumentation and scorecard spec using canonical proof-motion analytics plus inboundRequests.ops.proof_path milestones`,
    `- Budget policy and approval thresholds`,
    `- Daily / weekly operating cadence`,
    `- Weekly execution plan for the first 12 weeks`,
    `- Go / hold / no-go gates for activation and widening`,
    `- Outreach playbooks and city-specific channel strategy tied to the Exact-Site Hosted Review wedge`,
    `- First-wave direct outreach set with 1-3 recipient-backed first-wave direct outreach contacts and explicit contact_email fields for every launch-ready direct lane`,
    `- Ops readiness checklist and failure modes`,
    `- Budget-aware bounded activation options: zero-budget, low-budget, and funded`,
    `- What Must Be Validated Before Live Outreach`,
    `- Research gaps and what must be validated locally before any public-beta claim`,
    `- Machine-readable activation payload`,
    ``,
    `Formatting requirements:`,
    `- write in Markdown`,
    `- include tables where useful`,
    `- cite specific sources throughout`,
    `- call out unsupported assumptions explicitly instead of smoothing them over`,
    `- if data is missing, say it is missing`,
    `- label each meaningful claim as evidence-backed, inferred, or hypothesis-level`,
    `- explicitly mark buyer stack, integration, delivery, legal, security, and partner assumptions as "verify before outreach" unless directly supported`,
    `- separate settled operating facts from leading hypotheses so a human can see what is activation-ready versus validation-required`,
    `- activation-ready does not mean "good strategy, no recipients"; if truthful recipients cannot be found, downgrade readiness and say the city is not outwardly addressable yet`,
    `- distinguish direct-outreach lanes from artifact-only/community lanes; community lanes may stay artifact-only until a real publication connector exists`,
    `- every direct-outreach-ready buyer_target_candidates or capture_location_candidates entry must include explicit \`contact_email\` fields; do not invent or infer emails`,
    `- if you mention telemetry, use only approved repo vocabulary: ${renderAllowedValues(CITY_LAUNCH_APPROVED_ANALYTICS_EVENTS)} plus \`inboundRequests.ops.proof_path\` milestones`,
    `- do not universalize site-operator intake as the only lawful path; choose between ${renderAllowedValues(CITY_LAUNCH_LAWFUL_ACCESS_MODE_VALUES)} and explain when private controlled interiors require explicit authorization`,
    `- include a machine-readable activation payload fence using \`\`\`city-launch-activation-payload with schema "${CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION}" and machine_policy_version "${CITY_LAUNCH_MACHINE_POLICY_VERSION}"`,
    `- do not ask for citywide liquidity, broad supply-demand balance, first 100/250 capturer scale, or generic community-seeding as the core launch frame`,
    ``,
    `Repo context to ground the work:`,
    input.context,
  ].join("\n");
}

export function buildCritiquePrompt(previousResearch: string) {
  return [
    `You are Blueprint's city proof-motion critique agent.`,
    `Review the previous Blueprint city proof-motion research dossier with a hostile-but-accurate operating lens.`,
    ``,
    `Your job is to find where the research is still generic, unsupported, operationally thin, or mismatched to Blueprint doctrine.`,
    `Be especially strict about:`,
    `- marketplace transfer errors from Uber / DoorDash-style patterns that do not fit Blueprint`,
    `- any framing that treats the work as a generic city marketplace launcher instead of a city proof-motion system`,
    `- citywide expansion or liquidity language appearing before proof assets, proof paths, and hosted reviews are real`,
    `- weak treatment of rights, provenance, privacy, or hosted proof`,
    `- unsupported access assumptions or missing site-operator acquisition before private interior capture`,
    `- invented city-specific telemetry instead of the platform event model`,
    `- proof-path vocabulary that conflicts with exact_site, adjacent_site, or scoped_follow_up`,
    `- use of analytics event names outside the approved repo vocabulary`,
    `- contradictory telemetry guidance such as claiming "no custom telemetry" while inventing new event names`,
    `- manipulative, hypey, scarcity-driven, or posture-changing messaging`,
    `- claims that skip rights, provenance, ops, or review gates and therefore sound settled when they are really hypotheses or inferences`,
    `- buyer stack, integration, delivery, security, or partner assumptions missing a "verify before outreach" label`,
    `- scaling supply volume before the first proof-ready sites, proof-pack deliveries, and hosted reviews exist`,
    `- unaddressed defense, ITAR, export-control, or air-gapped review constraints`,
    `- missing city-specific channel and trust mechanics`,
    `- missing operator-vs-agent ownership splits`,
    `- missing instrumentation, activation gates, widening gates, or go/no-go thresholds`,
    `- outreach plans that assume volume before proof`,
    `- parser/materializer enum mismatches, unsupported appendix values, or vocabulary drift from current repo contracts`,
    `- missing machine-readable activation payloads, missing lane mappings, or missing validation-required named claims`,
    `- recommendations that cannot safely be delegated to agent lanes after normal human review`,
    ``,
    `Return Markdown with exactly these sections:`,
    `1. Fatal gaps`,
    `2. Unsupported or weak analogies`,
    `3. Manipulative or posture-drifting language`,
    `4. Missing validation-required labels`,
    `5. Contract mismatches and unsafe structured output`,
    `6. Missing local evidence`,
    `7. Missing operating mechanics`,
    `8. Follow-up research questions`,
    `9. Required playbook revisions`,
    ``,
    `Previous research dossier:`,
    previousResearch,
  ].join("\n");
}

export function buildFollowUpResearchPrompt(input: {
  city: string;
  critique: string;
  priorResearch: string;
}) {
  return [
    `Continue the Blueprint city proof-motion research for ${input.city}.`,
    `You are resolving critique findings from a prior city proof-motion research pass.`,
    ``,
    `Instructions:`,
    `- focus only on the unresolved Blueprint proof-motion gaps and critiques below`,
    `- add new evidence and tighter operating detail`,
    `- do not repeat unchanged background unless needed for clarity`,
    `- keep citations and call out uncertainty explicitly`,
    `- preserve the distinction between evidence-backed claims, inferred claims, and hypotheses needing validation`,
    `- resolve lawful access path evidence, rights/provenance mechanics, buyer proof-path fit, hosted-review readiness, commercial handoff readiness, and company-specific validation gaps before adding new surface area`,
    `- keep buyer-stack, integration, delivery, security, rights, and partner assumptions marked "verify before outreach" unless directly supported`,
    `- if the prior draft says a city is activation-ready, require 1-3 recipient-backed first-wave direct outreach contacts with explicit contact_email evidence or downgrade readiness`,
    `- keep direct-outreach lanes separate from artifact-only/community lanes instead of treating "good strategy, no recipients" as launchable`,
    `- keep the machine-readable activation payload aligned with the prose so issue seeds, required approvals, metrics dependencies, and named claims can be delegated safely`,
    `- do not introduce new analytics event names beyond approved repo vocabulary`,
    `- do not drift into generic marketplace framing, citywide liquidity logic, or capturer volume milestones as the core output`,
    `- do not use manipulative or scarcity-driven language`,
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
    `Turn the accumulated research and critique outputs into a single operator-ready Blueprint city proof-motion playbook for ${input.city}.`,
    ``,
    `The playbook must be usable by both humans and agents.`,
    `It must be more specific and more operational than a strategy memo, safe to delegate against after normal human review, compact enough to route from, and expansive enough to support city activation.`,
    ``,
    `Required sections:`,
    `- Executive summary`,
    `- Truth constraints`,
    `- City proof-motion thesis`,
    `- Why this city now for Blueprint`,
    `- Narrow wedge definition`,
    `- Analog sanity check`,
    `- What analogous companies teach us and what they do not`,
    `- What Blueprint should copy, adapt, reject`,
    `- Evidence-backed claims`,
    `- Inferred claims`,
    `- Hypotheses needing validation`,
    `- Lawful capture supply acquisition system`,
    `- Rights / provenance / privacy clearance system`,
    `- Proof-asset system`,
    `- Buyer proof-path routing system`,
    `- Hosted-review conversion system`,
    `- Human vs agent operating model`,
    `- Instrumentation spec`,
    `- Budget policy and approval thresholds`,
    `- Daily / weekly operating cadence`,
    `- Site-operator acquisition and rights path`,
    `- What Must Be Validated Before Live Outreach`,
    `- 12-week execution schedule`,
    `- Go / hold / no-go gates for activation and widening`,
    `- Checklists`,
    `- Sample prompts for agents`,
    `- Open research gaps`,
    `- Machine-readable activation payload`,
    `- Structured launch data appendix`,
    ``,
    `Formatting rules:`,
    `- output Markdown only`,
    `- include a "Truth constraints" section near the top`,
    `- include a "What not to say publicly yet" section`,
    `- include tables and numbered steps where useful`,
    `- preserve uncertainty labels`,
    `- organize the document as a Blueprint city proof-motion launcher, not a generic marketplace launch plan`,
    `- keep analogous companies as a secondary sanity-check section only, not the main narrative frame`,
    `- use the exact heading text "## Machine-readable activation payload" immediately before the \`\`\`city-launch-activation-payload fence`,
    `- use the exact heading text "## Structured launch data appendix" immediately before the \`\`\`city-launch-records fence`,
    `- do not introduce city-specific analytics event names; use only approved repo analytics vocabulary with a city/source tag`,
    `- make the lawful access decision explicit before any private indoor capture motion`,
    `- if the city includes defense, aerospace, or other export-controlled buyers, add an explicit constraint section covering hosted-review limits and air-gapped review needs`,
    `- do not scale beyond a small vetted capturer cohort until the first proof assets and hosted reviews are real`,
    `- do not ask for generic liquidity metrics, broad supply-demand balance language, or first 100/250 capturer scale milestones`,
    `- use proof-motion milestones instead: first lawful site-operator access paths, first approved capturers with trust clearance, first completed captures, first QA-passed captures, first rights-cleared proof assets, first proof-pack deliveries, first hosted-review-ready assets, first hosted-review starts, and first human commercial handoffs`,
    `- explicitly label buyer stack, integration, delivery, security, partner, and compliance assumptions as "verify before outreach" unless directly supported`,
    `- do not use manipulative, exclusivity, fake urgency, or posture-changing language`,
    `- do not claim "no custom telemetry" while introducing new event names; distinguish current repo events, approved missing proof-motion events, and \`inboundRequests.ops.proof_path\` milestones explicitly`,
    `- align the result with the current city-launch execution docs and activation program, and distinguish activation gates vs widening gates vs outreach gates`,
    `- never copy placeholder schema values such as Example Robotics, Example warehouse, or example.com from the schema examples below into the final playbook`,
    `- if a source URL is unknown, use an empty array and keep the claim validation-required; never emit placeholder URLs`,
    `- include a fenced \`\`\`city-launch-activation-payload block that acts as the control-plane artifact for activation, issue routing, approvals, and metrics blockers`,
    `- end the document with a fenced JSON block using \`\`\`city-launch-records`,
    `- the JSON block must parse cleanly and use schema_version "${CITY_LAUNCH_RESEARCH_SCHEMA_VERSION}"`,
    `- only include entries supported by the research; if a field is inferred, list it under inferred_fields instead of presenting it as ground truth`,
    `- activation-ready output must include 1-3 recipient-backed first-wave direct outreach contacts`,
    `- Every direct-outreach-ready buyer_target_candidates or capture_location_candidates entry must include contact_email`,
    `- If truthful recipients cannot be found, downgrade readiness and state that direct outreach is not outwardly addressable yet`,
    `- treat community-posting lanes as artifact-only until a real publication connector exists; do not use them to mask missing direct recipients`,
    `- activation payload schema_version must be "${CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION}"`,
    `- activation payload machine_policy_version must be "${CITY_LAUNCH_MACHINE_POLICY_VERSION}"`,
    `- activation payload lawful_access_modes must use only: ${renderAllowedValues(CITY_LAUNCH_LAWFUL_ACCESS_MODE_VALUES)}`,
    `- activation payload owner_lanes must use only: ${renderAllowedValues(CITY_LAUNCH_CONTROL_PLANE_RULES.agentLanes)}`,
    `- activation payload required_approvals lanes must use only: ${renderAllowedValues(CITY_LAUNCH_CONTROL_PLANE_RULES.approvalLanes)}`,
    `- activation payload issue_seeds human_lane values must use only: ${renderAllowedValues(CITY_LAUNCH_CONTROL_PLANE_RULES.humanLanes)}`,
    `- activation payload issue_seeds must map every recommended action to named lanes from the current autonomous org and activation program`,
    `- activation payload named_claims must include every named company, stack, or delivery claim and each claim must either carry source_urls or set validation_required=true`,
    `- activation payload metrics_dependencies must cover: ${renderAllowedValues(CITY_LAUNCH_REQUIRED_METRIC_DEPENDENCY_KEYS)}`,
    `- activation payload may also track proof milestones such as: ${renderAllowedValues(CITY_LAUNCH_REQUIRED_PROOF_MOTION_MILESTONES)}`,
    `- allowed capture status values: ${renderAllowedValues(CITY_LAUNCH_PROSPECT_STATUS_VALUES)}`,
    `- allowed buyer target status values: ${renderAllowedValues(CITY_LAUNCH_BUYER_TARGET_STATUS_VALUES)}`,
    `- allowed buyer target proof_path values: ${renderAllowedValues(CITY_LAUNCH_BUYER_PROOF_PATH_VALUES)}`,
    `- allowed first touch type values: ${renderAllowedValues(CITY_LAUNCH_TOUCH_TYPE_VALUES)}`,
    `- allowed first touch status values: ${renderAllowedValues(CITY_LAUNCH_TOUCH_STATUS_VALUES)}`,
    `- allowed budget category values: ${renderAllowedValues(CITY_LAUNCH_BUDGET_CATEGORY_VALUES)}`,
    `- if a value is unsupported or unknown, omit it or set it to null rather than inventing a new enum`,
    `- approved analytics references for the instrumentation section: ${renderAllowedValues(CITY_LAUNCH_APPROVED_ANALYTICS_REFERENCES)}`,
    ``,
    `Machine-readable activation payload schema:`,
    "```json",
    JSON.stringify(
      {
        schema_version: CITY_LAUNCH_ACTIVATION_PAYLOAD_SCHEMA_VERSION,
        machine_policy_version: CITY_LAUNCH_MACHINE_POLICY_VERSION,
        city: input.city,
        city_slug: slugifyCityName(input.city),
        city_thesis:
          "One narrow exact-site hosted review motion tied to one real workflow lane and one truthful buyer proof path.",
        primary_site_lane: "industrial_warehouse",
        primary_workflow_lane: "dock handoff and pallet movement",
        primary_buyer_proof_path: "exact_site",
        lawful_access_modes: ["buyer_requested_site", "site_operator_intro"],
        preferred_lawful_access_mode: "buyer_requested_site",
        rights_path: {
          summary:
            "Use the lawful access mode per target. Private controlled interiors require explicit authorization before capture dispatch.",
          private_controlled_interiors_require_authorization: true,
          validation_required: false,
          source_urls: ["https://example.com/rights"],
        },
        validation_blockers: [
          {
            key: "buyer_stack_fit",
            summary: "Verify target export format compatibility before live outreach.",
            severity: "high",
            owner_lane: "buyer-solutions-agent",
            validation_required: true,
            source_urls: [],
          },
        ],
        required_approvals: [
          {
            lane: "founder",
            reason: "New city activation and spend posture remain founder-gated.",
          },
        ],
        owner_lanes: [
          "city-launch-agent",
          "ops-lead",
          "growth-lead",
          "buyer-solutions-agent",
          "analytics-agent",
        ],
        issue_seeds: [
          {
            key: "lawful-access-path",
            title: "Lock the first lawful access path",
            phase: "founder_gates",
            owner_lane: "city-launch-agent",
            human_lane: "growth-lead",
            summary:
              "Pick the first lawful access mode and block private controlled interiors until authorization is explicit.",
            dependency_keys: [],
            success_criteria: [
              "First lawful access path is named and documented.",
            ],
            metrics_dependencies: ["first_lawful_access_path"],
            validation_required: false,
          },
        ],
        metrics_dependencies: [
          {
            key: "robot_team_inbound_captured",
            kind: "event",
            status: "required_tracked",
            owner_lane: "analytics-agent",
            notes: "Tracked in WebApp growth-event and city-scorecard surfaces; keep verifying city attribution.",
          },
          {
            key: "proof_path_assigned",
            kind: "event",
            status: "required_tracked",
            owner_lane: "analytics-agent",
            notes: "Tracked in WebApp growth-event and city-scorecard surfaces; keep verifying city attribution.",
          },
          {
            key: "proof_pack_delivered",
            kind: "event",
            status: "required_tracked",
            owner_lane: "analytics-agent",
            notes: "Tracked in WebApp growth-event and city-scorecard surfaces; keep verifying city attribution.",
          },
          {
            key: "hosted_review_ready",
            kind: "event",
            status: "required_tracked",
            owner_lane: "analytics-agent",
            notes: "Tracked in WebApp growth-event and city-scorecard surfaces; keep verifying city attribution.",
          },
          {
            key: "hosted_review_started",
            kind: "event",
            status: "required_tracked",
            owner_lane: "analytics-agent",
            notes: "Tracked in WebApp growth-event and city-scorecard surfaces; keep verifying city attribution.",
          },
          {
            key: "hosted_review_follow_up_sent",
            kind: "event",
            status: "required_tracked",
            owner_lane: "analytics-agent",
            notes: "Tracked in WebApp growth-event and city-scorecard surfaces; keep verifying city attribution.",
          },
          {
            key: "human_commercial_handoff_started",
            kind: "event",
            status: "required_tracked",
            owner_lane: "analytics-agent",
            notes: "Tracked in WebApp growth-event and city-scorecard surfaces; keep verifying city attribution.",
          },
          {
            key: "proof_motion_stalled",
            kind: "event",
            status: "required_tracked",
            owner_lane: "analytics-agent",
            notes: "Tracked in WebApp growth-event and city-scorecard surfaces; keep verifying city attribution.",
          },
        ],
        named_claims: [
          {
            subject: "<researched-company>",
            claim_type: "company",
            claim: "Replace with a researched named buyer target or set validation_required=true with empty source_urls.",
            validation_required: true,
            source_urls: [],
          },
          {
            subject: "<stack-or-delivery-claim>",
            claim_type: "stack",
            claim: "The proof path should support ROS 2 / Gazebo-compatible artifacts.",
            validation_required: true,
            source_urls: [],
          },
        ],
      },
      null,
      2,
    ),
    "```",
    ``,
    `Structured launch data schema:`,
    "```json",
    JSON.stringify(
      {
        schema_version: CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
        generated_at: "2026-04-12T00:00:00.000Z",
        capture_location_candidates: [
          {
            name: "<researched-site>",
            contact_email: "site-operator-or-professional-contact@example.com",
            source_bucket: "industrial_warehouse",
            channel: "operator_intro",
            status: "identified",
            site_address: "<researched-site-address>",
            location_summary: "<researched-site-summary>",
            lat: 30.0,
            lng: -97.0,
            site_category: "warehouse",
            workflow_fit: "dock handoff and pallet movement",
            priority_note: "Strong early exact-site capture wedge.",
            source_urls: [],
            explicit_fields: ["name", "site_address", "source_bucket"],
            inferred_fields: ["lat", "lng"],
          },
        ],
        buyer_target_candidates: [
          {
            company_name: "<researched-company>",
            contact_name: "Jane Doe",
            contact_email: "jane.doe@example.com",
            status: "researched",
            workflow_fit: "warehouse autonomy",
            proof_path: "exact_site",
            notes: "Cited buyer fit from current robotics deployment work.",
            source_bucket: "warehouse_robotics",
            source_urls: [],
            explicit_fields: ["company_name", "workflow_fit"],
            inferred_fields: [],
          },
        ],
        first_touch_candidates: [
          {
            reference_type: "buyer_target",
            reference_name: "<researched-company>",
            channel: "email",
            touch_type: "first_touch",
            status: "queued",
            campaign_id: null,
            issue_id: null,
            notes: "Reference a cited warehouse proof path.",
            source_urls: [],
            explicit_fields: ["reference_name", "channel"],
            inferred_fields: [],
          },
        ],
        budget_recommendations: [
          {
            category: "outbound",
            amount_usd: 250,
            note: "Explicit recommendation from the final playbook.",
            source_urls: [],
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

function renderValidationReport(result: CityLaunchPlaybookValidationResult) {
  return [
    "# Final Playbook Validation",
    "",
    `- ok: ${result.ok}`,
    "",
    "## Errors",
    "",
    ...(result.errors.length > 0 ? result.errors.map((error) => `- ${error}`) : ["- none"]),
    "",
    "## Warnings",
    "",
    ...(result.warnings.length > 0 ? result.warnings.map((warning) => `- ${warning}`) : ["- none"]),
  ].join("\n");
}

async function writeTextArtifact(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function writePlanningManifest(input: {
  city: string;
  citySlug: string;
  status: "in_progress" | "completed";
  startedAt: string;
  completedAt: string;
  manifestPath: string;
  artifacts: CityLaunchHarnessArtifacts;
  stages: CityLaunchHarnessResult["stages"];
  notion?: CityLaunchHarnessResult["notion"];
}) {
  const payload: CityLaunchHarnessResult = {
    city: input.city,
    citySlug: input.citySlug,
    status: input.status,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    artifacts: input.artifacts,
    stages: input.stages,
    ...(input.notion ? { notion: input.notion } : {}),
  };

  await writeTextArtifact(input.manifestPath, JSON.stringify(payload, null, 2));
  return payload;
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

function buildCanonicalActivationPayloadPath(citySlug: string) {
  return path.join(
    REPO_ROOT,
    `ops/paperclip/playbooks/city-launch-${citySlug}-activation-payload.json`,
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

function validateAndParsePlaybook(input: {
  city: string;
  artifactPath: string;
  markdown: string;
}) {
  const validation = validateCityLaunchPlaybookMarkdown({
    city: input.city,
    markdown: input.markdown,
  });
  const parsedPlaybook = parseCityLaunchResearchArtifact({
    city: input.city,
    artifactPath: input.artifactPath,
    markdown: input.markdown,
  });

  return {
    validation,
    parsedPlaybook,
  };
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
  const validationArtifactPath = path.join(runDirectory, "98-final-playbook-validation.md");
  const activationPayloadPath = path.join(runDirectory, "97-activation-payload.json");
  const canonicalPlaybookPath = buildCanonicalPlaybookPath(citySlug);
  const canonicalActivationPayloadPath = buildCanonicalActivationPayloadPath(citySlug);
  const manifestPath = path.join(runDirectory, "manifest.json");
  const stageArtifacts: string[] = [];
  const stages: CityLaunchHarnessResult["stages"] = [];
  const similarCompanies = options.similarCompanies?.length
    ? options.similarCompanies
    : ["Uber", "DoorDash", "Instacart", "Airbnb", "Lime"];
  const deepResearchAgent = resolveGeminiDeepResearchAgent({
    explicitAgent: options.deepResearchAgent,
    envKeys: [
      "BLUEPRINT_CITY_LAUNCH_DEEP_RESEARCH_AGENT",
      "BLUEPRINT_DEEP_RESEARCH_AGENT",
    ],
  });
  const deepResearchTools = buildDeepResearchTools({
    fileSearchStoreNames: resolveDeepResearchFileSearchStoreNames({
      explicitStoreNames: options.fileSearchStoreNames,
      envKeys: [
        "BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE",
        "BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE",
      ],
    }),
    mcpServers: resolveDeepResearchMcpServers({
      envKeys: [
        "BLUEPRINT_CITY_LAUNCH_DEEP_RESEARCH_MCP_SERVERS_JSON",
        "BLUEPRINT_DEEP_RESEARCH_MCP_SERVERS_JSON",
      ],
    }),
  });
  const critiqueRounds = Math.max(1, options.critiqueRounds ?? 1);
  const context = await loadPlanningContext(citySlug);
  let latestResearchText = "";
  const critiqueOutputs: string[] = [];
  const startedAtIso = startedAt.toISOString();
  const baseArtifacts: CityLaunchHarnessArtifacts = {
    runDirectory,
    manifestPath,
    initialResearchPath,
    finalPlaybookPath,
    activationPayloadPath,
    canonicalPlaybookPath,
    canonicalActivationPayloadPath,
    stageArtifacts,
  };

  await writePlanningManifest({
    city,
    citySlug,
    status: "in_progress",
    startedAt: startedAtIso,
    completedAt: startedAtIso,
    manifestPath,
    artifacts: baseArtifacts,
    stages,
  });

  const initialResearchPrompt = buildResearchPrompt({
    city,
    region: options.region || null,
    similarCompanies,
    context,
  });

  logger.info(
    { city, citySlug, deepResearchAgent },
    "Starting city launch Deep Research harness",
  );

  const initialResearch = await createGeminiInteraction({
    input: initialResearchPrompt,
    agent: deepResearchAgent,
    agentConfig: buildGeminiDeepResearchAgentConfig(),
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
  await writePlanningManifest({
    city,
    citySlug,
    status: "in_progress",
    startedAt: startedAtIso,
    completedAt: new Date().toISOString(),
    manifestPath,
    artifacts: baseArtifacts,
    stages,
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
    await writePlanningManifest({
      city,
      citySlug,
      status: "in_progress",
      startedAt: startedAtIso,
      completedAt: new Date().toISOString(),
      manifestPath,
      artifacts: baseArtifacts,
      stages,
    });

    const followUpPrompt = buildFollowUpResearchPrompt({
      city,
      critique: critiqueText,
      priorResearch: latestResearchText,
    });
    const followUpResearch = await createGeminiInteraction({
      input: followUpPrompt,
      agent: deepResearchAgent,
      agentConfig: buildGeminiDeepResearchAgentConfig(),
      previousInteractionId: stages[stages.length - 1]?.interactionId,
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
    await writePlanningManifest({
      city,
      citySlug,
      status: "in_progress",
      startedAt: startedAtIso,
      completedAt: new Date().toISOString(),
      manifestPath,
      artifacts: baseArtifacts,
      stages,
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
  let validatedPlaybookArtifactPath = finalPlaybookPath;
  const finalPlaybookText = await persistInteractionArtifact({
    artifactPath: finalPlaybookPath,
    title: `${city} Final Launch Playbook`,
    interaction: finalSynthesis,
    prompt: synthesisPrompt,
  });
  let validatedPlaybookText = finalPlaybookText;
  let validatedInteractionId = finalSynthesis.id;
  let {
    validation,
    parsedPlaybook,
  } = validateAndParsePlaybook({
    city,
    artifactPath: finalPlaybookPath,
    markdown: validatedPlaybookText,
  });

  for (let repairRound = 1; !validation.ok && repairRound <= 2; repairRound += 1) {
    const repairPrompt = buildPlaybookRepairPrompt({
      city,
      previousPlaybook: validatedPlaybookText,
      validationErrors: validation.errors,
      validationWarnings: validation.warnings,
    });
    const repairInteraction = await createGeminiInteraction({
      input: repairPrompt,
      model: GEMINI_PLANNING_MODEL,
      previousInteractionId: validatedInteractionId,
      store: true,
    });
    const repairArtifactPath = path.join(
      runDirectory,
      `99-final-playbook-repair-round-${repairRound}.md`,
    );
    validatedPlaybookArtifactPath = repairArtifactPath;
    validatedPlaybookText = await persistInteractionArtifact({
      artifactPath: repairArtifactPath,
      title: `${city} Final Playbook Repair Round ${repairRound}`,
      interaction: repairInteraction,
      prompt: repairPrompt,
    });
    validatedInteractionId = repairInteraction.id;
    stageArtifacts.push(repairArtifactPath);
    stages.push({
      key: `final_playbook_repair_round_${repairRound}`,
      interactionId: repairInteraction.id,
      status: repairInteraction.status,
      artifactPath: repairArtifactPath,
    });
    await writePlanningManifest({
      city,
      citySlug,
      status: "in_progress",
      startedAt: startedAtIso,
      completedAt: new Date().toISOString(),
      manifestPath,
      artifacts: baseArtifacts,
      stages,
    });

    ({
      validation,
      parsedPlaybook,
    } = validateAndParsePlaybook({
      city,
      artifactPath: repairArtifactPath,
      markdown: validatedPlaybookText,
    }));
  }

  await writeTextArtifact(
    validationArtifactPath,
    renderValidationReport(validation),
  );
  if (!validation.ok) {
    throw new Error(
      `Final city launch playbook failed validation: ${validation.errors.join(" | ")}`,
    );
  }
  if (!parsedPlaybook.activationPayload) {
    throw new Error("Final city launch playbook is missing a valid activation payload.");
  }
  if (validatedPlaybookArtifactPath !== finalPlaybookPath) {
    await fs.copyFile(validatedPlaybookArtifactPath, finalPlaybookPath);
  }
  await writeTextArtifact(canonicalPlaybookPath, validatedPlaybookText);
  await writeTextArtifact(
    activationPayloadPath,
    JSON.stringify(parsedPlaybook.activationPayload, null, 2),
  );
  await writeTextArtifact(
    canonicalActivationPayloadPath,
    JSON.stringify(parsedPlaybook.activationPayload, null, 2),
  );
  stageArtifacts.push(activationPayloadPath);
  stageArtifacts.push(finalPlaybookPath);
  stages.push({
    key: "final_playbook",
    interactionId: validatedInteractionId,
    status: "completed",
    artifactPath: finalPlaybookPath,
  });

  const result: CityLaunchHarnessResult = {
    city,
    citySlug,
    status: "completed",
    startedAt: startedAtIso,
    completedAt: new Date().toISOString(),
    artifacts: baseArtifacts,
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

  await writePlanningManifest({
    city,
    citySlug,
    status: "completed",
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    manifestPath,
    artifacts: result.artifacts,
    stages,
    notion: result.notion,
  });
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
  fileSearchStoreNames?: string[];
  deepResearchAgent?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}) {
  const deepResearchAgent = resolveGeminiDeepResearchAgent({
    explicitAgent: input.deepResearchAgent,
    envKeys: [
      "BLUEPRINT_CITY_LAUNCH_DEEP_RESEARCH_AGENT",
      "BLUEPRINT_DEEP_RESEARCH_AGENT",
    ],
  });
  const deepResearchTools = buildDeepResearchTools({
    fileSearchStoreNames: resolveDeepResearchFileSearchStoreNames({
      explicitStoreNames: input.fileSearchStoreNames,
      envKeys: [
        "BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE",
        "BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE",
      ],
    }),
    mcpServers: resolveDeepResearchMcpServers({
      envKeys: [
        "BLUEPRINT_CITY_LAUNCH_DEEP_RESEARCH_MCP_SERVERS_JSON",
        "BLUEPRINT_DEEP_RESEARCH_MCP_SERVERS_JSON",
      ],
    }),
  });
  const startedInteraction = await createGeminiInteraction({
    input: input.question,
    agent: deepResearchAgent,
    agentConfig: buildGeminiDeepResearchAgentConfig(),
    previousInteractionId: input.previousInteractionId,
    background: true,
    store: true,
    tools: deepResearchTools,
  });
  const interaction = await pollGeminiInteractionUntilComplete({
    interactionId: startedInteraction.id,
    pollIntervalMs: input.pollIntervalMs,
    timeoutMs: input.timeoutMs,
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
        `- status: ${interaction.status}`,
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
