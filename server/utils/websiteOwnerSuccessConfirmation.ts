/**
 * A website job's success thresholds, confirmed by the job's owner on the job page.
 *
 * Blueprint builds each website job with its standard success thresholds (for
 * example: the object ends inside the goal area, is never dropped, the robot
 * pushes on it with no more than 100 N). They stay a proposal until the job's
 * owner confirms them, and the Pipeline scores no robot against an unconfirmed
 * proposal. The operator door could record that confirmation by hand; this is
 * the owner's own way to do it.
 *
 * The Pipeline sends the proposal over its signed sync transport each time it
 * checks on the job (`recordOwnerSuccessProposal`): the exact thresholds, the
 * scene revision they belong to and a `proposal_digest` that seals them. It is
 * kept append-only on the job's scene intake. The owner link (and only the
 * owner link) sees it in plain words, with Confirm and "this is wrong" with a
 * typed reason (`decideOwnerSuccessProposal`). Each decision is appended,
 * bound to that exact proposal digest and revision; nothing edits a number.
 * The Pipeline's next check reads the decision for the proposal it sent: a
 * confirmation is recorded on the Pipeline with the door's own writer, and a
 * "wrong" answer holds the job with its reason. A changed proposal has a new
 * digest and needs a new decision.
 *
 * A hold is flagged on the intake (`owner_success_hold_open`) so the beta ops
 * monitor alerts Blueprint's team with the reason
 * (`websitePreparationOpsAlerts.scanHeldOwnerSuccessThresholds`).
 *
 * Only privacy and rights stop it: a withdrawn capture or revoked consent is
 * refused on both sides. Nothing here starts compute or moves money.
 */
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest, crossRuntimeCanonicalJson } from "./crossRuntimeCanonical";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { taskTargetSelectionApplies } from "./websiteTaskTargetChoice";

export const OWNER_SUCCESS_PROPOSAL_SCHEMA = "website_owner_success_proposal.v1";
export const OWNER_SUCCESS_RECEIPT_SCHEMA = "website_owner_success_proposal_receipt.v1";
export const OWNER_SUCCESS_DECISION_SCHEMA = "website_owner_success_decision.v1";
/** Why an owner says the thresholds are wrong; mirrored by the Pipeline (website_owner_success_confirmation.HOLD_REASONS). */
export const OWNER_SUCCESS_HOLD_REASONS = ["wrong_goal", "too_strict", "too_loose", "wrong_task", "other"] as const;
export type OwnerSuccessHoldReason = typeof OWNER_SUCCESS_HOLD_REASONS[number];
// The scene intake collection (taskEvaluationSceneIntake.SCENE_INTAKE_COLLECTION),
// named here so the page reader does not import the intake worker.
const SCENE_INTAKES = "taskEvaluationSceneIntakes";
const MAX_CRITERIA_BYTES = 32_000;
const MAX_PROPOSALS = 32;
const MAX_DECISIONS = 64;
const sha = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const intentId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,131}$/);
const token = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
/** Set on the intake while the owner's latest decision on its current proposal is a hold. */
export const OWNER_SUCCESS_HOLD_FIELD = "owner_success_hold_open";

function canonicalBytes(value: unknown): number | null {
  try { return Buffer.byteLength(crossRuntimeCanonicalJson(value)); } catch { return null; }
}
const sealed = (field: string) => (value: Record<string, unknown>) => {
  try { return crossRuntimeArtifactDigest(value, field) === value[field]; } catch { return false; }
};

export const ownerSuccessProposalSchema = z.object({
  schema_version: z.literal(OWNER_SUCCESS_PROPOSAL_SCHEMA),
  intent_id: intentId, intent_digest: sha, task_id: z.string().min(1).max(192),
  configured_scene_revision_digest: sha,
  configured_success_criteria: z.record(z.string(), z.unknown()).refine(value => Object.keys(value).length > 0
    && (canonicalBytes(value) ?? Infinity) <= MAX_CRITERIA_BYTES, "thresholds missing or too large"),
  configured_success_criteria_digest: sha, proposal_authority_digest: sha,
  // What each forbidden contact class counts and leaves out, as the Pipeline's scorer defines it.
  forbidden_contacts: z.array(z.object({ contact_class: token, parts: z.array(token).max(4),
    excluding: z.array(token).max(8) }).strict()).max(16),
  binding_digest: sha, proposal_digest: sha,
}).strict().refine(sealed("proposal_digest"), "proposal digest mismatch");
export type OwnerSuccessProposal = z.infer<typeof ownerSuccessProposalSchema>;

