import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin.js";
import { executeAction } from "../agents/action-executor.js";
import {
  PERSONA_LIFECYCLE_POLICY,
  validateRecipientEmailAddress,
} from "../agents/action-policies.js";
import {
  appendCommercialEmailFooter,
  buildUnsubscribeUrl,
  isEmailSuppressed,
} from "./email-suppression.js";

export const LIFECYCLE_CADENCE_COLLECTION = "lifecycle_email_cadences";

export type LifecyclePersona = "site_operator" | "capturer" | "robot_team";

export type LifecycleCadenceStep = {
  key: string;
  dayOffset: number;
  scheduledAt: string;
  status: "pending" | "pending_approval" | "sent" | "skipped" | "suppressed" | "failed";
  agentOwner: string;
  policyOwner: "growth-lead";
  subject: string;
  body: string;
  ctaQuestion: string;
  skipIfEventKeys: string[];
  requiredEventKeys?: string[];
  requiresHumanReview: true;
  emailClass: "commercial_lifecycle";
  skipReason?: string;
  ledgerDocId?: string;
  queuedAt?: string;
};

type PersonaContract = {
  persona: LifecyclePersona;
  agentOwner: string;
  policyOwner: "growth-lead";
  activationMoment: string;
  activationEventKeys: string[];
};

export const LIFECYCLE_PERSONA_CONTRACTS: Record<LifecyclePersona, PersonaContract> = {
  site_operator: {
    persona: "site_operator",
    agentOwner: "site-operator-partnership-agent",
    policyOwner: "growth-lead",
    activationMoment:
      "operator confirms a site claim, access boundary, or commercialization/privacy boundary worth reviewing",
    activationEventKeys: [
      "site_claim_submitted",
      "access_boundary_defined",
      "operator_reply_received",
    ],
  },
  capturer: {
    persona: "capturer",
    agentOwner: "capturer-success-agent",
    policyOwner: "growth-lead",
    activationMoment: "capturer completes a first usable capture or capture-readiness step",
    activationEventKeys: [
      "capturer_signup_submitted",
      "first_capture_uploaded",
      "first_capture_passed",
      "repeat_capture_uploaded",
    ],
  },
  robot_team: {
    persona: "robot_team",
    agentOwner: "robot-team-growth-agent",
    policyOwner: "growth-lead",
    activationMoment:
      "robot team requests or receives an exact-site proof path, hosted review, or entitlement",
    activationEventKeys: [
      "robot_team_signup_submitted",
      "exact_site_requested",
      "proof_pack_delivered",
      "hosted_review_started",
      "entitlement_provisioned",
    ],
  },
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return normalizeString(value).toLowerCase();
}

function displayNameOrFallback(displayName: string | undefined, email: string) {
  if (displayName && displayName.trim()) {
    return displayName.trim();
  }
  const localPart = email.split("@")[0] || "there";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "there";
}

function cadenceDayToDelayMs(dayOffset: number) {
  if (dayOffset <= 0) {
    return 0;
  }
  return Math.max(1, dayOffset - 1) * 86_400_000;
}

function scheduledAtForDay(nowIso: string, dayOffset: number) {
  const baseMs = new Date(nowIso).getTime();
  const safeBase = Number.isFinite(baseMs) ? baseMs : Date.now();
  return new Date(safeBase + cadenceDayToDelayMs(dayOffset)).toISOString();
}

function sentenceList(values: string[]) {
  return values.filter(Boolean).join(" ");
}

