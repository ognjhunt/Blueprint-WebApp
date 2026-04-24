import type {
  CityLaunchBuyerTargetRecord,
  CityLaunchProspectRecord,
  CityLaunchReplyConversionRecord,
  CityLaunchSendActionRecord,
} from "./cityLaunchLedgers";
import type {
  CityLaunchAgentLane,
  CityLaunchHumanLane,
  CityLaunchIssueSeedPhase,
  CityLaunchProofMotionMilestone,
  CityLaunchRequiredMetricDependencyKey,
} from "./cityLaunchDoctrine";
import type { CityLaunchProfile } from "./cityLaunchProfiles";

export type CityLaunchNoSignalRecoveryStatus = "not_triggered" | "triggered";

export type CityLaunchNoSignalRecoveryThresholds = {
  noSignalAfterDays: number;
  minSentActions: number;
};

export type CityLaunchNoSignalRecoverySignals = {
  sentDirectOutreach: number;
  sentDirectOutreachWithRecipient: number;
  firstSentAtIso: string | null;
  daysSinceFirstSent: number | null;
  recordedResponses: number;
  routedResponses: number;
  replyConversions: number;
  liveSupplyResponses: number;
  approvedCapturers: number;
  onboardedCapturers: number;
  capturingCapturers: number;
  buyerLiveEngagements: number;
  qualifiedSiteOperatorIntros: number;
  explicitNoResponseOutcomes: number;
};

export type CityLaunchNoSignalRecoveryDelegation = {
  key: string;
  ownerLane: CityLaunchAgentLane;
  workingLabel: string;
  purpose: string;
  safeAutonomousOutputs: string[];
  humanGates: string[];
};

export type CityLaunchNoSignalRecoveryArtifactPaths = {
  run: {
    recoveryReportPath: string;
    campaignMockPackPath: string;
    siteOperatorRecoveryPackPath: string;
    scorecardPath: string;
  };
  canonical: {
    recoveryReportPath: string;
    campaignMockPackPath: string;
    siteOperatorRecoveryPackPath: string;
    scorecardPath: string;
  };
};

export type CityLaunchNoSignalRecoveryResult = {
  status: CityLaunchNoSignalRecoveryStatus;
  triggered: boolean;
  city: string;
  citySlug: string;
  evaluatedAtIso: string;
  thresholds: CityLaunchNoSignalRecoveryThresholds;
  signals: CityLaunchNoSignalRecoverySignals;
  reason: string;
  triggerRule: string;
  delegations: CityLaunchNoSignalRecoveryDelegation[];
  successMetrics: string[];
  humanGates: string[];
  artifactPaths: CityLaunchNoSignalRecoveryArtifactPaths;
  dispatchStatus?: "not_applicable" | "pending" | "dispatched" | "failed";
  dispatchError?: string | null;
};

export type CityLaunchNoSignalRecoveryTaskSeed = {
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
};

const DEFAULT_NO_SIGNAL_RECOVERY_THRESHOLDS: CityLaunchNoSignalRecoveryThresholds = {
  noSignalAfterDays: 3,
  minSentActions: 2,
};

const LIVE_SUPPLY_STATUSES = new Set(["responded", "approved", "onboarded", "capturing"]);
const APPROVED_CAPTURER_STATUSES = new Set(["approved", "onboarded", "capturing"]);
const BUYER_LIVE_STATUSES = new Set([
  "engaged",
  "hosted_review",
  "commercial_handoff",
  "closed_won",
]);

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveNoSignalRecoveryThresholds(
  overrides?: Partial<CityLaunchNoSignalRecoveryThresholds>,
): CityLaunchNoSignalRecoveryThresholds {
  return {
    noSignalAfterDays:
      overrides?.noSignalAfterDays
      ?? parsePositiveInteger(
        process.env.BLUEPRINT_CITY_LAUNCH_NO_SIGNAL_RECOVERY_DAYS,
        DEFAULT_NO_SIGNAL_RECOVERY_THRESHOLDS.noSignalAfterDays,
      ),
    minSentActions:
      overrides?.minSentActions
      ?? parsePositiveInteger(
        process.env.BLUEPRINT_CITY_LAUNCH_NO_SIGNAL_RECOVERY_MIN_SENDS,
        DEFAULT_NO_SIGNAL_RECOVERY_THRESHOLDS.minSentActions,
      ),
  };
}