export const ownerSuccessDecisionSchema = z.object({
  schema_version: z.literal(OWNER_SUCCESS_DECISION_SCHEMA),
  intent_id: intentId, intent_digest: sha, request_id: identifier, capture_id: identifier,
  proposal_digest: sha, configured_scene_revision_digest: sha, binding_digest: sha,
  decision: z.enum(["confirmed", "held"]), reason: z.enum(OWNER_SUCCESS_HOLD_REASONS).nullable(),
  decided_via: z.literal("owner_job_link"),
  decided_at: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/),
  decision_digest: sha,
}).strict().refine(value => (value.decision === "confirmed") === (value.reason === null), "reason does not match the decision")
  .refine(sealed("decision_digest"), "decision digest mismatch");
export type OwnerSuccessDecision = z.infer<typeof ownerSuccessDecisionSchema>;

/** What the job page sends: confirm this exact proposal, or say it is wrong and why. No number is a field. */
export const ownerSuccessDecisionRequestSchema = z.discriminatedUnion("decision", [
  z.object({ proposalDigest: sha, decision: z.literal("confirm") }).strict(),
  z.object({ proposalDigest: sha, decision: z.literal("wrong"), reason: z.enum(OWNER_SUCCESS_HOLD_REASONS) }).strict(),
]);
export type OwnerSuccessDecisionRequest = z.infer<typeof ownerSuccessDecisionRequestSchema>;

type Intake = Record<string, any>;
const revoked = (intake: Intake) => Boolean(intake.revocation_requested || intake.revocation_receipt)
  || ["revocation_pending", "revoked", "cancelled"].includes(intake.state);

function storedProposal(row: unknown): OwnerSuccessProposal | null {
  const value = row as { proposal_digest?: unknown; proposal_json?: unknown } | null;
  if (!value || typeof value.proposal_json !== "string") return null;
  try {
    const parsed = ownerSuccessProposalSchema.safeParse(JSON.parse(value.proposal_json));
    return parsed.success && parsed.data.proposal_digest === value.proposal_digest ? parsed.data : null;
  } catch { return null; }
}

/** The proposal the Pipeline sent last for this intake, if it still verifies and binds the intake's intent. */
export function currentOwnerSuccessProposal(intake: Intake | undefined): OwnerSuccessProposal | null {
  if (!intake || revoked(intake) || typeof intake.owner_success_proposal_current !== "string") return null;
  const rows: unknown[] = Array.isArray(intake.owner_success_proposals) ? intake.owner_success_proposals : [];
  const proposal = rows.map(storedProposal).find(row => row?.proposal_digest === intake.owner_success_proposal_current);
  return proposal && proposal.intent_id === intake.receipt?.intent_id && proposal.intent_digest === intake.receipt?.intent_digest
    ? proposal : null;
}

/** The owner's open hold on the intake's current proposal (no confirmation of it), or null. */
export function currentOwnerSuccessHold(intake: Intake | undefined): OwnerSuccessDecision | null {
  const proposal = currentOwnerSuccessProposal(intake);
  const decision = proposal ? ownerSuccessDecisionFor(intake, proposal) : null;
  return decision?.decision === "held" ? decision : null;
}

/** Plain words for each hold reason, for the page and for ops. */
export const OWNER_SUCCESS_HOLD_REASON_TEXT: Record<OwnerSuccessHoldReason, string> = {
  wrong_goal: "The goal area is in the wrong place", too_strict: "These limits are stricter than the job needs",
  too_loose: "These limits are looser than the job needs", wrong_task: "This is not the job the robot should do",
  other: "Something else is wrong",
};

