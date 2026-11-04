/**
 * Movable furniture moved out of the robot's way in a website job's
 * simulation, only with the job owner's approval on the job page.
 *
 * When the robot arm can't stand within reach of the job in the simulation
 * of the site because chairs or stools are in the way, the Pipeline proposes
 * moving exactly the ones that would give it room. Only items the scene's
 * own analysis labels movable furniture are ever proposed; never walls,
 * counters or the table the job is on. This changes what the simulation
 * shows the robot, so nothing happens without the owner.
 *
 * The Pipeline sends the proposal over its signed sync transport each time it
 * checks on the job (`recordRobotAccessProposal`), the same transport as the
 * success thresholds (`websiteOwnerSuccessConfirmation`): the items in the
 * analysis's own words, the scene revision and a `proposal_digest` that seals
 * them. It is kept append-only on the job's scene intake. The owner link (and
 * only the owner link) shows it in plain words with "Move it in the
 * simulation" and "Keep it where it is" (`decideRobotAccessProposal`). Each
 * decision is appended, bound to that exact proposal digest, revision and
 * removal binding. No decision means no change: the Pipeline's next check
 * reads the decision for the proposal it sent; an approval rebuilds the
 * simulation without the items, a decline holds the job by name.
 *
 * Measuring the chairs first is Blueprint's own preparation spend, reserved
 * within the job's approved caps on the Pipeline: it is never a question here,
 * and no cost or budget ever reaches the site.
 *
 * Only privacy and rights stop it: a withdrawn capture or revoked consent is
 * refused on both sides. Nothing here starts compute or moves money; the
 * approval is about the simulation only, never a spend.
 */
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest, crossRuntimeCanonicalJson } from "./crossRuntimeCanonical";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { latestSceneIntake } from "./websiteOwnerSuccessConfirmation";

export const ROBOT_ACCESS_PROPOSAL_SCHEMA = "website_robot_access_proposal.v1";
export const ROBOT_ACCESS_RECEIPT_SCHEMA = "website_robot_access_proposal_receipt.v1";
export const ROBOT_ACCESS_DECISION_SCHEMA = "website_robot_access_decision.v1";
/** The kinds of movable furniture the Pipeline may propose (robot_access_furniture.FURNITURE_KINDS). */
export const ROBOT_ACCESS_KINDS = ["chair", "stool"] as const;
// The scene intake collection (taskEvaluationSceneIntake.SCENE_INTAKE_COLLECTION).
const SCENE_INTAKES = "taskEvaluationSceneIntakes";
const MAX_PROPOSALS = 32;
const MAX_DECISIONS = 64;
const sha = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const intentId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,131}$/);
const words = z.string().min(1).max(160).regex(/^[^\u0000-\u001f<>]+$/);

const sealed = (field: string) => (value: Record<string, unknown>) => {
  try { return crossRuntimeArtifactDigest(value, field) === value[field]; } catch { return false; }
};

export const robotAccessProposalSchema = z.object({
  schema_version: z.literal(ROBOT_ACCESS_PROPOSAL_SCHEMA),
  intent_id: intentId, intent_digest: sha, task_id: z.string().min(1).max(192),
  configured_scene_revision_digest: sha, binding_digest: sha,
  // The items in the scene analysis's own words; their measured bounds stay on the Pipeline.
  items: z.array(z.object({ target_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/), label: words,
    kind: z.enum(ROBOT_ACCESS_KINDS) }).strict()).min(1).max(4),
  support_label: words, reason: z.literal("no_ranked_stance_carries"), appearance: z.literal("unchanged"),
  proposal_digest: sha,
}).strict().refine(sealed("proposal_digest"), "proposal digest mismatch");
export type RobotAccessProposal = z.infer<typeof robotAccessProposalSchema>;