function parseIsoMillis(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
}

function daysBetween(firstIso: string | null, evaluatedAtIso: string) {
  const firstMillis = parseIsoMillis(firstIso);
  const evaluatedMillis = parseIsoMillis(evaluatedAtIso);
  if (firstMillis === null || evaluatedMillis === null || evaluatedMillis < firstMillis) {
    return null;
  }
  return Number(((evaluatedMillis - firstMillis) / 86_400_000).toFixed(2));
}

function sendActionSentAt(sendAction: CityLaunchSendActionRecord) {
  return sendAction.sentAtIso || sendAction.updatedAtIso || sendAction.createdAtIso || null;
}

function isSentDirectOutreach(sendAction: CityLaunchSendActionRecord) {
  return sendAction.actionType === "direct_outreach" && sendAction.status === "sent";
}

function isExplicitNoResponseOutcome(sendAction: CityLaunchSendActionRecord) {
  const notes = String(sendAction.notes || "").toLowerCase();
  return sendAction.status === "sent"
    && sendAction.responseIngestState === "closed"
    && /\b(no[- ]?response|no reply|nonresponse|no signal)\b/.test(notes);
}

function countQualifiedSiteOperatorIntros(prospects: CityLaunchProspectRecord[]) {
  return prospects.filter((prospect) => {
    const isOperatorLike = [
      prospect.sourceBucket,
      prospect.channel,
      prospect.siteCategory,
      prospect.workflowFit,
      prospect.notes,
    ]
      .map((value) => String(value || "").toLowerCase())
      .some((value) =>
        /\b(operator|warehouse|facility|leasing|aec|survey|owner|logistics)\b/.test(value),
      );
    const hasExternalTouch = Boolean(prospect.firstContactedAt || prospect.lastContactedAt);
    return isOperatorLike && hasExternalTouch && prospect.status === "qualified";
  }).length;
}

function buildSignals(input: {
  sendActions: CityLaunchSendActionRecord[];
  prospects: CityLaunchProspectRecord[];
  buyerTargets: CityLaunchBuyerTargetRecord[];
  replyConversions: CityLaunchReplyConversionRecord[];
  evaluatedAtIso: string;
}): CityLaunchNoSignalRecoverySignals {
  const sentDirectOutreach = input.sendActions.filter(isSentDirectOutreach);
  const firstSentAtIso = sentDirectOutreach
    .map(sendActionSentAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0] || null;
  const recordedResponses = input.sendActions.filter((entry) =>
    ["response_recorded", "routed", "closed"].includes(entry.responseIngestState),
  ).length;
  const routedResponses = input.sendActions.filter((entry) =>
    ["routed", "closed"].includes(entry.responseIngestState),
  ).length;
  const liveSupplyProspects = input.prospects.filter((entry) =>
    LIVE_SUPPLY_STATUSES.has(entry.status),
  );

  return {
    sentDirectOutreach: sentDirectOutreach.length,
    sentDirectOutreachWithRecipient: sentDirectOutreach.filter((entry) =>
      Boolean(entry.recipientEmail),
    ).length,
    firstSentAtIso,
    daysSinceFirstSent: daysBetween(firstSentAtIso, input.evaluatedAtIso),
    recordedResponses,
    routedResponses,
    replyConversions: input.replyConversions.length,
    liveSupplyResponses: liveSupplyProspects.length,
    approvedCapturers: input.prospects.filter((entry) =>
      APPROVED_CAPTURER_STATUSES.has(entry.status),
    ).length,
    onboardedCapturers: input.prospects.filter((entry) =>
      entry.status === "onboarded",
    ).length,
    capturingCapturers: input.prospects.filter((entry) =>
      entry.status === "capturing",
    ).length,
    buyerLiveEngagements: input.buyerTargets.filter((entry) =>
      BUYER_LIVE_STATUSES.has(entry.status),
    ).length,
    qualifiedSiteOperatorIntros: countQualifiedSiteOperatorIntros(input.prospects),
    explicitNoResponseOutcomes: input.sendActions.filter(isExplicitNoResponseOutcome).length,
  };
}