/** The owner's decision on exactly this proposal: a confirmation is final; otherwise the latest hold; else null. */
export function ownerSuccessDecisionFor(intake: Intake | undefined, proposal: OwnerSuccessProposal): OwnerSuccessDecision | null {
  const rows: unknown[] = Array.isArray(intake?.owner_success_decisions) ? intake!.owner_success_decisions : [];
  const bound = rows.flatMap(row => {
    const parsed = ownerSuccessDecisionSchema.safeParse(row);
    return parsed.success && parsed.data.proposal_digest === proposal.proposal_digest
      && parsed.data.intent_id === proposal.intent_id && parsed.data.intent_digest === proposal.intent_digest
      && parsed.data.configured_scene_revision_digest === proposal.configured_scene_revision_digest
      && parsed.data.binding_digest === proposal.binding_digest ? [parsed.data] : [];
  });
  return bound.find(row => row.decision === "confirmed") ?? bound.filter(row => row.decision === "held").at(-1) ?? null;
}

function assertRights(job: Record<string, any> | undefined) {
  if (!job) throw new Error("website_owner_success_job_unavailable");
  if (job.capture_withdrawal) throw new Error("website_owner_success_capture_withdrawn");
  if (!projectWebsiteCaptureRights(job).derived_scene_generation_allowed)
    throw new Error("website_owner_success_consent_revoked");
}

export type OwnerSuccessReceipt = {
  schema_version: typeof OWNER_SUCCESS_RECEIPT_SCHEMA; status: "pending" | "confirmed" | "held";
  intent_id: string; proposal_digest: string; decision: OwnerSuccessDecision | null;
};

/**
 * The Pipeline's signed notice: keep this proposal (append-only, by digest) as
 * the job's current one, and answer with the owner's decision on it, if any.
 * A proposal already kept is not written again.
 */
export async function recordOwnerSuccessProposal(input: OwnerSuccessProposal, store = db): Promise<OwnerSuccessReceipt> {
  const notice = ownerSuccessProposalSchema.parse(input);
  if (!store) throw new Error("website_owner_success_store_unavailable");
  const matches = await store.collection(SCENE_INTAKES).where("receipt.intent_id", "==", notice.intent_id).limit(2).get();
  if (matches.docs.length !== 1) throw new Error("website_owner_success_intake_unavailable");
  const intakeRef = matches.docs[0].ref;
  return store.runTransaction(async transaction => {
    const intake = (await transaction.get(intakeRef)).data() as Intake | undefined;
    if (!intake || intake.receipt?.intent_id !== notice.intent_id)
      throw new Error("website_owner_success_intake_unavailable");
    if (intake.receipt?.intent_digest !== notice.intent_digest) throw new Error("website_owner_success_intent_mismatch");
    if (revoked(intake)) throw new Error("website_owner_success_intent_revoked");
    // Only a website job has an owner job page to ask.
    if (typeof intake.website_request_id !== "string" || !intake.website_request_id)
      throw new Error("website_owner_success_not_a_website_job");
    assertRights((await transaction.get(store.collection("inboundRequests").doc(intake.website_request_id))).data());
    const history: Record<string, any>[] = Array.isArray(intake.owner_success_proposals) ? intake.owner_success_proposals : [];
    const kept = history.find(row => row?.proposal_digest === notice.proposal_digest);
    if (kept && !storedProposal(kept)) throw new Error("website_owner_success_proposal_conflict");
    if (!kept && history.length >= MAX_PROPOSALS) throw new Error("website_owner_success_proposal_history_full");
    const proposals = kept ? history : [...history, { proposal_digest: notice.proposal_digest,
      proposal_json: crossRuntimeCanonicalJson(notice), received_at_iso: new Date().toISOString() }];
    const decision = ownerSuccessDecisionFor(intake, notice);
    if (!kept || intake.owner_success_proposal_current !== notice.proposal_digest)
      transaction.update(intakeRef, { owner_success_proposals: proposals,
        owner_success_proposal_current: notice.proposal_digest, [OWNER_SUCCESS_HOLD_FIELD]: decision?.decision === "held",
        updated_at_iso: new Date().toISOString() });
    return { schema_version: OWNER_SUCCESS_RECEIPT_SCHEMA, status: decision ? decision.decision : "pending",
      intent_id: notice.intent_id, proposal_digest: notice.proposal_digest, decision };
  });
}