export const robotAccessDecisionSchema = z.object({
  schema_version: z.literal(ROBOT_ACCESS_DECISION_SCHEMA),
  intent_id: intentId, intent_digest: sha, request_id: identifier, capture_id: identifier,
  proposal_digest: sha, configured_scene_revision_digest: sha, binding_digest: sha,
  decision: z.enum(["approved", "declined"]), decided_via: z.literal("owner_job_link"),
  decided_at: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/),
  decision_digest: sha,
}).strict().refine(sealed("decision_digest"), "decision digest mismatch");
export type RobotAccessDecision = z.infer<typeof robotAccessDecisionSchema>;

/** What the job page sends: approve or decline this exact proposal. Nothing else is a field. */
export const robotAccessDecisionRequestSchema = z.object({
  proposalDigest: sha, decision: z.enum(["approve", "decline"]),
}).strict();
export type RobotAccessDecisionRequest = z.infer<typeof robotAccessDecisionRequestSchema>;

type Intake = Record<string, any>;
const revoked = (intake: Intake) => Boolean(intake.revocation_requested || intake.revocation_receipt)
  || ["revocation_pending", "revoked", "cancelled"].includes(intake.state);

function storedProposal(row: unknown): RobotAccessProposal | null {
  const value = row as { proposal_digest?: unknown; proposal_json?: unknown } | null;
  if (!value || typeof value.proposal_json !== "string") return null;
  try {
    const parsed = robotAccessProposalSchema.safeParse(JSON.parse(value.proposal_json));
    return parsed.success && parsed.data.proposal_digest === value.proposal_digest ? parsed.data : null;
  } catch { return null; }
}

/** The proposal the Pipeline sent last for this intake, if it still verifies and binds the intake's intent. */
export function currentRobotAccessProposal(intake: Intake | undefined): RobotAccessProposal | null {
  if (!intake || revoked(intake) || typeof intake.robot_access_proposal_current !== "string") return null;
  const rows: unknown[] = Array.isArray(intake.robot_access_proposals) ? intake.robot_access_proposals : [];
  const proposal = rows.map(storedProposal).find(row => row?.proposal_digest === intake.robot_access_proposal_current);
  return proposal && proposal.intent_id === intake.receipt?.intent_id && proposal.intent_digest === intake.receipt?.intent_digest
    ? proposal : null;
}

/** The owner's decision on exactly this proposal: an approval is final; otherwise the latest decline; else null. */
export function robotAccessDecisionFor(intake: Intake | undefined, proposal: RobotAccessProposal): RobotAccessDecision | null {
  const rows: unknown[] = Array.isArray(intake?.robot_access_decisions) ? intake!.robot_access_decisions : [];
  const bound = rows.flatMap(row => {
    const parsed = robotAccessDecisionSchema.safeParse(row);
    return parsed.success && parsed.data.proposal_digest === proposal.proposal_digest
      && parsed.data.intent_id === proposal.intent_id && parsed.data.intent_digest === proposal.intent_digest
      && parsed.data.configured_scene_revision_digest === proposal.configured_scene_revision_digest
      && parsed.data.binding_digest === proposal.binding_digest ? [parsed.data] : [];
  });
  return bound.find(row => row.decision === "approved") ?? bound.filter(row => row.decision === "declined").at(-1) ?? null;
}

function assertRights(job: Record<string, any> | undefined) {
  if (!job) throw new Error("website_robot_access_job_unavailable");
  if (job.capture_withdrawal) throw new Error("website_robot_access_capture_withdrawn");
  if (!projectWebsiteCaptureRights(job).derived_scene_generation_allowed)
    throw new Error("website_robot_access_consent_revoked");
}

export type RobotAccessReceipt = {
  schema_version: typeof ROBOT_ACCESS_RECEIPT_SCHEMA; status: "pending" | "approved" | "declined";
  intent_id: string; proposal_digest: string; decision: RobotAccessDecision | null;
};

/**
 * The Pipeline's signed notice: keep this proposal (append-only, by digest) as
 * the job's current one, and answer with the owner's decision on it, if any.
 * A proposal already kept is not written again.
 */
