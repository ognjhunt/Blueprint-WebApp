import { promises as fs } from "node:fs";
import path from "node:path";

import {
  renderHumanBlockerPacketText,
  type HumanBlockerPacket,
} from "./human-blocker-packet";
import type { HumanBlockerDeliveryMode } from "./human-blocker-dispatch";
import {
  normalizeCityLaunchBudgetTier,
  type CityLaunchBudgetPolicy,
  type CityLaunchBudgetTier,
} from "./cityLaunchPolicy";
import type { CityLaunchPlanningState } from "./cityLaunchPlanningState";
import { resolveCityLaunchProfile, slugifyCityName } from "./cityLaunchProfiles";

export const CITY_LAUNCH_WINDOW_HOURS = 72 as const;
export const CITY_LAUNCH_FOUNDER_BUDGET_TIERS = [
  "lean",
  "standard",
  "aggressive",
] as const satisfies readonly CityLaunchBudgetTier[];

function timestampForFile(date = new Date()) {
  return date.toISOString().replaceAll(":", "-");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizedInput(value: unknown) {
  return String(value ?? "").trim();
}

function looksLikePlaceholder(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, " ");
  return (
    /[\[\]{}<>]/.test(value)
    || normalized === "city"
    || normalized === "city, st"
    || normalized === "city, state"
    || normalized === "your city"
    || normalized === "example city"
    || normalized === "sample city"
    || normalized === "tbd"
    || normalized === "todo"
    || normalized.includes("replace with")
    || normalized.includes("placeholder")
  );
}

function defaultRequiredInputs(city: string) {
  return [
    "GOOGLE_GENAI_API_KEY or GEMINI_API_KEY",
    "A Google/Gemini Deep Research account with quota/billing access for the configured agent",
    `A valid completed city playbook for ${city}`,
  ];
}

function evidencePathsFromPlanningState(planningState: CityLaunchPlanningState) {
  return [
    planningState.completedArtifactPath,
    planningState.latestArtifactPath,
    planningState.manifestPath,
    planningState.canonicalPlaybookPath,
  ].filter((entry): entry is string => Boolean(entry));
}

export function getCityLaunchDeepResearchBlockerId(city: string) {
  return `city-launch-deep-research-${slugifyCityName(city)}`;
}

export function resolveCityLaunchCityInput(value: unknown): string {
  const city = normalizedInput(value);
  if (!city) {
    throw new Error("Required: --city \"City, ST\".");
  }
  if (looksLikePlaceholder(city)) {
    throw new Error(
      `Invalid city-launch city input: ${city}. Replace the placeholder with one real city, for example "Durham, NC".`,
    );
  }
  return city;
}

export function resolveCityLaunchFounderBudgetTierInput(value: unknown): CityLaunchBudgetTier {
  const raw = normalizedInput(value);
  if (!raw) {
    throw new Error("Required: --budget-tier lean|standard|aggressive.");
  }
  if (looksLikePlaceholder(raw)) {
    throw new Error(
      `Invalid city-launch budget tier: ${raw}. Use lean, standard, or aggressive.`,
    );
  }
  const tier = normalizeCityLaunchBudgetTier(raw);
  if (
    !tier
    || !CITY_LAUNCH_FOUNDER_BUDGET_TIERS.includes(
      tier as (typeof CITY_LAUNCH_FOUNDER_BUDGET_TIERS)[number],
    )
  ) {
    throw new Error(
      `Unsupported CITY+BUDGET budget tier: ${raw}. Use lean, standard, or aggressive.`,
    );
  }
  return tier;
}

export function resolveCityLaunchFounderBudgetMaxUsdInput(value: unknown): number {
  const raw = normalizedInput(value);
  if (!raw) {
    throw new Error("Required: --budget-max-usd NUMBER.");
  }
  if (looksLikePlaceholder(raw) || /^number$/i.test(raw)) {
    throw new Error(
      `Invalid city-launch budget max USD: ${raw}. Replace it with a non-negative number.`,
    );
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(
      `Invalid city-launch budget max USD: ${raw}. Use a non-negative number.`,
    );
  }
  return parsed;
}

export function resolveCityLaunchWindowHours(value: unknown): typeof CITY_LAUNCH_WINDOW_HOURS {
  if (value === null || value === undefined || String(value).trim() === "") {
    return CITY_LAUNCH_WINDOW_HOURS;
  }
  const parsed = Number(String(value).trim());
  if (parsed === CITY_LAUNCH_WINDOW_HOURS) {
    return CITY_LAUNCH_WINDOW_HOURS;
  }
  throw new Error(
    `Unsupported city-launch window: ${String(value)}. The current CITY+BUDGET launch contract supports WINDOW_HOURS=72 with 24h, 48h, and 72h scorecards.`,
  );
}

