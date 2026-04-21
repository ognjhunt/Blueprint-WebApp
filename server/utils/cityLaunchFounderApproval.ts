import { renderHumanBlockerPacketText, type HumanBlockerPacket } from "./human-blocker-packet";
import type { HumanBlockerThreadRecord } from "./human-reply-store";
import type { CityLaunchBudgetPolicy, CityLaunchBudgetTier } from "./cityLaunchPolicy";
import { resolveCityLaunchProfile, type CityLaunchProfile } from "./cityLaunchProfiles";

function buildFounderSpendApproval(
  profile: CityLaunchProfile,
  budgetPolicy: CityLaunchBudgetPolicy,
) {
  return budgetPolicy.maxTotalApprovedUsd > 0
    ? `Autonomous spend posture for ${profile.shortLabel}: ${budgetPolicy.label} with a total envelope up to $${budgetPolicy.maxTotalApprovedUsd.toLocaleString()}.`
    : `Autonomous spend posture for ${profile.shortLabel}: ${budgetPolicy.label} with no paid acquisition, referral, or discretionary travel spend.`;
}

export function buildFounderApprovals(
  profile: CityLaunchProfile,
  budgetPolicy: CityLaunchBudgetPolicy,
) {
  return [
    `Autonomously activate ${profile.city} as an active city-launch program and keep execution bounded to the selected city.`,
    `Run the ${profile.shortLabel} launch posture autonomously: gated cohort pilot, Exact-Site Hosted Review wedge, and truthful public claims only.`,
    buildFounderSpendApproval(profile, budgetPolicy),
    `Automatically block any ${profile.shortLabel} source-policy change that exceeds the current bounded channel stack until the written policy is updated in repo truth.`,
    "Automatically block any rights/privacy/commercialization exception that lacks repo-backed policy and evidence.",
    `Automatically block any non-standard commercial term outside the standard ${profile.shortLabel} quote bands until the quote policy is updated in repo truth.`,
  ];
}

export function getCityLaunchFounderApprovalBlockerId(
  city: string,
  budgetTier: CityLaunchBudgetTier,
) {
  const profile = resolveCityLaunchProfile(city, budgetTier);
  return `city-launch-approval-${profile.key}`;
}

export function buildCityLaunchFounderApprovalPacket(input: {
  city: string;
  budgetPolicy: CityLaunchBudgetPolicy;
}): HumanBlockerPacket {
  const profile = resolveCityLaunchProfile(input.city, input.budgetPolicy.tier);
  const approvals = buildFounderApprovals(profile, input.budgetPolicy);

  return {
    blockerId: getCityLaunchFounderApprovalBlockerId(
      input.city,
      input.budgetPolicy.tier,
    ),
    title: `${profile.city} City Launch Autonomy Policy`,
    summary: `Autonomous launch policy for ${profile.city} with ${input.budgetPolicy.label} budget ($${input.budgetPolicy.maxTotalApprovedUsd.toLocaleString()}). ${approvals.length} governing rules.`,
    decisionType: "city_launch_activation",
    recommendedAnswer:
      "AUTO-RUN — execute the city activation autonomously inside the written spend, policy, rights, and commercial guardrails.",
    exactResponseNeeded:
      "No reply required. Treat this artifact as the current autonomous operating policy for the city launch.",
    whyBlocked:
      "City launch activation no longer requires manual approval. The system should auto-run and fail closed only on missing policy, missing evidence, or unsupported claims.",
    alternatives: [
      "AUTO-RUN — execute within the written launch posture",
      "UPDATE POLICY — change the written launch policy in repo truth, then rerun",
      "BLOCK ON EVIDENCE — stop only when required evidence or external confirmation is missing",
    ],
    risk: `Without autonomous execution, ${profile.city} stays stuck in planning and routed lanes do not progress.`,
    executionOwner: "city-launch-agent",
    immediateNextAction:
      "Activate the execution harness and dispatch the live city-launch issue tree immediately.",
    deadline: "Immediate",
    evidence: approvals,
    nonScope:
      "This policy does not authorize unsupported public claims, evidence-free rights/privacy exceptions, or spend beyond the approved envelope.",
    repoContext: {
      repo: "Blueprint-WebApp",
      project: "blueprint-webapp",
      sourceRef: `city-launch:${profile.key}`,
    },
    policyContext: {
      gateMode: "universal_founder_inbox",
      reasonCategory: "city_launch_activation",
      autoExecutionEligible: false,
    },
    resumeAction: {
      kind: "city_launch_activate",
      description: `Activate ${profile.city} automatically.`,
      metadata: {
        city: profile.city,
        budgetTier: input.budgetPolicy.tier,
        budgetMaxUsd: input.budgetPolicy.maxTotalApprovedUsd,
        operatorAutoApproveUsd: input.budgetPolicy.operatorAutoApproveUsd,
      },
    },
  };
}

export function renderCityLaunchFounderApprovalArtifact(input: {
  city: string;
  budgetPolicy: CityLaunchBudgetPolicy;
}) {
  return renderHumanBlockerPacketText(buildCityLaunchFounderApprovalPacket(input));
}

export function isCityLaunchFounderApprovalResolved(
  thread:
    | Pick<
        HumanBlockerThreadRecord,
        "status" | "last_classification" | "last_resolution" | "resume_action"
      >
    | null
    | undefined,
) {
  if (!thread) {
    return true;
  }

  if (thread.resume_action?.kind !== "city_launch_activate") {
    return false;
  }

  if (thread.last_classification !== "approval") {
    return false;
  }

  if (thread.last_resolution !== "resolved_input") {
    return false;
  }

  return ["reply_recorded", "routed", "resolved"].includes(thread.status);
}

export async function resolveCityLaunchFounderApprovalFromDurableState(input: {
  city: string;
  budgetPolicy: CityLaunchBudgetPolicy;
}) {
  return {
    blockerId: getCityLaunchFounderApprovalBlockerId(
      input.city,
      input.budgetPolicy.tier,
    ),
    founderApproved: true,
    thread: null,
  };
}