export async function recordRobotAccessProposal(input: RobotAccessProposal, store = db): Promise<RobotAccessReceipt> {
  const notice = robotAccessProposalSchema.parse(input);
  if (!store) throw new Error("website_robot_access_store_unavailable");
  const matches = await store.collection(SCENE_INTAKES).where("receipt.intent_id", "==", notice.intent_id).limit(2).get();
  if (matches.docs.length !== 1) throw new Error("website_robot_access_intake_unavailable");
  const intakeRef = matches.docs[0].ref;
  return store.runTransaction(async transaction => {
    const intake = (await transaction.get(intakeRef)).data() as Intake | undefined;
    if (!intake || intake.receipt?.intent_id !== notice.intent_id) throw new Error("website_robot_access_intake_unavailable");
    if (intake.receipt?.intent_digest !== notice.intent_digest) throw new Error("website_robot_access_intent_mismatch");
    if (revoked(intake)) throw new Error("website_robot_access_intent_revoked");
    // Only a website job has an owner job page to ask.
    if (typeof intake.website_request_id !== "string" || !intake.website_request_id)
      throw new Error("website_robot_access_not_a_website_job");
    assertRights((await transaction.get(store.collection("inboundRequests").doc(intake.website_request_id))).data());
    const history: Record<string, any>[] = Array.isArray(intake.robot_access_proposals) ? intake.robot_access_proposals : [];
    const kept = history.find(row => row?.proposal_digest === notice.proposal_digest);
    if (kept && !storedProposal(kept)) throw new Error("website_robot_access_proposal_conflict");
    if (!kept && history.length >= MAX_PROPOSALS) throw new Error("website_robot_access_proposal_history_full");
    const decision = robotAccessDecisionFor(intake, notice);
    if (!kept || intake.robot_access_proposal_current !== notice.proposal_digest)
      transaction.update(intakeRef, {
        robot_access_proposals: kept ? history : [...history, { proposal_digest: notice.proposal_digest,
          proposal_json: crossRuntimeCanonicalJson(notice), received_at_iso: new Date().toISOString() }],
        robot_access_proposal_current: notice.proposal_digest, updated_at_iso: new Date().toISOString() });
    return { schema_version: ROBOT_ACCESS_RECEIPT_SCHEMA, status: decision ? decision.decision : "pending",
      intent_id: notice.intent_id, proposal_digest: notice.proposal_digest, decision };
  });
}

/* ------------------------------------------------------------ plain words */

const NUMBERS = ["no", "1", "2", "3", "4"];
function counted(items: RobotAccessProposal["items"]): string {
  const counts = ROBOT_ACCESS_KINDS.map(kind => [kind, items.filter(row => row.kind === kind).length] as const)
    .filter(([, count]) => count > 0);
  return counts.map(([kind, count]) => `${NUMBERS[count] ?? count} ${kind}${count === 1 ? "" : "s"}`).join(" and ");
}

export type RobotAccessWords = { what: string; why: string; question: string; note: string; items: string[];
  approve: string; decline: string; approved: string; declined: string };

/** The proposal in plain words, from what the Pipeline sent and nothing else. */
export function describeRobotAccessProposal(proposal: RobotAccessProposal): RobotAccessWords {
  const what = counted(proposal.items);
  const one = proposal.items.length === 1;
  const support = proposal.support_label.trim().replace(/^(the|a|an) /i, "");
  return {
    what,
    why: `In the simulation of your site, the robot arm can't stand close enough to reach the job: ${what} ${one ? "is" : "are"} in the way.`,
    question: `To give the robot room, Blueprint would move ${what} away from the ${support} in the simulation. Approve?`,
    note: `Only the simulation changes; your site and your video stay as they are. The ${one ? proposal.items[0].kind : "furniture"} `
      + `may still show in the simulation's pictures, but the robot is no longer blocked by ${one ? "it" : "them"}. Results stay estimates.`,
    items: proposal.items.map(row => row.label),
    approve: one ? "Move it in the simulation" : "Move them in the simulation",
    decline: one ? "Keep it where it is" : "Keep them where they are",
    approved: `You approved this. Blueprint moves ${what} in the simulation and checks again whether the robot can reach the job.`,
    declined: `You chose to keep ${what} where ${one ? "it is" : "they are"}. The robot can't stand within reach, so this job is on hold. `
      + "You can still approve if you change your mind.",
  };
}