function hasPositiveLiveSignal(signals: CityLaunchNoSignalRecoverySignals) {
  return signals.recordedResponses > 0
    || signals.routedResponses > 0
    || signals.replyConversions > 0
    || signals.liveSupplyResponses > 0
    || signals.approvedCapturers > 0
    || signals.onboardedCapturers > 0
    || signals.capturingCapturers > 0
    || signals.buyerLiveEngagements > 0
    || signals.qualifiedSiteOperatorIntros > 0;
}

function buildDelegations(): CityLaunchNoSignalRecoveryDelegation[] {
  return [
    {
      key: "capturer-growth-no-signal-diagnosis",
      ownerLane: "capturer-growth-agent",
      workingLabel: "capturer growth recovery",
      purpose:
        "Diagnose why the supply lane produced no applicants or capturer signal, then produce a revised source plan and capturer-facing campaign brief.",
      safeAutonomousOutputs: [
        "source-bucket diagnosis",
        "capturer-facing campaign brief",
        "revised source plan with applicant/capturer signal metrics",
      ],
      humanGates: ["live posting", "paid spend", "trust/payout exceptions"],
    },
    {
      key: "city-opening-coherence-recovery",
      ownerLane: "city-launch-agent",
      workingLabel: "city-opening CTA and routing recovery",
      purpose:
        "Keep city-opening CTA, reply routing, source buckets, and scorecard outcomes coherent while recovery lanes branch out.",
      safeAutonomousOutputs: [
        "CTA/routing update",
        "source-bucket map",
        "updated no-signal scorecard",
      ],
      humanGates: ["policy posture changes", "rights/privacy exceptions"],
    },
    {
      key: "marketing-brand-content-mock-pack",
      ownerLane: "community-updates-agent",
      workingLabel: "marketing, brand, and content draft lane",
      purpose:
        "Create campaign assets, landing-copy variants, short video/mock creative, and channel-specific drafts without live publishing.",
      safeAutonomousOutputs: [
        "campaign mock pack",
        "landing-copy variants",
        "short video/storyboard concepts",
        "channel-specific draft copy",
      ],
      humanGates: ["live public posting", "paid spend", "brand-risk exceptions"],
    },
    {
      key: "site-operator-non-public-recovery",
      ownerLane: "site-operator-partnership-agent",
      workingLabel: "non-public-location access recovery",
      purpose:
        "Run the warehouse, facility, operator, leasing, AEC/survey, and site-owner path with access and rights boundaries explicit.",
      safeAutonomousOutputs: [
        "site-operator target buckets",
        "rights-aware operator intro pack",
        "private-site access sequence draft",
      ],
      humanGates: ["private controlled site commitment", "rights/privacy exception", "non-standard commercial commitment"],
    },
    {
      key: "recipient-backed-outbound-recovery",
      ownerLane: "outbound-sales-agent",
      workingLabel: "proof-led outbound recovery",
      purpose:
        "Continue buyer/operator outbound only when recipient evidence exists and copy stays proof-led instead of qualification-first.",
      safeAutonomousOutputs: [
        "recipient-evidence check",
        "proof-led outbound copy variants",
        "no-response outcome ledger update",
      ],
      humanGates: ["live send without approved transport", "recipient-evidence gap", "commercial exception"],
    },
  ];
}