/** The job's latest scene intake for this capture (the one its scene progression reads), or null. */
async function latestIntake(requestId: string, captureId: string, store = db) {
  if (!store) throw new Error("website_owner_success_store_unavailable");
  const session = (await store.collection("captureUploadSessions").doc(captureId).get()).data();
  const rows = await store.collection(SCENE_INTAKES).where("website_request_id", "==", requestId).get();
  let latest: { ref: FirebaseFirestore.DocumentReference; data: Intake } | null = null;
  for (const row of rows.docs) {
    const value = row.data();
    if (value.source_session_id === captureId && taskTargetSelectionApplies(session, value) && (!latest
      || String(value.created_at_iso || "") > String(latest.data.created_at_iso || ""))) latest = { ref: row.ref, data: value };
  }
  return latest;
}
/** The same lookup, for the owner's other decisions on this job (``websiteRobotAccessRemoval``). */
export const latestSceneIntake = latestIntake;

/* ------------------------------------------------------------ plain words */

const round = (value: number, places = 1) => {
  const scaled = Math.round(value * 10 ** places) / 10 ** places;
  return Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(places).replace(/0+$/, "");
};
const cm = (meters: number) => `${round(meters * 100)} cm`;
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const tries = (count: number, none: string, some: string) => count === 0 ? none : `${some} ${count}`;
const PRIVATE_LOCATOR = /(?:\b(?:s3|gs|file|https?):\/\/|\/(?:var|etc|opt|private|tmp|home|srv)\/|api[_ -]?key|credential|secret)/i;
const humanize = (value: string) => value.replace(/_/g, " ");

export type OwnerSuccessContact = { contact_class: string; parts: string[]; excluding: string[] };
// The Pipeline's words for what a contact class counts (website_owner_success_confirmation.CONTACT_CLASS_SCOPE).
// Each exclusion it names is said only where it applies; any other is said as sent.
const FIRST: Record<string, (excluding: Set<string>) => string> = {
  robot_protected_bodies: excluding => excluding.delete("admitted_gripper_task_contact_bodies")
    ? "the robot's arm or body (not its gripper)" : "the robot",
  task_object: () => "the object",
  destination: () => "the container",
};
const SECOND: Record<string, (excluding: Set<string>) => string> = {
  task_object: () => "the object",
  scene_including_destination_support: () => "the surroundings, including the goal surface",
  scene: excluding => excluding.delete("destination_support") ? "anything but the goal surface"
    : excluding.delete("qualified_placement_support") ? "anything but the surface it stands on" : "the surroundings",
};

/** One forbidden contact in plain words, from what the Pipeline says the class counts and leaves out. */
export function describeContact(contact: OwnerSuccessContact): string {
  const [first, second] = contact.parts;
  if (!first || !second || contact.parts.length !== 2) return humanize(contact.contact_class);
  const excluding = new Set(contact.excluding);
  const text = `${(FIRST[first] ?? (() => humanize(first)))(excluding)} with ${(SECOND[second] ?? (() => humanize(second)))(excluding)}`;
  return excluding.size ? `${text} (except ${[...excluding].map(humanize).join(", ")})` : text;
}

function otherValue(label: string, value: unknown): OwnerSuccessRow {
  const raw = typeof value === "boolean" ? (value ? "yes" : "no") : typeof value === "string" ? value : JSON.stringify(value);
  // A storage or host locator never reaches the site's page, whatever the Pipeline sends.
  const text = PRIVATE_LOCATOR.test(raw) ? "(internal reference)" : raw;
  return { label: humanize(label), value: text.length > 240 ? `${text.slice(0, 237)}...` : text };
}

export type OwnerSuccessRow = { label: string; value: string };

/**
 * The thresholds in plain words: each one Blueprint knows how to say, then every
 * other value exactly as the Pipeline sent it, nested ones included. Nothing is
 * left out or changed.
 */
