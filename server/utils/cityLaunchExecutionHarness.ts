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
  resolveFocusCityProfile,
  slugifyCityName,
  type FocusCityProfile,
} from "./cityLaunchProfiles";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const DEFAULT_REPORTS_ROOT = path.join(
  REPO_ROOT,
  "ops/paperclip/reports/city-launch-execution",
);

const STATIC_SOURCE_PATHS = [
  "docs/city-launch-deep-research-harness-2026-04-11.md",
  "ops/paperclip/programs/city-launch-agent-program.md",
  "ops/paperclip/programs/city-demand-agent-program.md",
  "ops/paperclip/playbooks/capturer-supply-playbook.md",
  "ops/paperclip/playbooks/robot-team-demand-playbook.md",
  "ops/paperclip/reports/city-demand-bootstrap-2026-04-06.md",
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
  phase: "founder-gates" | "supply" | "proof-assets" | "demand" | "commercial" | "measurement";
  title: string;
  owner: string;
  humanOwner: string | null;
  purpose: string;
  inputs: string[];
  dependencies: string[];
  doneWhen: string[];
  humanGate: string | null;
};

export type CityLaunchExecutionResult = {
  city: string;
  citySlug: string;
  status: CityLaunchExecutionStatus;
  startedAt: string;
  completedAt: string;
  artifacts: {
    runDirectory: string;
    manifestPath: string;
    systemDocPath: string;
    issueBundlePath: string;
    issueBundleJsonPath: string;
    targetLedgerPath: string;
    targetLedgerJsonPath: string;
    approvalsPath: string;
    canonicalSystemDocPath: string;
    canonicalIssueBundlePath: string;
    canonicalTargetLedgerPath: string;
    notionKnowledgePageUrl?: string;
    notionWorkQueuePageUrl?: string;
  };
  notion?: {
    knowledgePageId?: string;
    knowledgePageUrl?: string;
    workQueuePageId?: string;
    workQueuePageUrl?: string;
  };
};

type ReadSourceArtifact = {
  relativePath: string;
  exists: boolean;
};

function timestampForFile(date = new Date()) {
  return date.toISOString().replaceAll(":", "-");
}

function buildCanonicalSystemDocPath(profile: FocusCityProfile) {
  return path.join(REPO_ROOT, profile.systemDocPath);
}

function buildCanonicalIssueBundlePath(profile: FocusCityProfile) {
  return path.join(REPO_ROOT, profile.issueBundlePath);
}

function buildCanonicalTargetLedgerPath(profile: FocusCityProfile) {
  return path.join(REPO_ROOT, profile.targetLedgerPath);
}