export function buildCityLaunchNoSignalRecovery(input: {
  profile: CityLaunchProfile;
  sendActions: CityLaunchSendActionRecord[];
  prospects: CityLaunchProspectRecord[];
  buyerTargets: CityLaunchBuyerTargetRecord[];
  replyConversions: CityLaunchReplyConversionRecord[];
  artifactPaths: CityLaunchNoSignalRecoveryArtifactPaths;
  evaluatedAtIso?: string;
  thresholds?: Partial<CityLaunchNoSignalRecoveryThresholds>;
}): CityLaunchNoSignalRecoveryResult {
  const evaluatedAtIso = input.evaluatedAtIso || new Date().toISOString();
  const thresholds = resolveNoSignalRecoveryThresholds(input.thresholds);
  const signals = buildSignals({
    sendActions: input.sendActions,
    prospects: input.prospects,
    buyerTargets: input.buyerTargets,
    replyConversions: input.replyConversions,
    evaluatedAtIso,
  });
  const positiveLiveSignal = hasPositiveLiveSignal(signals);
  const reachedSendThreshold = signals.sentDirectOutreach >= thresholds.minSentActions;
  const reachedAgeThreshold =
    signals.daysSinceFirstSent !== null
    && signals.daysSinceFirstSent >= thresholds.noSignalAfterDays;
  const triggered = !positiveLiveSignal && (reachedSendThreshold || reachedAgeThreshold);
  const triggerRule =
    `no positive applicant/capturer/reply/operator signal after ${thresholds.noSignalAfterDays} days or ${thresholds.minSentActions} sent direct-outreach actions`;
  const reason = positiveLiveSignal
    ? "Not triggered because a positive live reply, applicant, capturer, operator, or buyer engagement signal is already recorded."
    : triggered
      ? `Triggered because ${input.profile.city} has ${signals.sentDirectOutreach} sent direct-outreach actions, ${signals.recordedResponses} recorded responses, ${signals.liveSupplyResponses} live supply responses, and ${signals.buyerLiveEngagements} live buyer/operator engagements.`
      : `Not triggered because ${input.profile.city} has not reached ${thresholds.noSignalAfterDays} days since first send or ${thresholds.minSentActions} sent direct-outreach actions.`;

  return {
    status: triggered ? "triggered" : "not_triggered",
    triggered,
    city: input.profile.city,
    citySlug: input.profile.key,
    evaluatedAtIso,
    thresholds,
    signals,
    reason,
    triggerRule,
    delegations: triggered ? buildDelegations() : [],
    successMetrics: [
      "applicant",
      "reply",
      "qualified site/operator intro",
      "capturer candidate",
      "explicit no-response outcome",
    ],
    humanGates: [
      "live public posting",
      "paid spend",
      "rights/privacy exceptions",
      "private controlled site commitments",
      "live sends without recipient-backed evidence or approved transport",
    ],
    artifactPaths: input.artifactPaths,
    dispatchStatus: triggered ? "pending" : "not_applicable",
    dispatchError: null,
  };
}

function sanitizeTableCell(value: unknown) {
  return String(value ?? "")
    .replace(/\|/g, "/")
    .replace(/\n+/g, " ")
    .trim() || "none";
}

function markdownList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function renderSignalsTable(signals: CityLaunchNoSignalRecoverySignals) {
  return [
    "| Signal | Count / value |",
    "| --- | --- |",
    `| sent direct outreach | ${signals.sentDirectOutreach} |`,
    `| sent direct outreach with recipient evidence | ${signals.sentDirectOutreachWithRecipient} |`,
    `| first sent at | ${signals.firstSentAtIso || "none"} |`,
    `| days since first send | ${signals.daysSinceFirstSent ?? "none"} |`,
    `| recorded responses | ${signals.recordedResponses} |`,
    `| routed responses | ${signals.routedResponses} |`,
    `| reply conversions | ${signals.replyConversions} |`,
    `| live supply responses | ${signals.liveSupplyResponses} |`,
    `| approved capturers | ${signals.approvedCapturers} |`,
    `| onboarded capturers | ${signals.onboardedCapturers} |`,
    `| capturing capturers | ${signals.capturingCapturers} |`,
    `| live buyer/operator engagements | ${signals.buyerLiveEngagements} |`,
    `| qualified site/operator intros | ${signals.qualifiedSiteOperatorIntros} |`,
    `| explicit no-response outcomes | ${signals.explicitNoResponseOutcomes} |`,
  ].join("\n");
}

