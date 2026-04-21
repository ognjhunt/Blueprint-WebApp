import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  createNotionClient,
  upsertKnowledgeEntry,
  upsertWorkQueueItem,
} from "../../ops/paperclip/plugins/blueprint-automation/src/notion";
import { getConfiguredEnvValue } from "../config/env";
import { getCityLaunchSenderStatus } from "./email";
import {
  buildCityCaptureTargetLedger,
  renderCityCaptureTargetLedgerMarkdown,
} from "./cityCaptureTargetLedger";
import {
  listCityLaunchBuyerTargets,
  listCityLaunchChannelAccounts,
  listCityLaunchProspects,
  listCityLaunchSendActions,
  readCityLaunchActivation,
  summarizeCityLaunchLedgers,
  upsertCityLaunchChannelAccount,
  upsertCityLaunchSendAction,
  writeCityLaunchActivation,
  type CityLaunchActivationStatus,
  type CityLaunchBuyerTargetRecord,
  type CityLaunchChannelAccountRecord,
  type CityLaunchProspectRecord,
  type CityLaunchSendActionRecord,
} from "./cityLaunchLedgers";
import { resolveCityLaunchPlanningState, type CityLaunchPlanningState } from "./cityLaunchPlanningState";
import {
  type CityLaunchResearchParseResult,
  type ParsedCityLaunchActivationPayload,
} from "./cityLaunchResearchParser";
import { runCityLaunchContactEnrichment } from "./cityLaunchContactEnrichment";
import {
  buildFounderApprovals,
  renderCityLaunchFounderApprovalArtifact,
} from "./cityLaunchFounderApproval";
import { materializeCityLaunchResearch } from "./cityLaunchResearchMaterializer";
import {
  assessCityLaunchOutboundReadiness,
  executeCityLaunchSends,
  type CityLaunchOutboundReadiness,
  type CityLaunchSendExecutionResult,
} from "./cityLaunchSendExecutor";
import { resolveHistoricalRecipientEvidence } from "./cityLaunchRecipientEvidence";
import {
  buildCityLaunchBudgetPolicy,
  buildCityLaunchWideningGuard,
  type CityLaunchBudgetPolicy,
  type CityLaunchBudgetTier,
} from "./cityLaunchPolicy";
import {
  resolveCityLaunchProfile,
  resolveFocusCityProfile,
  slugifyCityName,
  type CityLaunchProfile,
} from "./cityLaunchProfiles";
import {
  createPaperclipIssueComment,
  getPaperclipIssue,
  resetPaperclipAgentSession,
  upsertPaperclipIssue,
  wakePaperclipAgent,
  type PaperclipIssueRecord,
} from "./paperclip";
import {
  CITY_LAUNCH_LANE_DISPLAY_NAMES,
  CITY_LAUNCH_MACHINE_POLICY_VERSION,
  type CityLaunchAgentLane,
  type CityLaunchHumanLane,
  type CityLaunchIssueSeedPhase,
  type CityLaunchProofMotionMilestone,
  type CityLaunchRequiredMetricDependencyKey,
} from "./cityLaunchDoctrine";
import {
  assessCityLaunchCapabilities,
  type CityLaunchCapabilitySnapshot,
} from "./cityLaunchCapabilityState";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const DEFAULT_REPORTS_ROOT = path.join(
  REPO_ROOT,
  "ops/paperclip/reports/city-launch-execution",
);

const CITY_LAUNCH_PROJECT_NAME = "blueprint-webapp";

const STATIC_SOURCE_PATHS = [
  "docs/city-launch-deep-research-harness-2026-04-11.md",
  "docs/generic-autonomous-city-launcher-2026-04-12.md",
  "ops/paperclip/programs/city-launch-agent-program.md",
  "ops/paperclip/programs/city-demand-agent-program.md",
  "ops/paperclip/playbooks/capturer-supply-playbook.md",
  "ops/paperclip/playbooks/robot-team-demand-playbook.md",
  "ops/paperclip/reports/city-demand-bootstrap-2026-04-06.md",
  "ops/paperclip/reports/city-demand-bootstrap-2026-04-12.md",
  "ops/paperclip/playbooks/capturer-trust-packet-stage-gate-standard.md",
  "ops/paperclip/playbooks/field-ops-first-assignment-site-facing-trust-gate.md",
  "docs/robot-team-proof-motion-analytics-requirements-2026-04-10.md",
  "ops/paperclip/programs/city-launch-activation-program.md",
  "ops/paperclip/blueprint-company/tasks/city-launch-activation/TASK.md",
];

export type CityLaunchExecutionStatus =
  | "draft_pending_founder_approval"
  | "founder_approved_activation_ready";

export type CityLaunchTask = {
  key: string;
  phase: CityLaunchIssueSeedPhase;
  title: string;
  ownerLane: CityLaunchAgentLane;
  humanLane: CityLaunchHumanLane | null;
  purpose: string;
  inputs: string[];
  dependencies: string[];
  doneWhen: string[];
  humanGate: string | null;
  metricsDependencies: Array<
    CityLaunchRequiredMetricDependencyKey | CityLaunchProofMotionMilestone
  >;
  validationRequired: boolean;
  source: "default_task_bundle" | "activation_payload";
};

export type CityLaunchTaskDispatch = {
  key: string;
  ownerLane: CityLaunchAgentLane;
  issueId: string;
  identifier: string | null;
  created: boolean;
  status: string;
  executionState:
    | "ready_to_execute"
    | "execute_until_human_gate"
    | "execute_until_external_confirmation"
    | "execute_until_live_signal";
  executionReason: string;
  wakeStatus?: string | null;
  wakeRunId?: string | null;
  wakeError?: string | null;
};

export type CityLaunchExecutionResult = {
  city: string;
  citySlug: string;
  status: CityLaunchExecutionStatus;
  budgetTier: CityLaunchBudgetTier;
  budgetPolicy: CityLaunchBudgetPolicy;
  startedAt: string;
  completedAt: string;
  activationStatus: CityLaunchActivationStatus;
  wideningGuard: {
    mode: "single_city_until_proven";
    wideningAllowed: boolean;
    reasons: string[];
  };
  artifacts: {
    runDirectory: string;
    manifestPath: string;
    systemDocPath: string;
    issueBundlePath: string;
    issueBundleJsonPath: string;
    launchPlaybookPath: string;
    demandPlaybookPath: string;
    targetLedgerPath: string;
    targetLedgerJsonPath: string;
    approvalsPath: string;
    researchMaterializationPath?: string;
    researchMaterializationMarkdownPath?: string;
    contactEnrichmentPath?: string;
    contactEnrichmentMarkdownPath?: string;
    sourceActivationPayloadPath?: string;
    canonicalSystemDocPath: string;
    canonicalIssueBundlePath: string;
    canonicalLaunchPlaybookPath: string;
    canonicalDemandPlaybookPath: string;
    canonicalTargetLedgerPath: string;
    canonicalActivationPayloadPath: string;
    cityOpeningArtifactPack: {
      run: {
        briefPath: string;
        channelMapPath: string;
        firstWavePackPath: string;
        ctaRoutingPath: string;
        responseTrackingPath: string;
        replyConversionPath: string;
        channelRegistryPath: string;
        sendLedgerPath: string;
        executionReportPath: string;
      };
      canonical: {
        briefPath: string;
        channelMapPath: string;
        firstWavePackPath: string;
        ctaRoutingPath: string;
        responseTrackingPath: string;
        replyConversionPath: string;
        channelRegistryPath: string;
        sendLedgerPath: string;
        executionReportPath: string;
      };
    };
    notionKnowledgePageUrl?: string;
    notionWorkQueuePageUrl?: string;
  };
  planning: {
    status: CityLaunchPlanningState["status"];
    latestArtifactPath: string | null;
    completedArtifactPath: string | null;
    warnings: string[];
  };
  notion?: {
    knowledgePageId?: string;
    knowledgePageUrl?: string;
    workQueuePageId?: string;
    workQueuePageUrl?: string;
  };
  paperclip?: {
    rootIssueId: string | null;
    rootIssueIdentifier: string | null;
    createdRootIssue: boolean;
    dispatched: CityLaunchTaskDispatch[];
    error?: string | null;
  };
  researchMaterialization?: {
    status: "materialized" | "planning_in_progress" | "missing_artifact" | "empty" | "failed";
    sourceArtifactPath: string | null;
    prospectsUpserted: number;
    buyerTargetsUpserted: number;
    touchesRecorded: number;
    budgetRecommendationsRecorded: number;
    contactEnrichmentStatus?: "enriched" | "no_changes" | "failed";
    contactEnrichmentArtifactPath?: string | null;
    warnings: string[];
  };
  capabilitySnapshot?: CityLaunchCapabilitySnapshot;
  outboundReadiness?: CityLaunchOutboundReadiness;
  sendExecution?: CityLaunchSendExecutionResult;
};

type ReadSourceArtifact = {
  relativePath: string;
  exists: boolean;
};

function timestampForFile(date = new Date()) {
  return date.toISOString().replaceAll(":", "-");
}

function buildCanonicalSystemDocPath(profile: CityLaunchProfile) {
  return path.join(REPO_ROOT, profile.systemDocPath);
}

function buildCanonicalIssueBundlePath(profile: CityLaunchProfile) {
  return path.join(REPO_ROOT, profile.issueBundlePath);
}

function buildCanonicalLaunchPlaybookPath(profile: CityLaunchProfile) {
  return path.join(REPO_ROOT, profile.launchPlaybookPath);
}

function buildCanonicalDemandPlaybookPath(profile: CityLaunchProfile) {
  return path.join(REPO_ROOT, profile.demandPlaybookPath);
}

function buildCanonicalTargetLedgerPath(profile: CityLaunchProfile) {
  return path.join(REPO_ROOT, profile.targetLedgerPath);
}

function buildCanonicalCityOpeningArtifactPath(
  profile: CityLaunchProfile,
  kind:
    | "brief"
    | "channel-map"
    | "first-wave-pack"
    | "cta-routing"
    | "response-tracking"
    | "reply-conversion"
    | "channel-registry"
    | "send-ledger"
    | "execution-report"
    | "robot-team-contact-list"
    | "site-operator-contact-list",
) {
  return path.join(
    REPO_ROOT,
    "ops/paperclip/playbooks",
    `city-opening-${profile.key}-${kind}.md`,
  );
}

function normalizeComparableText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function buyerTargetMatchesSendAction(
  buyerTarget: CityLaunchBuyerTargetRecord,
  sendAction: CityLaunchSendActionRecord,
) {
  const companyKey = normalizeComparableText(buyerTarget.companyName);
  if (!companyKey) {
    return false;
  }

  const evidenceFields = [
    sendAction.targetLabel,
    sendAction.recipientEmail,
    sendAction.notes,
  ];

  return evidenceFields.some((field) => normalizeComparableText(field).includes(companyKey));
}

type SeededCityOpeningExecution = {
  channelAccounts: CityLaunchChannelAccountRecord[];
  sendActions: CityLaunchSendActionRecord[];
};

async function writeTextArtifact(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function listSourceArtifacts(profile: CityLaunchProfile) {
  const sourcePaths = [
    ...STATIC_SOURCE_PATHS,
    profile.launchPlaybookPath,
    profile.demandPlaybookPath,
    profile.targetLedgerPath,
  ];
  const artifacts = await Promise.all(
    sourcePaths.map(async (relativePath): Promise<ReadSourceArtifact> => {
      try {
        await fs.access(path.join(REPO_ROOT, relativePath));
        return { relativePath, exists: true };
      } catch {
        return { relativePath, exists: false };
      }
    }),
  );

  return artifacts.filter((artifact) => artifact.exists);
}

async function maybeLoadCompletedResearch(input: {
  planningState: CityLaunchPlanningState;
  contactEnrichmentPath?: string | null;
}) {
  if (!input.planningState.completedArtifactPath) {
    return null;
  }

  try {
    const enrichment = await runCityLaunchContactEnrichment({
      city: input.planningState.city,
      artifactPath: input.planningState.completedArtifactPath,
      outputPath: input.contactEnrichmentPath ?? null,
      resolveRecipientEvidence: resolveHistoricalRecipientEvidence,
    });
    return enrichment.parsed ? enrichment : null;
  } catch {
    return null;
  }
}

function formatDateOnly(value: string) {
  return value.slice(0, 10);
}

function countRecipientBackedFirstWaveContacts(research: CityLaunchResearchParseResult | null) {
  return (research?.buyerTargets || []).filter((entry) => Boolean(entry.contactEmail)).length
    + (research?.captureCandidates || []).filter((entry) => Boolean(entry.contactEmail)).length;
}

function hasFirehoseConfigured() {
  return Boolean(
    getConfiguredEnvValue("FIREHOSE_API_TOKEN")
      && getConfiguredEnvValue("FIREHOSE_BASE_URL"),
  );
}

async function reconcilePriorActivationIssueState(input: {
  priorActivation: Awaited<ReturnType<typeof readCityLaunchActivation>> | null;
  tasks: CityLaunchTask[];
}) {
  if (!input.priorActivation) {
    return {
      rootIssueId: null,
      taskIssueIds: {} as Record<string, string>,
    };
  }

  const validTaskKeys = new Set(input.tasks.map((task) => task.key));
  let rootIssueId = input.priorActivation.rootIssueId || null;

  if (rootIssueId) {
    try {
      await getPaperclipIssue(rootIssueId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/Paperclip 404\b/i.test(message)) {
        rootIssueId = null;
      } else {
        throw error;
      }
    }
  }

  const taskIssueIds = Object.fromEntries(
    (
      await Promise.all(
        Object.entries(input.priorActivation.taskIssueIds || {}).map(async ([key, issueId]) => {
          if (!validTaskKeys.has(key) || !issueId) {
            return null;
          }
          try {
            await getPaperclipIssue(issueId);
            return [key, issueId] as const;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/Paperclip 404\b/i.test(message)) {
              return null;
            }
            throw error;
          }
        }),
      )
    ).filter((entry): entry is readonly [string, string] => Boolean(entry)),
  );

  return {
    rootIssueId,
    taskIssueIds,
  };
}

function formatPlanningState(planningState: CityLaunchPlanningState) {
  switch (planningState.status) {
    case "completed":
      return "completed";
    case "refresh_in_progress":
      return "refresh in progress";
    case "in_progress":
      return "in progress";
    default:
      return "not started";
  }
}

function laneDisplayName(lane: CityLaunchAgentLane | CityLaunchHumanLane) {
  return CITY_LAUNCH_LANE_DISPLAY_NAMES[lane];
}

