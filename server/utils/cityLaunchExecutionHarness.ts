import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  createNotionClient,
  upsertKnowledgeEntry,
  upsertWorkQueueItem,
} from "../../ops/paperclip/plugins/blueprint-automation/src/notion";
import { getConfiguredEnvValue } from "../config/env";
import {
  buildCityCaptureTargetLedger,
  renderCityCaptureTargetLedgerMarkdown,
} from "./cityCaptureTargetLedger";
import {
  readCityLaunchActivation,
  summarizeCityLaunchLedgers,
  writeCityLaunchActivation,
  type CityLaunchActivationStatus,
} from "./cityLaunchLedgers";
import { resolveCityLaunchPlanningState, type CityLaunchPlanningState } from "./cityLaunchPlanningState";
import {
  loadAndParseCityLaunchResearchArtifact,
  type CityLaunchResearchParseResult,
  type ParsedCityLaunchActivationPayload,
} from "./cityLaunchResearchParser";
import { materializeCityLaunchResearch } from "./cityLaunchResearchMaterializer";
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
  upsertPaperclipIssue,
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
    sourceActivationPayloadPath?: string;
    canonicalSystemDocPath: string;
    canonicalIssueBundlePath: string;
    canonicalLaunchPlaybookPath: string;
    canonicalDemandPlaybookPath: string;
    canonicalTargetLedgerPath: string;
    canonicalActivationPayloadPath: string;
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
    warnings: string[];
  };
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

async function maybeLoadCompletedResearch(planningState: CityLaunchPlanningState) {
  if (!planningState.completedArtifactPath) {
    return null;
  }

  try {
    const parsed = await loadAndParseCityLaunchResearchArtifact({
      city: planningState.city,
      artifactPath: planningState.completedArtifactPath,
    });
    return parsed.errors.length > 0 ? null : parsed;
  } catch {
    return null;
  }
}

function buildFounderApprovals(profile: CityLaunchProfile, budgetPolicy: CityLaunchBudgetPolicy) {
  const spendLine = budgetPolicy.maxTotalApprovedUsd > 0
    ? `Approve the bounded spend posture for ${profile.shortLabel}: ${budgetPolicy.label} with a total envelope up to $${budgetPolicy.maxTotalApprovedUsd.toLocaleString()}.`
    : `Approve the bounded spend posture for ${profile.shortLabel}: ${budgetPolicy.label} with no paid acquisition, referral, or discretionary travel spend.`;

  return [
    `Approve ${profile.city} as an active city-launch activation and keep non-active cities deferred unless a new evidence packet exists.`,
    `Approve the bounded ${profile.shortLabel} launch posture: gated cohort pilot, Exact-Site Hosted Review wedge, no public city-live claims.`,
    spendLine,
    `Approve any ${profile.shortLabel} source-policy exceptions beyond the current bounded channel stack.`,
    "Approve any rights/privacy/commercialization exception that would set precedent or create an irreversible external commitment.",
    `Approve any non-standard commercial terms outside the standard ${profile.shortLabel} quote bands prepared by revenue-ops-pricing-agent and the designated human commercial owner.`,
  ];
}