export type RobotAccessView = RobotAccessWords & {
  proposalDigest: string;
  decision: { kind: "approved" | "declined"; decidedAt: string } | null;
};

/** What the owner's job page shows, or null when the Pipeline has sent no current proposal. */
export function robotAccessView(intake: Intake | undefined): RobotAccessView | null {
  const proposal = currentRobotAccessProposal(intake);
  if (!proposal) return null;
  const decision = robotAccessDecisionFor(intake, proposal);
  return { proposalDigest: proposal.proposal_digest, ...describeRobotAccessProposal(proposal),
    decision: decision ? { kind: decision.decision, decidedAt: decision.decided_at } : null };
}

/** The same, read for the owner's page; unreadable is unknown (null). */
export async function loadRobotAccessView(requestId: string, captureId: string, store = db): Promise<RobotAccessView | null> {
  try { return robotAccessView((await latestSceneIntake(requestId, captureId, store))?.data); }
  catch { return null; }
}

/**
 * The owner's decision on the proposal their page showed. The proposal is
 * re-read in the transaction, so a page showing an older proposal cannot
 * decide on the current one. An approval is final; a decline can be followed
 * by an approval. Every decision is appended; none is ever edited.
 */
export async function decideRobotAccessProposal(requestId: string, captureId: string, body: RobotAccessDecisionRequest,
  store = db, now = () => new Date()): Promise<RobotAccessDecision> {
  const request = robotAccessDecisionRequestSchema.parse(body);
  const latest = await latestSceneIntake(requestId, captureId, store);
  if (!latest || !store) throw new Error("website_robot_access_proposal_changed");
  return store.runTransaction(async transaction => {
    const intake = (await transaction.get(latest.ref)).data() as Intake | undefined;
    if (!intake || intake.website_request_id !== requestId || intake.source_session_id !== captureId)
      throw new Error("website_robot_access_proposal_changed");
    const proposal = currentRobotAccessProposal(intake);
    if (!proposal || proposal.proposal_digest !== request.proposalDigest) throw new Error("website_robot_access_proposal_changed");
    assertRights((await transaction.get(store.collection("inboundRequests").doc(requestId))).data());
    const prior = robotAccessDecisionFor(intake, proposal);
    const kind = request.decision === "approve" ? "approved" : "declined";
    if (prior?.decision === "approved") {
      if (kind === "approved") return prior;
      throw new Error("website_robot_access_already_approved");
    }
    if (prior && prior.decision === kind) return prior;
    const history: unknown[] = Array.isArray(intake.robot_access_decisions) ? intake.robot_access_decisions : [];
    if (history.length >= MAX_DECISIONS) throw new Error("website_robot_access_decision_history_full");
    const record = { schema_version: ROBOT_ACCESS_DECISION_SCHEMA, intent_id: proposal.intent_id,
      intent_digest: proposal.intent_digest, request_id: requestId, capture_id: captureId,
      proposal_digest: proposal.proposal_digest, configured_scene_revision_digest: proposal.configured_scene_revision_digest,
      binding_digest: proposal.binding_digest, decision: kind, decided_via: "owner_job_link" as const,
      decided_at: now().toISOString() };
    const decision = robotAccessDecisionSchema.parse({ ...record,
      decision_digest: crossRuntimeArtifactDigest(record as Record<string, unknown>, "decision_digest") });
    transaction.update(latest.ref, { robot_access_decisions: [...history, decision], updated_at_iso: new Date().toISOString() });
    return decision;
  });
}