export function buildCityLaunchDeepResearchBlockerPacket(input: {
  city: string;
  budgetPolicy: CityLaunchBudgetPolicy;
  errorMessage: string;
  requiredInputs?: string[];
  evidencePaths?: string[];
}): HumanBlockerPacket {
  const profile = resolveCityLaunchProfile(input.city, input.budgetPolicy.tier);
  const requiredInputs = input.requiredInputs?.length
    ? input.requiredInputs
    : defaultRequiredInputs(profile.city);
  const evidence = [
    `Deep Research failure: ${input.errorMessage}`,
    `City: ${profile.city}`,
    `Budget tier: ${input.budgetPolicy.tier}`,
    `Budget max USD: ${input.budgetPolicy.maxTotalApprovedUsd}`,
    "Required inputs:",
    ...requiredInputs.map((entry) => `- ${entry}`),
    ...(input.evidencePaths?.length
      ? ["Evidence paths:", ...input.evidencePaths.map((entry) => `- ${entry}`)]
      : []),
  ];

  return {
    blockerId: getCityLaunchDeepResearchBlockerId(profile.city),
    title: `${profile.city} City Launch Deep Research Access`,
    summary:
      `The ${profile.city} CITY+BUDGET launch loop could not create a Deep Research plan and no valid completed playbook was available to reuse.`,
    decisionType: "city_launch_deep_research_access",
    recommendedAnswer:
      "UNBLOCK DEEP RESEARCH - configure the Gemini Deep Research credentials/account, or provide a valid completed city playbook for reuse.",
    exactResponseNeeded:
      "Reply with Deep Research access/account ready, provide Deep Research access details, or name the valid completed city playbook that should be reused.",
    whyBlocked:
      "The launch loop cannot truthfully delegate target discovery, outreach, creative, ad, analytics, and scorecard work without either a freshly generated Deep Research plan or a validated existing playbook.",
    alternatives: [
      "Configure GOOGLE_GENAI_API_KEY or GEMINI_API_KEY and rerun the city-launch plan phase.",
      "Provide a valid existing city playbook with machine-readable activation payload and launch_surface_coverage.",
      "Leave the city blocked; do not dispatch the launch issue tree from narrative-only planning.",
    ],
    risk:
      "Continuing without a valid playbook would turn the city launch into narrative completion and could invent targets, contacts, proof, readiness, or spend posture.",
    executionOwner: "city-launch-agent",
    immediateNextAction:
      `Rerun npm run city-launch:run -- --city "${profile.city}" --budget-tier ${input.budgetPolicy.tier} --budget-max-usd ${input.budgetPolicy.maxTotalApprovedUsd} --window-hours ${CITY_LAUNCH_WINDOW_HOURS} --require-founder-approval after the missing input is recorded.`,
    deadline: "Immediate",
    evidence,
    nonScope:
      "This packet does not approve city posture, live sends, live paid spend, rights/privacy exceptions, or unsupported public claims.",
    repoContext: {
      repo: "Blueprint-WebApp",
      project: "blueprint-webapp",
      sourceRef: `city-launch:${profile.key}:deep-research`,
    },
    policyContext: {
      gateMode: "universal_founder_inbox",
      reasonCategory: "city_launch_deep_research_access",
      autoExecutionEligible: false,
    },
    resumeAction: {
      kind: "city_launch_plan",
      description: `Run the Deep Research planning phase for ${profile.city}.`,
      metadata: {
        city: profile.city,
        budgetTier: input.budgetPolicy.tier,
        budgetMaxUsd: input.budgetPolicy.maxTotalApprovedUsd,
        operatorAutoApproveUsd: input.budgetPolicy.operatorAutoApproveUsd,
        windowHours: CITY_LAUNCH_WINDOW_HOURS,
      },
    },
  };
}

export type CityLaunchDeepResearchFailureResolution =
  | {
      status: "reuse_existing_playbook";
      city: string;
      completedPlaybookPath: string;
      blockerPacketPath: null;
      blockerId: null;
      requiredInputs: string[];
      errorMessage: string;
      humanBlockerDispatch: null;
    }
  | {
      status: "blocked";
      city: string;
      completedPlaybookPath: null;
      blockerPacketPath: string;
      blockerId: string;
      requiredInputs: string[];
      errorMessage: string;
      humanBlockerDispatch: CityLaunchDeepResearchHumanBlockerDispatch | null;
    };

export type CityLaunchDeepResearchHumanBlockerDeliveryMode =
  | Extract<HumanBlockerDeliveryMode, "review_required" | "send_now">
  | "none";