function operatorSteps(params: {
  name: string;
  siteLabel: string;
  sourceLabel: string;
  nowIso: string;
  agentOwner: string;
  policyOwner: "growth-lead";
}): LifecycleCadenceStep[] {
  const shared = {
    agentOwner: params.agentOwner,
    policyOwner: params.policyOwner,
    requiresHumanReview: true as const,
    emailClass: "commercial_lifecycle" as const,
  };
  const site = params.siteLabel || params.sourceLabel || "your site";

  return [
    {
      key: "operator_welcome_day0",
      dayOffset: 0,
      scheduledAt: scheduledAtForDay(params.nowIso, 0),
      status: "pending",
      subject: `Blueprint received the ${site} operator note`,
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        `Blueprint received your note about ${site}. The useful next step is to make the site boundary concrete without turning operator approval into a universal prerequisite for every Blueprint package.`,
        "",
        "The operator lane helps us understand lawful access, privacy constraints, commercial boundaries, and what the site team would want a robot team to know before a hosted review.",
        "",
        "Could you reply with the one boundary Blueprint should not cross for this site?",
      ]),
      ctaQuestion: "What is the one boundary Blueprint should not cross for this site?",
      skipIfEventKeys: ["operator_reply_received", "access_boundary_defined"],
      ...shared,
    },
    {
      key: "operator_access_boundary_day2",
      dayOffset: 2,
      scheduledAt: scheduledAtForDay(params.nowIso, 2),
      status: "pending",
      subject: `Access boundary for ${site}`,
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        `For ${site}, the most useful operator input is usually the access boundary: which areas can be captured, what hours or escort rules apply, and what should stay out of scope.`,
        "",
        "This does not create a blanket permission gate. It gives Blueprint a truthful operating envelope when a real capture or hosted review needs one.",
        "",
        "Which one access rule should we attach to the site record first?",
      ]),
      ctaQuestion: "Which one access rule should we attach to the site record first?",
      skipIfEventKeys: ["access_boundary_defined"],
      ...shared,
    },
    {
      key: "operator_privacy_rules_day5",
      dayOffset: 5,
      scheduledAt: scheduledAtForDay(params.nowIso, 5),
      status: "pending",
      subject: `Privacy notes before ${site} becomes a package`,
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        `Before Blueprint turns ${site} into a reusable site-specific package, we want the privacy and derived-scene boundary to be explicit.`,
        "",
        "The record should say what capture evidence exists, what is simulated or generated, and what cannot be shared downstream.",
        "",
        "What privacy or commercialization constraint should be visible to Blueprint operators first?",
      ]),
      ctaQuestion: "What privacy or commercialization constraint should be visible to Blueprint operators first?",
      skipIfEventKeys: ["privacy_boundary_defined", "commercialization_boundary_defined"],
      ...shared,
    },
    {
      key: "operator_day7_feedback",
      dayOffset: 7,
      scheduledAt: scheduledAtForDay(params.nowIso, 7),
      status: "pending",
      subject: `One-week check-in on ${site}`,
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        `A week in, the goal is simple: decide whether ${site} should stay as an operator-reviewed site, move toward capture planning, or wait until there is a specific robot-team demand signal.`,
        "",
        "We should not push the site forward on vague readiness.",
        "",
        "Which path is most accurate right now: hold, capture-plan, or buyer-demand first?",
      ]),
      ctaQuestion: "Which path is most accurate right now: hold, capture-plan, or buyer-demand first?",
      skipIfEventKeys: ["operator_path_confirmed"],
      ...shared,
    },
    {
      key: "operator_day14_product_update",
      dayOffset: 14,
      scheduledAt: scheduledAtForDay(params.nowIso, 14),
      status: "pending",
      subject: `How ${site} would appear in Blueprint updates`,
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        "Blueprint community updates stay proof-led. If a site is mentioned, the update should separate real capture provenance from generated previews and internal planning status.",
        "",
        `For ${site}, we can keep updates private, anonymized, or excluded until there is explicit evidence worth sharing.`,
        "",
        "Which visibility mode should Blueprint assume for now?",
      ]),
      ctaQuestion: "Which visibility mode should Blueprint assume for now?",
      skipIfEventKeys: ["operator_visibility_confirmed"],
      ...shared,
    },
    {
      key: "operator_day30_reengage",
      dayOffset: 30,
      scheduledAt: scheduledAtForDay(params.nowIso, 30),
      status: "pending",
      subject: `Should Blueprint keep ${site} active?`,
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        `If ${site} has gone quiet, Blueprint should either attach one useful operator note or stop treating the site as active.`,
        "",
        "That keeps the system truthful: no fake site readiness, no invented proof, and no vague launch status.",
        "",
        "Should we keep this site active, pause it, or close the loop for now?",
      ]),
      ctaQuestion: "Should we keep this site active, pause it, or close the loop for now?",
      skipIfEventKeys: ["operator_path_confirmed", "operator_closed_loop"],
      ...shared,
    },
  ];
}