async function writeTextArtifact(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

async function listSourceArtifacts(profile: FocusCityProfile) {
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

function buildFounderApprovals(profile: FocusCityProfile) {
  return [
    `Approve ${profile.city} as an active city-launch activation and keep non-active cities deferred unless a new evidence packet exists.`,
    `Approve the bounded ${profile.shortLabel} launch posture: gated cohort pilot, Exact-Site Hosted Review wedge, no public city-live claims.`,
    "Approve the bounded spend posture: zero-budget only, low-budget envelope, or explicit funded envelope.",
    `Approve any ${profile.shortLabel} source-policy exceptions beyond the current bounded channel stack.`,
    "Approve any rights/privacy/commercialization exception that would set precedent or create an irreversible external commitment.",
    `Approve any non-standard commercial terms outside the standard ${profile.shortLabel} quote bands prepared by revenue-ops-pricing-agent and the designated human commercial owner.`,
  ];
}

export function buildCityExecutionTasks(profile: FocusCityProfile): CityLaunchTask[] {
  return [
    {
      key: "city-target-ledger",
      phase: "founder-gates",
      title: `Maintain the ${profile.shortLabel} capture target ledger`,
      owner: "city-demand-agent",
      humanOwner: "Growth Lead",
      purpose: `Rank which ${profile.shortLabel} sites and site clusters should be captured first based on current robot workflow focus, buyer value, and access realism.`,
      inputs: [
        profile.demandPlaybookPath,
        "robot-team-demand-playbook.md",
        `${profile.shortLabel} capture target ledger`,
      ],
      dependencies: [],
      doneWhen: [
        `The ${profile.shortLabel} target ledger names the immediate top 25, the next 100 expansion buckets, and the long 300-1000 site universe model.`,
        "Capture priorities stay tied to current robot workflow demand instead of generic city coverage.",
      ],
      humanGate: "Escalate only when a target requires a sensitive operator-lane, rights/privacy exception, or posture-changing outbound motion.",
    },
    {
      key: "growth-source-policy",
      phase: "founder-gates",
      title: `Lock ${profile.shortLabel} source policy and invite/access-code posture`,
      owner: "growth-lead",
      humanOwner: "Growth Lead",
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
    },
    {
      key: "ops-rubric-thresholds",
      phase: "founder-gates",
      title: `Publish ${profile.shortLabel} intake rubric, trust kit, and first-capture thresholds`,
      owner: "ops-lead",
      humanOwner: "Ops Lead",
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
    },
    {
      key: "supply-prospects",
      phase: "supply",
      title: `Build the ${profile.shortLabel} capturer prospect list and post package`,
      owner: "capturer-growth-agent",
      humanOwner: "Growth Lead",
      purpose: `Generate the first ${profile.shortLabel} supply wave without widening into generic gig-market posture.`,
      inputs: [
        "capturer-supply-playbook.md",
        profile.launchPlaybookPath,
        `${profile.shortLabel} source policy`,
      ],
      dependencies: ["city-target-ledger", "growth-source-policy"],
      doneWhen: [
        `25-50 curated ${profile.shortLabel} prospects are named with source bucket, rationale, and next move, or the org explicitly switches to the broader 100-signup path.`,
        "Any post copy stays draft-first and preserves no-guarantee capture language.",
      ],
      humanGate: `Human review before any public posting or channel expansion beyond the written ${profile.shortLabel} source policy.`,
    },
    {
      key: "supply-qualification",
      phase: "supply",
      title: `Route ${profile.shortLabel} applicants into qualification and approval`,
      owner: "intake-agent",
      humanOwner: "Ops Lead",
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
    },
    {
      key: "capturer-activation-success",
      phase: "supply",
      title: `Own approved ${profile.shortLabel} capturers through onboarding and repeat-ready`,
      owner: "capturer-success-agent",
      humanOwner: "Ops Lead",
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
    },
    {
      key: "first-capture-routing",
      phase: "supply",
      title: `Assign ${profile.shortLabel} first captures, reminders, and site-facing trust prep`,
      owner: "field-ops-agent",
      humanOwner: "Ops Lead",
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
    },
    {
      key: "capture-qa",
      phase: "proof-assets",
      title: `QA ${profile.shortLabel} first captures and route recapture decisions`,
      owner: "capture-qa-agent",
      humanOwner: "Ops Lead",
      purpose: `Ensure ${profile.shortLabel} proof assets are real, clean, and ready for buyer proof work.`,
      inputs: [
        "pipeline artifacts",
        "capture QA evidence",
      ],
      dependencies: ["first-capture-routing"],
      doneWhen: [
        `${profile.shortLabel} captures receive PASS, BORDERLINE, or FAIL with explicit evidence.`,
        "Recapture instructions are attached when the first pass is not proof-ready.",
      ],
      humanGate: null,
    },
    {
      key: "rights-clearance",
      phase: "proof-assets",
      title: `Clear rights, provenance, and privacy on ${profile.shortLabel} proof assets`,
      owner: "rights-provenance-agent",
      humanOwner: "Designated human rights reviewer",
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
    },
    {
      key: "proof-pack-listings",
      phase: "proof-assets",
      title: `Assemble ${profile.shortLabel} proof packs and publish 1-2 proof-ready listings`,
      owner: "buyer-solutions-agent",
      humanOwner: "Ops Lead",
      purpose: `Turn ${profile.shortLabel} captures into concrete exact-site proof assets with a hosted-review path.`,
      inputs: [
        `CLEARED ${profile.shortLabel} proof assets`,
        "robot-team-demand-playbook.md",
        "proof-path-ownership-contract.md",
      ],
      dependencies: ["city-target-ledger", "rights-clearance"],
      doneWhen: [
        `At least 1-2 ${profile.shortLabel} proof-ready listings or equivalent proof packs exist with exact-site versus adjacent-site labeling.`,
        "Each proof pack includes provenance, coverage boundaries, hosted-review path, and next-step guidance.",
      ],
      humanGate: "Escalate only when a buyer-visible claim would outrun the underlying evidence or commercial scope.",
    },
    {
      key: "buyer-target-research",
      phase: "demand",
      title: `Research ${profile.shortLabel} robot-company target accounts and buyer clusters`,
      owner: "demand-intel-agent",
      humanOwner: "Growth Lead",
      purpose: `Build a real ${profile.shortLabel} demand list that matches the proof assets Blueprint can actually show.`,
      inputs: [
        profile.demandPlaybookPath,
        "robot-team-demand-playbook.md",
        `${profile.shortLabel} proof-ready listings`,
      ],
      dependencies: ["proof-pack-listings"],
      doneWhen: [
        `20-40 named ${profile.shortLabel}-relevant robot-company targets are researched with facility/workflow fit and proof-path notes.`,
        "Exact-site versus adjacent-site proof rules are explicit per target.",
      ],
      humanGate: null,
    },
    {
      key: "outbound-package",
      phase: "demand",
      title: `Prepare ${profile.shortLabel} proof-led outbound package and first touches`,
      owner: "robot-team-growth-agent",
      humanOwner: "Growth Lead",
      purpose: `Make outbound specific to ${profile.shortLabel} proof assets and hosted review instead of generic AI messaging.`,
      inputs: [
        "buyer-target-research",
        `${profile.shortLabel} proof packs`,
        "standard commercial handoff rules",
      ],
      dependencies: ["buyer-target-research"],
      doneWhen: [
        `${profile.shortLabel} outbound templates lead with one site, one workflow lane, proof-led CTA, and hosted-review next step.`,
        "10-20 tailored first touches are queued for operator approval or event-driven send.",
      ],
      humanGate: "Human review before any live send.",
    },
    {
      key: "outbound-execution",
      phase: "demand",
      title: `Run ${profile.shortLabel} outbound and move serious buyers into hosted review`,
      owner: "outbound-sales-agent",
      humanOwner: "Growth Lead",
      purpose: `Convert named ${profile.shortLabel} targets into serious proof conversations without dragging the founder into routine work.`,
      inputs: [
        "approved outbound package",
        `${profile.shortLabel} buyer target list`,
      ],
      dependencies: ["outbound-package"],
      doneWhen: [
        `5-8 ${profile.shortLabel} buyer conversations are active with explicit next steps.`,
        "2-3 hosted proof reviews are run end to end or clearly blocked with named reasons.",
      ],
      humanGate: "Escalate only for posture changes, non-standard terms, or sensitive rights/privacy questions.",
    },
    {
      key: "buyer-thread-commercial",
      phase: "commercial",
      title: `Keep ${profile.shortLabel} buyer threads inside standard commercial handling`,
      owner: "revenue-ops-pricing-agent",
      humanOwner: "Designated human commercial owner",
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
    },
    {
      key: "city-scorecard",
      phase: "measurement",
      title: `Publish the ${profile.shortLabel} launch scorecard and blocker view`,
      owner: "analytics-agent",
      humanOwner: "Growth Lead",
      purpose: `Make ${profile.shortLabel} progress measurable and reviewable without relying on narrative updates.`,
      inputs: [
        "growth_events",
        "inboundRequests.ops.proof_path",
        "capturer records",
        `published ${profile.shortLabel} proof assets`,
      ],
      dependencies: ["supply-qualification", "proof-pack-listings", "outbound-execution"],
      doneWhen: [
        `${profile.shortLabel} scorecard reports supply and demand progress against the launch thresholds.`,
        "Missing instrumentation is surfaced as blocked instead of smoothed over.",
      ],
      humanGate: null,
    },
    {
      key: "notion-breadcrumbs",
      phase: "measurement",
      title: `Mirror ${profile.shortLabel} execution artifacts into Notion Knowledge and Work Queue`,
      owner: "notion-manager-agent",
      humanOwner: "Chief of Staff",
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
    },
    {
      key: "switch-on-review",
      phase: "measurement",
      title: `Run the ${profile.shortLabel} switch-on review before activation`,
      owner: "beta-launch-commander",
      humanOwner: "CTO",
      purpose: `Confirm the software/runtime surfaces needed by the ${profile.shortLabel} launch are safe before switch-on.`,
      inputs: [
        "alpha:check",
        "alpha:preflight",
        `${profile.shortLabel} launch system doc`,
      ],
      dependencies: ["city-scorecard"],
      doneWhen: [
        `${profile.shortLabel} switch-on review returns GO, CONDITIONAL GO, or HOLD with evidence.`,
        "Any software/runtime blocker is routed to the right engineering lane before launch activation.",
      ],
      humanGate: "CTO review on release safety; founder only if compliance or rights evidence is ambiguous.",
    },
  ];
}

function buildTaskMarkdown(profile: FocusCityProfile, tasks: CityLaunchTask[]) {
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
    lines.push(`- agent owner: ${task.owner}`);
    lines.push(`- human owner: ${task.humanOwner ?? "none"}`);
    lines.push(`- purpose: ${task.purpose}`);
    lines.push(`- human gate: ${task.humanGate ?? "none"}`);
    lines.push(`- dependencies: ${task.dependencies.length > 0 ? task.dependencies.join(", ") : "none"}`);
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
  profile: FocusCityProfile;
  status: CityLaunchExecutionStatus;
  founderApprovals: string[];
  sourceArtifacts: ReadSourceArtifact[];
  tasks: CityLaunchTask[];
}) {
  const { profile } = input;
  const founderOnly = [
    `${profile.shortLabel} go / no-go and the decision to keep the city gated or expand it.`,
    `Any spend envelope beyond the already-approved bounded ${profile.shortLabel} posture.`,
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
    "| Loop | Metric | Target |",
    "| --- | --- | --- |",
    `| Supply | Curated ${profile.shortLabel} supply prospects contacted | 25-50 |`,
    `| Supply | Raw ${profile.shortLabel} supply signups if broader funnel is used | 100 |`,
    `| Supply | Approved ${profile.shortLabel} capturers | 10-20 |`,
    "| Supply | First captures completed | 5-10 |",
    "| Supply | QA-passed captures | 3-5 |",
    `| Supply | ${profile.shortLabel} proof-ready listings / proof packs | 1-2 |`,
    "| Demand | Named robot-company targets researched | 20-40 |",
    "| Demand | Tailored first touches sent | 10-20 |",
    "| Demand | Live buyer conversations | 5-8 |",
    "| Demand | Hosted proof reviews run end to end | 2-3 |",
  ].join("\n");

  return [
    `# ${profile.city} Launch System`,
    "",
    `- city: ${profile.city}`,
    `- status: ${input.status}`,
    "- doctrine: capture-first, world-model-product-first, Exact-Site Hosted Review wedge",
    "",
    "## Objective",
    "",
    `Turn the ${profile.shortLabel} planning artifacts into an executable company harness that can run the supply loop and the demand loop with minimal founder involvement after bounded founder approval.`,
    "",
    "## What The Org Will Do",
    "",
    `1. Generate and critique the ${profile.shortLabel} plan through the existing Gemini Deep Research harness.`,
    `2. Convert the compact ${profile.shortLabel} city-launch and city-demand playbooks into a single ${profile.shortLabel} operating system with explicit tasks, owners, thresholds, and handoff rules.`,
    `3. Wake the paused ${profile.shortLabel}-relevant lanes only through the founder-approved city activation path, instead of letting the growth tree sprawl open again.`,
    `4. Measure the city through ${profile.shortLabel}-specific supply and proof-motion metrics so operators can see whether the city is actually becoming operationally real.`,
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
    `- ${profile.shortLabel} capture target ledger with immediate top 25, next 100, and long-universe buckets.`,
    `- ${profile.shortLabel} ops packet: intake rubric, trust kit, first-capture thresholds, and launch-readiness checklist.`,
    `- At least one clean ${profile.shortLabel} proof pack with hosted-review path and rights/provenance clearance.`,
    `- ${profile.shortLabel} buyer target list and proof-led outbound package.`,
    `- ${profile.shortLabel} scorecard working from live repo truth sources.`,
    "",
    "## Execution Bundle",
    "",
    ...input.tasks.map((task) =>
      `- ${task.title}: ${task.owner} owns execution, ${task.humanOwner ?? "no separate human owner"} is the human lane, and the task closes only when ${task.doneWhen[0]}.`,
    ),
    "",
    "## Launch Targets",
    "",
    metricsTable,
    "",
    "## How Stalls Stay Visible",
    "",
    "- If supply stalls, the scorecard must show whether the break is at source quality, signup, approval, first capture, QA, or proof-ready listing conversion.",
    "- If demand stalls, the scorecard must show whether the break is at inbound, proof-pack delivery, hosted-review start, follow-up, or human commercial handoff.",
    "- If a routine metric is not instrumented yet, the scorecard must say it is not tracked rather than pretending the work is healthy.",
    "- If the target ledger is stale or misaligned, city-demand-agent owns the reprioritization instead of letting capture work fan out randomly.",
    "",
    "## Source Artifacts",
    "",
    ...input.sourceArtifacts.map((artifact) => `- ${artifact.relativePath}`),
    "",
    "## Determination",
    "",
    `Existing agents are sufficient with instruction, task, and orchestration changes. No new ${profile.shortLabel}-specific agent is required in this repo because every required capability already maps to an existing lane: planning, sourcing, intake, field ops, QA, rights/provenance, proof delivery, outbound, buyer ownership, pricing support, analytics, Notion hygiene, and release gating.`,
  ].join("\n");
}

function getNotionToken() {
  return getConfiguredEnvValue("NOTION_API_TOKEN", "NOTION_API_KEY");
}

async function syncExecutionArtifactsToNotion(input: {
  profile: FocusCityProfile;
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

export async function runCityLaunchExecutionHarness(input: {
  city: string;
  founderApproved?: boolean;
  reportsRoot?: string;
}) {
  const profile = resolveFocusCityProfile(input.city);
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
  const targetLedgerPath = path.join(runDirectory, `city-capture-target-ledger-${profile.key}.md`);
  const targetLedgerJsonPath = path.join(runDirectory, `city-capture-target-ledger-${profile.key}.json`);
  const approvalsPath = path.join(runDirectory, "founder-approvals.md");
  const manifestPath = path.join(runDirectory, "manifest.json");
  const canonicalSystemDocPath = buildCanonicalSystemDocPath(profile);
  const canonicalIssueBundlePath = buildCanonicalIssueBundlePath(profile);
  const canonicalTargetLedgerPath = buildCanonicalTargetLedgerPath(profile);
  const tasks = buildCityExecutionTasks(profile);
  const founderApprovals = buildFounderApprovals(profile);
  const sourceArtifacts = await listSourceArtifacts(profile);
  const targetLedger = buildCityCaptureTargetLedger(profile);
  const targetLedgerMarkdown = renderCityCaptureTargetLedgerMarkdown(targetLedger);
  const systemDocText = buildSystemDocMarkdown({
    profile,
    status,
    founderApprovals,
    sourceArtifacts,
    tasks,
  });
  const issueBundleText = buildTaskMarkdown(profile, tasks);
  const approvalsText = [
    `# ${profile.city} Founder Approval Checklist`,
    "",
    ...founderApprovals.map((item, index) => `${index + 1}. ${item}`),
  ].join("\n");

  await writeTextArtifact(systemDocPath, systemDocText);
  await writeTextArtifact(issueBundlePath, issueBundleText);
  await writeTextArtifact(issueBundleJsonPath, JSON.stringify(tasks, null, 2));
  await writeTextArtifact(targetLedgerPath, targetLedgerMarkdown);
  await writeTextArtifact(targetLedgerJsonPath, JSON.stringify(targetLedger, null, 2));
  await writeTextArtifact(approvalsPath, approvalsText);
  await writeTextArtifact(canonicalSystemDocPath, systemDocText);
  await writeTextArtifact(canonicalIssueBundlePath, issueBundleText);
  await writeTextArtifact(canonicalTargetLedgerPath, targetLedgerMarkdown);

  const result: CityLaunchExecutionResult = {
    city: profile.city,
    citySlug: profile.key,
    status,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    artifacts: {
      runDirectory,
      manifestPath,
      systemDocPath,
      issueBundlePath,
      issueBundleJsonPath,
      targetLedgerPath,
      targetLedgerJsonPath,
      approvalsPath,
      canonicalSystemDocPath,
      canonicalIssueBundlePath,
      canonicalTargetLedgerPath,
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

  await writeTextArtifact(manifestPath, JSON.stringify(result, null, 2));
  return result;
}

export async function runAustinLaunchExecutionHarness(input?: {
  founderApproved?: boolean;
  reportsRoot?: string;
}) {
  return runCityLaunchExecutionHarness({
    city: "Austin, TX",
    founderApproved: input?.founderApproved,
    reportsRoot: input?.reportsRoot,
  });
}

export function buildAustinExecutionTasks() {
  return buildCityExecutionTasks(resolveFocusCityProfile("Austin, TX"));
}