function formatDateOnly(value: string) {
  return value.slice(0, 10);
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
    `- last-human-launch-decision: ${input.status === "founder_approved_activation_ready" ? "approved with conditions" : "not approved"}`,
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
    "- Do not run paid acquisition, public bounty, or generic gig-worker motions for private interiors.",
    "- Keep public posture at Exact-Site Hosted Review wedge only; no city-live or readiness claims until proof is real.",
    input.activationPayload?.preferredLawfulAccessMode
      ? `- Preferred first lawful access mode: ${input.activationPayload.preferredLawfulAccessMode}.`
      : "- Preferred first lawful access mode is still validation-required.",
    "",
    "## Target Capturer Profile",
    "- site-authorized surveying, AEC scanning, industrial inspection, or commercial mapping operator",
    "- comfortable with repeatable indoor walkthrough capture and explicit rights / privacy boundaries",
    "- able to document access path and site-operator authority without ambiguity",
    "",
    "## Ranked Channel Stack",
    "| Rank | Channel | Why it fits | Trust mechanism | Current posture |",
    "|---|---|---|---|---|",
    "| 1 | site-operator introductions | lawful path into private interiors | named operator approval and rights packet | start here |",
    "| 2 | buyer-linked exact-site requests | strongest proof-led capture path | buyer thread plus operator approval | start here |",
    "| 3 | local surveying / AEC / industrial inspection firms | best early supply quality | professional credentials plus first-capture review | curated only |",
    "| 4 | high-trust mapper referrals | useful after first proof assets exist | referral guardrails plus completion history | hold until proof exists |",
    "| 5 | broad community or public channels | easiest to create noise and rights risk | weak | do not use yet |",
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
    "## Human Gates",
    "- founder or designated human approval for new city activation, spend expansion, posture-changing public claims, precedent-setting rights/privacy exceptions, and non-standard commercial commitments",
    "- designated human rights review for sensitive privacy, consent, or commercialization questions",
    "- designated human commercial owner for standard quotes inside approved bands",
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
    "- if a buyer sits in defense, aerospace, export-controlled, or air-gapped environments, require explicit human review before assuming the standard hosted-review path is acceptable",
    "- do not imply that Blueprint can serve sensitive or controlled-access environments over a standard cloud runtime without buyer-specific confirmation",
    "- operator-governed facilities and rights-sensitive exact-site requests should route through `rights-provenance-agent` plus human review",
    "",
    "## Immediate Next Actions",
    "1. materialize the research-backed buyer targets and first-touch candidates as soon as deep research completes",
    "2. keep `buyer-solutions-agent` and `revenue-ops-pricing-agent` on standard commercial prep while founders stay out of routine proof motion",
    "3. block city-specific outbound scale until proof packs and hosted reviews are real, not just planned",
  ].join("\n");
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
      humanGate: "Escalate only when a target requires a sensitive operator-lane, rights/privacy exception, or posture-changing outbound motion.",
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
      purpose: `Keep ${profile.shortLabel} sourcing narrow, truthful, and off the founder lane for routine approvals.`,
      inputs: [
        profile.launchPlaybookPath,
        "capturer-supply-playbook.md",
        `founder-approved ${profile.shortLabel} launch posture`,
      ],
      dependencies: [],
      doneWhen: [
        `${profile.shortLabel} source policy names allowed channels, disallowed channels, referral rules, and who may issue invites or access codes.`,
        "Routine invite/access-code decisions stay with Growth Lead and Ops Lead inside written guardrails.",
      ],
      humanGate: `Founder approval only if the policy expands spend, public posture, or channel scope beyond the bounded ${profile.shortLabel} pilot.`,
      metricsDependencies: [],
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
      purpose: `Generate the first ${profile.shortLabel} supply wave without widening into generic gig-market posture.`,
      inputs: [
        "capturer-supply-playbook.md",
        profile.launchPlaybookPath,
        `${profile.shortLabel} source policy`,
      ],
      dependencies: ["city-target-ledger", "growth-source-policy"],
      doneWhen: [
        `A curated first-wave ${profile.shortLabel} prospect set is named with source bucket, rationale, lawful access posture, and next move.`,
        "Any copy stays draft-first and preserves no-guarantee capture language.",
      ],
      humanGate: `Human review before any public posting or channel expansion beyond the written ${profile.shortLabel} source policy.`,
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
      purpose: `Classify ${profile.shortLabel} applicants using the approved rubric instead of ad hoc founder review.`,
      inputs: [
        `${profile.shortLabel} intake rubric`,
        "waitlistSubmissions",
        "capturer signup records",
      ],
      dependencies: ["ops-rubric-thresholds"],
      doneWhen: [
        `${profile.shortLabel} applicants are tagged by source bucket, approval state, and missing-trust evidence.`,
        "Exceptions are blocked with explicit missing facts instead of silently held.",
      ],
      humanGate: "Escalate only when the rubric is ambiguous or the application raises rights/privacy/trust exceptions.",
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
      humanGate: "Escalate only when routine support exposes a threshold, rights, privacy, payout, or policy exception.",
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
      humanGate: "Escalate only for missing site access, ambiguous permissions, or threshold exceptions.",
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
        "Policy-setting exceptions route to the human reviewer and founder only when precedent changes.",
      ],
      humanGate: "Human rights review for sensitive or precedent-setting privacy, rights, or commercialization questions.",
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
      humanGate: "Escalate only when a buyer-visible claim would outrun the underlying evidence or commercial scope.",
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
        "First proof-led touches are queued for operator approval or event-driven send.",
      ],
      humanGate: "Human review before any live send.",
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
      humanGate: "Escalate only for posture changes, non-standard terms, or sensitive rights/privacy questions.",
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
        "Only non-standard commitments escalate above the designated human commercial owner.",
      ],
      humanGate: "Human commercial owner approval for standard quotes; founder approval only for non-standard commitments.",
      metricsDependencies: [
        "human_commercial_handoff_started",
        "first_human_commercial_handoff",
      ],
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
      dependencies: ["supply-qualification", "proof-pack-listings", "outbound-execution"],
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
        `A Work Queue breadcrumb exists for the current ${profile.shortLabel} activation state and next human gate.`,
      ],
      humanGate: "Escalate only for ambiguous Notion identity or rights-sensitive content movement.",
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
      humanGate: "CTO review on release safety; founder only if compliance or rights evidence is ambiguous.",
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
    lines.push(`- human gate: ${task.humanGate ?? "none"}`);
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
    `${profile.shortLabel} go / no-go and the decision to keep the city gated or expand it.`,
    `Any spend envelope beyond the approved ${profile.shortLabel} ${input.budgetPolicy.label.toLowerCase()} policy.`,
    `Any public statement that changes company posture or overstates ${profile.shortLabel} readiness.`,
    "Any rights/privacy exception or non-standard commercial commitment that would set precedent.",
  ];

  const operatorOwned = [
    `Growth Lead owns ${profile.shortLabel} source policy, referral posture, and invite/access-code issuance inside approved guardrails.`,
    `Ops Lead owns the ${profile.shortLabel} intake rubric, trust kit, first-capture thresholds, and launch-readiness checklist.`,
    "The designated human commercial owner owns standard quotes inside approved bands.",
    "The designated human rights reviewer owns sensitive but non-precedent rights/privacy calls prepared by rights-provenance-agent.",
  ];

  const agentPrepared = [
    `city-launch-agent keeps the ${profile.shortLabel} plan and dependency map current.`,
    `city-demand-agent maintains the ${profile.shortLabel} target ledger so the capture queue stays tied to real robot workflow demand.`,
    `capturer-growth-agent, intake-agent, capturer-success-agent, field-ops-agent, capture-qa-agent, and rights-provenance-agent run the supply loop inside the ${profile.shortLabel} policy packet.`,
    `demand-intel-agent, robot-team-growth-agent, outbound-sales-agent, buyer-solutions-agent, and revenue-ops-pricing-agent run the demand loop inside the proof-led ${profile.shortLabel} wedge.`,
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
    `Turn the ${profile.shortLabel} planning artifacts into an executable company harness that can run the supply loop and the demand loop with minimal founder involvement after bounded founder approval.`,
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
    `3. Materialize the live Paperclip issue tree for the city launch so work is routable instead of staying trapped in artifacts.`,
    `4. Measure the city through ${profile.shortLabel}-specific supply, demand, spend, and proof-motion metrics so operators can see whether the city is actually becoming operationally real.`,
    `5. Treat the machine-readable activation payload as the control-plane artifact for validation blockers, lane mapping, and metrics readiness.`,
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
    `## ${profile.shortLabel} Switch-On Requirements`,
    "",
    `- Founder-approved ${profile.shortLabel} posture and bounded source policy.`,
    `- ${profile.shortLabel} capture target ledger with first proof candidates, queued lawful-access buckets, and longer-horizon discovery lanes.`,
    `- ${profile.shortLabel} ops packet: intake rubric, trust kit, first-capture thresholds, and launch-readiness checklist.`,
    `- At least one clean ${profile.shortLabel} proof pack with hosted-review path and rights/provenance clearance.`,
    `- ${profile.shortLabel} buyer target list and proof-led outbound package.`,
    `- ${profile.shortLabel} scorecard working from live repo truth sources.`,
    `- Machine-readable activation payload with validation blockers, issue seeds, named claims, and metrics dependencies.`,
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
    "## Validation Required",
    "",
    input.task.validationRequired ? "true" : "false",
    "",
    "## Human Gate",
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

async function dispatchCityLaunchIssueTree(input: {
  profile: CityLaunchProfile;
  tasks: CityLaunchTask[];
  founderApproved: boolean;
  budgetPolicy: CityLaunchBudgetPolicy;
  artifactPaths: {
    canonicalSystemDocPath: string;
    canonicalIssueBundlePath: string;
    canonicalTargetLedgerPath: string;
    canonicalActivationPayloadPath: string;
  };
}) {
  const issueStatus = input.founderApproved ? "todo" : "backlog";
  const rootDescription = [
    `# Launch ${input.profile.city}`,
    "",
    `This is the root issue for the generic autonomous city launcher in ${input.profile.city}.`,
    "",
    `- founder_approved: ${input.founderApproved}`,
    `- budget_tier: ${input.budgetPolicy.tier}`,
    `- execution_bundle: ${input.artifactPaths.canonicalIssueBundlePath}`,
    `- launch_system: ${input.artifactPaths.canonicalSystemDocPath}`,
    `- target_ledger: ${input.artifactPaths.canonicalTargetLedgerPath}`,
    `- activation_payload: ${input.artifactPaths.canonicalActivationPayloadPath}`,
    "",
    "Route all child issues under this root so the city launch can be reviewed and executed as one bounded operating program.",
  ].join("\n");

  const root = await upsertPaperclipIssue({
    projectName: CITY_LAUNCH_PROJECT_NAME,
    assigneeKey: "growth-lead",
    title: `Launch ${input.profile.city} as a bounded city program`,
    description: rootDescription,
    priority: input.founderApproved ? "high" : "medium",
    status: issueStatus,
    originKind: "city_launch_activation",
    originId: input.profile.key,
  });

  const dispatched: CityLaunchTaskDispatch[] = [];

  for (const task of input.tasks) {
    const issue = await upsertPaperclipIssue({
      projectName: CITY_LAUNCH_PROJECT_NAME,
      assigneeKey: task.ownerLane,
      title: task.title,
      description: taskIssueDescription({
        profile: input.profile,
        task,
        budgetPolicy: input.budgetPolicy,
        artifactPaths: input.artifactPaths,
      }),
      priority:
        task.phase === "founder_gates" || task.phase === "measurement" ? "high" : "medium",
      status: issueStatus,
      originKind: "city_launch_task",
      originId: `${input.profile.key}:${task.key}`,
      parentId: root.issue.id,
    });
    dispatched.push({
      key: task.key,
      ownerLane: task.ownerLane,
      issueId: issue.issue.id,
      identifier: issue.issue.identifier || null,
      created: issue.created,
      status: issue.issue.status,
    });
  }

  await createPaperclipIssueComment(
    root.issue.id,
    [
      `City launch issue tree refreshed for ${input.profile.city}.`,
      `Founder-approved activation: ${input.founderApproved}`,
      `Task issues routed: ${dispatched.length}`,
      `Canonical bundle: ${input.artifactPaths.canonicalIssueBundlePath}`,
    ].join("\n"),
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
}) {
  const budgetPolicy = buildCityLaunchBudgetPolicy({
    tier: input.budgetTier,
    maxTotalApprovedUsd: input.budgetMaxUsd,
    operatorAutoApproveUsd: input.operatorAutoApproveUsd,
  });
  const profile = resolveCityLaunchProfile(input.city, budgetPolicy.tier);
  const status: CityLaunchExecutionStatus = input?.founderApproved
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
  const researchMaterializationPath = path.join(
    runDirectory,
    `city-launch-research-materialization-${profile.key}.json`,
  );
  const manifestPath = path.join(runDirectory, "manifest.json");
  const canonicalSystemDocPath = buildCanonicalSystemDocPath(profile);
  const canonicalIssueBundlePath = buildCanonicalIssueBundlePath(profile);
  const canonicalLaunchPlaybookPath = buildCanonicalLaunchPlaybookPath(profile);
  const canonicalDemandPlaybookPath = buildCanonicalDemandPlaybookPath(profile);
  const canonicalTargetLedgerPath = buildCanonicalTargetLedgerPath(profile);
  const canonicalActivationPayloadPath = path.join(
    REPO_ROOT,
    `ops/paperclip/playbooks/city-launch-${profile.key}-activation-payload.json`,
  );
  const planningState = await resolveCityLaunchPlanningState({ city: profile.city });
  const completedResearch = await maybeLoadCompletedResearch(planningState);
  const tasks = mergeTasksWithActivationPayload(
    buildCityExecutionTasks(profile),
    completedResearch?.activationPayload,
  );
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

  await writeTextArtifact(canonicalLaunchPlaybookPath, compactLaunchPlaybook);
  await writeTextArtifact(canonicalDemandPlaybookPath, compactDemandPlaybook);
  await writeTextArtifact(canonicalTargetLedgerPath, targetLedgerMarkdown);
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
  const approvalsText = [
    `# ${profile.city} Founder Approval Checklist`,
    "",
    ...founderApprovals.map((item, index) => `${index + 1}. ${item}`),
  ].join("\n");
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
    activationStatus: input.founderApproved ? "activation_ready" : "planning",
    wideningGuard,
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
      sourceActivationPayloadPath:
        completedResearch?.activationPayload ? canonicalActivationPayloadPath : undefined,
      canonicalSystemDocPath,
      canonicalIssueBundlePath,
      canonicalLaunchPlaybookPath,
      canonicalDemandPlaybookPath,
      canonicalTargetLedgerPath,
      canonicalActivationPayloadPath,
    },
    planning: {
      status: planningState.status,
      latestArtifactPath: planningState.latestArtifactPath,
      completedArtifactPath: planningState.completedArtifactPath,
      warnings: planningState.warnings,
    },
  };

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

  if (input.dispatchIssues !== false) {
    try {
      const dispatch = await dispatchCityLaunchIssueTree({
        profile,
        tasks,
        founderApproved: Boolean(input.founderApproved),
        budgetPolicy,
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

  await writeCityLaunchActivation({
    city: profile.city,
    budgetTier: budgetPolicy.tier,
    budgetPolicy,
    founderApproved: Boolean(input.founderApproved),
    status: result.activationStatus,
    rootIssueId: result.paperclip?.rootIssueId || null,
    taskIssueIds: Object.fromEntries(
      (result.paperclip?.dispatched || []).map((entry) => [entry.key, entry.issueId]),
    ),
    wideningGuard,
  }).catch(() => null);

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
    warnings: researchMaterialization.warnings,
  };

  await writeTextArtifact(manifestPath, JSON.stringify(result, null, 2));
  return result;
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