function capturerSteps(params: {
  name: string;
  sourceLabel: string;
  nowIso: string;
  agentOwner: string;
  policyOwner: "growth-lead";
}): LifecycleCadenceStep[] {
  const shared = {
    agentOwner: params.agentOwner,
    policyOwner: params.policyOwner,
    requiresHumanReview: true as const,
    emailClass: "commercial_lifecycle" as const,
  };
  const place = params.sourceLabel || "the first site";
  return [
    {
      key: "capturer_welcome_day0",
      dayOffset: 0,
      scheduledAt: scheduledAtForDay(params.nowIso, 0),
      status: "pending",
      subject: "Your first useful Blueprint capture",
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        "Welcome to Blueprint Capture. The first milestone is not a perfect portfolio. It is one real capture with enough provenance for a site-specific world-model package.",
        "",
        `If ${place} is the best starting point, we can route the capture toward QA and repeat-ready guidance once it exists.`,
        "",
        "What is the first site or route you can realistically capture?",
      ]),
      ctaQuestion: "What is the first site or route you can realistically capture?",
      skipIfEventKeys: ["first_capture_uploaded", "first_capture_passed"],
      ...shared,
    },
    {
      key: "capturer_first_capture_plan_day2",
      dayOffset: 2,
      scheduledAt: scheduledAtForDay(params.nowIso, 2),
      status: "pending",
      subject: "Plan the first capture pass",
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        "The cleanest first pass is a lawful, rights-safe route through one site with clear notes on device, time, and any boundary that affects downstream use.",
        "",
        "Blueprint can use a narrow first pass better than a broad, unlabeled upload.",
        "",
        "What device and site route are you planning to use first?",
      ]),
      ctaQuestion: "What device and site route are you planning to use first?",
      skipIfEventKeys: ["first_capture_uploaded", "first_capture_passed"],
      ...shared,
    },
    {
      key: "capturer_unblock_day5",
      dayOffset: 5,
      scheduledAt: scheduledAtForDay(params.nowIso, 5),
      status: "pending",
      subject: "What is blocking the first upload?",
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        "If the first capture has not landed yet, the useful thing is to name the blocker: device setup, site access, route uncertainty, upload trouble, or privacy concerns.",
        "",
        "The capturer-success lane can route the next step once the blocker is real.",
        "",
        "Which one blocker should we help remove first?",
      ]),
      ctaQuestion: "Which one blocker should we help remove first?",
      skipIfEventKeys: ["first_capture_uploaded", "first_capture_passed"],
      ...shared,
    },
    {
      key: "capturer_day7_qa_check",
      dayOffset: 7,
      scheduledAt: scheduledAtForDay(params.nowIso, 7),
      status: "pending",
      subject: "First-week capture QA",
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        "Once a capture exists, Blueprint should turn it into clear QA feedback: what passed, what needs another pass, and what provenance is strong enough for a package.",
        "",
        "We do not want you guessing from vague readiness language.",
        "",
        "Do you want the next note to focus on QA feedback or repeat-capture planning?",
      ]),
      ctaQuestion: "Do you want the next note to focus on QA feedback or repeat-capture planning?",
      skipIfEventKeys: ["first_capture_passed", "repeat_capture_uploaded"],
      ...shared,
    },
    {
      key: "capturer_repeat_ready_day14",
      dayOffset: 14,
      scheduledAt: scheduledAtForDay(params.nowIso, 14),
      status: "pending",
      subject: "Repeat-ready capture work",
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        "The next useful stage is repeatability: another pass at the same site, a nearby site with similar geometry, or a capture route that fills a known buyer demand signal.",
        "",
        "Blueprint should only ask for more capture when there is a concrete use for it.",
        "",
        "Which repeat path would be easiest for you this month?",
      ]),
      ctaQuestion: "Which repeat path would be easiest for you this month?",
      skipIfEventKeys: ["repeat_capture_uploaded"],
      ...shared,
    },
    {
      key: "capturer_day30_reengage",
      dayOffset: 30,
      scheduledAt: scheduledAtForDay(params.nowIso, 30),
      status: "pending",
      subject: "One concrete capture next step",
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        "If capture work went quiet, the next step should stay concrete: one site, one route, or one blocker to clear. No daily nudges, no generic reminders.",
        "",
        "Blueprint will keep the capture record truthful and only mark progress when there is real evidence.",
        "",
        "What is the single next capture action you want us to route around?",
      ]),
      ctaQuestion: "What is the single next capture action you want us to route around?",
      skipIfEventKeys: ["repeat_capture_uploaded", "capturer_closed_loop"],
      ...shared,
    },
  ];
}