function buildCompactLaunchPlaybookMarkdown(input: {
  profile: CityLaunchProfile;
  status: CityLaunchExecutionStatus;
  budgetPolicy: CityLaunchBudgetPolicy;
  planningState: CityLaunchPlanningState;
  targetLedgerMode: "curated_city_profile" | "deep_research_records" | "planning_placeholder";
  targetLedgerWarnings: string[];
  research: CityLaunchResearchParseResult | null;
  activationPayload: ParsedCityLaunchActivationPayload | null;
}) {
  const firstTargets = input.research?.captureCandidates.slice(0, 3) || [];
  const sampleTargetLine = firstTargets.length > 0
    ? `Research-backed named targets already available include ${firstTargets.map((entry) => entry.name).join(", ")}.`
    : `No research-backed named targets are available yet, so the first live capture work should stay blocked until deep research materializes into named sites.`;
  const validationBlockers = input.activationPayload?.validationBlockers || [];

  return [
    `# ${input.profile.city} — Blueprint City Launch Plan`,
    "",
    "## Status",
    `- phase: ${input.status === "founder_approved_activation_ready" ? "activation_ready" : "planning"}`,
    "- owner: city-launch-agent",
    `- last-reviewed: ${formatDateOnly(new Date().toISOString())}`,
    `- recommended-posture: ${input.status === "founder_approved_activation_ready" ? "gated cohort pilot" : "gated cohort pilot, not public launch"}`,
    `- launch_policy_state: ${input.status === "founder_approved_activation_ready" ? "autonomous_execution_ready" : "planning_only"}`,
    `- planning-state: ${formatPlanningState(input.planningState)}`,
    "",
    "## Launch Thesis",
    input.activationPayload?.cityThesis
      || `${input.profile.shortLabel} should launch only as a bounded, proof-led city program: create rights-cleared proof assets and use those exact-site artifacts to open buyer review before any volume motion.`,
    "",
    "## What Changed This Pass",
    `- evidence-backed: the generic city-launch activation harness generated the ${input.profile.shortLabel} system doc, execution issue bundle, target ledger, and compact city playbooks in one run.`,
    `- evidence-backed: the launch harness now tracks planning state explicitly so activation can distinguish "not started" from "research still running".`,
    `- evidence-backed: the compact launch packet uses the standard platform analytics event model rather than inventing city-specific telemetry.`,
    `- evidence-backed: the target ledger mode for this city is \`${input.targetLedgerMode}\`. ${sampleTargetLine}`,
    ...(input.targetLedgerWarnings.map((warning) => `- warning: ${warning}`)),
    "",
    "## Why This City Now",
    "- the city remains a planning candidate only if it can produce rights-cleared exact-site proof assets for real robotics workflows",
    "- the launch should stay anchored to warehouse, manufacturing, inspection, or similarly commercial site types where hosted review creates technical buyer value",
    "- no city should widen until the first proof assets, hosted reviews, and capturer approvals are real and measurable",
    "",
    "## Recommended Launch Posture",
    `- Choose the lawful access mode per target from: ${(input.activationPayload?.lawfulAccessModes || []).join(", ") || "buyer_requested_site, site_operator_intro, capturer_existing_lawful_access, public_non_controlled_site"}.`,
    "- Private controlled interiors require explicit authorization before dispatching capturers.",
    "- Keep the first active capturer cohort capped at roughly 5-10 vetted surveying, AEC, industrial inspection, or commercial mapping operators until the first 3-5 proof-ready sites exist.",
    "- Do not run public bounty, generic gig-worker, or broad community sourcing for private controlled interiors.",
    "- For public, non-controlled commercial locations such as groceries, retail stores, and similar walk-in sites, allow bounded online community sourcing when the brief constrains capture to lawful public areas and preserves privacy, signage, and provenance rules.",
    "- For that public commercial lane, find everyday capturers where they already are online: local city/community groups, neighborhood forums, retail and shopping communities, creator communities, and lightweight campus or gig networks that do not imply private-interior access.",
    "- Keep public posture at Exact-Site Hosted Review wedge only; no city-live or readiness claims until proof is real.",
    input.activationPayload?.preferredLawfulAccessMode
      ? `- Preferred first lawful access mode: ${input.activationPayload.preferredLawfulAccessMode}.`
      : "- Preferred first lawful access mode is still validation-required.",
    "",
    "## City-Opening Distribution Layer",
    "- City opening is a first-class launch lane, not an implied side effect of having sourcing or demand tasks on paper.",
    `- ${input.profile.shortLabel} should open with two explicit awareness tracks: warehouse/facility direct awareness to named buyers, operators, and integrators; and bounded public-commercial awareness through many small community placements rather than one broad campaign.`,
    "- Optimize the first wave for first response and truthful routing, not polished branding.",
    "- Every city-opening asset should say who Blueprint is, what is launching in the city, what spaces are in scope, what is not allowed, and the exact CTA path for replies.",
    "",
    "## Required Distribution Artifacts",
    `- ${input.profile.shortLabel} city-opening brief with warehouse/facility and public-commercial awareness split`,
    `- ${input.profile.shortLabel} city channel map naming channels, audiences, owners, and message posture`,
    `- ${input.profile.shortLabel} first-wave outreach/posting pack with direct outreach variants and bounded community-placement variants`,
    `- ${input.profile.shortLabel} CTA / intake path with source tags and next-owner routing`,
    `- ${input.profile.shortLabel} response-tracking view showing which channels produced real replies`,
    `- ${input.profile.shortLabel} reply-conversion queue and follow-up cadence rules so live responses move into the correct next lane`,
    `- ${input.profile.shortLabel} channel/account registry with ready-to-create, created, or blocked state`,
    `- ${input.profile.shortLabel} live post/outreach send ledger with ready-to-send, sent, or blocked state plus first-send approval`,
    `- ${input.profile.shortLabel} city-opening execution report showing what actually went live versus what is still pending`,
    "",
    "## Target Capturer Profile",
    "- site-authorized surveying, AEC scanning, industrial inspection, or commercial mapping operator",
    "- comfortable with repeatable indoor walkthrough capture and explicit rights / privacy boundaries",
    "- able to document access path and site-operator authority without ambiguity",
    "- for public, non-controlled commercial locations, everyday capturers sourced from online communities may participate when they can follow a public-area-only brief and explicit privacy/signage rules",
    "",
    "## Ranked Channel Stack",
    "| Rank | Channel | Why it fits | Trust mechanism | Current posture |",
    "|---|---|---|---|---|",
    "| 1 | site-operator introductions | lawful path into private interiors | named operator approval and rights packet | start here |",
    "| 2 | buyer-linked exact-site requests | strongest proof-led capture path | buyer thread plus operator approval | start here |",
    "| 3 | local surveying / AEC / industrial inspection firms | best early supply quality | professional credentials plus first-capture review | curated only |",
    "| 4 | high-trust mapper referrals | useful after first proof assets exist | referral guardrails plus completion history | hold until proof exists |",
    "| 5 | online community capture for public, non-controlled commercial sites | enables everyday capturers to source groceries, retail, and similar walk-in locations through the communities they already use online | public-area-only brief plus privacy/signage guardrails | enable in bounded form |",
    "",
    "## Response Signal Standard",
    "- A real live city-opening signal means a real reply, applicant, referral, operator callback, buyer callback, or community response is recorded in the canonical intake path with city, lane, source, and CTA attribution.",
    "- Draft copy, saved prospect lists, and unsent channel ideas are preparation, not live response.",
    "- Warehouse/facility awareness should route into named direct threads with proof-led next steps and access-path truth.",
    "- Public-commercial awareness should route into bounded public-area capture replies without implying blanket permission for private interiors.",
    "",
    "## Reply Conversion Cadence",
    "- Once replies start arriving, the city-opening lane should own a shared response queue instead of letting different channels drift into scattered inboxes.",
    "- Each live response should be tagged by responder type, channel, current status, next owner, next follow-up due, and downstream handoff target.",
    "- Reply conversion should hand warehouse/facility responses into operator/buyer/access work, public-commercial responses into qualification, and ambiguous or weak responses into blocked/no-fit states with named reasons.",
    "- A live response does not count as converted just because it exists; it counts when it receives a next step, follow-up cadence, and downstream routing decision.",
    "",
    "## City-Opening Execution Layer",
    "- The city-opening execution layer should keep a first-class channel/account registry, a send ledger, and a current execution report.",
    "- Account creation, send readiness, send approval, sent state, and response ingest should stay visible in canonical artifacts instead of hiding in agent comments.",
    "- The reply-conversion lane should ingest responses from the send ledger rather than assuming responses will be routed manually.",
    "",
    "## Rights Path",
    "",
    input.activationPayload?.rightsPath.summary
      || "Rights path is still validation-required. Private controlled interiors require explicit authorization before capture dispatch.",
    "",
    "## Trust Infrastructure Required Before Expansion",
    "- written site-operator acquisition path and authority verification checklist",
    "- Ops Lead-approved intake rubric, trust kit, and first-capture thresholds",
    "- standard proof-pack structure with provenance, rights, privacy, recency, and hosted-review path",
    "- platform analytics using `robot_team_inbound_captured`, `proof_path_assigned`, `proof_pack_delivered`, `hosted_review_ready`, and `hosted_review_started` with city/source tags",
    "",
    "## Validation Blockers",
    "",
    ...(validationBlockers.length > 0
      ? validationBlockers.map((blocker) =>
          `- ${blocker.severity}: ${blocker.summary}${blocker.validationRequired ? " (validation required)" : ""}`,
        )
      : ["- none recorded in the current activation payload"]),
    "",
    "## Readiness Scorecard",
    "| Dimension | Score | Rationale |",
    "|---|---:|---|",
    `| channel reachability | ${input.research ? "3/5" : "1/5"} | ${input.research ? "Named research exists, but operator-rights paths still need validation." : "No research-backed named sites are materialized yet."} |`,
    "| likely supply quality | 3/5 | high if channels stay with site-authorized technical operators, low if widened into generic public recruiting |",
    "| operations feasibility | 3/5 | the issue tree and operator lanes exist, but the city still needs explicit site acquisition and proof-ops packets |",
    "| measurement readiness | 3/5 | platform events exist, but city-specific reporting still needs end-to-end validation |",
    "| legal/compliance clarity | 1/5 | private-interior access, rights authority, and any defense/export constraints remain explicit blockers until reviewed |",
    `| strategic importance | ${input.research ? "3/5" : "2/5"} | city value is still hypothesis-level until proof-ready assets and hosted reviews exist |`,
    "",
    "## Autonomous Policy",
    "- city activation runs automatically inside the written budget envelope, source policy, and evidence-backed posture",
    "- unsupported public claims, evidence-free rights/privacy exceptions, and non-standard commercial terms stay automatically blocked until repo truth is updated",
    "- pricing, rights, privacy, and commercialization rules are enforced from the written policy and proof artifacts rather than approval packets",
    "",
    "## Sequencing Recommendation",
    `Do not treat ${input.profile.shortLabel} as operationally real until a small number of rights-cleared sites, proof packs, and hosted reviews are real. The city should widen only after those proofs exist and the operator lanes can support them.`,
  ].join("\n");
}

function buildCompactDemandPlaybookMarkdown(input: {
  profile: CityLaunchProfile;
  status: CityLaunchExecutionStatus;
  planningState: CityLaunchPlanningState;
  research: CityLaunchResearchParseResult | null;
  activationPayload: ParsedCityLaunchActivationPayload | null;
}) {
  const buyerNames = input.research?.buyerTargets.slice(0, 3).map((entry) => entry.companyName) || [];
  const metricsDependencies = input.activationPayload?.metricsDependencies || [];
  return [
    `# ${input.profile.city} — Blueprint City Demand Plan`,
    "",
    "## Status",
    `- phase: ${input.status === "founder_approved_activation_ready" ? "activation_ready" : "planning"}`,
    "- owner: city-demand-agent",
    `- latest-refresh: ${formatDateOnly(new Date().toISOString())}`,
    `- planning-state: ${formatPlanningState(input.planningState)}`,
    `- confidence: ${input.research ? "medium" : "low"}`,
    "",
    "## City Demand Thesis",
    `${input.profile.shortLabel} demand should stay proof-led: qualify real robot-team interest, classify exact-site versus adjacent-site fit inside one business day, and route serious threads into hosted review with clear artifact handoff and human-gated exceptions.`,
    "",
    "## What Changed This Pass",
    `- evidence-backed: the city launcher now generates the compact demand playbook during activation so downstream tasks have a real canonical reference.`,
    `- evidence-backed: city demand instrumentation is pinned to the platform event model rather than custom city-specific events.`,
    ...(buyerNames.length > 0
      ? [`- evidence-backed: current deep research names buyer targets such as ${buyerNames.join(", ")}.`]
      : ["- warning: no research-backed buyer target list has been materialized yet."]),
    "",
    "## Required Proof Motion",
    "- serious robot-team demand must hit 24-hour proof-path triage",
    "- classify every serious thread as exact_site, adjacent_site, or scoped_follow_up before promising a review surface",
    "- default to proof-pack plus hosted review, with artifact handoff expectations attached",
    "- keep pricing, rights, privacy, and commercialization exceptions out of the technical proof lane until humans are needed",
    "",
    "## Instrumentation Standard",
    "| Stage | Event or state | Why it matters |",
    "|---|---|---|",
    "| demand signal | `robot_team_inbound_captured` with source, city, buyer role, and requested lane | separates real robot-team demand from generic awareness |",
    "| proof-path triage | `proof_path_assigned` with outcome: exact_site, adjacent_site, scoped_follow_up | shows whether the city has truthful proof scope |",
    "| proof delivery | `proof_pack_delivered` and `hosted_review_ready` | measures time-to-proof and whether a technical review surface exists |",
    "| hosted review | `hosted_review_started` and `hosted_review_follow_up_sent` | measures whether proof actually converts into technical review |",
    "",
    "## Metrics Dependencies",
    "",
    ...(metricsDependencies.length > 0
      ? metricsDependencies.map((entry) =>
          `- ${entry.key}: ${entry.status}${entry.notes ? ` — ${entry.notes}` : ""}`,
        )
      : ["- No machine-readable metrics dependency payload is available yet."]),
    "",
    "## Sensitive-Lane Constraints",
    "- if a buyer sits in defense, aerospace, export-controlled, or air-gapped environments, block the standard hosted-review path until the policy and evidence path are explicit",
    "- do not imply that Blueprint can serve sensitive or controlled-access environments over a standard cloud runtime without buyer-specific confirmation",
    "- operator-governed facilities and rights-sensitive exact-site requests should route through `rights-provenance-agent` plus written policy evidence",
    "",
    "## Immediate Next Actions",
    "1. materialize the research-backed buyer targets and first-touch candidates as soon as deep research completes",
    "2. keep `buyer-solutions-agent` and `revenue-ops-pricing-agent` on standard commercial prep while founders stay out of routine proof motion",
    "3. block city-specific outbound scale until proof packs and hosted reviews are real, not just planned",
  ].join("\n");
}

function buildCityOpeningBriefMarkdown(input: {
  profile: CityLaunchProfile;
  research: CityLaunchResearchParseResult | null;
  activationPayload: ParsedCityLaunchActivationPayload | null;
}) {
  const buyerTargets =
    input.research?.buyerTargets.slice(0, 3).map((entry) => entry.companyName) || [];
  const captureTargets =
    input.research?.captureCandidates.slice(0, 3).map((entry) => entry.name) || [];

  return [
    `# ${input.profile.city} City-Opening Brief`,
    "",
    "- status: generated draft artifact",
    "- purpose: city-opening distribution planning artifact, not evidence of a live send or live reply",
    "",
    "## City Opening Goal",
    `Open ${input.profile.shortLabel} with truthful awareness before expecting replies: make the right people aware that Blueprint is launching a bounded city motion, what spaces are in scope, what is out of scope, and what exact CTA path they should use.`,
    "",
    "## Awareness Split",
    "- Warehouse / facility awareness: direct, named, proof-led outreach to buyers, operators, tenants, integrators, and site-adjacent technical contacts.",
    "- Public-commercial awareness: many small bounded community placements for public, non-controlled commercial capture with public-area-only framing and explicit privacy/signage guardrails.",
    "",
    "## Core Message",
    "- Who Blueprint is: a capture-first, world-model-product-first company turning real sites into exact-site proof assets and hosted review paths.",
    `- What is launching in ${input.profile.shortLabel}: one narrow city-opening motion around exact-site hosted review, not a broad public city-launch claim.`,
    `- What is in scope: ${input.activationPayload?.primarySiteLane || "warehouse and commercial site capture"} with truthful lawful-access posture and bounded public-commercial capture where allowed.`,
    "- What is out of scope: fake traction claims, blanket permission language, private controlled-interior capture without lawful access, and promises beyond actual proof state.",
    "- CTA: respond through the tagged city intake path with site type, access posture, contact role, and what kind of follow-up is requested.",
    "",
    "## Evidence Anchors Available Now",
    ...(captureTargets.length > 0
      ? [`- Example research-backed capture targets: ${captureTargets.join(", ")}.`]
      : ["- No research-backed capture targets are materialized yet; keep claims narrow and posture-led."]),
    ...(buyerTargets.length > 0
      ? [`- Example buyer-side targets already named in research: ${buyerTargets.join(", ")}.`]
      : ["- No research-backed buyer target set is materialized yet."]),
    "",
    "## Usage Rule",
    "This artifact is a working city-opening brief for operators and agents. It does not mean outreach has been sent, channels have been opened, or live responses already exist.",
  ].join("\n");
}

function buildCityOpeningChannelMapMarkdown(input: {
  profile: CityLaunchProfile;
  activationPayload: ParsedCityLaunchActivationPayload | null;
}) {
  return [
    `# ${input.profile.city} City Channel Map`,
    "",
    "- status: generated draft artifact",
    "- purpose: channel map for city-opening execution, not proof of account creation or sends",
    "",
    "| Lane | Audience | Channel class | Message posture | Exact CTA | Guardrails |",
    "| --- | --- | --- | --- | --- | --- |",
    `| warehouse-facility-direct | buyers, operators, integrators, tenants, site-adjacent technical contacts | direct email, direct message, intro request, referral thread | proof-led, named, exact-site posture | reply with site, role, access posture, and interest in follow-up | no blanket permission claims; no fake proof; no non-standard commercial commitments |`,
    `| buyer-linked-site | existing buyer threads requesting exact-site or adjacent-site review | buyer-linked thread | exact-site hosted-review posture | confirm site/workflow fit and handoff path | rights/privacy and commercial exceptions stay human-gated |`,
    `| professional-capturer | surveying, AEC, industrial inspection, commercial mapping operators | curated direct outreach | lawful-access and trust-packet posture | apply through tagged intake path with access facts and equipment fit | no generic gig-worker framing for private interiors |`,
    `| public-commercial-community | everyday capturers in city/community and retail-adjacent communities | small bounded community placements | public-area-only capture brief | reply with candidate public commercial site, public-area posture, and availability | no implication that private interiors are allowed; preserve signage/privacy/provenance rules |`,
    "",
    "## Primary Workflow Context",
    `- primary_site_lane: ${input.activationPayload?.primarySiteLane || "validation required"}`,
    `- primary_workflow_lane: ${input.activationPayload?.primaryWorkflowLane || "validation required"}`,
    `- primary_buyer_proof_path: ${input.activationPayload?.primaryBuyerProofPath || "validation required"}`,
  ].join("\n");
}

function buildCityOpeningFirstWavePackMarkdown(input: {
  profile: CityLaunchProfile;
  research: CityLaunchResearchParseResult | null;
}) {
  const buyers =
    input.research?.buyerTargets.slice(0, 3).map((entry) => entry.companyName) || [];
  const targets =
    input.research?.captureCandidates.slice(0, 3).map((entry) => entry.name) || [];

  return [
    `# ${input.profile.city} City-Opening First-Wave Pack`,
    "",
    "- status: generated draft artifact",
    "- purpose: first-wave asset pack for operator review; not evidence of a live send, post, or account setup",
    "",
    "## Warehouse / Facility Direct Awareness",
    ...(buyers.length > 0
      ? buyers.map((buyer, index) => `- target ${index + 1}: ${buyer} — use a proof-led intro anchored to one workflow lane and one truthful CTA.`)
      : ["- no named buyer-side targets are materialized yet; keep this lane in draft preparation only."]),
    ...(targets.length > 0
      ? [`- target site anchors currently available: ${targets.join(", ")}.`]
      : ["- no named site anchors are materialized yet; avoid pretending a target list is complete."]),
    "",
    "## Public-Commercial Bounded Placements",
    "- placement class 1: local city/community groups where public commercial walkthroughs can be discussed without implying private access.",
    "- placement class 2: retail/shopping and creator-adjacent communities where public-area-only capture briefs are understandable.",
    "- placement class 3: lightweight campus/gig networks only when the copy stays bounded to public commercial capture.",
    "",
    "## Required Copy Rules",
    "- say who Blueprint is and what exact city-opening motion is underway",
    "- say what spaces are in scope and what is not allowed",
    "- point every asset to the same CTA / intake path with source tagging",
    "- do not imply traction, legal certainty, or permission that does not exist",
  ].join("\n");
}

function buildCityOpeningCtaRoutingMarkdown(input: {
  profile: CityLaunchProfile;
}) {
  return [
    `# ${input.profile.city} City-Opening CTA Routing`,
    "",
    "- status: generated draft artifact",
    "- purpose: canonical response-routing contract for city-opening replies",
    "",
    "## CTA Standard",
    `Every ${input.profile.shortLabel} city-opening asset should route replies into one tagged intake path instead of ad hoc inboxes, side notes, or disconnected DMs.`,
    "",
    "## Required Tags",
    "- city",
    "- lane: warehouse-facility-direct or public-commercial-community",
    "- source channel / channel class",
    "- responder type",
    "- requested next step",
    "",
    "## Minimum Response Fields",
    "- contact role",
    "- site or space type",
    "- whether the respondent has lawful access, operator reach, buyer interest, or only a public-commercial lead",
    "- what follow-up they want from Blueprint",
    "",
    "## Routing Rule",
    "- warehouse / facility access and operator-side replies route toward site-operator-partnership or buyer-linked handling",
    "- capturer or public-commercial responses route toward supply qualification",
    "- unclear or weak responses remain visible as blocked/no-fit rather than disappearing",
  ].join("\n");
}

function buildCityOpeningResponseTrackingMarkdown(input: {
  profile: CityLaunchProfile;
}) {
  return [
    `# ${input.profile.city} City-Opening Response Tracking`,
    "",
    "- status: generated draft artifact",
    "- purpose: measurement contract for city-opening awareness work",
    "",
    "## What Counts As A Real Response",
    "- a reply, applicant, referral, operator callback, buyer callback, or community response recorded with city, lane, source, and CTA attribution",
    "",
    "## What Does Not Count",
    "- draft copy",
    "- unsent outreach",
    "- account setup alone",
    "- a prospect list with no response",
    "",
    "## Tracking View Requirements",
    "- separate warehouse/facility direct awareness from public-commercial community awareness",
    "- show which channel classes were activated",
    "- show response counts and attribution gaps",
    "- make missing instrumentation explicit instead of assuming awareness happened",
  ].join("\n");
}

function buildCityOpeningReplyConversionMarkdown(input: {
  profile: CityLaunchProfile;
}) {
  return [
    `# ${input.profile.city} City-Opening Reply Conversion`,
    "",
    "- status: generated draft artifact",
    "- purpose: shared reply queue and follow-up cadence contract for city-opening responses",
    "",
    "## Shared Response Queue Fields",
    "- responder type",
    "- channel / source",
    "- current status",
    "- next owner",
    "- next follow-up due",
    "- downstream handoff target",
    "- blocked / no-fit reason when applicable",
    "",
    "## Follow-Up Cadence",
    "- first response: acknowledge, classify, and route into the next lane",
    "- second touch: use when a live response exists but required details or confirmation are still missing",
    "- stale response handling: mark explicitly stale if the follow-up window passes without movement",
    "- closure: move into qualification, operator partnership, buyer handling, blocked-with-reason, or no-fit / closed-lost",
    "",
    "## Conversion Rule",
    `A ${input.profile.shortLabel} city-opening response is not converted just because it exists. It is converted when it has an owner, a next step, a follow-up due state, and a downstream routing decision.`,
  ].join("\n");
}