export function describeOwnerSuccessThresholds(criteria: Record<string, unknown>,
  contacts: OwnerSuccessContact[] = []): { rows: OwnerSuccessRow[]; otherValues: OwnerSuccessRow[] } {
  const rows: OwnerSuccessRow[] = [];
  const used = new Set<string>();
  const nested: OwnerSuccessRow[] = [];
  const target = criteria.surface_target as Record<string, unknown> | undefined;
  if (target && typeof target === "object" && !Array.isArray(target) && isNumber(target.radius_m)) {
    used.add("surface_target");
    const shown = new Set(["radius_m", "visible_label"]);
    const label = typeof target.visible_label === "string" && target.visible_label.trim() ? `the ${target.visible_label.trim()}` : "the goal area";
    rows.push({ label: "Goal area", value: `${label[0].toUpperCase()}${label.slice(1)}: a circle ${cm(2 * target.radius_m)} across. The whole object has to end up inside it.` });
    if (isNumber(target.maximum_tilt_rad)) {
      shown.add("maximum_tilt_rad");
      rows.push({ label: "Upright", value: `It ends tilted no more than ${round(target.maximum_tilt_rad * 180 / Math.PI, 0)}°.` });
    }
    if (isNumber(target.stable_seconds)) {
      shown.add("stable_seconds");
      const limits = [
        isNumber(target.maximum_linear_speed_m_s) && shown.add("maximum_linear_speed_m_s")
          ? `moving under ${round(target.maximum_linear_speed_m_s * 100)} cm/s` : null,
        isNumber(target.maximum_angular_speed_rad_s) && shown.add("maximum_angular_speed_rad_s")
          ? `turning under ${round(target.maximum_angular_speed_rad_s * 180 / Math.PI, 0)}° a second` : null,
      ].filter(Boolean);
      rows.push({ label: "Settled", value: `It stays still there for at least ${round(target.stable_seconds)} s${limits.length ? `: ${limits.join(" and ")}` : ""}.` });
    }
    for (const key of Object.keys(target).filter(key => !shown.has(key)).sort())
      nested.push(otherValue(`surface_target ${key}`, target[key]));
  }
  const number = (key: string, label: string, text: (value: number) => string) => {
    const value = criteria[key];
    if (isNumber(value)) { used.add(key); rows.push({ label, value: text(value) }); }
  };
  const flag = (key: string, expected: boolean, label: string, text: string) => {
    if (criteria[key] === expected) { used.add(key); rows.push({ label, value: text }); }
  };
  number("maximum_final_planar_target_error_m", "Final position", value => `Within ${cm(value)} of the goal point, measured across the surface.`);
  number("minimum_lift_m", "Lift", value => `The object is lifted at least ${cm(value)}.`);
  number("minimum_planar_displacement_m", "Distance moved", value => `It moves at least ${cm(value)} across the surface.`);
  number("minimum_opening_fraction_of_usable_travel", "Opening", value => `Opened at least ${round(value * 100, 0)}% of its usable travel.`);
  number("minimum_opening_fraction_of_estimated_stroke", "Opening", value => `Opened at least ${round(value * 100, 0)}% of the estimated travel.`);
  number("minimum_hold_seconds", "Held", value => `Held there for at least ${round(value)} s.`);
  number("maximum_episode_seconds", "Time limit", value => `${round(value)} seconds.`);
  number("maximum_task_contact_force_n", "Force", value => `The robot pushes on the object with no more than ${round(value, 0)} N (about the weight of ${round(value / 9.81, 0)} kg).`);
  flag("drop_events_allowed", false, "Drops", "The object is never dropped.");
  number("maximum_retries", "Second tries", value => tries(value, "None.", "At most"));
  number("maximum_regrasps", "Re-grabbing", value => tries(value, "None.", "At most"));
  const classes = criteria.forbidden_contact_classes;
  if (criteria.forbidden_collision_allowed === false && Array.isArray(classes) && classes.every(row => typeof row === "string")) {
    used.add("forbidden_collision_allowed"); used.add("forbidden_contact_classes");
    const scoped = new Map(contacts.map(row => [row.contact_class, row]));
    const phrases = (classes as string[]).map(name => describeContact(scoped.get(name) ?? { contact_class: name, parts: [], excluding: [] }));
    const floor = criteria.collision_failure_minimum_force_n;
    if (isNumber(floor)) used.add("collision_failure_minimum_force_n");
    rows.push({ label: "Collisions", value: `No contact between ${phrases.join("; ")}.${isNumber(floor)
      ? ` A touch counts from ${round(floor)} N.` : ""}` });
  }
  flag("release_required", true, "Release", "The robot lets go of the object at the end.");
  if (criteria.retreat_clearance_required === true && isNumber(criteria.retreat_clearance_m)) {
    used.add("retreat_clearance_required"); used.add("retreat_clearance_m");
    rows.push({ label: "Moving away", value: `Then the robot moves at least ${cm(criteria.retreat_clearance_m)} away.` });
  }
  flag("object_must_rest_on_destination_support", true, "Resting", "The object ends resting on the goal surface.");
  flag("joint_limit_violation_allowed", false, "Robot limits", "The robot stays within its joint limits.");
  const otherValues = [...Object.keys(criteria).filter(key => !used.has(key)).map(key => otherValue(key, criteria[key])), ...nested]
    .sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
  return { rows, otherValues };
}