function robotTeamSteps(params: {
  name: string;
  siteLabel: string;
  sourceLabel: string;
  nowIso: string;
  agentOwner: string;
  policyOwner: "growth-lead";
}): LifecycleCadenceStep[] {
  const shared = {
    agentOwner: params.agentOwner,
    policyOwner: params.policyOwner,
    requiresHumanReview: true as const,
    emailClass: "commercial_lifecycle" as const,
  };
  const site = params.siteLabel || params.sourceLabel || "one real site";
  return [
    {
      key: "robot_team_welcome_day0",
      dayOffset: 0,
      scheduledAt: scheduledAtForDay(params.nowIso, 0),
      status: "pending",
      subject: "Your exact-site Blueprint path",
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        `Blueprint is useful when the work starts with one real site, not a generic model checkpoint. For ${site}, the right first step is to make the deployment question and proof path explicit.`,
        "",
        "The robot-team lane should help you decide whether an existing exact-site package, adjacent-site evidence, or a hosted review answers the next deployment question.",
        "",
        "What is the one site-specific question your team needs answered first?",
      ]),
      ctaQuestion: "What is the one site-specific question your team needs answered first?",
      skipIfEventKeys: ["hosted_review_started", "entitlement_provisioned"],
      ...shared,
    },
    {
      key: "robot_team_proof_path_day2",
      dayOffset: 2,
      scheduledAt: scheduledAtForDay(params.nowIso, 2),
      status: "pending",
      subject: "Choose the proof path before more demo work",
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        "The fastest useful path is usually one of three: exact-site required, adjacent site acceptable, or guidance needed before your team can choose.",
        "",
        "Blueprint should not pretend a generated preview is ground truth. The email should identify what is captured, what is simulated, and what still needs review.",
        "",
        "Which proof path matches your current deployment decision?",
      ]),
      ctaQuestion: "Which proof path matches your current deployment decision?",
      skipIfEventKeys: ["proof_path_confirmed", "hosted_review_started", "entitlement_provisioned"],
      ...shared,
    },
    {
      key: "robot_team_blocker_day5",
      dayOffset: 5,
      scheduledAt: scheduledAtForDay(params.nowIso, 5),
      status: "pending",
      subject: "Name the exact-site blocker",
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        "If the next step is blocked, the blocker is usually site choice, rights/privacy review, internal buyer alignment, package scope, or hosted-review timing.",
        "",
        "A real blocker helps Blueprint route the work. A generic reminder does not.",
        "",
        "Which blocker should we solve around first?",
      ]),
      ctaQuestion: "Which blocker should we solve around first?",
      skipIfEventKeys: ["hosted_review_started", "entitlement_provisioned", "buyer_blocker_recorded"],
      ...shared,
    },
    {
      key: "robot_team_day7_founder_check",
      dayOffset: 7,
      scheduledAt: scheduledAtForDay(params.nowIso, 7),
      status: "pending",
      subject: "One-week exact-site check",
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        "At the one-week mark, the useful founder-style check is whether Blueprint has helped your team narrow a real deployment decision.",
        "",
        "If the answer is no, we should change the package, site, or hosted-review framing instead of sending more generic product copy.",
        "",
        "What would make the next Blueprint review worth your team's time?",
      ]),
      ctaQuestion: "What would make the next Blueprint review worth your team's time?",
      skipIfEventKeys: ["hosted_review_started", "entitlement_provisioned"],
      ...shared,
    },
    {
      key: "robot_team_day14_product_update",
      dayOffset: 14,
      scheduledAt: scheduledAtForDay(params.nowIso, 14),
      status: "pending",
      subject: "How Blueprint updates should be useful to your team",
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        "Blueprint product and community updates should be proof-led: new capture types, hosted-review changes, delivery improvements, and clear limits on what is real capture versus generated preview.",
        "",
        "For your team, those updates should map to actual deployment questions instead of broad newsletter noise.",
        "",
        "Which kind of update would help your team decide faster?",
      ]),
      ctaQuestion: "Which kind of update would help your team decide faster?",
      skipIfEventKeys: ["community_update_preference_recorded"],
      ...shared,
    },
    {
      key: "robot_team_day30_reengage",
      dayOffset: 30,
      scheduledAt: scheduledAtForDay(params.nowIso, 30),
      status: "pending",
      subject: "Should Blueprint keep this site path active?",
      body: sentenceList([
        `Hi ${params.name},`,
        "",
        "If the exact-site path went quiet, Blueprint should offer one concrete restart: pick a site, review an existing proof pack, or close the loop until the deployment question changes.",
        "",
        "We should not keep inventing progress where there is no buyer action or capture evidence.",
        "",
        "Should we restart with a site, review proof, or pause this path?",
      ]),
      ctaQuestion: "Should we restart with a site, review proof, or pause this path?",
      skipIfEventKeys: ["hosted_review_started", "entitlement_provisioned", "buyer_closed_loop"],
      ...shared,
    },
  ];
}