async function buildCityOpeningExecutionSeed(input: {
  profile: CityLaunchProfile;
  launchId: string | null;
  taskIssueIds: Record<string, string>;
  research: CityLaunchResearchParseResult | null;
  founderApproved: boolean;
}) {
  const citySlug = input.profile.key;
  const buyerTargets = input.research?.buyerTargets || [];
  const captureTargets = input.research?.captureCandidates || [];
  const buyerProofReady = hasVerifiedBuyerProofAsset(input.research);
  const recipientEvidence = await resolveHistoricalRecipientEvidence({
    targets: [
      ...buyerTargets.slice(0, 6).map((entry) => entry.companyName),
      ...captureTargets.slice(0, 4).map((entry) => entry.name),
    ],
  });
  const approvalState = "approved";
  const directLaneStatus = "created";
  const directWarehouseSubject = `Blueprint ${input.profile.shortLabel} exact-site warehouse opening`;
  const directWarehouseBody = [
    `Blueprint is opening a bounded ${input.profile.shortLabel} city-launch motion focused on exact-site hosted review for real warehouse workflows.`,
    "",
    "We are looking for named buyer, operator, and integrator threads where one real site and one real workflow lane can be routed into a truthful proof path.",
    "",
    `If there is a relevant ${input.profile.shortLabel} facility or workflow thread, reply with the site, role, access posture, and whether the next step should be a direct intro or a proof-led follow-up.`,
  ].join("\n");
  const buyerLinkedSubject = `Blueprint ${input.profile.shortLabel} exact-site follow-up`;
  const buyerLinkedBody = [
    `Blueprint is opening a bounded ${input.profile.shortLabel} exact-site hosted-review motion.`,
    "",
    "This follow-up stays narrow: one real site, one workflow lane, one truthful next step into proof review.",
    "",
    "Reply with the site/workflow fit and the right owner or operator path if a Sacramento thread should be opened.",
  ].join("\n");
  const professionalCapturerSubject = `Blueprint ${input.profile.shortLabel} professional capture opening`;
  const professionalCapturerBody = [
    `Blueprint is opening a bounded ${input.profile.shortLabel} capture motion and is looking for professional operators who can support lawful-access commercial site capture.`,
    "",
    "This is not a broad public gig post. We are looking for repeatable, rights-safe operators who can document access posture and follow a narrow capture brief.",
    "",
    `Reply with your ${input.profile.shortLabel} coverage, equipment fit, access posture, and whether you can support warehouse or similar commercial sites.`,
  ].join("\n");
  const recipientBackedBuyerTargets = buyerTargets
    .map((entry) => ({
      entry,
      recipientEmail:
        entry.contactEmail
        || recipientEvidence.get(normalizeComparableText(entry.companyName))?.recipientEmail
        || null,
      recipientSource:
        recipientEvidence.get(normalizeComparableText(entry.companyName))?.source || null,
    }))
    .filter((entry): entry is typeof entry & { recipientEmail: string } => Boolean(entry.recipientEmail));
  const recipientBackedCaptureTargets = captureTargets
    .map((entry) => ({
      entry,
      recipientEmail:
        entry.contactEmail
        || recipientEvidence.get(normalizeComparableText(entry.name))?.recipientEmail
        || null,
      recipientSource:
        recipientEvidence.get(normalizeComparableText(entry.name))?.source || null,
    }))
    .filter((entry): entry is typeof entry & { recipientEmail: string } => Boolean(entry.recipientEmail));
  const warehouseTarget = recipientBackedBuyerTargets[0] || recipientBackedCaptureTargets[0] || null;
  const buyerLinkedTarget = recipientBackedBuyerTargets[1] || null;
  const professionalTarget = recipientBackedCaptureTargets[0] || null;
  const warehouseTargetIsBuyer = Boolean(
    warehouseTarget
    && typeof Reflect.get(warehouseTarget.entry as object, "companyName") === "string",
  );
  const warehouseTargetBlockedForProof = warehouseTargetIsBuyer && !buyerProofReady;
  const warehouseTargetLabel = warehouseTarget
    ? String(
        Reflect.get(warehouseTarget.entry as object, "companyName")
        || Reflect.get(warehouseTarget.entry as object, "name")
        || "",
      )
    : null;

  const channelAccounts: Array<Omit<CityLaunchChannelAccountRecord, "citySlug" | "createdAtIso" | "updatedAtIso">> = [
    {
      id: `${citySlug}-channel-warehouse-facility-direct`,
      city: input.profile.city,
      launchId: input.launchId,
      lane: "warehouse-facility-direct",
      channelClass: "direct_email_or_intro_thread",
      accountLabel: `${input.profile.shortLabel} warehouse/facility direct outreach lane`,
      ownerAgent: "city-launch-agent",
      status: directLaneStatus,
      approvalState,
      notes: "Direct outreach lane is approved for autonomous execution inside the bounded launch posture.",
    },
    {
      id: `${citySlug}-channel-buyer-linked-site`,
      city: input.profile.city,
      launchId: input.launchId,
      lane: "buyer-linked-site",
      channelClass: "buyer_thread_or_intro_request",
      accountLabel: `${input.profile.shortLabel} buyer-linked site outreach lane`,
      ownerAgent: "city-launch-agent",
      status: directLaneStatus,
      approvalState,
      notes: "Use for named buyer-linked or operator-linked follow-through only.",
    },
    {
      id: `${citySlug}-channel-professional-capturer`,
      city: input.profile.city,
      launchId: input.launchId,
      lane: "professional-capturer",
      channelClass: "curated_professional_outreach",
      accountLabel: `${input.profile.shortLabel} professional capturer outreach lane`,
      ownerAgent: "capturer-growth-agent",
      status: directLaneStatus,
      approvalState,
      notes: "Private controlled interiors stay on curated lawful-access posture.",
    },
    {
      id: `${citySlug}-channel-public-commercial-community`,
      city: input.profile.city,
      launchId: input.launchId,
      lane: "public-commercial-community",
      channelClass: "bounded_community_posting",
      accountLabel: `${input.profile.shortLabel} public-commercial community lane`,
      ownerAgent: "capturer-growth-agent",
      status: "created",
      approvalState: "not_required",
      notes:
        "Artifact-only lane; external community publication is excluded from the automated launch path until a publication connector exists.",
    },
  ];

  const sendActions: Array<Omit<CityLaunchSendActionRecord, "citySlug" | "createdAtIso" | "updatedAtIso">> = [];

  if (warehouseTarget) {
    sendActions.push({
      id: `${citySlug}-send-warehouse-direct-1`,
      city: input.profile.city,
      launchId: input.launchId,
      lane: "warehouse-facility-direct",
      actionType: "direct_outreach",
      channelAccountId: `${citySlug}-channel-warehouse-facility-direct`,
      channelLabel: "warehouse/facility direct outreach lane",
      targetLabel: warehouseTargetLabel || `${input.profile.shortLabel} named warehouse/facility target`,
      assetKey: "city-opening-first-wave-pack",
      ownerAgent: "capturer-growth-agent",
      recipientEmail: warehouseTarget.recipientEmail,
      emailSubject: directWarehouseSubject,
      emailBody: directWarehouseBody,
      status: warehouseTargetBlockedForProof ? "blocked" : "ready_to_send",
      approvalState,
      responseIngestState: "awaiting_response",
      issueId: input.taskIssueIds["city-opening-first-wave-pack"] || null,
      notes:
        warehouseTargetBlockedForProof
          ? `Missing rights-cleared proof pack. ${warehouseTargetLabel || input.profile.shortLabel} first touch is drafted, but it must stay conditional until a proof-ready asset exists.`
          : warehouseTarget.recipientSource
            || "First proof-led direct outreach is ready for autonomous dispatch.",
      sentAtIso: null,
      firstResponseAtIso: null,
    });
  }

  if (buyerLinkedTarget) {
    sendActions.push({
      id: `${citySlug}-send-buyer-linked-1`,
      city: input.profile.city,
      launchId: input.launchId,
      lane: "buyer-linked-site",
      actionType: "direct_outreach",
      channelAccountId: `${citySlug}-channel-buyer-linked-site`,
      channelLabel: "buyer-linked site outreach lane",
      targetLabel:
        buyerLinkedTarget.entry.companyName
        || `${input.profile.shortLabel} buyer-linked exact-site thread`,
      assetKey: "city-opening-first-wave-pack",
      ownerAgent: "city-launch-agent",
      recipientEmail: buyerLinkedTarget.recipientEmail,
      emailSubject: buyerLinkedSubject,
      emailBody: buyerLinkedBody,
      status: buyerProofReady ? "ready_to_send" : "blocked",
      approvalState,
      responseIngestState: "awaiting_response",
      issueId: input.taskIssueIds["city-opening-first-wave-pack"] || null,
      notes:
        buyerProofReady
          ? buyerLinkedTarget.recipientSource
            || "Use only when the message stays within exact-site proof posture."
          : `Missing rights-cleared proof pack. ${buyerLinkedTarget.entry.companyName || input.profile.shortLabel} first touch is drafted, but it must stay conditional until a proof-ready asset exists.`,
      sentAtIso: null,
      firstResponseAtIso: null,
    });
  }

  if (professionalTarget) {
    sendActions.push({
      id: `${citySlug}-send-professional-capturer-1`,
      city: input.profile.city,
      launchId: input.launchId,
      lane: "professional-capturer",
      actionType: "direct_outreach",
      channelAccountId: `${citySlug}-channel-professional-capturer`,
      channelLabel: "professional capturer outreach lane",
      targetLabel:
        professionalTarget.entry.name
        || `${input.profile.shortLabel} professional capturer first-wave target`,
      assetKey: "city-opening-first-wave-pack",
      ownerAgent: "capturer-growth-agent",
      recipientEmail: professionalTarget.recipientEmail,
      emailSubject: professionalCapturerSubject,
      emailBody: professionalCapturerBody,
      status: "ready_to_send",
      approvalState,
      responseIngestState: "awaiting_response",
      issueId: input.taskIssueIds["supply-prospects"] || null,
      notes:
        professionalTarget.recipientSource
        || "First curated professional outreach is ready for autonomous dispatch.",
      sentAtIso: null,
      firstResponseAtIso: null,
    });
  }

  return { channelAccounts, sendActions };
}

async function seedCityOpeningExecutionLedgers(input: {
  profile: CityLaunchProfile;
  launchId: string | null;
  taskIssueIds: Record<string, string>;
  research: CityLaunchResearchParseResult | null;
  founderApproved: boolean;
}) {
  const seed = await buildCityOpeningExecutionSeed(input);
  const [channelAccounts, sendActions] = await Promise.all([
    Promise.all(seed.channelAccounts.map((entry) => upsertCityLaunchChannelAccount(entry))),
    Promise.all(seed.sendActions.map((entry) => upsertCityLaunchSendAction(entry))),
  ]);
  return {
    channelAccounts,
    sendActions,
  } satisfies SeededCityOpeningExecution;
}

function renderCityOpeningChannelRegistryMarkdown(input: {
  profile: CityLaunchProfile;
  channelAccounts: CityLaunchChannelAccountRecord[];
}) {
  return [
    `# ${input.profile.city} City-Opening Channel Registry`,
    "",
    "- status: deterministic execution artifact",
    "- purpose: canonical registry of city-opening channels/accounts, not proof that each one is already live",
    "",
    "| Lane | Channel class | Account label | Status | Approval | Owner | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...input.channelAccounts.map((entry) =>
      `| ${entry.lane} | ${entry.channelClass} | ${entry.accountLabel} | ${entry.status} | ${entry.approvalState} | ${entry.ownerAgent || "none"} | ${(entry.notes || "").replace(/\|/g, "/")} |`,
    ),
  ].join("\n");
}

function renderCityOpeningSendLedgerMarkdown(input: {
  profile: CityLaunchProfile;
  sendActions: CityLaunchSendActionRecord[];
}) {
  return [
    `# ${input.profile.city} City-Opening Send Ledger`,
    "",
    "- status: deterministic execution artifact",
    "- purpose: canonical ledger of city-opening outreach/posting actions and their ready/sent/blocked state",
    "",
    "| Lane | Action type | Target | Recipient | Status | Approval | Response ingest | Owner | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...input.sendActions.map((entry) =>
      `| ${entry.lane} | ${entry.actionType} | ${entry.targetLabel} | ${entry.recipientEmail || "missing"} | ${entry.status} | ${entry.approvalState} | ${entry.responseIngestState} | ${entry.ownerAgent || "none"} | ${(entry.notes || "").replace(/\|/g, "/")} |`,
    ),
  ].join("\n");
}

function renderCityOpeningExecutionReportMarkdown(input: {
  profile: CityLaunchProfile;
  channelAccounts: CityLaunchChannelAccountRecord[];
  sendActions: CityLaunchSendActionRecord[];
  outboundReadiness: CityLaunchOutboundReadiness;
}) {
  const channelsReady = input.channelAccounts.filter((entry) =>
    ["ready_to_create", "created"].includes(entry.status),
  ).length;
  const sendsReady = input.sendActions.filter((entry) =>
    ["ready_to_send", "sent"].includes(entry.status),
  ).length;
  const sendsSent = input.sendActions.filter((entry) => entry.status === "sent").length;
  const sendsBlocked = input.sendActions.filter((entry) => entry.status === "blocked").length;
  const responsesRouted = input.sendActions.filter((entry) =>
    ["routed", "closed"].includes(entry.responseIngestState),
  ).length;
  const currentBlockers = input.sendActions.filter((entry) =>
    entry.status === "blocked" || (entry.actionType === "direct_outreach" && !entry.recipientEmail),
  );

  return [
    `# ${input.profile.city} City-Opening Execution Report`,
    "",
    "- status: generated execution snapshot",
    "- purpose: show what is ready, what is live, and what is still blocked in city-opening execution",
    "",
    `- channels_ready_or_created: ${channelsReady}`,
    `- sends_ready_or_sent: ${sendsReady}`,
    `- sends_marked_sent: ${sendsSent}`,
    `- sends_blocked: ${sendsBlocked}`,
    `- responses_routed: ${responsesRouted}`,
    `- outbound_readiness_status: ${input.outboundReadiness.status}`,
    "",
    "## Interpretation",
    "- `ready_to_create` means the channel/account is planned and not yet auto-opened for a launch lane.",
    "- `ready_to_send` means the outreach is eligible for autonomous dispatch when a real recipient exists and transport is available.",
    "- `sent` means a real send/post has been recorded in the send ledger.",
    "- response ingest stays in the send ledger until the reply-conversion lane routes it onward.",
    "",
    "## Outbound readiness",
    `- direct_outreach_total: ${input.outboundReadiness.directOutreachActions.total}`,
    `- direct_outreach_recipient_backed: ${input.outboundReadiness.directOutreachActions.recipientBacked}`,
    `- email_transport_configured: ${input.outboundReadiness.emailTransport.configured}`,
    `- city_launch_sender: ${input.outboundReadiness.sender.fromEmail || "missing"}`,
    ...(input.outboundReadiness.status === "blocked"
      ? [
          `- ${input.profile.shortLabel} may be activated operationally, but it is not outwardly addressable yet.`,
        ]
      : []),
    ...(input.outboundReadiness.blockers.length > 0
      ? [
          "",
          "### Outbound blockers",
          ...input.outboundReadiness.blockers.map((blocker) => `- ${blocker}`),
        ]
      : []),
    ...(input.outboundReadiness.warnings.length > 0
      ? [
          "",
          "### Outbound warnings",
          ...input.outboundReadiness.warnings.map((warning) => `- ${warning}`),
        ]
      : []),
    ...(currentBlockers.length > 0
      ? [
          "",
          "## Current blockers",
          ...currentBlockers.map((entry) => {
            const reasons = [
              entry.actionType === "direct_outreach" && !entry.recipientEmail
                ? "missing real recipient email"
                : null,
              entry.notes || null,
            ]
              .filter(Boolean)
              .join(" ");
            return `- ${entry.id}: ${reasons || "blocked without a recorded reason."}`;
          }),
        ]
      : []),
  ].join("\n");
}

function renderRobotTeamContactListMarkdown(input: {
  profile: CityLaunchProfile;
  buyerTargets: CityLaunchBuyerTargetRecord[];
  sendActions: CityLaunchSendActionRecord[];
}) {
  const robotTeamSendActions = input.sendActions.filter((entry) =>
    entry.actionType === "direct_outreach"
    && ["warehouse-facility-direct", "buyer-linked-site"].includes(entry.lane),
  );
  const evidencedContacts = robotTeamSendActions.filter((entry) => entry.recipientEmail);
  const buyerRows = input.buyerTargets
    .slice()
    .sort((left, right) => left.companyName.localeCompare(right.companyName))
    .map((buyerTarget) => {
      const matchedSendAction = evidencedContacts.find((entry) =>
        buyerTargetMatchesSendAction(buyerTarget, entry),
      );
      return `| ${buyerTarget.companyName} | ${buyerTarget.workflowFit || "unknown"} | ${buyerTarget.proofPath || "unknown"} | ${matchedSendAction?.recipientEmail || "missing"} | ${(buyerTarget.notes || "").replace(/\|/g, "/")} |`;
    });

  return [
    `# ${input.profile.city} Robot-Team Contact List`,
    "",
    "- status: generated working contact-finding artifact",
    "- scope: robot-team buyers, integrators, and technical deployment targets only",
    "- evidence boundary: repo/live evidence first; no invented emails or roles",
    "",
    "## Live recipient evidence already present",
    ...(evidencedContacts.length > 0
      ? [
          "| Target | Recipient email | Lane | Source |",
          "| --- | --- | --- | --- |",
          ...evidencedContacts.map((entry) =>
            `| ${entry.targetLabel} | ${entry.recipientEmail} | ${entry.lane} | live send-action or delivery evidence in the city-launch ledger |`,
          ),
        ]
      : ["- no live robot-team recipient emails are present yet in the city-launch ledger"]),
    "",
    "## Current buyer target set",
    ...(buyerRows.length > 0
      ? [
          "| Company | Workflow fit | Proof path | Real recipient email present now | Notes |",
          "| --- | --- | --- | --- | --- |",
          ...buyerRows,
        ]
      : ["- no city-specific buyer targets are materialized yet"]),
  ].join("\n");
}