export type OwnerSuccessView = {
  proposalDigest: string;
  rows: OwnerSuccessRow[];
  otherValues: OwnerSuccessRow[];
  decision: { kind: "confirmed" | "held"; reason: OwnerSuccessHoldReason | null; decidedAt: string } | null;
};

/** What the owner's job page shows, or null when the Pipeline has sent no current proposal. */
export function ownerSuccessView(intake: Intake | undefined): OwnerSuccessView | null {
  const proposal = currentOwnerSuccessProposal(intake);
  if (!proposal) return null;
  const decision = ownerSuccessDecisionFor(intake, proposal);
  return { proposalDigest: proposal.proposal_digest,
    ...describeOwnerSuccessThresholds(proposal.configured_success_criteria, proposal.forbidden_contacts),
    decision: decision ? { kind: decision.decision, reason: decision.reason, decidedAt: decision.decided_at } : null };
}

/** The same, read for the owner's page; unreadable is unknown (null). */
export async function loadOwnerSuccessView(requestId: string, captureId: string, store = db): Promise<OwnerSuccessView | null> {
  try { return ownerSuccessView((await latestIntake(requestId, captureId, store))?.data); }
  catch { return null; }
}

/**
 * The owner's decision on the proposal their page showed. The proposal is
 * re-read in the transaction, so a page showing an older proposal cannot
 * decide on the current one. A confirmation is final; a hold can be followed
 * by a confirmation. Every decision is appended; none is ever edited.
 */
export async function decideOwnerSuccessProposal(requestId: string, captureId: string, body: OwnerSuccessDecisionRequest,
  store = db, now = () => new Date()): Promise<OwnerSuccessDecision> {
  const request = ownerSuccessDecisionRequestSchema.parse(body);
  const latest = await latestIntake(requestId, captureId, store);
  if (!latest || !store) throw new Error("website_owner_success_proposal_changed");
  return store.runTransaction(async transaction => {
    const intake = (await transaction.get(latest.ref)).data() as Intake | undefined;
    if (!intake || intake.website_request_id !== requestId || intake.source_session_id !== captureId)
      throw new Error("website_owner_success_proposal_changed");
    const proposal = currentOwnerSuccessProposal(intake);
    if (!proposal || proposal.proposal_digest !== request.proposalDigest) throw new Error("website_owner_success_proposal_changed");
    assertRights((await transaction.get(store.collection("inboundRequests").doc(requestId))).data());
    const prior = ownerSuccessDecisionFor(intake, proposal);
    const kind = request.decision === "confirm" ? "confirmed" : "held";
    const reason = request.decision === "wrong" ? request.reason : null;
    if (prior?.decision === "confirmed") {
      if (kind === "confirmed") return prior;
      throw new Error("website_owner_success_already_confirmed");
    }
    if (prior && prior.decision === kind && prior.reason === reason) return prior;
    const history: unknown[] = Array.isArray(intake.owner_success_decisions) ? intake.owner_success_decisions : [];
    if (history.length >= MAX_DECISIONS) throw new Error("website_owner_success_decision_history_full");
    const record = { schema_version: OWNER_SUCCESS_DECISION_SCHEMA, intent_id: proposal.intent_id,
      intent_digest: proposal.intent_digest, request_id: requestId, capture_id: captureId,
      proposal_digest: proposal.proposal_digest, configured_scene_revision_digest: proposal.configured_scene_revision_digest,
      binding_digest: proposal.binding_digest, decision: kind, reason, decided_via: "owner_job_link" as const,
      decided_at: now().toISOString() };
    const decision = ownerSuccessDecisionSchema.parse({ ...record,
      decision_digest: crossRuntimeArtifactDigest(record as Record<string, unknown>, "decision_digest") });
    transaction.update(latest.ref, { owner_success_decisions: [...history, decision],
      [OWNER_SUCCESS_HOLD_FIELD]: kind === "held", updated_at_iso: new Date().toISOString() });
    return decision;
  });
}