export function renderCityLaunchNoSignalRecoveryMarkdown(
  recovery: CityLaunchNoSignalRecoveryResult,
) {
  return [
    `# ${recovery.city} No-Signal Recovery`,
    "",
    `- status: ${recovery.status}`,
    `- evaluated_at: ${recovery.evaluatedAtIso}`,
    `- trigger_rule: ${recovery.triggerRule}`,
    `- reason: ${recovery.reason}`,
    `- dispatch_status: ${recovery.dispatchStatus || "not_applicable"}`,
    recovery.dispatchError ? `- dispatch_error: ${recovery.dispatchError}` : null,
    "",
    "## Thresholds",
    "",
    `- no_signal_after_days: ${recovery.thresholds.noSignalAfterDays}`,
    `- min_sent_actions: ${recovery.thresholds.minSentActions}`,
    "",
    "## Signal Snapshot",
    "",
    renderSignalsTable(recovery.signals),
    "",
    "## Delegation Plan",
    "",
    recovery.delegations.length > 0
      ? [
          "| Delegation | Owner | Safe autonomous outputs | Human gates |",
          "| --- | --- | --- | --- |",
          ...recovery.delegations.map((delegation) =>
            `| ${sanitizeTableCell(delegation.workingLabel)} | ${delegation.ownerLane} | ${sanitizeTableCell(delegation.safeAutonomousOutputs.join("; "))} | ${sanitizeTableCell(delegation.humanGates.join("; "))} |`,
          ),
        ].join("\n")
      : "- no recovery delegations are active yet",
    "",
    "## Measurement Outputs",
    "",
    markdownList(recovery.successMetrics),
    "",
    "## Human Gates That Remain",
    "",
    markdownList(recovery.humanGates),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function renderCityLaunchCampaignMockPackMarkdown(input: {
  profile: CityLaunchProfile;
  recovery: CityLaunchNoSignalRecoveryResult;
}) {
  const { profile, recovery } = input;
  if (!recovery.triggered) {
    return [
      `# ${profile.city} City-Opening Campaign Mock Pack`,
      "",
      "- status: not active",
      `- reason: ${recovery.reason}`,
      "- activation_rule: create full campaign mocks only after the no-signal recovery trigger fires",
      "- live_public_posting: human-gated",
      "- paid_spend: human-gated",
    ].join("\n");
  }

  return [
    `# ${profile.city} City-Opening Campaign Mock Pack`,
    "",
    "- status: draft-only recovery artifact",
    "- live_public_posting: human-gated",
    "- paid_spend: human-gated",
    "- purpose: city-launch recovery after the first supply/outreach motion produced no positive live signal",
    "",
    "## Campaign Frame",
    "",
    `Blueprint is opening ${profile.shortLabel} for site-specific world-model proof. The campaign should route people toward one concrete output: a real site, a capturer candidate, an operator intro, a buyer reply, or an explicit no-response outcome.`,
    "",
    "## Landing-Copy Variants",
    "",
    "### Capturer-Facing",
    "",
    `Blueprint is looking for ${profile.shortLabel} capturers who can help turn real commercial spaces into useful robot-team world models. Apply only if you can capture lawful public or approved-access locations and keep provenance clear.`,
    "",
    "### Site-Operator-Facing",
    "",
    `Operate or manage a ${profile.shortLabel} warehouse, facility, yard, or commercial space? Blueprint can turn approved site access into a hosted review surface for robot teams without claiming rights we do not have.`,
    "",
    "### Buyer/Robot-Team-Facing",
    "",
    `Need a real ${profile.shortLabel} site modeled for a robot workflow? Send the site type, workflow lane, and review need. Blueprint will keep proof tied to actual capture provenance.`,
    "",
    "## Short Video / Mock Creative",
    "",
    "- 15s concept: show a real site category, the capture handoff, and the hosted-review outcome. No fake proof assets.",
    "- 30s concept: open with the operator problem, show lawful capture flow, close on a proof-led CTA.",
    "- Static mock: one real-space signal, one capture task, one hosted-review outcome. Avoid qualification-first language.",
    "",
    "## Channel Drafts",
    "",
    "| Channel | Draft posture | CTA | Gate |",
    "| --- | --- | --- | --- |",
    `| public commercial community | public-area-only sourcing draft | Apply or refer a lawful public/commercial capture path in ${profile.shortLabel} | live posting approval |`,
    `| professional capturer outreach | recipient-backed direct draft | Reply with lawful access/capture availability | transport and recipient evidence |`,
    `| site-operator intro | private-site access-aware draft | Request an operator intro or site review | private controlled site commitment |`,
    `| buyer/operator outbound | proof-led direct draft | Name a site/workflow needing proof | recipient-backed evidence |`,
    "",
    "## Scorecard Targets",
    "",
    markdownList(recovery.successMetrics),
  ].join("\n");
}

export function renderCityLaunchSiteOperatorRecoveryPackMarkdown(input: {
  profile: CityLaunchProfile;
  recovery: CityLaunchNoSignalRecoveryResult;
  prospects: CityLaunchProspectRecord[];
  buyerTargets: CityLaunchBuyerTargetRecord[];
}) {
  if (!input.recovery.triggered) {
    return [
      `# ${input.profile.city} Site-Operator Recovery Pack`,
      "",
      "- status: not active",
      `- reason: ${input.recovery.reason}`,
      "- activation_rule: open the non-public-location recovery path only after the no-signal recovery trigger fires",
      "- private_controlled_site_commitments: human-gated",
    ].join("\n");
  }

  const operatorProspects = input.prospects.filter((entry) =>
    [
      entry.sourceBucket,
      entry.channel,
      entry.siteCategory,
      entry.workflowFit,
      entry.notes,
    ]
      .map((value) => String(value || "").toLowerCase())
      .some((value) => /\b(operator|warehouse|facility|leasing|aec|survey|owner|logistics)\b/.test(value)),
  );
  const buyerLinkedTargets = input.buyerTargets.filter((entry) =>
    ["exact_site", "nearby_site", "scoped_follow_up"].includes(String(entry.proofPath || "")),
  );

  return [
    `# ${input.profile.city} Site-Operator Recovery Pack`,
    "",
    "- status: draft-only recovery artifact",
    "- scope: warehouses, facilities, operators, leasing reps, AEC/survey firms, and site owners",
    "- access boundary: private controlled interiors require explicit authorization before capture or commitment",
    "",
    "## Autonomous Work Allowed Now",
    "",
    "- research and rank operator/site-owner buckets",
    "- draft access-aware intro copy",
    "- prepare operator value prop and FAQ",
    "- identify recipient-evidence gaps without inventing contacts",
    "- update the city-opening scorecard with no-response outcomes",
    "",
    "## Human Gates",
    "",
    markdownList(input.recovery.humanGates),
    "",
    "## Target Buckets",
    "",
    "| Bucket | Reason | Output |",
    "| --- | --- | --- |",
    "| warehouse and logistics operators | closest to robot workflow proof | operator intro draft and access path |",
    "| facility managers and site owners | authority over controlled interiors | rights-aware site review pack |",
    "| leasing reps and industrial brokers | path to property/operator introductions | intro/referral script |",
    "| AEC, survey, and reality-capture firms | credible site/capture operators | capturer/operator referral path |",
    "| buyer-linked exact sites | proof can be tied to a real buyer need | proof-led access request draft |",
    "",
    "## Current Operator-Like Candidates",
    "",
    operatorProspects.length > 0
      ? [
          "| Candidate | Channel | Site | Contact evidence | Status | Notes |",
          "| --- | --- | --- | --- | --- | --- |",
          ...operatorProspects.map((entry) =>
            `| ${sanitizeTableCell(entry.name)} | ${sanitizeTableCell(entry.channel)} | ${sanitizeTableCell(entry.siteAddress || entry.locationSummary)} | ${entry.email ? "recipient present" : "missing"} | ${entry.status} | ${sanitizeTableCell(entry.notes || entry.priorityNote)} |`,
          ),
        ].join("\n")
      : "- no operator-like candidates are materialized yet",
    "",
    "## Buyer-Linked Site Paths",
    "",
    buyerLinkedTargets.length > 0
      ? [
          "| Buyer / operator | Proof path | Recipient evidence | Status | Notes |",
          "| --- | --- | --- | --- | --- |",
          ...buyerLinkedTargets.map((entry) =>
            `| ${sanitizeTableCell(entry.companyName)} | ${sanitizeTableCell(entry.proofPath)} | ${entry.contactEmail ? "recipient present" : "missing"} | ${entry.status} | ${sanitizeTableCell(entry.notes)} |`,
          ),
        ].join("\n")
      : "- no buyer-linked site paths are materialized yet",
  ].join("\n");
}

export function renderCityLaunchNoSignalScorecardMarkdown(
  recovery: CityLaunchNoSignalRecoveryResult,
) {
  return [
    `# ${recovery.city} City-Opening No-Signal Scorecard`,
    "",
    `- status: ${recovery.status}`,
    `- evaluated_at: ${recovery.evaluatedAtIso}`,
    `- trigger_rule: ${recovery.triggerRule}`,
    "",
    "## Outcome Counters",
    "",
    renderSignalsTable(recovery.signals),
    "",
    "## Recovery Outcome Standard",
    "",
    "- applicant: a real person applies or asks for capturer next steps",
    "- reply: a recipient-backed contact responds",
    "- qualified site/operator intro: an operator, site owner, leasing rep, AEC/survey firm, or buyer-linked site path advances with evidence",
    "- capturer candidate: a real capturer candidate is routed with source bucket and trust evidence",
    "- explicit no-response outcome: the lane records no response after the approved follow-up window instead of leaving the result ambiguous",
    "",
    "## Active Recovery Lanes",
    "",
    recovery.delegations.length > 0
      ? recovery.delegations.map((entry) => `- ${entry.ownerLane}: ${entry.purpose}`).join("\n")
      : "- no recovery lanes are active yet",
  ].join("\n");
}

export function buildNoSignalRecoveryTaskSeeds(input: {
  profile: CityLaunchProfile;
  recovery: CityLaunchNoSignalRecoveryResult;
  artifactInputs: string[];
}): CityLaunchNoSignalRecoveryTaskSeed[] {
  if (!input.recovery.triggered) {
    return [];
  }

  const inputs = input.artifactInputs;
  return [
    {
      key: "no-signal-capturer-source-recovery",
      phase: "supply",
      title: `Recover ${input.profile.shortLabel} capturer sourcing after no live signal`,
      ownerLane: "capturer-growth-agent",
      humanLane: "growth-lead",
      purpose:
        "Diagnose why the supply lane produced no applicants or capturer signal, then produce a revised source plan and capturer-facing campaign brief.",
      inputs,
      dependencies: ["city-opening-response-tracking", "city-opening-reply-conversion"],
      doneWhen: [
        "The no-signal diagnosis separates source, copy, channel, CTA, trust, and recipient-evidence gaps.",
        "A revised source plan names concrete source buckets and the metric each bucket should produce: applicant, reply, qualified site/operator intro, capturer candidate, or explicit no-response outcome.",
        "The capturer-facing campaign brief stays capture-first and does not invent supply, readiness, or proof.",
      ],
      humanGate:
        "Human review is required only for live public posting, paid spend, trust/payout exceptions, or policy posture changes.",
      metricsDependencies: ["first_approved_capturer"],
      validationRequired: false,
    },
    {
      key: "no-signal-city-opening-coherence",
      phase: "measurement",
      title: `Keep ${input.profile.shortLabel} no-signal recovery CTA and scorecard coherent`,
      ownerLane: "city-launch-agent",
      humanLane: "growth-lead",
      purpose:
        "Keep the city-opening CTA, reply routing, source buckets, and recovery scorecard coherent while recovery lanes execute.",
      inputs,
      dependencies: ["city-opening-cta-routing", "city-opening-response-tracking"],
      doneWhen: [
        "The CTA route names the owning queue, source tags, reply owner, and next state for every recovery channel.",
        "The city-opening scorecard distinguishes applicant, reply, qualified site/operator intro, capturer candidate, and explicit no-response outcomes.",
        "Source buckets stay aligned with public-commercial, professional-capturer, site-operator, and buyer/operator paths.",
      ],
      humanGate:
        "Human review is required only for policy posture changes, rights/privacy exceptions, live public posting, or spend.",
      metricsDependencies: ["robot_team_inbound_captured", "proof_path_assigned"],
      validationRequired: false,
    },
    {
      key: "no-signal-marketing-campaign-mock-pack",
      phase: "supply",
      title: `Draft ${input.profile.shortLabel} city-opening campaign mocks and creative`,
      ownerLane: "community-updates-agent",
      humanLane: "growth-lead",
      purpose:
        "Create campaign assets, landing-copy variants, short video/mock creative, and channel-specific drafts as safe mocks only.",
      inputs,
      dependencies: ["no-signal-city-opening-coherence"],
      doneWhen: [
        "A draft campaign pack exists with landing-copy variants, channel drafts, and short video/mock concepts.",
        "Every asset is marked draft-only until live posting, spend, and connector readiness are approved.",
        "Copy stays proof-led and world-model-product-first, not generic growth or qualification-first.",
      ],
      humanGate:
        "Human review is required for live public posting, paid spend, connector policy readiness, or brand-risk exceptions.",
      metricsDependencies: ["robot_team_inbound_captured"],
      validationRequired: false,
    },
    {
      key: "no-signal-site-operator-recovery",
      phase: "supply",
      title: `Open the ${input.profile.shortLabel} non-public site-operator recovery path`,
      ownerLane: "site-operator-partnership-agent",
      humanLane: "growth-lead",
      purpose:
        "Run the non-public-location recovery path across warehouses, facilities, operators, leasing reps, AEC/survey firms, and site owners with rights/access boundaries explicit.",
      inputs,
      dependencies: ["parallel-lawful-access-queue", "site-operator-partnership"],
      doneWhen: [
        "The recovery pack names operator/site-owner buckets, current recipient-evidence gaps, and next intro drafts.",
        "Private controlled site commitments stay gated while research, drafts, and targeting lists proceed autonomously.",
        "At least one access-aware operator/site-owner path is ready for approved outreach or explicitly marked no-response/no-evidence.",
      ],
      humanGate:
        "Human review is required for private controlled site commitments, rights/privacy exceptions, and non-standard commercial terms.",
      metricsDependencies: ["first_lawful_access_path"],
      validationRequired: false,
    },
    {
      key: "no-signal-recipient-backed-outbound-recovery",
      phase: "demand",
      title: `Continue ${input.profile.shortLabel} proof-led outbound recovery only with recipient evidence`,
      ownerLane: "outbound-sales-agent",
      humanLane: "growth-lead",
      purpose:
        "Continue buyer/operator outbound only when recipient evidence exists and copy stays tied to capture provenance and proof-motion outcomes.",
      inputs,
      dependencies: ["no-signal-site-operator-recovery", "buyer-target-research"],
      doneWhen: [
        "Every outbound draft has recipient-backed evidence before live send.",
        "Proof-led copy variants exist for buyer, operator, and site-owner paths.",
        "No-response outcomes are recorded instead of leaving send attempts ambiguous.",
      ],
      humanGate:
        "Human review is required for live sends without approved transport, missing recipient evidence, or commercial exceptions.",
      metricsDependencies: ["proof_path_assigned", "hosted_review_started"],
      validationRequired: false,
    },
  ];
}