function renderSiteOperatorContactListMarkdown(input: {
  profile: CityLaunchProfile;
  prospects: CityLaunchProspectRecord[];
}) {
  const operatorProspects = input.prospects
    .filter((entry) =>
      ["operator_intro", "property_owner_path"].includes(entry.channel)
      || /(operator|owner|tenant|warehouse)/i.test(entry.channel)
      || /(operator|owner|tenant|pilot-host|lawful-access)/i.test(entry.notes || "")
      || /(warehouse|property_owner_path)/i.test(entry.siteCategory || ""),
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  return [
    `# ${input.profile.city} Site-Operator And Pilot-Host Contact List`,
    "",
    "- status: generated working contact-finding artifact",
    "- scope: property-owner, logistics-operator, tenant, and pilot-host paths only",
    "- evidence boundary: repo/live evidence first; no invented emails or permission claims",
    "",
    "## Current site-side candidates",
    ...(operatorProspects.length > 0
      ? [
          "| Candidate | Channel | Site address | Real recipient email present now | Workflow fit | Notes |",
          "| --- | --- | --- | --- | --- | --- |",
          ...operatorProspects.map((entry) =>
            `| ${entry.name} | ${entry.channel} | ${entry.siteAddress || "unknown"} | ${entry.email || "missing"} | ${entry.workflowFit || "unknown"} | ${((entry.priorityNote || entry.notes || "")).replace(/\|/g, "/")} |`,
          ),
        ]
      : ["- no site-operator or pilot-host candidates are materialized yet"]),
  ].join("\n");
}

function hasVerifiedBuyerProofAsset(research: CityLaunchResearchParseResult | null) {
  const metrics = research?.activationPayload?.metricsDependencies || [];
  return metrics.some((entry) =>
    (entry.key === "proof_pack_delivered"
      || entry.key === "hosted_review_ready"
      || entry.key === "hosted_review_started")
    && entry.status === "verified",
  );
}

export function buildCityExecutionTasks(profile: CityLaunchProfile): CityLaunchTask[] {
  return [
    {
      key: "city-target-ledger",
      phase: "founder_gates",
      title: `Maintain the ${profile.shortLabel} capture target ledger`,
      ownerLane: "city-demand-agent",
      humanLane: "growth-lead",
      purpose: `Rank which ${profile.shortLabel} sites and site clusters should be captured first based on current robot workflow focus, buyer value, and access realism.`,
      inputs: [
        profile.demandPlaybookPath,
        "robot-team-demand-playbook.md",
        `${profile.shortLabel} capture target ledger`,
      ],
      dependencies: [],
      doneWhen: [
        `The ${profile.shortLabel} target ledger names the first proof candidates, queued lawful-access buckets, and longer-horizon discovery lanes.`,
        "Capture priorities stay tied to current robot workflow demand and lawful access realism instead of generic city coverage.",
      ],
      humanGate: "Automatic policy block only when a target requires a sensitive operator lane, unsupported rights/privacy handling, or posture-changing outbound motion.",
      metricsDependencies: ["first_lawful_access_path"],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "parallel-lawful-access-queue",
      phase: "founder_gates",
      title: `Maintain the ${profile.shortLabel} parallel lawful-access queue`,
      ownerLane: "city-demand-agent",
      humanLane: "growth-lead",
      purpose: `Keep a multi-site lawful-access queue active so ${profile.shortLabel} warehouse and facility work does not stall on a single signature path.`,
      inputs: [
        profile.targetLedgerPath,
        profile.launchPlaybookPath,
        "buyer-linked exact-site requests",
        "site access path notes",
      ],
      dependencies: ["city-target-ledger"],
      doneWhen: [
        `${profile.shortLabel} keeps 3-5 named lawful-access candidates or buyer-linked fallback sites queued in parallel, with one current next step per candidate.`,
        "If one warehouse stalls, another named access path is ready without restarting city planning from zero.",
        "Each queued candidate names the current access posture, likely owner/operator/tenant path, and whether the next move belongs to buyer thread, operator intro, or existing lawful access.",
      ],
      humanGate:
        "Automatic policy block only when the next candidate requires a posture-changing operator motion or unsupported rights/privacy handling.",
      metricsDependencies: ["first_lawful_access_path"],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "growth-source-policy",
      phase: "founder_gates",
      title: `Lock ${profile.shortLabel} source policy and invite/access-code posture`,
      ownerLane: "growth-lead",
      humanLane: "growth-lead",
      purpose: `Keep ${profile.shortLabel} sourcing narrow, truthful, and fully autonomous inside written policy while explicitly distinguishing private controlled interiors from public, non-controlled commercial capture.`,
      inputs: [
        profile.launchPlaybookPath,
        "capturer-supply-playbook.md",
        `${profile.shortLabel} autonomous launch posture`,
      ],
      dependencies: [],
      doneWhen: [
        `${profile.shortLabel} source policy names allowed channels, disallowed channels, referral rules, and who may issue invites or access codes.`,
        `${profile.shortLabel} source policy makes public, non-controlled commercial community sourcing explicit while keeping private controlled interiors on stricter lawful-access paths.`,
        `${profile.shortLabel} source policy names the online habitats for the public commercial lane instead of leaving community sourcing abstract.`,
        "Routine invite/access-code decisions stay with Growth Lead and Ops Lead inside written guardrails.",
      ],
      humanGate: `Automatic policy block only if the plan expands spend, public posture, or channel scope beyond the bounded ${profile.shortLabel} pilot.`,
      metricsDependencies: [],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "city-opening-distribution",
      phase: "founder_gates",
      title: `Build the ${profile.shortLabel} city-opening distribution brief and channel map`,
      ownerLane: "city-launch-agent",
      humanLane: "growth-lead",
      purpose: `Make ${profile.shortLabel} city opening explicit before the system expects replies: define who needs to hear about Blueprint in the city, what proof-led message each lane gets, which channels are in scope, what is out of scope, and how replies should route back into Blueprint.`,
      inputs: [
        profile.launchPlaybookPath,
        profile.demandPlaybookPath,
        profile.targetLedgerPath,
        `${profile.shortLabel} source policy`,
      ],
      dependencies: ["city-target-ledger", "growth-source-policy"],
      doneWhen: [
        `${profile.shortLabel} city-opening brief exists with a warehouse/facility direct-awareness track and a bounded public-commercial community-awareness track.`,
        `${profile.shortLabel} channel map names the target audience, named channel or channel class, proof posture, exact CTA, and what is allowed versus out of scope for each lane.`,
        `${profile.shortLabel} distribution brief tells people who Blueprint is, what the city launch is trying to source, what spaces are in scope, what is not allowed, and what counts as a qualified reply.`,
        `${profile.shortLabel} distribution brief names the CTA path and source-tagging rules needed for later intake and response tracking.`,
      ],
      humanGate:
        "Automatic policy block only when the brief would expand channel classes, blur lawful-access boundaries, or make posture-changing public claims.",
      metricsDependencies: [],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "city-opening-cta-routing",
      phase: "founder_gates",
      title: `Publish the ${profile.shortLabel} city-facing CTA and intake routing path`,
      ownerLane: "ops-lead",
      humanLane: "ops-lead",
      purpose: `Ensure ${profile.shortLabel} awareness work routes into a live intake path instead of scattering replies across ad hoc inboxes, notes, or untracked side conversations.`,
      inputs: [
        `${profile.shortLabel} city-opening brief`,
        `${profile.shortLabel} intake rubric`,
        "live capturer intake path",
        "city launch ledgers",
      ],
      dependencies: ["city-opening-distribution", "ops-rubric-thresholds"],
      doneWhen: [
        `${profile.shortLabel} warehouse/facility direct-awareness replies and public-commercial community replies both land in a named CTA path with city, lane, source, and owner routing.`,
        `${profile.shortLabel} CTA path states what Blueprint is asking for, what access or site facts respondents must provide, and what the next review step is.`,
        "Responses do not die in personal inboxes or draft docs; they enter the canonical intake queue or ledger path with next-owner visibility.",
      ],
      humanGate: null,
      metricsDependencies: [],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "city-opening-first-wave-pack",
      phase: "supply",
      title: `Assemble the ${profile.shortLabel} first-wave outreach and posting pack`,
      ownerLane: "capturer-growth-agent",
      humanLane: "growth-lead",
      purpose: `Turn the ${profile.shortLabel} city-opening brief into concrete first-wave assets that can create the first responses: direct named outreach for warehouse/facility awareness and small bounded posting packages for public-commercial awareness.`,
      inputs: [
        `${profile.shortLabel} city-opening brief`,
        `${profile.shortLabel} channel map`,
        `${profile.shortLabel} CTA / intake path`,
        profile.targetLedgerPath,
      ],
      dependencies: ["city-opening-distribution", "city-opening-cta-routing"],
      doneWhen: [
        `${profile.shortLabel} warehouse/facility first-wave outreach pack names the first buyers, operators, integrators, or facilities to contact, the proof-led message variants, and the next move per target.`,
        `${profile.shortLabel} public-commercial first-wave posting pack names the first small community placements, the public-area-only brief, and the exact CTA copy for each placement.`,
        `Every ${profile.shortLabel} first-wave asset points to the same truthful CTA path, uses source attribution, and avoids invented traction, blanket permission claims, or fake legal certainty.`,
      ],
      humanGate:
        "Automatic policy block before any send, post, or expansion that outruns the written city-opening brief.",
      metricsDependencies: [],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "site-operator-partnership",
      phase: "founder_gates",
      title: `Run ${profile.shortLabel} site-operator partnership routing`,
      ownerLane: "site-operator-partnership-agent",
      humanLane: "growth-lead",
      purpose: `Prepare the operator-side access path for ${profile.shortLabel} warehouses and facilities by identifying contacts, operator value props, approval sequence, and escalation boundaries before the city waits on a single site.`,
      inputs: [
        "ops/paperclip/playbooks/site-operator-access-and-commercialization-playbook.md",
        profile.launchPlaybookPath,
        profile.targetLedgerPath,
        `${profile.shortLabel} city-opening brief`,
        "parallel lawful-access queue",
      ],
      dependencies: [
        "parallel-lawful-access-queue",
        "growth-source-policy",
        "city-opening-distribution",
      ],
      doneWhen: [
        `${profile.shortLabel} operator-lane packet identifies likely owner/operator/tenant contacts, operator-side value props, and the exact approval sequence for the highest-priority warehouse/facility candidates.`,
        "The first operator-outreach draft or intro packet is ready before the lane reaches a policy or evidence block.",
        "Open questions and escalation boundaries are explicit before live operator outreach begins.",
      ],
      humanGate:
        "Automatic policy block before live operator outreach that lacks a written access, commercialization, privacy, consent, or legal basis.",
      metricsDependencies: ["first_lawful_access_path"],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "ops-rubric-thresholds",
      phase: "founder_gates",
      title: `Publish ${profile.shortLabel} intake rubric, trust kit, and first-capture thresholds`,
      ownerLane: "ops-lead",
      humanLane: "ops-lead",
      purpose: `Give Intake, Field Ops, QA, and Rights lanes explicit ${profile.shortLabel} rules so they can run without founder review.`,
      inputs: [
        profile.launchPlaybookPath,
        "capturer-trust-packet-stage-gate-standard.md",
        "field-ops-first-assignment-site-facing-trust-gate.md",
      ],
      dependencies: ["growth-source-policy"],
      doneWhen: [
        `${profile.shortLabel} rubric covers source quality, access-path truth, equipment/device fit, trust-packet minimums, and approval outcomes.`,
        `${profile.shortLabel} first-capture thresholds and trust-kit checklist exist in one operator packet.`,
      ],
      humanGate: null,
      metricsDependencies: [],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "supply-prospects",
      phase: "supply",
      title: `Build the ${profile.shortLabel} capturer prospect list and post package`,
      ownerLane: "capturer-growth-agent",
      humanLane: "growth-lead",
      purpose: `Generate the first ${profile.shortLabel} curated professional supply wave for private controlled interiors and buyer-linked exact-site paths, then push the first real prospect or invite response into the live intake path without widening into generic gig-market posture.`,
      inputs: [
        "capturer-supply-playbook.md",
        profile.launchPlaybookPath,
        `${profile.shortLabel} source policy`,
        `${profile.shortLabel} city-opening brief`,
        `${profile.shortLabel} first-wave outreach pack`,
        "live capturer intake path",
      ],
      dependencies: [
        "city-target-ledger",
        "growth-source-policy",
        "city-opening-first-wave-pack",
        "city-opening-cta-routing",
      ],
      doneWhen: [
        `A curated first-wave ${profile.shortLabel} professional prospect set is named with source bucket, rationale, lawful access posture, and next move.`,
        `At least one real ${profile.shortLabel} invite, reply, or applicant signal is landed in the live intake path with source bucket and next owner recorded.`,
        "Any copy stays draft-first and preserves no-guarantee capture language.",
      ],
      humanGate: `Automatic policy block only for unsupported rights/privacy handling or posture-changing source-policy changes beyond the approved ${profile.shortLabel} launch posture.`,
      metricsDependencies: [],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "public-commercial-community-sourcing",
      phase: "supply",
      title: `Run ${profile.shortLabel} public-commercial community sourcing`,
      ownerLane: "capturer-growth-agent",
      humanLane: "growth-lead",
      purpose: `Open a bounded online-community sourcing lane for public, non-controlled commercial locations such as groceries, retail stores, and similar walk-in sites, and turn that lane into real intake signals.`,
      inputs: [
        "capturer-supply-playbook.md",
        profile.launchPlaybookPath,
        `${profile.shortLabel} source policy`,
        `${profile.shortLabel} city-opening brief`,
        `${profile.shortLabel} first-wave posting pack`,
        "public-area-only capture brief",
        "live capturer intake path",
      ],
      dependencies: [
        "growth-source-policy",
        "city-opening-first-wave-pack",
        "city-opening-cta-routing",
      ],
      doneWhen: [
        `${profile.shortLabel} public-commercial sourcing names the online communities, channels, and posting brief for public, non-controlled commercial capture.`,
        `At least one live ${profile.shortLabel} community-sourced invite, reply, or applicant signal is landed in the intake path with source bucket and public-commercial posture recorded.`,
        "If no automated publication connector exists, the lane still produces a complete agent-owned posting pack and does not block the automated launch path.",
        "The lane stays explicitly limited to lawful public areas and preserves privacy, signage, and provenance rules.",
      ],
      humanGate: null,
      metricsDependencies: [],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "supply-qualification",
      phase: "supply",
      title: `Route ${profile.shortLabel} applicants into qualification and approval`,
      ownerLane: "intake-agent",
      humanLane: "ops-lead",
      purpose: `Classify ${profile.shortLabel} applicants using the approved rubric instead of ad hoc founder review, and resume immediately once the first live invite or applicant signal lands.`,
      inputs: [
        `${profile.shortLabel} intake rubric`,
        "waitlistSubmissions",
        "capturer signup records",
        "capturer invite replies / live intake responses",
      ],
      dependencies: ["ops-rubric-thresholds"],
      doneWhen: [
        `${profile.shortLabel} applicants are tagged by source bucket, approval state, and missing-trust evidence.`,
        "Exceptions are blocked with explicit missing facts instead of silently held.",
        "If no live applicant signal exists yet, the lane is left blocked as a missing live signal rather than quietly waiting.",
      ],
      humanGate: "Automatic policy block only when the rubric is ambiguous or the application raises unsupported rights/privacy/trust conditions.",
      metricsDependencies: ["first_approved_capturer"],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "capturer-activation-success",
      phase: "supply",
      title: `Own approved ${profile.shortLabel} capturers through onboarding and repeat-ready`,
      ownerLane: "capturer-success-agent",
      humanLane: "ops-lead",
      purpose: `Give every approved ${profile.shortLabel} mapper one routine relationship owner from approval through onboarding, first pass, and repeat-readiness so the founder is not the default support lane.`,
      inputs: [
        `${profile.shortLabel} intake rubric`,
        `${profile.shortLabel} trust kit`,
        "field assignment and reminder state",
        "capture QA evidence",
      ],
      dependencies: ["ops-rubric-thresholds", "supply-qualification"],
      doneWhen: [
        `Each approved ${profile.shortLabel} capturer has a named lifecycle owner for approved -> onboarded -> first capture -> first pass -> repeat-ready.`,
        "Routine mapper questions, support, and coaching stay with capturer-success-agent unless they become logistics, QA, rights, privacy, or policy exceptions.",
      ],
      humanGate: "Automatic policy block only when routine support exposes a threshold, rights, privacy, payout, or policy exception.",
      metricsDependencies: ["first_approved_capturer", "first_completed_capture"],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "first-capture-routing",
      phase: "supply",
      title: `Assign ${profile.shortLabel} first captures, reminders, and site-facing trust prep`,
      ownerLane: "field-ops-agent",
      humanLane: "ops-lead",
      purpose: `Turn approved ${profile.shortLabel} capturers into real first captures inside bounded thresholds.`,
      inputs: [
        `${profile.shortLabel} first-capture thresholds`,
        "capture_jobs",
        "field-ops-first-assignment-site-facing-trust-gate.md",
      ],
      dependencies: ["supply-qualification", "capturer-activation-success"],
      doneWhen: [
        `Approved ${profile.shortLabel} capturers receive assignment, reminder, and site-facing trust steps through the existing field-ops lane.`,
        "Travel, timing, and access blockers are explicit on the issue and visible in the admin queue.",
      ],
      humanGate: "Automatic policy block only for missing site access, ambiguous permissions, or threshold exceptions.",
      metricsDependencies: ["first_completed_capture"],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "capture-qa",
      phase: "proof_assets",
      title: `QA ${profile.shortLabel} first captures and route recapture decisions`,
      ownerLane: "capture-qa-agent",
      humanLane: "ops-lead",
      purpose: `Ensure ${profile.shortLabel} proof assets are real, clean, and ready for buyer proof work.`,
      inputs: ["pipeline artifacts", "capture QA evidence"],
      dependencies: ["first-capture-routing"],
      doneWhen: [
        `${profile.shortLabel} captures receive PASS, BORDERLINE, or FAIL with explicit evidence.`,
        "Recapture instructions are attached when the first pass is not proof-ready.",
      ],
      humanGate: null,
      metricsDependencies: ["first_qa_passed_capture"],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "rights-clearance",
      phase: "proof_assets",
      title: `Clear rights, provenance, and privacy on ${profile.shortLabel} proof assets`,
      ownerLane: "rights-provenance-agent",
      humanLane: "designated-human-rights-reviewer",
      purpose: `Make ${profile.shortLabel} proof packs releasable without weakening trust boundaries.`,
      inputs: [
        "pipeline compliance artifacts",
        "site-facing trust evidence",
        "rights/provenance checklist",
      ],
      dependencies: ["capture-qa"],
      doneWhen: [
        `Each ${profile.shortLabel} proof asset is marked CLEARED, BLOCKED, or NEEDS-REVIEW with evidence citations.`,
        "Policy-setting exceptions stay blocked until repo policy and supporting evidence are updated.",
      ],
      humanGate: "Automatic rights/provenance policy block for sensitive or precedent-setting privacy, rights, or commercialization questions.",
      metricsDependencies: ["first_rights_cleared_proof_asset"],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "proof-pack-listings",
      phase: "proof_assets",
      title: `Assemble ${profile.shortLabel} proof packs and publish 1-2 proof-ready listings`,
      ownerLane: "buyer-solutions-agent",
      humanLane: "ops-lead",
      purpose: `Turn ${profile.shortLabel} captures into concrete exact-site proof assets with a hosted-review path.`,
      inputs: [
        `CLEARED ${profile.shortLabel} proof assets`,
        "robot-team-demand-playbook.md",
        "proof-path-ownership-contract.md",
      ],
      dependencies: ["city-target-ledger", "rights-clearance"],
      doneWhen: [
        `At least one ${profile.shortLabel} proof-ready listing or equivalent proof pack exists with exact-site versus adjacent-site labeling.`,
        "Each proof pack includes provenance, coverage boundaries, hosted-review path, and next-step guidance.",
      ],
      humanGate: "Automatic policy block only when a buyer-visible claim would outrun the underlying evidence or commercial scope.",
      metricsDependencies: ["proof_pack_delivered", "first_proof_pack_delivery"],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "buyer-target-research",
      phase: "demand",
      title: `Research ${profile.shortLabel} robot-company target accounts and buyer clusters`,
      ownerLane: "demand-intel-agent",
      humanLane: "growth-lead",
      purpose: `Build a real ${profile.shortLabel} demand list that matches the proof assets Blueprint can actually show.`,
      inputs: [
        profile.demandPlaybookPath,
        "robot-team-demand-playbook.md",
        `${profile.shortLabel} proof-ready listings`,
      ],
      dependencies: ["proof-pack-listings"],
      doneWhen: [
        `A named ${profile.shortLabel} buyer target set is researched with facility/workflow fit and proof-path notes.`,
        "Exact-site versus adjacent-site proof rules are explicit per target.",
      ],
      humanGate: null,
      metricsDependencies: ["robot_team_inbound_captured", "proof_path_assigned"],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "outbound-package",
      phase: "demand",
      title: `Prepare ${profile.shortLabel} proof-led outbound package and first touches`,
      ownerLane: "robot-team-growth-agent",
      humanLane: "growth-lead",
      purpose: `Make outbound specific to ${profile.shortLabel} proof assets and hosted review instead of generic AI messaging.`,
      inputs: [
        "buyer-target-research",
        `${profile.shortLabel} proof packs`,
        "standard commercial handoff rules",
      ],
      dependencies: ["buyer-target-research"],
      doneWhen: [
        `${profile.shortLabel} outbound templates lead with one site, one workflow lane, proof-led CTA, and hosted-review next step.`,
        "First proof-led touches are prepared for autonomous dispatch inside the approved launch posture.",
      ],
      humanGate: "Automatic policy block only for unsupported rights/privacy handling, posture-changing claims, or non-standard commercial commitments beyond the approved launch posture.",
      metricsDependencies: ["proof_path_assigned"],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "outbound-execution",
      phase: "demand",
      title: `Run ${profile.shortLabel} outbound and move serious buyers into hosted review`,
      ownerLane: "outbound-sales-agent",
      humanLane: "growth-lead",
      purpose: `Convert named ${profile.shortLabel} targets into serious proof conversations without dragging the founder into routine work.`,
      inputs: ["approved outbound package", `${profile.shortLabel} buyer target list`],
      dependencies: ["outbound-package"],
      doneWhen: [
        `${profile.shortLabel} buyer conversations are active with explicit next steps.`,
        "At least one hosted proof review is run end to end or clearly blocked with named reasons.",
      ],
      humanGate: "Automatic policy block only for posture changes, non-standard terms, or sensitive rights/privacy questions.",
      metricsDependencies: [
        "hosted_review_ready",
        "hosted_review_started",
        "hosted_review_follow_up_sent",
        "proof_motion_stalled",
        "first_hosted_review",
      ],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "buyer-thread-commercial",
      phase: "commercial",
      title: `Keep ${profile.shortLabel} buyer threads inside standard commercial handling`,
      ownerLane: "revenue-ops-pricing-agent",
      humanLane: "designated-human-commercial-owner",
      purpose: "Prevent routine pricing and packaging questions from escalating to founder review.",
      inputs: [
        `${profile.shortLabel} buyer conversations`,
        `${profile.shortLabel} proof packs`,
        "revenue-ops-pricing-agent-program.md",
      ],
      dependencies: ["outbound-execution"],
      doneWhen: [
        `Standard ${profile.shortLabel} quote bands, discount guardrails, and handoff thresholds are documented and used.`,
        "Only terms inside the written quote bands proceed automatically; anything else stays blocked until the quote policy changes.",
      ],
      humanGate: "Automatic commercial policy block whenever proposed terms fall outside the written standard quote bands.",
      metricsDependencies: [
        "human_commercial_handoff_started",
        "first_human_commercial_handoff",
      ],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "city-opening-response-tracking",
      phase: "measurement",
      title: `Publish ${profile.shortLabel} city-opening response tracking`,
      ownerLane: "analytics-agent",
      humanLane: "growth-lead",
      purpose: `Make ${profile.shortLabel} city-opening distribution measurable so operators can see which awareness lanes actually create replies before deeper capture or buyer workflows take over.`,
      inputs: [
        `${profile.shortLabel} city-opening brief`,
        `${profile.shortLabel} CTA / intake path`,
        "growth_events",
        "city launch ledgers",
      ],
      dependencies: ["city-opening-cta-routing", "city-opening-first-wave-pack"],
      doneWhen: [
        `${profile.shortLabel} response-tracking view shows which warehouse/facility channels and which public-commercial community channels were activated, with asset or message attribution where available.`,
        `A real ${profile.shortLabel} city-opening response is defined and counted only when a reply, applicant, referral, operator callback, or buyer callback is recorded with city, lane, source, and CTA attribution.`,
        "Missing attribution or missing visibility is called out explicitly instead of assuming awareness work happened.",
      ],
      humanGate: null,
      metricsDependencies: [],
      validationRequired: true,
      source: "default_task_bundle",
    },
    {
      key: "city-opening-reply-conversion",
      phase: "supply",
      title: `Run the ${profile.shortLabel} city-opening reply-conversion and follow-up cadence lane`,
      ownerLane: "city-launch-agent",
      humanLane: "growth-lead",
      purpose: `Convert live ${profile.shortLabel} city-opening replies across warehouse/facility and public-commercial channels into routed next steps with explicit follow-up cadence, instead of letting first responses decay across scattered threads.`,
      inputs: [
        `${profile.shortLabel} city-opening brief`,
        `${profile.shortLabel} CTA / intake path`,
        `${profile.shortLabel} response-tracking view`,
        "live city-opening replies",
        "city launch ledgers",
      ],
      dependencies: ["city-opening-response-tracking", "city-opening-cta-routing"],
      doneWhen: [
        `${profile.shortLabel} reply-conversion queue exists with each live response tagged by responder type, channel, current status, next owner, next follow-up due, and downstream handoff target.`,
        `${profile.shortLabel} follow-up cadence rules define first response, second follow-up, stale-response handling, and the handoff boundary into qualification, site-operator partnership, buyer handling, or no-fit closure.`,
        `At least one live ${profile.shortLabel} city-opening response is moved through the queue into qualification, operator/buyer handoff, blocked-with-reason, or explicit no-fit / closed-lost outcome.`,
        "Live responses do not sit unowned after landing; each one has an explicit next step and cadence state.",
      ],
      humanGate:
        "Automatic policy block only when follow-up would require posture-changing claims, unsupported rights/privacy promises, pricing or commercial commitments outside policy, legal interpretation, or blanket permission language.",
      metricsDependencies: [],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "city-scorecard",
      phase: "measurement",
      title: `Publish the ${profile.shortLabel} launch scorecard and blocker view`,
      ownerLane: "analytics-agent",
      humanLane: "growth-lead",
      purpose: `Make ${profile.shortLabel} progress measurable and reviewable without relying on narrative updates.`,
      inputs: [
        "growth_events",
        "inboundRequests.ops.proof_path",
        "city launch ledgers",
        `published ${profile.shortLabel} proof assets`,
      ],
      dependencies: [
        "supply-qualification",
        "proof-pack-listings",
        "outbound-execution",
        "city-opening-response-tracking",
        "city-opening-reply-conversion",
      ],
      doneWhen: [
        `${profile.shortLabel} scorecard reports supply and demand progress against the launch thresholds.`,
        "Missing instrumentation is surfaced as blocked instead of smoothed over.",
      ],
      humanGate: null,
      metricsDependencies: [
        "robot_team_inbound_captured",
        "proof_path_assigned",
        "proof_pack_delivered",
        "hosted_review_ready",
        "hosted_review_started",
        "hosted_review_follow_up_sent",
        "human_commercial_handoff_started",
        "proof_motion_stalled",
      ],
      validationRequired: true,
      source: "default_task_bundle",
    },
    {
      key: "notion-breadcrumbs",
      phase: "measurement",
      title: `Mirror ${profile.shortLabel} execution artifacts into Notion Knowledge and Work Queue`,
      ownerLane: "notion-manager-agent",
      humanLane: "chief-of-staff",
      purpose: `Keep the ${profile.shortLabel} launch runnable and inspectable for humans outside the repo.`,
      inputs: [
        `${profile.shortLabel} launch system doc`,
        `${profile.shortLabel} issue bundle`,
        `${profile.shortLabel} scorecard`,
      ],
      dependencies: ["city-scorecard"],
      doneWhen: [
        `${profile.shortLabel} execution system doc is mirrored into Notion Knowledge.`,
        `A Work Queue breadcrumb exists for the current ${profile.shortLabel} activation state and next policy block.`,
      ],
      humanGate: "Automatic policy block only for ambiguous Notion identity or rights-sensitive content movement.",
      metricsDependencies: [],
      validationRequired: false,
      source: "default_task_bundle",
    },
    {
      key: "switch-on-review",
      phase: "measurement",
      title: `Run the ${profile.shortLabel} switch-on review before activation`,
      ownerLane: "beta-launch-commander",
      humanLane: "cto",
      purpose: `Confirm the software/runtime surfaces needed by the ${profile.shortLabel} launch are safe before switch-on.`,
      inputs: ["alpha:check", "alpha:preflight", `${profile.shortLabel} launch system doc`],
      dependencies: ["city-scorecard"],
      doneWhen: [
        `${profile.shortLabel} switch-on review returns GO, CONDITIONAL GO, or HOLD with evidence.`,
        "Any software/runtime blocker is routed to the right engineering lane before launch activation.",
      ],
      humanGate: "Automatic release-safety block when compliance or rights evidence is ambiguous.",
      metricsDependencies: [],
      validationRequired: false,
      source: "default_task_bundle",
    },
  ];
}

function mergeTasksWithActivationPayload(
  defaultTasks: CityLaunchTask[],
  activationPayload: ParsedCityLaunchActivationPayload | null | undefined,
) {
  if (!activationPayload) {
    return defaultTasks;
  }

  const mergedByKey = new Map<string, CityLaunchTask>(
    defaultTasks.map((task) => [task.key, task]),
  );

  for (const issueSeed of activationPayload.issueSeeds) {
    const existing = mergedByKey.get(issueSeed.key);
    const payloadTask: CityLaunchTask = existing
      ? {
          ...existing,
          title: issueSeed.title || existing.title,
          phase: issueSeed.phase,
          ownerLane: issueSeed.ownerLane,
          humanLane: issueSeed.humanLane,
          purpose: issueSeed.summary || existing.purpose,
          dependencies:
            issueSeed.dependencyKeys.length > 0
              ? issueSeed.dependencyKeys
              : existing.dependencies,
          doneWhen:
            issueSeed.successCriteria.length > 0
              ? issueSeed.successCriteria
              : existing.doneWhen,
          metricsDependencies:
            issueSeed.metricsDependencies.length > 0
              ? issueSeed.metricsDependencies
              : existing.metricsDependencies,
          validationRequired: issueSeed.validationRequired,
          source: "activation_payload",
        }
      : {
          key: issueSeed.key,
          title: issueSeed.title,
          phase: issueSeed.phase,
          ownerLane: issueSeed.ownerLane,
          humanLane: issueSeed.humanLane,
          purpose: issueSeed.summary,
          inputs: [
            "city-launch activation payload",
            "city launch system doc",
          ],
          dependencies: issueSeed.dependencyKeys,
          doneWhen: issueSeed.successCriteria,
          humanGate: issueSeed.humanLane
            ? `Human review lane: ${laneDisplayName(issueSeed.humanLane)}.`
            : null,
          metricsDependencies: issueSeed.metricsDependencies,
          validationRequired: issueSeed.validationRequired,
          source: "activation_payload",
        };
    mergedByKey.set(issueSeed.key, payloadTask);
  }

  return [...mergedByKey.values()];
}

function buildTaskMarkdown(profile: CityLaunchProfile, tasks: CityLaunchTask[]) {
  const lines: string[] = [
    `# ${profile.city} Launch Issue Bundle`,
    "",
    `This issue bundle turns the ${profile.shortLabel} playbook into executable lanes using the current Blueprint agent org.`,
    "",
  ];

  for (const task of tasks) {
    lines.push(`## ${task.title}`);
    lines.push("");
    lines.push(`- key: ${task.key}`);
    lines.push(`- phase: ${task.phase}`);
    lines.push(`- agent owner: ${task.ownerLane}`);
    lines.push(`- human owner: ${task.humanLane ?? "none"}`);
    lines.push(`- purpose: ${task.purpose}`);
    lines.push(`- policy_guardrail: ${task.humanGate ?? "none"}`);
    lines.push(`- dependencies: ${task.dependencies.length > 0 ? task.dependencies.join(", ") : "none"}`);
    lines.push(
      `- metrics dependencies: ${task.metricsDependencies.length > 0 ? task.metricsDependencies.join(", ") : "none"}`,
    );
    lines.push(`- validation required: ${task.validationRequired}`);
    lines.push(`- source: ${task.source}`);
    lines.push("- inputs:");
    for (const input of task.inputs) {
      lines.push(`  - ${input}`);
    }
    lines.push("- done when:");
    for (const item of task.doneWhen) {
      lines.push(`  - ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildSystemDocMarkdown(input: {
  profile: CityLaunchProfile;
  status: CityLaunchExecutionStatus;
  budgetPolicy: CityLaunchBudgetPolicy;
  planningState: CityLaunchPlanningState;
  founderApprovals: string[];
  sourceArtifacts: ReadSourceArtifact[];
  tasks: CityLaunchTask[];
  wideningGuard: { wideningAllowed: boolean; reasons: string[] };
  activationPayload: ParsedCityLaunchActivationPayload | null;
}) {
  const { profile } = input;
  const founderOnly = [
    `${profile.shortLabel} city expansion stays gated by proof and hosted-review milestones, not approval packets.`,
    `Any spend request beyond the written ${profile.shortLabel} ${input.budgetPolicy.label.toLowerCase()} policy is out of policy until the repo policy changes.`,
    `Any public statement that changes company posture or overstates ${profile.shortLabel} readiness is auto-blocked until supported in repo truth.`,
    "Any rights/privacy exception or non-standard commercial commitment is blocked until the written policy and evidence path are updated.",
  ];

  const operatorOwned = [
    `Growth Lead owns ${profile.shortLabel} source policy, referral posture, and invite/access-code issuance inside approved guardrails.`,
    `Ops Lead owns the ${profile.shortLabel} intake rubric, trust kit, first-capture thresholds, and launch-readiness checklist.`,
    "Standard quote bands are enforced directly from repo policy and the current proof posture.",
    "Sensitive rights/privacy questions stay blocked by policy until the written evidence path supports the action.",
  ];

  const agentPrepared = [
    `city-launch-agent keeps the ${profile.shortLabel} plan and dependency map current.`,
    `city-demand-agent maintains the ${profile.shortLabel} target ledger and parallel lawful-access queue so the capture queue stays tied to real robot workflow demand without stalling on one facility.`,
    `city-launch-agent, capturer-growth-agent, ops-lead, and analytics-agent make ${profile.shortLabel} city-opening distribution explicit through a city-opening brief, channel map, first-wave outreach/posting pack, city-facing CTA path, response-tracking view, reply-conversion cadence lane, channel registry, send ledger, and city-opening execution report before the system assumes the city has heard about Blueprint.`,
    `site-operator-partnership-agent prepares operator-lane contact maps, value props, and approval sequences for warehouse/facility access paths before the city waits on a single signature thread.`,
    `capturer-growth-agent, intake-agent, capturer-success-agent, field-ops-agent, capture-qa-agent, and rights-provenance-agent run the supply loop continuously, producing drafts, packets, routing, and prep work even before the first real-world confirmations arrive.`,
    `demand-intel-agent, robot-team-growth-agent, outbound-sales-agent, buyer-solutions-agent, and revenue-ops-pricing-agent run the demand loop continuously, packaging truthful proof motion and only pausing at irreversible claim, rights, spend, or non-standard commercial gates.`,
    `analytics-agent and notion-manager-agent keep ${profile.shortLabel} measurable, reviewable, and mirrored into the operator surfaces.`,
  ];

  const metricsTable = [
    "| Proof motion | Metric | Threshold |",
    "| --- | --- | --- |",
    "| Access | First lawful access path | required before private controlled capture dispatch |",
    "| Supply | First approved capturer | required before first assignment |",
    "| Supply | First completed capture | required before QA claims |",
    "| Supply | First QA-passed capture | required before proof-pack assembly |",
    "| Proof | First rights-cleared proof asset | required before buyer-visible proof |",
    "| Proof | First proof-pack delivery | required before hosted-review conversion analysis |",
    "| Demand | First hosted review started | required before widening |",
    "| Commercial | First human commercial handoff | required before broader commercial playbook claims |",
  ].join("\n");

  return [
    `# ${profile.city} Launch System`,
    "",
    `- city: ${profile.city}`,
    `- status: ${input.status}`,
    `- planning_state: ${formatPlanningState(input.planningState)}`,
    "- doctrine: capture-first, world-model-product-first, Exact-Site Hosted Review wedge",
    "",
    "## Objective",
    "",
    `Turn the ${profile.shortLabel} planning artifacts into an executable company harness that runs the supply loop and demand loop in one autonomy-first sweep without manual city-activation approval.`,
    "",
    "## Machine-Readable Budget Policy",
    "",
    `- budget_tier: ${input.budgetPolicy.tier}`,
    `- total_envelope_usd: ${input.budgetPolicy.maxTotalApprovedUsd}`,
    `- operator_auto_approve_usd: ${input.budgetPolicy.operatorAutoApproveUsd}`,
    `- allow_paid_acquisition: ${input.budgetPolicy.allowPaidAcquisition}`,
    `- allow_referral_rewards: ${input.budgetPolicy.allowReferralRewards}`,
    `- allow_travel_reimbursement: ${input.budgetPolicy.allowTravelReimbursement}`,
    `- founder_approval_required_above_usd: ${input.budgetPolicy.founderApprovalRequiredAboveUsd}`,
    "",
    "## What The Org Will Do",
    "",
    `1. Generate and critique the ${profile.shortLabel} plan through the existing Gemini Deep Research harness.`,
    `2. Convert the compact ${profile.shortLabel} city-launch and city-demand playbooks into a single ${profile.shortLabel} operating system with explicit tasks, owners, thresholds, and handoff rules.`,
    `3. Make city-opening distribution explicit through a city-opening brief, channel map, first-wave outreach/posting pack, exact CTA/intake routing, response tracking, reply-conversion cadence, channel registry, send ledger, and city-opening execution report so the city does not wait for replies from people who were never reached or lose the first replies once they arrive.`,
    `4. Materialize the live Paperclip issue tree for the city launch so work is routable instead of staying trapped in artifacts.`,
    `5. Measure the city through ${profile.shortLabel}-specific distribution, supply, demand, spend, and proof-motion metrics so operators can see whether the city is actually becoming operationally real.`,
    `6. Treat the machine-readable activation payload as the control-plane artifact for validation blockers, lane mapping, and metrics readiness.`,
    `7. After activation, every lane should execute all reversible work immediately and stop only at automatic policy blocks, external counterparty confirmations, or the lack of a real live signal needed to mark completion.`,
    "",
    "## Planning State",
    "",
    `- planning_status: ${input.planningState.status}`,
    `- latest_artifact: ${input.planningState.latestArtifactPath || "none"}`,
    `- completed_playbook: ${input.planningState.completedArtifactPath || "none"}`,
    ...(input.planningState.warnings.map((warning) => `- warning: ${warning}`)),
    "",
    "## Founder-Only Decisions",
    "",
    ...founderOnly.map((item) => `- ${item}`),
    "",
    "## Human Operator-Owned Decisions",
    "",
    ...operatorOwned.map((item) => `- ${item}`),
    "",
    "## Agent-Prepared / Autonomous Work",
    "",
    ...agentPrepared.map((item) => `- ${item}`),
    "",
    "## Founder Approvals Required Before Activation",
    "",
    ...input.founderApprovals.map((item) => `- ${item}`),
    "",
    `## ${profile.shortLabel} Completion Requirements`,
    "",
    `- Founder-approved ${profile.shortLabel} posture remains required to activate the city.`,
    `- ${profile.shortLabel} capture target ledger with first proof candidates, queued lawful-access buckets, and longer-horizon discovery lanes is required to mark the city operationally real, but not required to begin execution.`,
    `- ${profile.shortLabel} city-opening brief, channel map, first-wave outreach/posting pack, CTA / intake path, response-tracking view, reply-conversion cadence lane, channel/account registry, send ledger, and city-opening execution report are required to prove the city was actually opened and that early replies are being worked instead of counted and lost.`,
    `- ${profile.shortLabel} ops packet: intake rubric, trust kit, first-capture thresholds, and launch-readiness checklist is a completion dependency, not a reason to leave execution lanes idle.`,
    `- At least one clean ${profile.shortLabel} proof pack with hosted-review path and rights/provenance clearance is required before claiming the city is live.`,
    `- ${profile.shortLabel} buyer target list and proof-led outbound package are completion requirements for launch quality, not start gates for agent work.`,
    `- ${profile.shortLabel} scorecard working from live repo truth sources is required before widening or health claims.`,
    `- Machine-readable activation payload with validation blockers, issue seeds, named claims, and metrics dependencies remains the control-plane source of truth.`,
    "",
    "## Activation Payload Highlights",
    "",
    ...(input.activationPayload
      ? [
          `- city_thesis: ${input.activationPayload.cityThesis}`,
          `- primary_site_lane: ${input.activationPayload.primarySiteLane}`,
          `- primary_workflow_lane: ${input.activationPayload.primaryWorkflowLane}`,
          `- primary_buyer_proof_path: ${input.activationPayload.primaryBuyerProofPath}`,
          `- lawful_access_modes: ${input.activationPayload.lawfulAccessModes.join(", ")}`,
        ]
      : ["- No activation payload was available; treat execution posture as incomplete."]),
    "",
    "## Metrics Blockers",
    "",
    ...(input.activationPayload
      ? input.activationPayload.metricsDependencies
          .filter((entry) => entry.status !== "verified")
          .map((entry) =>
            `- ${entry.key}: ${entry.status}${entry.notes ? ` — ${entry.notes}` : ""}`,
          )
      : ["- No activation payload metrics contract is available yet."]),
    "",
    "## Expansion Guard",
    "",
    `- widening_allowed: ${input.wideningGuard.wideningAllowed}`,
    ...(input.wideningGuard.reasons.length > 0
      ? input.wideningGuard.reasons.map((item) => `- ${item}`)
      : ["- This city has met the minimum proof threshold to consider widening."]),
    "",
    "## Execution Bundle",
    "",
    ...input.tasks.map((task) =>
      `- ${task.title}: ${laneDisplayName(task.ownerLane)} owns execution, ${task.humanLane ? laneDisplayName(task.humanLane) : "no separate human owner"} is the human lane, and the task closes only when ${task.doneWhen[0]}.`,
    ),
    "",
    "## Launch Targets",
    "",
    metricsTable,
    "",
    "## How Stalls Stay Visible",
    "",
    "- If supply stalls, the scorecard must show whether the break is at source quality, signup, approval, first capture, QA, or proof-ready listing conversion.",
    "- If demand stalls, the scorecard must show whether the break is at target research, first touch, proof-pack delivery, hosted-review start, follow-up, or human commercial handoff.",
    "- If spend drifts, the budget ledger must show whether the spend was within policy and who approved it.",
    "- If a routine metric is not instrumented yet, the scorecard must say it is not tracked rather than pretending the work is healthy.",
    "- If the target ledger is stale or misaligned, city-demand-agent owns the reprioritization instead of letting capture work fan out randomly.",
    "",
    "## Source Artifacts",
    "",
    ...input.sourceArtifacts.map((artifact) => `- ${artifact.relativePath}`),
    "",
    "## Determination",
    "",
    `Existing agents are sufficient with instruction, task, and orchestration changes. No new ${profile.shortLabel}-specific permanent agent is required because the launcher now routes work into the existing city, ops, growth, buyer, and measurement lanes through a live issue tree.`,
  ].join("\n");
}

function getNotionToken() {
  return getConfiguredEnvValue("NOTION_API_TOKEN", "NOTION_API_KEY");
}

async function syncExecutionArtifactsToNotion(input: {
  profile: CityLaunchProfile;
  status: CityLaunchExecutionStatus;
  canonicalSystemDocPath: string;
  systemDocText: string;
  completedAt: string;
}) {
  const notionToken = getNotionToken();
  if (!notionToken) {
    return null;
  }

  const notionClient = createNotionClient({ token: notionToken });
  const knowledgeEntry = await upsertKnowledgeEntry(
    notionClient,
    {
      title: `${input.profile.city} Launch System`,
      type: "Reference",
      system: "WebApp",
      content: input.systemDocText,
      sourceOfTruth: "Repo",
      canonicalSource: input.canonicalSystemDocPath,
      reviewCadence: "Weekly",
      lifecycleStage:
        input.status === "founder_approved_activation_ready"
          ? "Ready"
          : "Review",
    },
    { archiveDuplicates: true },
  );

  const workQueueEntry = await upsertWorkQueueItem(
    notionClient,
    {
      title:
        input.status === "founder_approved_activation_ready"
          ? `Execute ${input.profile.city} launch harness`
          : `Review ${input.profile.city} launch harness`,
      priority: "P1",
      system: "WebApp",
      businessLane: "Growth",
      lifecycleStage: "Open",
      workType: "Task",
      lastStatusChange: input.completedAt,
      naturalKey: `city-launch-system::${slugifyCityName(input.profile.city)}`,
      substage: [
        `Status: ${input.status}`,
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

function taskIssueDescription(input: {
  profile: CityLaunchProfile;
  task: CityLaunchTask;
  executionState:
    | "ready_to_execute"
    | "execute_until_human_gate"
    | "execute_until_external_confirmation"
    | "execute_until_live_signal";
  executionReason: string;
  budgetPolicy: CityLaunchBudgetPolicy;
  artifactPaths: {
    canonicalSystemDocPath: string;
    canonicalIssueBundlePath: string;
    canonicalTargetLedgerPath: string;
    canonicalActivationPayloadPath: string;
  };
}) {
  return [
    `# ${input.task.title}`,
    "",
    `City: ${input.profile.city}`,
    `Phase: ${input.task.phase}`,
    `Agent owner: ${input.task.ownerLane} (${laneDisplayName(input.task.ownerLane)})`,
    `Human owner: ${input.task.humanLane ? `${input.task.humanLane} (${laneDisplayName(input.task.humanLane)})` : "none"}`,
    "",
    "## Purpose",
    "",
    input.task.purpose,
    "",
    "## Dependencies",
    "",
    ...(input.task.dependencies.length > 0
      ? input.task.dependencies.map((entry) => `- ${entry}`)
      : ["- none"]),
    "",
    "## Inputs",
    "",
    ...input.task.inputs.map((entry) => `- ${entry}`),
    "",
    "## Done When",
    "",
    ...input.task.doneWhen.map((entry) => `- ${entry}`),
    "",
    "## Metrics Dependencies",
    "",
    ...(input.task.metricsDependencies.length > 0
      ? input.task.metricsDependencies.map((entry) => `- ${entry}`)
      : ["- none"]),
    "",
    "## Activation Routing Status",
    "",
    `- execution_state: ${input.executionState}`,
    `- activation_reason: ${input.executionReason}`,
    "- autonomy_rule: Execute all reversible research, drafting, implementation, routing, and internal/external preparation immediately. Stop only at automatic policy blocks, external counterparty confirmations, or the absence of a real live signal required to mark the lane complete.",
    ...(input.executionState === "execute_until_external_confirmation"
      ? [
          "- completion_rule: Draft packets, routed reviews, and internal prep are progress only. Do not mark this issue done until the required external confirmation, signature, applicant, reply, or artifact actually exists.",
        ]
      : []),
    ...(input.executionState === "execute_until_live_signal"
      ? [
          "- completion_rule: Internal setup is not completion. Leave the issue open or blocked until the required live signal exists in the canonical path.",
        ]
      : []),
    "",
    "## Validation Required",
    "",
    input.task.validationRequired ? "true" : "false",
    "",
    "## Policy Guardrail",
    "",
    input.task.humanGate || "none",
    "",
    "## Machine-Readable Budget Policy",
    "",
    `- budget_tier: ${input.budgetPolicy.tier}`,
    `- total_envelope_usd: ${input.budgetPolicy.maxTotalApprovedUsd}`,
    `- operator_auto_approve_usd: ${input.budgetPolicy.operatorAutoApproveUsd}`,
    "",
    "## Canonical Artifacts",
    "",
    `- launch system: ${input.artifactPaths.canonicalSystemDocPath}`,
    `- execution issue bundle: ${input.artifactPaths.canonicalIssueBundlePath}`,
    `- target ledger: ${input.artifactPaths.canonicalTargetLedgerPath}`,
    `- activation payload: ${input.artifactPaths.canonicalActivationPayloadPath}`,
  ].join("\n");
}

function assessCityLaunchTaskExecution(task: CityLaunchTask): {
  executionState: CityLaunchTaskDispatch["executionState"];
  executionReason: string;
} {
  switch (task.key) {
    case "city-target-ledger":
    case "parallel-lawful-access-queue":
    case "growth-source-policy":
    case "city-opening-distribution":
    case "city-opening-cta-routing":
    case "site-operator-partnership":
    case "ops-rubric-thresholds":
    case "buyer-target-research":
    case "city-opening-response-tracking":
    case "city-scorecard":
    case "notion-breadcrumbs":
    case "switch-on-review":
      return {
        executionState: "ready_to_execute",
        executionReason:
          "This lane should start immediately and complete all reversible research, drafting, implementation, and internal routing work without waiting on another lane to be manually cleared first.",
      };
    case "supply-prospects":
    case "public-commercial-community-sourcing":
    case "city-opening-first-wave-pack":
    case "outbound-package":
      return {
        executionState: "ready_to_execute",
        executionReason:
          "This lane should execute now and continue through standard automated dispatch inside the approved launch posture without waiting for a routine approval step.",
      };
    case "outbound-execution":
    case "buyer-thread-commercial":
      return {
        executionState: "execute_until_live_signal",
        executionReason:
          "This lane should execute now and remain open until real buyer responses, hosted reviews, or commercial handoffs are recorded, without pausing for routine approval steps.",
      };
    case "city-opening-reply-conversion":
      return {
        executionState: "execute_until_live_signal",
        executionReason:
          "This lane should build the queue, cadence rules, and routing logic immediately, then stay open until real city-opening responses exist and are moved through a tracked follow-up path.",
      };
    case "supply-qualification":
    case "capturer-activation-success":
    case "first-capture-routing":
    case "capture-qa":
    case "rights-clearance":
    case "proof-pack-listings":
    case "lawful-access-path":
      return {
        executionState: "execute_until_external_confirmation",
        executionReason:
          "This lane should run now and push through research, packetization, routing, drafting, and prep work until it reaches the first real external confirmation, signature, applicant, capture artifact, or buyer response needed to complete the lane.",
      };
    default:
      return {
        executionState: "ready_to_execute",
        executionReason:
          "This lane should execute now; completion may still depend on external facts, but activation should not leave it idle.",
      };
  }
}

function paperclipIssueLink(identifier: string | null | undefined) {
  const normalized = String(identifier || "").trim();
  if (!normalized) {
    return null;
  }
  const prefix = normalized.split("-")[0]?.trim();
  if (!prefix) {
    return null;
  }
  return `[${normalized}](/${prefix}/issues/${normalized})`;
}

function renderDispatchLink(dispatch: Pick<CityLaunchTaskDispatch, "identifier" | "key">) {
  const link = paperclipIssueLink(dispatch.identifier);
  return link ? `${link} (${dispatch.key})` : dispatch.key;
}

function buildCityLaunchRootBlockerSummaryComment(input: {
  profile: CityLaunchProfile;
  dispatched: CityLaunchTaskDispatch[];
}) {
  const grouped = {
    ready_to_execute: input.dispatched.filter((entry) => entry.executionState === "ready_to_execute"),
    execute_until_human_gate: input.dispatched.filter(
      (entry) => entry.executionState === "execute_until_human_gate",
    ),
    execute_until_external_confirmation: input.dispatched.filter(
      (entry) => entry.executionState === "execute_until_external_confirmation",
    ),
    execute_until_live_signal: input.dispatched.filter(
      (entry) => entry.executionState === "execute_until_live_signal",
    ),
  };

  const formatGroup = (entries: CityLaunchTaskDispatch[]) =>
    entries.length > 0
      ? entries.map((entry) => `  - ${renderDispatchLink(entry)}: ${entry.executionReason}`)
      : ["  - none"];

  return [
    `Autonomy-first execution summary for ${input.profile.city}.`,
    "Activation should not leave lanes idle just because the city still lacks final proof, telemetry, or external confirmations.",
    "",
    `- Execute immediately (${grouped.ready_to_execute.length}):`,
    ...formatGroup(grouped.ready_to_execute),
    `- Execute until an automatic policy block is truly required (${grouped.execute_until_human_gate.length}):`,
    ...formatGroup(grouped.execute_until_human_gate),
    `- Execute until an external confirmation or real-world counterpart is required (${grouped.execute_until_external_confirmation.length}):`,
    ...formatGroup(grouped.execute_until_external_confirmation),
    `- Execute until a live signal exists to mark completion (${grouped.execute_until_live_signal.length}):`,
    ...formatGroup(grouped.execute_until_live_signal),
    "",
    "The remaining constraints are completion gates, not activation gates: do not fake lawful access, proof assets, hosted reviews, rights clearance, spend approvals, public claims, or non-standard commitments.",
    "All lanes should still run now and push as far as they can with research, packet drafting, implementation, routing, and truthful prep work in one continuous sweep.",
  ].join("\n");
}

function buildTaskKickoffComment(input: {
  profile: CityLaunchProfile;
  task: CityLaunchTask;
  issueId: string;
  identifier: string | null;
}) {
  return [
    `Routing ${input.task.ownerLane} to pick up ${input.task.title} for ${input.profile.city}.`,
    `Issue: ${input.identifier || input.issueId}`,
    `Why now: city-launch:activate created the bounded execution tree and this lane should run immediately in autonomy-first mode.`,
    `Next move: start from this issue, push through all reversible work now, and leave proof-bearing progress or the first true irreversible gate here.`,
    ...(input.task.key === "supply-prospects"
      ? [
          "Do not stop at list drafting alone: use the prepared prospect package and source policy to create the first real invite, reply, or applicant signal and land it in the live intake path.",
        ]
      : []),
    ...(input.task.key === "parallel-lawful-access-queue"
      ? [
          "Do not wait on one warehouse: keep multiple named access paths warm so the city can switch targets without restarting planning.",
        ]
      : []),
    ...(input.task.key === "site-operator-partnership"
      ? [
          "Prepare the operator contact map, value prop, and approval sequence now so lawful-access work is ready for review before the city hits a single-site dead end.",
        ]
      : []),
    ...(input.task.key === "city-opening-distribution"
      ? [
          "Make the city-opening brief concrete: split warehouse/facility direct awareness from bounded public-commercial awareness, define the channel map, and make the CTA path explicit before the system expects replies.",
        ]
      : []),
    ...(input.task.key === "city-opening-cta-routing"
      ? [
          "Do not let city-opening replies die in ad hoc inboxes or notes: publish the exact CTA route, source tags, and next-owner routing into the canonical intake path.",
        ]
      : []),
    ...(input.task.key === "city-opening-first-wave-pack"
      ? [
          "Optimize for first response, not polished branding: prepare the named warehouse/facility outreach variants and the first small public-commercial placements, all tied to the same truthful CTA path.",
        ]
      : []),
    ...(input.task.key === "public-commercial-community-sourcing"
      ? [
          "Name the online communities for public commercial capture, prepare the public-area-only brief, and turn the lane into the first real community-sourced intake signal without drifting into private-interior sourcing.",
        ]
      : []),
    ...(input.task.key === "city-opening-response-tracking"
      ? [
          "Define what counts as a real city-opening response and keep warehouse/facility awareness separate from public-commercial community awareness in the measurement view.",
        ]
      : []),
    ...(input.task.key === "city-opening-reply-conversion"
      ? [
          "Build the shared response queue and cadence rules now, then route the first real replies into qualification, operator/buyer handoff, or explicit blocked/no-fit outcomes instead of letting them decay in channel-specific threads.",
        ]
      : []),
    ...(input.task.key === "supply-qualification"
      ? [
          "Resume immediately when the first live invite or applicant signal lands, then tag source bucket, approval state, and missing-trust evidence.",
        ]
      : []),
    ...(input.task.key === "lawful-access-path"
      ? [
          "If the packet is only drafted and the signatures are still pending, leave the issue open or blocked rather than marking it done.",
        ]
      : []),
  ].join("\n");
}

async function wakeCityLaunchTaskOwner(input: {
  activationRunId: string;
  assigneeAgentId: string;
  companyId: string;
  profile: CityLaunchProfile;
  task: CityLaunchTask;
  issue: PaperclipIssueRecord;
  issueIdentifier: string | null;
  artifactPaths: {
    canonicalSystemDocPath: string;
    canonicalIssueBundlePath: string;
    canonicalTargetLedgerPath: string;
    canonicalActivationPayloadPath: string;
  };
}) {
  let commentConflict = false;
  try {
    await createPaperclipIssueComment(
      input.issue.id,
      buildTaskKickoffComment({
        profile: input.profile,
        task: input.task,
        issueId: input.issue.id,
        identifier: input.issueIdentifier,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!(/Paperclip 409\b/.test(message) && /bound to a different issue/i.test(message))) {
      throw error;
    }
    commentConflict = true;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await resetPaperclipAgentSession(input.assigneeAgentId, input.issue.id, input.companyId);
      const wakeResult = await wakePaperclipAgent({
        agentId: input.assigneeAgentId,
        companyId: input.companyId,
        reason: `city-launch-activate:${input.profile.key}:${input.task.key}:${input.activationRunId}`,
        idempotencyKey: `city-launch-activate:${input.profile.key}:${input.task.key}:${input.issue.id}:${input.activationRunId}`,
        payload: {
          source: "city_launch_activate",
          city: input.profile.city,
          citySlug: input.profile.key,
          issueId: input.issue.id,
          issueIdentifier: input.issueIdentifier,
          taskKey: input.task.key,
          taskTitle: input.task.title,
          ownerLane: input.task.ownerLane,
          humanLane: input.task.humanLane,
          phase: input.task.phase,
          validationRequired: input.task.validationRequired,
          dependencies: input.task.dependencies,
          canonicalSystemDocPath: input.artifactPaths.canonicalSystemDocPath,
          canonicalIssueBundlePath: input.artifactPaths.canonicalIssueBundlePath,
          canonicalTargetLedgerPath: input.artifactPaths.canonicalTargetLedgerPath,
          canonicalActivationPayloadPath: input.artifactPaths.canonicalActivationPayloadPath,
        },
      });

      return {
        wakeStatus: wakeResult?.status || null,
        wakeRunId:
          "runId" in wakeResult && typeof wakeResult.runId === "string"
            ? wakeResult.runId
            : null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        (/Paperclip 409\b/.test(message) && /bound to a different issue/i.test(message))
        || (/Paperclip 403\b/.test(message) && /Agent can only invoke itself/i.test(message));

      if (!retryable || attempt === 1) {
        if (retryable) {
          return {
            wakeStatus: commentConflict ? "skipped_existing" : "requested",
            wakeRunId: null,
          };
        }
        throw error;
      }
    }
  }

  return {
    wakeStatus: commentConflict ? "skipped_existing" : "requested",
    wakeRunId: null,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  if (items.length === 0) {
    return [] as R[];
  }

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(items[index], index);
      }
    }),
  );

  return results;
}

async function dispatchCityLaunchIssueTree(input: {
  activationRunId: string;
  profile: CityLaunchProfile;
  tasks: CityLaunchTask[];
  founderApproved: boolean;
  budgetPolicy: CityLaunchBudgetPolicy;
  existingRootIssueId?: string | null;
  existingTaskIssueIds?: Record<string, string>;
  wakeExistingIssues?: boolean;
  rewakeTaskKeys?: string[];
  rewakeOwnerLanes?: string[];
  artifactPaths: {
    canonicalSystemDocPath: string;
    canonicalIssueBundlePath: string;
    canonicalTargetLedgerPath: string;
    canonicalActivationPayloadPath: string;
  };
}) {
  const founderApproved = input.founderApproved === true;
  const rewakeTaskKeys = new Set(input.rewakeTaskKeys || []);
  const rewakeOwnerLanes = new Set(input.rewakeOwnerLanes || []);
  const rootIssueStatus = founderApproved ? "todo" : "backlog";
  const rootDescription = [
    `# Launch ${input.profile.city}`,
    "",
    `This is the root issue for the generic autonomous city launcher in ${input.profile.city}.`,
    "",
    `- founder_approved: ${founderApproved}`,
    `- budget_tier: ${input.budgetPolicy.tier}`,
    `- execution_bundle: ${input.artifactPaths.canonicalIssueBundlePath}`,
    `- launch_system: ${input.artifactPaths.canonicalSystemDocPath}`,
    `- target_ledger: ${input.artifactPaths.canonicalTargetLedgerPath}`,
    `- activation_payload: ${input.artifactPaths.canonicalActivationPayloadPath}`,
    "",
    "Route all child issues under this root so the city launch can be reviewed and executed as one bounded operating program.",
  ].join("\n");

  let root: Awaited<ReturnType<typeof upsertPaperclipIssue>>;
  try {
    root = await upsertPaperclipIssue({
      projectName: CITY_LAUNCH_PROJECT_NAME,
      assigneeKey: "growth-lead",
      title: `Launch ${input.profile.city} as a bounded city program`,
      description: rootDescription,
      priority: input.founderApproved ? "high" : "medium",
      status: rootIssueStatus,
      originKind: "city_launch_activation",
      originId: input.profile.key,
      existingIssueId: input.existingRootIssueId ?? null,
      onBoundConflict: {
        strategy: "create_fresh",
        originId: `${input.profile.key}:activation:${input.activationRunId}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Paperclip 409\b/.test(message) && /bound to a different issue/i.test(message)) {
      root = {
        companyId: "",
        projectId: null,
        assigneeAgentId: "",
        issue: {
          id: input.existingRootIssueId || "",
          identifier: null,
          status: rootIssueStatus,
        } as PaperclipIssueRecord,
        created: false,
      };
    } else {
      throw error;
    }
  }

  const dispatched = await mapWithConcurrency(
    input.tasks,
    6,
    async (task) => {
      const executionAssessment = assessCityLaunchTaskExecution(task);
      const issueStatus = founderApproved ? "todo" : "backlog";
      const existingIssueId = input.existingTaskIssueIds?.[task.key] || null;
      let issue: Awaited<ReturnType<typeof upsertPaperclipIssue>>;
      try {
        issue = await upsertPaperclipIssue({
          projectName: CITY_LAUNCH_PROJECT_NAME,
          assigneeKey: task.ownerLane,
          title: task.title,
          description: taskIssueDescription({
            profile: input.profile,
            task,
            executionState: executionAssessment.executionState,
            executionReason: executionAssessment.executionReason,
            budgetPolicy: input.budgetPolicy,
            artifactPaths: input.artifactPaths,
          }),
          priority:
            task.phase === "founder_gates" || task.phase === "measurement" ? "high" : "medium",
          status: issueStatus,
          originKind: "city_launch_task",
          originId: `${input.profile.key}:${task.key}`,
          parentId: root.issue.id,
          existingIssueId,
          onBoundConflict: {
            strategy: "create_fresh",
            originId: `${input.profile.key}:${task.key}:activation:${input.activationRunId}`,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/Paperclip 409\b/.test(message) && /bound to a different issue/i.test(message)) {
          return {
            key: task.key,
            ownerLane: task.ownerLane,
            issueId: existingIssueId || "",
            identifier: null,
            created: false,
            status: issueStatus,
            executionState: executionAssessment.executionState,
            executionReason: `${executionAssessment.executionReason} (foreign-bound issue skipped)`,
            wakeStatus: "skipped_existing",
            wakeRunId: null,
            wakeError: message,
          };
        }
        throw error;
      }
      const dispatchRecord: CityLaunchTaskDispatch = {
        key: task.key,
        ownerLane: task.ownerLane,
        issueId: issue.issue.id,
        identifier: issue.issue.identifier || null,
        created: issue.created,
        status: issue.issue.status,
        executionState: executionAssessment.executionState,
        executionReason: executionAssessment.executionReason,
        wakeStatus: null,
        wakeRunId: null,
        wakeError: null,
      };
      const shouldRewakeExistingIssue =
        input.wakeExistingIssues === true
        || rewakeTaskKeys.has(task.key)
        || rewakeOwnerLanes.has(task.ownerLane);
      const shouldAttemptWake =
        founderApproved && (issue.created || shouldRewakeExistingIssue);
      dispatchRecord.wakeStatus = shouldAttemptWake
        ? "requested"
        : founderApproved
          ? "skipped_existing"
          : "skipped";
      if (shouldAttemptWake) {
        try {
          const assigneeAgentId = issue.assigneeAgentId;
          const companyId = issue.companyId;
          if (!assigneeAgentId || !companyId) {
            throw new Error(`Paperclip issue ${issue.issue.id} is missing wakeup ownership metadata.`);
          }
          const wake = await wakeCityLaunchTaskOwner({
            activationRunId: input.activationRunId,
            assigneeAgentId,
            companyId,
            profile: input.profile,
            task,
            issue: issue.issue,
            issueIdentifier: issue.issue.identifier || null,
            artifactPaths: input.artifactPaths,
          });
          dispatchRecord.wakeStatus = wake.wakeStatus || dispatchRecord.wakeStatus;
          dispatchRecord.wakeRunId = wake.wakeRunId;
        } catch (error) {
          dispatchRecord.wakeError = error instanceof Error ? error.message : String(error);
        }
      }
      return dispatchRecord;
    },
  );

  await createPaperclipIssueComment(
    root.issue.id,
    [
      `City launch issue tree refreshed for ${input.profile.city}.`,
      `Founder-approved activation: ${founderApproved}`,
      `Task issues routed: ${dispatched.length}`,
      `Task wakeups attempted: ${dispatched.filter((entry) => entry.wakeStatus !== "skipped" && entry.wakeStatus !== "skipped_existing").length}`,
      `Canonical bundle: ${input.artifactPaths.canonicalIssueBundlePath}`,
    ].join("\n"),
  ).catch(() => undefined);

  await createPaperclipIssueComment(
    root.issue.id,
    buildCityLaunchRootBlockerSummaryComment({
      profile: input.profile,
      dispatched,
    }),
  ).catch(() => undefined);

  return {
    rootIssue: root.issue,
    createdRootIssue: root.created,
    dispatched,
  };
}

export async function runCityLaunchExecutionHarness(input: {
  city: string;
  founderApproved?: boolean;
  reportsRoot?: string;
  budgetTier?: CityLaunchBudgetTier;
  budgetMaxUsd?: number;
  operatorAutoApproveUsd?: number;
  dispatchIssues?: boolean;
  rewakeTaskKeys?: string[];
  rewakeOwnerLanes?: string[];
}) {
  const budgetPolicy = buildCityLaunchBudgetPolicy({
    tier: input.budgetTier,
    maxTotalApprovedUsd: input.budgetMaxUsd,
    operatorAutoApproveUsd: input.operatorAutoApproveUsd,
  });
  const profile = resolveCityLaunchProfile(input.city, budgetPolicy.tier);
  const autonomousActivation = input.founderApproved !== false;
  const status: CityLaunchExecutionStatus = autonomousActivation
    ? "founder_approved_activation_ready"
    : "draft_pending_founder_approval";
  const startedAt = new Date();
  const runTimestamp = timestampForFile(startedAt);
  const reportsRoot = input?.reportsRoot || DEFAULT_REPORTS_ROOT;
  const runDirectory = path.join(reportsRoot, profile.key, runTimestamp);
  const systemDocPath = path.join(runDirectory, `city-launch-system-${profile.key}.md`);
  const issueBundlePath = path.join(runDirectory, `city-launch-issue-bundle-${profile.key}.md`);
  const issueBundleJsonPath = path.join(runDirectory, `city-launch-issue-bundle-${profile.key}.json`);
  const launchPlaybookPath = path.join(runDirectory, `city-launch-${profile.key}.md`);
  const demandPlaybookPath = path.join(runDirectory, `city-demand-${profile.key}.md`);
  const targetLedgerPath = path.join(runDirectory, `city-capture-target-ledger-${profile.key}.md`);
  const targetLedgerJsonPath = path.join(runDirectory, `city-capture-target-ledger-${profile.key}.json`);
  const approvalsPath = path.join(runDirectory, "founder-approvals.md");
  const cityOpeningBriefPath = path.join(runDirectory, `city-opening-${profile.key}-brief.md`);
  const cityOpeningChannelMapPath = path.join(runDirectory, `city-opening-${profile.key}-channel-map.md`);
  const cityOpeningFirstWavePackPath = path.join(runDirectory, `city-opening-${profile.key}-first-wave-pack.md`);
  const cityOpeningCtaRoutingPath = path.join(runDirectory, `city-opening-${profile.key}-cta-routing.md`);
  const cityOpeningResponseTrackingPath = path.join(runDirectory, `city-opening-${profile.key}-response-tracking.md`);
  const cityOpeningReplyConversionPath = path.join(runDirectory, `city-opening-${profile.key}-reply-conversion.md`);
  const cityOpeningChannelRegistryPath = path.join(runDirectory, `city-opening-${profile.key}-channel-registry.md`);
  const cityOpeningSendLedgerPath = path.join(runDirectory, `city-opening-${profile.key}-send-ledger.md`);
  const cityOpeningExecutionReportPath = path.join(runDirectory, `city-opening-${profile.key}-execution-report.md`);
  const cityOpeningRobotTeamContactListPath = path.join(runDirectory, `city-opening-${profile.key}-robot-team-contact-list.md`);
  const cityOpeningSiteOperatorContactListPath = path.join(runDirectory, `city-opening-${profile.key}-site-operator-contact-list.md`);
  const researchMaterializationPath = path.join(
    runDirectory,
    `city-launch-research-materialization-${profile.key}.json`,
  );
  const contactEnrichmentPath = path.join(
    runDirectory,
    `city-launch-contact-enrichment-${profile.key}.json`,
  );
  const manifestPath = path.join(runDirectory, "manifest.json");
  const canonicalSystemDocPath = buildCanonicalSystemDocPath(profile);
  const canonicalIssueBundlePath = buildCanonicalIssueBundlePath(profile);
  const canonicalLaunchPlaybookPath = buildCanonicalLaunchPlaybookPath(profile);
  const canonicalDemandPlaybookPath = buildCanonicalDemandPlaybookPath(profile);
  const canonicalTargetLedgerPath = buildCanonicalTargetLedgerPath(profile);
  const canonicalCityOpeningBriefPath = buildCanonicalCityOpeningArtifactPath(profile, "brief");
  const canonicalCityOpeningChannelMapPath = buildCanonicalCityOpeningArtifactPath(profile, "channel-map");
  const canonicalCityOpeningFirstWavePackPath = buildCanonicalCityOpeningArtifactPath(profile, "first-wave-pack");
  const canonicalCityOpeningCtaRoutingPath = buildCanonicalCityOpeningArtifactPath(profile, "cta-routing");
  const canonicalCityOpeningResponseTrackingPath = buildCanonicalCityOpeningArtifactPath(profile, "response-tracking");
  const canonicalCityOpeningReplyConversionPath = buildCanonicalCityOpeningArtifactPath(profile, "reply-conversion");
  const canonicalCityOpeningChannelRegistryPath = buildCanonicalCityOpeningArtifactPath(profile, "channel-registry");
  const canonicalCityOpeningSendLedgerPath = buildCanonicalCityOpeningArtifactPath(profile, "send-ledger");
  const canonicalCityOpeningExecutionReportPath = buildCanonicalCityOpeningArtifactPath(profile, "execution-report");
  const canonicalCityOpeningRobotTeamContactListPath = buildCanonicalCityOpeningArtifactPath(profile, "robot-team-contact-list");
  const canonicalCityOpeningSiteOperatorContactListPath = buildCanonicalCityOpeningArtifactPath(profile, "site-operator-contact-list");
  const canonicalActivationPayloadPath = path.join(
    REPO_ROOT,
    `ops/paperclip/playbooks/city-launch-${profile.key}-activation-payload.json`,
  );
  const stepErrorPath = path.join(runDirectory, "step-error.json");
  const stepHistory: Array<{ step: string; atIso: string; note?: string }> = [];
  let currentStep = "init";

  const serializeError = (error: unknown) => ({
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "Error",
    stack: error instanceof Error ? error.stack || null : null,
  });

  const writeRuntimeManifest = async (
    finalResult?: CityLaunchExecutionResult,
    errorDetail?: ReturnType<typeof serializeError> | null,
  ) => {
    const payload = finalResult
      ? {
          ...finalResult,
          currentStep,
          stepHistory,
          error: errorDetail || null,
        }
      : {
          city: profile.city,
          citySlug: profile.key,
          status,
          founderApproved: autonomousActivation,
          startedAt: startedAt.toISOString(),
          reportsRoot,
          runDirectory,
          manifestPath,
          currentStep,
          stepHistory,
          error: errorDetail || null,
        };
    await writeTextArtifact(manifestPath, JSON.stringify(payload, null, 2));
  };

  const advanceStep = async (step: string, note?: string) => {
    currentStep = step;
    stepHistory.push({
      step,
      atIso: new Date().toISOString(),
      ...(note ? { note } : {}),
    });
    await writeRuntimeManifest();
  };

  await writeRuntimeManifest();

  try {
    await advanceStep("load_activation_state");
    const priorActivation = await readCityLaunchActivation(profile.city).catch(() => null);

    await advanceStep("resolve_planning_state");
    const planningState = await resolveCityLaunchPlanningState({ city: profile.city });

    await advanceStep("load_completed_research");
    const completedResearchEnrichment = await maybeLoadCompletedResearch({
      planningState,
      contactEnrichmentPath,
    });
    const completedResearch = completedResearchEnrichment?.parsed?.errors.length
      ? null
      : completedResearchEnrichment?.parsed || null;

    if (autonomousActivation && !planningState.completedArtifactPath) {
      throw new Error(
        `${profile.city} autonomous activation requires a completed deep-research playbook before delegation starts.`,
      );
    }

    if (
      autonomousActivation
      && completedResearchEnrichment?.parsed?.errors.length
      && completedResearchEnrichment.parsed.errors[0]
    ) {
      throw new Error(completedResearchEnrichment.parsed.errors[0]);
    }

    if (autonomousActivation && !completedResearch?.activationPayload) {
      throw new Error(
        `${profile.city} autonomous activation requires a real activation payload before delegation starts.`,
      );
    }
    const recipientBackedContactCount = countRecipientBackedFirstWaveContacts(completedResearch);
    const capabilitySnapshot = assessCityLaunchCapabilities({
      hasCompletedPlaybook: Boolean(planningState.completedArtifactPath),
      hasActivationPayload: Boolean(completedResearch?.activationPayload),
      recipientBackedContacts: recipientBackedContactCount,
      senderVerification: getCityLaunchSenderStatus().verificationStatus,
      hasRightsClearedProofAsset: false,
      hasHostedReviewStarted: false,
      hasFirehose: hasFirehoseConfigured(),
    });

    await advanceStep("build_city_artifacts");
    const tasks = mergeTasksWithActivationPayload(
      buildCityExecutionTasks(profile),
      completedResearch?.activationPayload,
    );
    const reconciledActivation = await reconcilePriorActivationIssueState({
      priorActivation,
      tasks,
    });
    const founderApprovals = buildFounderApprovals(profile, budgetPolicy);
    const targetLedger = buildCityCaptureTargetLedger({
      profile,
      research: completedResearch,
      planningState,
    });
    const targetLedgerMarkdown = renderCityCaptureTargetLedgerMarkdown(targetLedger);
    const ledgerSummary = await summarizeCityLaunchLedgers(profile.city);
    const metricsBlockers = completedResearch?.activationPayload
      ? completedResearch.activationPayload.metricsDependencies
          .filter((entry) => entry.status !== "verified")
          .map((entry) => `${entry.key} is ${entry.status}.`)
      : ["Required proof-motion analytics contract is missing from the activation payload."];
    const wideningGuard = buildCityLaunchWideningGuard({
      proofReadyListings: 0,
      hostedReviewsStarted: 0,
      approvedCapturers: 0,
      onboardedCapturers: ledgerSummary.onboardedCapturers,
      metricsReady: metricsBlockers.length === 0,
      metricBlockers: metricsBlockers,
    });
    const compactLaunchPlaybook = buildCompactLaunchPlaybookMarkdown({
      profile,
      status,
      budgetPolicy,
      planningState,
      targetLedgerMode: targetLedger.mode,
      targetLedgerWarnings: targetLedger.warnings,
      research: completedResearch,
      activationPayload: completedResearch?.activationPayload || null,
    });
    const compactDemandPlaybook = buildCompactDemandPlaybookMarkdown({
      profile,
      status,
      planningState,
      research: completedResearch,
      activationPayload: completedResearch?.activationPayload || null,
    });
    const cityOpeningBrief = buildCityOpeningBriefMarkdown({
      profile,
      research: completedResearch,
      activationPayload: completedResearch?.activationPayload || null,
    });
    const cityOpeningChannelMap = buildCityOpeningChannelMapMarkdown({
      profile,
      activationPayload: completedResearch?.activationPayload || null,
    });
    const cityOpeningFirstWavePack = buildCityOpeningFirstWavePackMarkdown({
      profile,
      research: completedResearch,
    });
    const cityOpeningCtaRouting = buildCityOpeningCtaRoutingMarkdown({
      profile,
    });
    const cityOpeningResponseTracking = buildCityOpeningResponseTrackingMarkdown({
      profile,
    });
    const cityOpeningReplyConversion = buildCityOpeningReplyConversionMarkdown({
      profile,
    });

    await writeTextArtifact(canonicalLaunchPlaybookPath, compactLaunchPlaybook);
    await writeTextArtifact(canonicalDemandPlaybookPath, compactDemandPlaybook);
    await writeTextArtifact(canonicalTargetLedgerPath, targetLedgerMarkdown);
    await writeTextArtifact(canonicalCityOpeningBriefPath, cityOpeningBrief);
    await writeTextArtifact(canonicalCityOpeningChannelMapPath, cityOpeningChannelMap);
    await writeTextArtifact(canonicalCityOpeningFirstWavePackPath, cityOpeningFirstWavePack);
    await writeTextArtifact(canonicalCityOpeningCtaRoutingPath, cityOpeningCtaRouting);
    await writeTextArtifact(canonicalCityOpeningResponseTrackingPath, cityOpeningResponseTracking);
    await writeTextArtifact(canonicalCityOpeningReplyConversionPath, cityOpeningReplyConversion);
    if (completedResearch?.activationPayload) {
      await writeTextArtifact(
        canonicalActivationPayloadPath,
        JSON.stringify(completedResearch.activationPayload, null, 2),
      );
    }

    const sourceArtifacts = await listSourceArtifacts(profile);
    if (completedResearch?.activationPayload) {
      sourceArtifacts.push({
        relativePath: path.relative(REPO_ROOT, canonicalActivationPayloadPath).replaceAll(path.sep, "/"),
        exists: true,
      });
    }
    for (const artifactPath of [
      canonicalCityOpeningBriefPath,
      canonicalCityOpeningChannelMapPath,
      canonicalCityOpeningFirstWavePackPath,
      canonicalCityOpeningCtaRoutingPath,
      canonicalCityOpeningResponseTrackingPath,
      canonicalCityOpeningReplyConversionPath,
      canonicalCityOpeningChannelRegistryPath,
      canonicalCityOpeningSendLedgerPath,
      canonicalCityOpeningExecutionReportPath,
      canonicalCityOpeningRobotTeamContactListPath,
      canonicalCityOpeningSiteOperatorContactListPath,
    ]) {
      sourceArtifacts.push({
        relativePath: path.relative(REPO_ROOT, artifactPath).replaceAll(path.sep, "/"),
        exists: true,
      });
    }
    const systemDocText = buildSystemDocMarkdown({
      profile,
      status,
      budgetPolicy,
      planningState,
      founderApprovals,
      sourceArtifacts,
      tasks,
      wideningGuard,
      activationPayload: completedResearch?.activationPayload || null,
    });
    const issueBundleText = buildTaskMarkdown(profile, tasks);
    const approvalsText = renderCityLaunchFounderApprovalArtifact({
      city: profile.city,
      budgetPolicy,
    });
    const issueBundlePayload = {
      machine_policy_version: CITY_LAUNCH_MACHINE_POLICY_VERSION,
      city: profile.city,
      city_slug: profile.key,
      source_activation_payload_path:
        completedResearch?.activationPayload ? canonicalActivationPayloadPath : null,
      tasks: tasks.map((task) => ({
        key: task.key,
        title: task.title,
        phase: task.phase,
        owner_lane: task.ownerLane,
        human_lane: task.humanLane,
        purpose: task.purpose,
        dependencies: task.dependencies,
        done_when: task.doneWhen,
        metrics_dependencies: task.metricsDependencies,
        validation_required: task.validationRequired,
        source: task.source,
      })),
    };
    const targetLedgerPayload = {
      city: targetLedger.city,
      city_slug: targetLedger.citySlug,
      generated_at: targetLedger.generatedAt,
      mode: targetLedger.mode,
      workflow_priorities: targetLedger.workflows,
      priority_proof_targets: targetLedger.immediateTop25,
      queued_lawful_access_buckets: targetLedger.next100Buckets.map((entry) => ({
        label: entry.bucket,
        activation_rule: "after first rights-cleared proof asset",
        rationale: entry.rationale,
      })),
      discovery_lanes: targetLedger.longUniverseBuckets.map((entry) => ({
        label: entry.bucket,
        rationale: entry.rationale,
      })),
      warnings: targetLedger.warnings,
      sources: targetLedger.sources,
    };

    await writeTextArtifact(systemDocPath, systemDocText);
    await writeTextArtifact(issueBundlePath, issueBundleText);
    await writeTextArtifact(issueBundleJsonPath, JSON.stringify(issueBundlePayload, null, 2));
    await writeTextArtifact(launchPlaybookPath, compactLaunchPlaybook);
    await writeTextArtifact(demandPlaybookPath, compactDemandPlaybook);
    await writeTextArtifact(targetLedgerPath, targetLedgerMarkdown);
    await writeTextArtifact(targetLedgerJsonPath, JSON.stringify(targetLedgerPayload, null, 2));
    await writeTextArtifact(approvalsPath, approvalsText);
    await writeTextArtifact(cityOpeningBriefPath, cityOpeningBrief);
    await writeTextArtifact(cityOpeningChannelMapPath, cityOpeningChannelMap);
    await writeTextArtifact(cityOpeningFirstWavePackPath, cityOpeningFirstWavePack);
    await writeTextArtifact(cityOpeningCtaRoutingPath, cityOpeningCtaRouting);
    await writeTextArtifact(cityOpeningResponseTrackingPath, cityOpeningResponseTracking);
    await writeTextArtifact(cityOpeningReplyConversionPath, cityOpeningReplyConversion);
    await writeTextArtifact(canonicalSystemDocPath, systemDocText);
    await writeTextArtifact(canonicalIssueBundlePath, issueBundleText);
    await writeTextArtifact(canonicalLaunchPlaybookPath, compactLaunchPlaybook);
    await writeTextArtifact(canonicalDemandPlaybookPath, compactDemandPlaybook);

    const result: CityLaunchExecutionResult = {
      city: profile.city,
      citySlug: profile.key,
      status,
      budgetTier: budgetPolicy.tier,
      budgetPolicy,
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      activationStatus: autonomousActivation ? "activation_ready" : "planning",
      wideningGuard,
      capabilitySnapshot,
      artifacts: {
        runDirectory,
        manifestPath,
        systemDocPath,
        issueBundlePath,
        issueBundleJsonPath,
        launchPlaybookPath,
        demandPlaybookPath,
        targetLedgerPath,
        targetLedgerJsonPath,
        approvalsPath,
        researchMaterializationPath,
        researchMaterializationMarkdownPath: researchMaterializationPath.replace(/\.json$/i, ".md"),
        contactEnrichmentPath: completedResearchEnrichment?.outputPath || undefined,
        contactEnrichmentMarkdownPath: completedResearchEnrichment?.outputMarkdownPath || undefined,
        sourceActivationPayloadPath:
          completedResearch?.activationPayload ? canonicalActivationPayloadPath : undefined,
        canonicalSystemDocPath,
        canonicalIssueBundlePath,
        canonicalLaunchPlaybookPath,
        canonicalDemandPlaybookPath,
        canonicalTargetLedgerPath,
        canonicalActivationPayloadPath,
        cityOpeningArtifactPack: {
          run: {
            briefPath: cityOpeningBriefPath,
            channelMapPath: cityOpeningChannelMapPath,
            firstWavePackPath: cityOpeningFirstWavePackPath,
            ctaRoutingPath: cityOpeningCtaRoutingPath,
            responseTrackingPath: cityOpeningResponseTrackingPath,
            replyConversionPath: cityOpeningReplyConversionPath,
            channelRegistryPath: cityOpeningChannelRegistryPath,
            sendLedgerPath: cityOpeningSendLedgerPath,
            executionReportPath: cityOpeningExecutionReportPath,
          },
          canonical: {
            briefPath: canonicalCityOpeningBriefPath,
            channelMapPath: canonicalCityOpeningChannelMapPath,
            firstWavePackPath: canonicalCityOpeningFirstWavePackPath,
            ctaRoutingPath: canonicalCityOpeningCtaRoutingPath,
            responseTrackingPath: canonicalCityOpeningResponseTrackingPath,
            replyConversionPath: canonicalCityOpeningReplyConversionPath,
            channelRegistryPath: canonicalCityOpeningChannelRegistryPath,
            sendLedgerPath: canonicalCityOpeningSendLedgerPath,
            executionReportPath: canonicalCityOpeningExecutionReportPath,
          },
        },
      },
      planning: {
        status: planningState.status,
        latestArtifactPath: planningState.latestArtifactPath,
        completedArtifactPath: planningState.completedArtifactPath,
        warnings: planningState.warnings,
      },
    };

    await advanceStep("sync_notion");
    const notion = await syncExecutionArtifactsToNotion({
      profile,
      status,
      canonicalSystemDocPath,
      systemDocText,
      completedAt: result.completedAt,
    }).catch(() => null);

    if (notion) {
      result.notion = notion;
      result.artifacts.notionKnowledgePageUrl = notion.knowledgePageUrl;
      result.artifacts.notionWorkQueuePageUrl = notion.workQueuePageUrl;
    }

    await advanceStep("dispatch_issue_tree");
    if (input.dispatchIssues !== false) {
      try {
        const dispatch = await dispatchCityLaunchIssueTree({
          activationRunId: runTimestamp,
          profile,
          tasks,
          founderApproved: autonomousActivation,
          budgetPolicy,
          existingRootIssueId: reconciledActivation.rootIssueId,
          existingTaskIssueIds: reconciledActivation.taskIssueIds,
          wakeExistingIssues: autonomousActivation,
          rewakeTaskKeys: input.rewakeTaskKeys,
          rewakeOwnerLanes: input.rewakeOwnerLanes,
          artifactPaths: {
            canonicalSystemDocPath,
            canonicalIssueBundlePath,
            canonicalTargetLedgerPath,
            canonicalActivationPayloadPath,
          },
        });
        result.paperclip = {
          rootIssueId: dispatch.rootIssue.id,
          rootIssueIdentifier: dispatch.rootIssue.identifier || null,
          createdRootIssue: dispatch.createdRootIssue,
          dispatched: dispatch.dispatched,
        };
      } catch (error) {
        result.paperclip = {
          rootIssueId: null,
          rootIssueIdentifier: null,
          createdRootIssue: false,
          dispatched: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    if (
      autonomousActivation
      && input.dispatchIssues !== false
      && (!result.paperclip?.rootIssueId || (result.paperclip?.dispatched.length || 0) === 0)
    ) {
      const dispatchError = result.paperclip?.error
        || "Autonomous activation did not create or update the live Paperclip city-launch issue tree.";
      throw new Error(
        `City launch activation failed closed for ${profile.city}: ${dispatchError}`,
      );
    }

    const taskIssueIds = Object.fromEntries(
      (result.paperclip?.dispatched || []).map((entry) => [entry.key, entry.issueId]),
    );

    await advanceStep("seed_city_opening_execution");
    const seededCityOpeningExecution = await seedCityOpeningExecutionLedgers({
      profile,
      launchId: result.paperclip?.rootIssueId || null,
      taskIssueIds,
      research: completedResearch,
      founderApproved: autonomousActivation,
    }).catch(() => null);

    const cityOpeningExecution =
      seededCityOpeningExecution
      || {
        channelAccounts: await listCityLaunchChannelAccounts(profile.city).catch(() => []),
        sendActions: await listCityLaunchSendActions(profile.city).catch(() => []),
      };

    await advanceStep("execute_outbound");
    const seededOutboundReadiness = assessCityLaunchOutboundReadiness({
      city: profile.city,
      sendActions: cityOpeningExecution.sendActions,
    });
    result.outboundReadiness = seededOutboundReadiness;

    if (autonomousActivation && seededOutboundReadiness.status !== "blocked") {
      result.sendExecution = await executeCityLaunchSends({
        city: profile.city,
      }).catch((error) => ({
        city: profile.city,
        totalEligible: 0,
        sent: 0,
        skippedApproval: 0,
        skippedNoRecipient: 0,
        skippedAlreadySent: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : String(error)],
      }));
    } else if (autonomousActivation) {
      result.sendExecution = {
        city: profile.city,
        totalEligible: seededOutboundReadiness.directOutreachActions.readyToSend,
        sent: 0,
        skippedApproval: 0,
        skippedNoRecipient: 0,
        skippedAlreadySent: 0,
        failed: 0,
        errors: [...seededOutboundReadiness.blockers],
      };
    }

    await advanceStep("write_execution_ledgers");
    const refreshedCityOpeningExecution = {
      channelAccounts: await listCityLaunchChannelAccounts(profile.city).catch(
        () => cityOpeningExecution.channelAccounts,
      ),
      sendActions: await listCityLaunchSendActions(profile.city).catch(
        () => cityOpeningExecution.sendActions,
      ),
    };

    const cityOpeningChannelRegistry = renderCityOpeningChannelRegistryMarkdown({
      profile,
      channelAccounts: refreshedCityOpeningExecution.channelAccounts,
    });
    const cityOpeningSendLedger = renderCityOpeningSendLedgerMarkdown({
      profile,
      sendActions: refreshedCityOpeningExecution.sendActions,
    });
    const cityOpeningExecutionReport = renderCityOpeningExecutionReportMarkdown({
      profile,
      channelAccounts: refreshedCityOpeningExecution.channelAccounts,
      sendActions: refreshedCityOpeningExecution.sendActions,
      outboundReadiness: assessCityLaunchOutboundReadiness({
        city: profile.city,
        sendActions: refreshedCityOpeningExecution.sendActions,
      }),
    });
    result.outboundReadiness = assessCityLaunchOutboundReadiness({
      city: profile.city,
      sendActions: refreshedCityOpeningExecution.sendActions,
    });

    await writeTextArtifact(cityOpeningChannelRegistryPath, cityOpeningChannelRegistry);
    await writeTextArtifact(cityOpeningSendLedgerPath, cityOpeningSendLedger);
    await writeTextArtifact(cityOpeningExecutionReportPath, cityOpeningExecutionReport);
    await writeTextArtifact(canonicalCityOpeningChannelRegistryPath, cityOpeningChannelRegistry);
    await writeTextArtifact(canonicalCityOpeningSendLedgerPath, cityOpeningSendLedger);
    await writeTextArtifact(canonicalCityOpeningExecutionReportPath, cityOpeningExecutionReport);

    await advanceStep("persist_activation_state");
    await writeCityLaunchActivation({
      city: profile.city,
      budgetTier: budgetPolicy.tier,
      budgetPolicy,
      founderApproved: autonomousActivation,
      status: result.activationStatus,
      rootIssueId: result.paperclip?.rootIssueId || null,
      taskIssueIds,
      wideningGuard,
    }).catch(() => null);

    await advanceStep("materialize_research");
    const researchMaterialization = await materializeCityLaunchResearch({
      city: profile.city,
      launchId: result.paperclip?.rootIssueId || null,
      budgetPolicy,
      outputPath: researchMaterializationPath,
    });
    result.researchMaterialization = {
      status: researchMaterialization.status,
      sourceArtifactPath: researchMaterialization.sourceArtifactPath,
      prospectsUpserted: researchMaterialization.prospectsUpserted,
      buyerTargetsUpserted: researchMaterialization.buyerTargetsUpserted,
      touchesRecorded: researchMaterialization.touchesRecorded,
      budgetRecommendationsRecorded: researchMaterialization.budgetRecommendationsRecorded,
      contactEnrichmentStatus: researchMaterialization.contactEnrichmentStatus,
      contactEnrichmentArtifactPath: researchMaterialization.contactEnrichmentArtifactPath || null,
      warnings: researchMaterialization.warnings,
    };

    await advanceStep("write_contact_lists");
    const [cityBuyerTargets, cityProspects, refreshedSendActions] = await Promise.all([
      listCityLaunchBuyerTargets(profile.city).catch(() => []),
      listCityLaunchProspects(profile.city).catch(() => []),
      listCityLaunchSendActions(profile.city).catch(() => cityOpeningExecution.sendActions),
    ]);
    const robotTeamContactList = renderRobotTeamContactListMarkdown({
      profile,
      buyerTargets: cityBuyerTargets,
      sendActions: refreshedSendActions,
    });
    const siteOperatorContactList = renderSiteOperatorContactListMarkdown({
      profile,
      prospects: cityProspects,
    });

    await writeTextArtifact(cityOpeningRobotTeamContactListPath, robotTeamContactList);
    await writeTextArtifact(cityOpeningSiteOperatorContactListPath, siteOperatorContactList);
    await writeTextArtifact(canonicalCityOpeningRobotTeamContactListPath, robotTeamContactList);
    await writeTextArtifact(canonicalCityOpeningSiteOperatorContactListPath, siteOperatorContactList);

    currentStep = "completed";
    await writeRuntimeManifest(result);
    return result;
  } catch (error) {
    const errorDetail = serializeError(error);
    await writeTextArtifact(
      stepErrorPath,
      JSON.stringify({
        city: profile.city,
        citySlug: profile.key,
        status,
        founderApproved: autonomousActivation,
        currentStep,
        stepHistory,
        failedAt: new Date().toISOString(),
        error: errorDetail,
      }, null, 2),
    );
    await writeRuntimeManifest(undefined, errorDetail);
    throw error;
  }
}

export async function runAustinLaunchExecutionHarness(input?: {
  founderApproved?: boolean;
  reportsRoot?: string;
  budgetTier?: CityLaunchBudgetTier;
}) {
  return runCityLaunchExecutionHarness({
    city: "Austin, TX",
    founderApproved: input?.founderApproved,
    reportsRoot: input?.reportsRoot,
    budgetTier: input?.budgetTier,
  });
}

export function buildAustinExecutionTasks() {
  return buildCityExecutionTasks(resolveFocusCityProfile("Austin, TX"));
}

export async function readCurrentCityLaunchActivation(city: string) {
  return await readCityLaunchActivation(city);
}