export function buildLifecycleCadenceSteps(params: {
  persona: LifecyclePersona;
  email: string;
  displayName?: string | null;
  company?: string | null;
  sourceLabel?: string | null;
  siteLabel?: string | null;
  nowIso?: string | null;
}): LifecycleCadenceStep[] {
  const contract = LIFECYCLE_PERSONA_CONTRACTS[params.persona];
  const nowIso = params.nowIso || new Date().toISOString();
  const email = normalizeEmail(params.email);
  const name = displayNameOrFallback(params.displayName || "", email);
  const sourceLabel = normalizeString(params.sourceLabel || params.company || "");
  const siteLabel = normalizeString(params.siteLabel || params.sourceLabel || "");
  const base = {
    name,
    sourceLabel,
    siteLabel,
    nowIso,
    agentOwner: contract.agentOwner,
    policyOwner: contract.policyOwner,
  };

  if (params.persona === "site_operator") {
    return operatorSteps(base);
  }
  if (params.persona === "capturer") {
    return capturerSteps(base);
  }
  return robotTeamSteps(base);
}

function normalizeCompletedEventKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return [
    ...new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

function nowTimestamp() {
  return admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date();
}

export async function createLifecycleCadenceEnrollment(params: {
  persona: LifecyclePersona;
  email: string;
  displayName?: string | null;
  company?: string | null;
  sourceCollection: string;
  sourceDocId: string;
  sourceLabel?: string | null;
  siteLabel?: string | null;
  completedEventKeys?: string[] | null;
}) {
  const email = normalizeEmail(params.email);
  const validation = validateRecipientEmailAddress(email);
  if (!validation.valid) {
    return {
      created: false,
      reason: validation.reason || "invalid_email",
      cadenceId: null,
    };
  }
  if (!db) {
    return { created: false, reason: "database_unavailable", cadenceId: null };
  }

  const contract = LIFECYCLE_PERSONA_CONTRACTS[params.persona];
  const cadenceId = `${params.sourceCollection}:${params.sourceDocId}:${params.persona}`;
  const ref = db.collection(LIFECYCLE_CADENCE_COLLECTION).doc(cadenceId);
  const existing = await ref.get();
  if (existing.exists) {
    return { created: false, reason: "already_exists", cadenceId };
  }

  const createdAtIso = new Date().toISOString();
  const steps = buildLifecycleCadenceSteps({
    persona: params.persona,
    email,
    displayName: params.displayName,
    company: params.company,
    sourceLabel: params.sourceLabel,
    siteLabel: params.siteLabel,
    nowIso: createdAtIso,
  });

  await ref.set({
    cadence_id: cadenceId,
    persona: params.persona,
    email,
    display_name: normalizeString(params.displayName),
    company: normalizeString(params.company) || null,
    agent_owner: contract.agentOwner,
    policy_owner: contract.policyOwner,
    activation_moment: contract.activationMoment,
    activation_event_keys: contract.activationEventKeys,
    source_collection: params.sourceCollection,
    source_doc_id: params.sourceDocId,
    source_label: normalizeString(params.sourceLabel) || null,
    site_label: normalizeString(params.siteLabel) || null,
    completed_event_keys: normalizeCompletedEventKeys(params.completedEventKeys),
    community_update_relation:
      "community-updates-agent may draft proof-led cross-audience updates; this persona cadence only references those updates when they carry real value for this recipient.",
    status: "active",
    steps,
    created_at_iso: createdAtIso,
    updated_at_iso: createdAtIso,
    created_at: nowTimestamp(),
    updated_at: nowTimestamp(),
  });

  return { created: true, reason: null, cadenceId };
}

function scheduledAtForStep(step: LifecycleCadenceStep) {
  const scheduled = normalizeString(step.scheduledAt || (step as unknown as Record<string, unknown>).scheduled_at);
  const ms = new Date(scheduled).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

function firstCompletedSkipKey(step: LifecycleCadenceStep, completedEventKeys: string[]) {
  return (step.skipIfEventKeys || []).find((eventKey) => completedEventKeys.includes(eventKey)) || null;
}

function missingRequiredKey(step: LifecycleCadenceStep, completedEventKeys: string[]) {
  const required = step.requiredEventKeys || [];
  return required.find((eventKey) => !completedEventKeys.includes(eventKey)) || null;
}

function markStep(
  step: LifecycleCadenceStep,
  patch: Partial<LifecycleCadenceStep>,
): LifecycleCadenceStep {
  return {
    ...step,
    ...patch,
  };
}

export async function runLifecycleCadenceWorker(params?: {
  limit?: number;
  now?: Date;
}): Promise<{
  processedCount: number;
  failedCount: number;
  skippedCount: number;
  suppressedCount: number;
}> {
  if (!db) {
    throw new Error("Database not available");
  }

  const limit = Math.max(1, Math.min(params?.limit ?? 25, 100));
  const now = params?.now || new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const snapshot = await db
    .collection(LIFECYCLE_CADENCE_COLLECTION)
    .where("status", "==", "active")
    .limit(limit)
    .get();

  let processedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let suppressedCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    const persona = data.persona as LifecyclePersona;
    const contract = LIFECYCLE_PERSONA_CONTRACTS[persona];
    const email = normalizeEmail(data.email);
    const completedEventKeys = normalizeCompletedEventKeys(data.completed_event_keys);
    const steps = Array.isArray(data.steps)
      ? (data.steps as LifecycleCadenceStep[])
      : [];
    let changed = false;
    let lastStatus: string | null = normalizeString(data.last_status) || null;
    let lastLedgerDocId: string | null = normalizeString(data.last_ledger_doc_id) || null;
    let lastStepKey: string | null = normalizeString(data.last_step_key) || null;
    let lastAgentOwner: string | null = normalizeString(data.last_agent_owner) || null;
    const updatedSteps: LifecycleCadenceStep[] = [];

    for (const step of steps) {
      if (step.status !== "pending" || scheduledAtForStep(step) > nowMs) {
        updatedSteps.push(step);
        continue;
      }

      const suppressed = await isEmailSuppressed(email, "lifecycle");
      if (suppressed) {
        const nextStep = markStep(step, {
          status: "suppressed",
          skipReason: "email_suppressed",
          queuedAt: nowIso,
        });
        updatedSteps.push(nextStep);
        suppressedCount += 1;
        changed = true;
        lastStatus = "suppressed";
        lastStepKey = step.key;
        lastAgentOwner = step.agentOwner || contract.agentOwner;
        continue;
      }

      const skipKey = firstCompletedSkipKey(step, completedEventKeys);
      if (skipKey) {
        updatedSteps.push(
          markStep(step, {
            status: "skipped",
            skipReason: `event_completed:${skipKey}`,
            queuedAt: nowIso,
          }),
        );
        skippedCount += 1;
        changed = true;
        lastStatus = "skipped";
        lastStepKey = step.key;
        lastAgentOwner = step.agentOwner || contract.agentOwner;
        continue;
      }

      const requiredKey = missingRequiredKey(step, completedEventKeys);
      if (requiredKey) {
        updatedSteps.push(
          markStep(step, {
            status: "skipped",
            skipReason: `missing_required_event:${requiredKey}`,
            queuedAt: nowIso,
          }),
        );
        skippedCount += 1;
        changed = true;
        lastStatus = "skipped";
        lastStepKey = step.key;
        lastAgentOwner = step.agentOwner || contract.agentOwner;
        continue;
      }

      const unsubscribeUrl = buildUnsubscribeUrl({
        email,
        scope: "lifecycle",
        cadenceId: doc.id,
      });
      const body = appendCommercialEmailFooter({
        text: step.body,
        email,
        scope: "lifecycle",
        cadenceId: doc.id,
      });
      const agentOwner = step.agentOwner || contract.agentOwner;

      try {
        const action = await executeAction({
          sourceCollection: LIFECYCLE_CADENCE_COLLECTION,
          sourceDocId: doc.id,
          actionType: "send_email",
          actionPayload: {
            type: "send_email",
            to: email,
            subject: step.subject,
            body,
            commercialEmail: true,
            emailSuppressionScope: "lifecycle",
            unsubscribeUrl,
            lifecycleCadenceId: doc.id,
            lifecyclePersona: persona,
            lifecycleStepKey: step.key,
            lifecycleDayOffset: step.dayOffset,
            agentOwner,
            policyOwner: step.policyOwner || "growth-lead",
            sendGridCategories: ["blueprint_lifecycle_cadence", persona],
            sendGridCustomArgs: {
              bp_lifecycle_cadence_id: doc.id,
              bp_lifecycle_step_key: step.key,
              bp_lifecycle_persona: persona,
            },
          },
          safetyPolicy: PERSONA_LIFECYCLE_POLICY,
          draftOutput: {
            recommendation: "persona_lifecycle_touch",
            confidence: 0.95,
            requires_human_review: true,
            category: "lifecycle_cadence",
            persona,
            step_key: step.key,
            agent_owner: agentOwner,
            policy_owner: step.policyOwner || "growth-lead",
            cta_question: step.ctaQuestion,
          },
          idempotencyKey: `lifecycle_cadence:${doc.id}:${step.key}`,
        });

        const stepStatus =
          action.state === "sent"
            ? "sent"
            : action.state === "failed"
              ? "failed"
              : "pending_approval";
        updatedSteps.push(
          markStep(step, {
            status: stepStatus,
            ledgerDocId: action.ledgerDocId,
            queuedAt: nowIso,
          }),
        );
        processedCount += 1;
        changed = true;
        lastStatus = action.state;
        lastLedgerDocId = action.ledgerDocId;
        lastStepKey = step.key;
        lastAgentOwner = agentOwner;
      } catch (error) {
        updatedSteps.push(
          markStep(step, {
            status: "failed",
            skipReason: error instanceof Error ? error.message : String(error),
            queuedAt: nowIso,
          }),
        );
        failedCount += 1;
        changed = true;
        lastStatus = "failed";
        lastStepKey = step.key;
        lastAgentOwner = agentOwner;
      }
    }

    if (!changed) {
      continue;
    }

    await doc.ref.set(
      {
        steps: updatedSteps,
        last_status: lastStatus,
        last_ledger_doc_id: lastLedgerDocId,
        last_step_key: lastStepKey,
        last_agent_owner: lastAgentOwner,
        updated_at_iso: nowIso,
        updated_at: nowTimestamp(),
      },
      { merge: true },
    );
  }

  return { processedCount, failedCount, skippedCount, suppressedCount };
}

export async function createLifecycleCadenceForInboundRequest(params: {
  requestId: string;
  buyerType: LifecyclePersona | "site_operator" | "robot_team";
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  siteName?: string | null;
  proofPathPreference?: string | null;
}) {
  const persona: LifecyclePersona =
    params.buyerType === "robot_team" ? "robot_team" : "site_operator";
  const displayName = [params.firstName, params.lastName]
    .map((value) => normalizeString(value))
    .filter(Boolean)
    .join(" ");
  const completedEventKeys = [
    persona === "robot_team" ? "robot_team_signup_submitted" : "site_operator_signup_submitted",
    persona === "robot_team" && params.proofPathPreference === "exact_site_required"
      ? "exact_site_requested"
      : null,
    persona === "site_operator" ? "site_claim_submitted" : null,
  ].filter((value): value is string => Boolean(value));

  return createLifecycleCadenceEnrollment({
    persona,
    email: params.email,
    displayName,
    company: params.company,
    sourceCollection: "inboundRequests",
    sourceDocId: params.requestId,
    sourceLabel: params.siteName || params.company || null,
    siteLabel: params.siteName || null,
    completedEventKeys,
  });
}

export async function createLifecycleCadenceForWaitlistSubmission(params: {
  submissionId: string;
  email: string;
  role?: string | null;
  company?: string | null;
  market?: string | null;
  source?: string | null;
}) {
  const role = normalizeString(params.role).toLowerCase();
  const source = normalizeString(params.source).toLowerCase();
  const persona: LifecyclePersona =
    role.includes("capturer") || source.includes("capture")
      ? "capturer"
      : "robot_team";
  const completedEventKeys = [
    persona === "capturer" ? "capturer_signup_submitted" : "robot_team_signup_submitted",
  ];

  return createLifecycleCadenceEnrollment({
    persona,
    email: params.email,
    company: params.company,
    sourceCollection: "waitlistSubmissions",
    sourceDocId: params.submissionId,
    sourceLabel: params.market || params.company || params.source || null,
    completedEventKeys,
  });
}