export type CityLaunchDeepResearchHumanBlockerDispatch = {
  queued: boolean;
  blockerId: string;
  dispatchId: string | null;
  deliveryMode: HumanBlockerDeliveryMode | null;
  deliveryStatus: string | null;
  emailSent: boolean;
  slackSent: boolean;
  threadId: string | null;
  error: string | null;
};

export function resolveCityLaunchHumanBlockerDeliveryMode(
  value: unknown,
): CityLaunchDeepResearchHumanBlockerDeliveryMode {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "review_required";
  }
  if (normalized === "none" || normalized === "off" || normalized === "false") {
    return "none";
  }
  if (normalized === "review" || normalized === "review_required") {
    return "review_required";
  }
  if (normalized === "send" || normalized === "send_now") {
    return "send_now";
  }
  throw new Error(
    `Unsupported city-launch human blocker delivery mode: ${String(value)}. Use review_required, send_now, or none.`,
  );
}

async function dispatchDeepResearchHumanBlocker(input: {
  packet: HumanBlockerPacket;
  blockerPacketPath: string;
  evidencePaths: string[];
  deliveryMode: CityLaunchDeepResearchHumanBlockerDeliveryMode;
}): Promise<CityLaunchDeepResearchHumanBlockerDispatch | null> {
  if (input.deliveryMode === "none") {
    return null;
  }

  const blockerId = input.packet.blockerId || "";
  try {
    const { dispatchHumanBlocker } = await import("./human-blocker-dispatch");
    const dispatch = await dispatchHumanBlocker({
      delivery_mode: input.deliveryMode,
      blocker_kind: "ops_commercial",
      routing_owner: "blueprint-chief-of-staff",
      execution_owner: "city-launch-agent",
      sender_owner: "city-launch-agent",
      mirror_to_slack: input.deliveryMode === "send_now",
      packet: input.packet,
      report_paths: [
        input.blockerPacketPath,
        ...input.evidencePaths,
      ],
    });

    return {
      queued: true,
      blockerId: dispatch.blocker_id || blockerId,
      dispatchId: dispatch.dispatch_id || null,
      deliveryMode: dispatch.delivery_mode || input.deliveryMode,
      deliveryStatus: dispatch.delivery_status || null,
      emailSent: dispatch.email_sent === true,
      slackSent: dispatch.slack_sent === true,
      threadId: dispatch.thread?.id || dispatch.blocker_id || blockerId || null,
      error: null,
    };
  } catch (error) {
    return {
      queued: false,
      blockerId,
      dispatchId: null,
      deliveryMode: input.deliveryMode,
      deliveryStatus: "failed",
      emailSent: false,
      slackSent: false,
      threadId: null,
      error: errorMessage(error),
    };
  }
}

export async function resolveCityLaunchDeepResearchFailure(input: {
  city: string;
  budgetPolicy: CityLaunchBudgetPolicy;
  planningState: CityLaunchPlanningState;
  error: unknown;
  reportsRoot: string;
  humanBlockerDeliveryMode?: CityLaunchDeepResearchHumanBlockerDeliveryMode | null;
}): Promise<CityLaunchDeepResearchFailureResolution> {
  const city = input.city.trim();
  const message = errorMessage(input.error);
  if (input.planningState.completedArtifactPath) {
    return {
      status: "reuse_existing_playbook",
      city,
      completedPlaybookPath: input.planningState.completedArtifactPath,
      blockerPacketPath: null,
      blockerId: null,
      requiredInputs: [],
      errorMessage: message,
      humanBlockerDispatch: null,
    };
  }

  const requiredInputs = defaultRequiredInputs(city);
  const evidencePaths = evidencePathsFromPlanningState(input.planningState);
  const blockerPacket = buildCityLaunchDeepResearchBlockerPacket({
    city,
    budgetPolicy: input.budgetPolicy,
    errorMessage: message,
    requiredInputs,
    evidencePaths,
  });
  const runDirectory = path.join(
    input.reportsRoot,
    slugifyCityName(city),
    timestampForFile(),
  );
  const blockerPacketPath = path.join(runDirectory, "deep-research-blocker-packet.md");
  await fs.mkdir(runDirectory, { recursive: true });
  await fs.writeFile(blockerPacketPath, renderHumanBlockerPacketText(blockerPacket), "utf8");
  const humanBlockerDispatch = await dispatchDeepResearchHumanBlocker({
    packet: blockerPacket,
    blockerPacketPath,
    evidencePaths,
    deliveryMode: input.humanBlockerDeliveryMode || "none",
  });

  return {
    status: "blocked",
    city,
    completedPlaybookPath: null,
    blockerPacketPath,
    blockerId: blockerPacket.blockerId || getCityLaunchDeepResearchBlockerId(city),
    requiredInputs,
    errorMessage: message,
    humanBlockerDispatch,
  };
}
