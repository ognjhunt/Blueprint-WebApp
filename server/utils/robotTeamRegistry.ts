/**
 * Reading and maintaining the robot-team registry.
 *
 * ## Three triggers, not a crawler
 *
 * A crawler keeps a registry fresh in the sense that it keeps changing. These
 * are the three events that actually carry new information:
 *
 * 1. **A team submits or updates their intake.** Authoritative for anything
 *    they answered. They are telling us about their own system and they are
 *    standing behind it; it overwrites whatever we had inferred.
 * 2. **An evaluation completes.** Measured beats claimed.
 *    `demonstratedSuccessRate` stops being a marketing number and becomes a
 *    result, and nothing may downgrade it afterwards.
 * 3. **A scheduled refresh proposes changes.** Into a review queue. Never
 *    applied. See `applyProposal`.
 *
 * ## Why upgrades are one-way
 *
 * `mergeCapability` refuses to replace a better-graded figure with a
 * worse-graded one. Without that rule a scheduled refresh reading a press
 * release could quietly overwrite a number Blueprint measured, and the registry
 * would get less true the longer it ran. The ordering is stated once, in
 * `GRADE_RANK`, and every write goes through it.
 */
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  CAPABILITY_PROPOSALS_COLLECTION,
  QUOTABLE_GRADES,
  ROBOT_TEAMS_COLLECTION,
  type CapabilityGrade,
  type CapabilityProposal,
  type FieldProvenance,
  type RobotCapability,
  type RobotCapabilityField,
  type RobotTeamRecord,
  type RobotTeamStatus,
} from "../types/robot-team-registry";
import type { RobotCandidate } from "../../client/src/lib/robotMatch";

/**
 * Higher wins. A measured result is the only thing that beats a team's own
 * account of its system, and a model's reading of a web page loses to both.
 */
const GRADE_RANK: Record<CapabilityGrade, number> = {
  measured: 3,
  self_reported: 2,
  published: 1,
  inferred: 0,
};

export function isQuotableGrade(grade: CapabilityGrade): boolean {
  return QUOTABLE_GRADES.includes(grade);
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Fold new readings into an existing capability record.
 *
 * Returns the merged capability and provenance plus the fields that actually
 * moved, so a caller can log what changed rather than that something did.
 */
export function mergeCapability(
  existing: Pick<RobotTeamRecord, "capability" | "fieldProvenance">,
  incoming: Partial<Record<RobotCapabilityField, string | number | null>>,
  provenance: Omit<FieldProvenance, "observedAt"> & { observedAt?: string },
): {
  capability: RobotCapability;
  fieldProvenance: RobotTeamRecord["fieldProvenance"];
  changed: RobotCapabilityField[];
} {
  const capability: RobotCapability = { ...existing.capability };
  const fieldProvenance = { ...existing.fieldProvenance };
  const changed: RobotCapabilityField[] = [];
  const observedAt = provenance.observedAt || nowIso();

  for (const [rawField, value] of Object.entries(incoming)) {
    const field = rawField as RobotCapabilityField;
    if (value === null || value === undefined || value === "") continue;

    const held = fieldProvenance[field];
    // A worse-graded reading never overwrites a better-graded one. This is the
    // rule that stops a scheduled refresh from eroding a measured result.
    if (held && GRADE_RANK[held.grade] > GRADE_RANK[provenance.grade]) continue;

    if (capability[field] === value) {
      // Same value, better or equal grade: keep the value, record the stronger
      // evidence for it.
      fieldProvenance[field] = { ...provenance, observedAt };
      continue;
    }

    (capability as Record<string, unknown>)[field] = value;
    fieldProvenance[field] = { ...provenance, observedAt };
    changed.push(field);
  }

  return { capability, fieldProvenance, changed };
}

/**
 * Drop anything a site operator must not be told.
 *
 * An inferred figure is a model's reading of public material. It is good enough
 * to decide who to research next and nowhere near good enough to put in a
 * sentence a site will act on, so for any email-facing match it is removed
 * entirely rather than annotated — the matcher then treats it as unknown, and
 * the team shows up as provisional instead of as a claim.
 */
export function quotableCapability(
  record: Pick<RobotTeamRecord, "capability" | "fieldProvenance">,
): RobotCapability {
  const filtered: RobotCapability = {};
  for (const [rawField, value] of Object.entries(record.capability)) {
    const field = rawField as RobotCapabilityField;
    const provenance = record.fieldProvenance[field];
    if (!provenance || !isQuotableGrade(provenance.grade)) continue;
    (filtered as Record<string, unknown>)[field] = value;
  }
  return filtered;
}

export function toMatchCandidate(
  record: RobotTeamRecord,
  options: { quotableOnly?: boolean } = {},
): RobotCandidate {
  const capability =
    options.quotableOnly === false ? record.capability : quotableCapability(record);
  return {
    id: record.id,
    capability: capability as Record<string, string | number | null | undefined>,
    deploymentGeography: capability.deploymentGeography ?? null,
    taskFamily: capability.taskFamily ?? null,
  };
}

/* ------------------------------------------------------------------ store */

export async function getRobotTeam(id: string): Promise<RobotTeamRecord | null> {
  if (!db) return null;
  const snapshot = await db.collection(ROBOT_TEAMS_COLLECTION).doc(id).get();
  return snapshot.exists ? (snapshot.data() as RobotTeamRecord) : null;
}

/**
 * Every team we are willing to put in front of a site.
 *
 * `declined` teams are excluded here rather than filtered by the caller: a
 * team that told us no should not reappear in a match list because somebody
 * forgot a predicate.
 */
export async function listMatchableRobotTeams(
  options: { statuses?: RobotTeamStatus[]; limit?: number } = {},
): Promise<RobotTeamRecord[]> {
  if (!db) return [];
  const statuses = options.statuses ?? ["applied", "engaged", "prospect"];
  const snapshot = await db
    .collection(ROBOT_TEAMS_COLLECTION)
    .where("status", "in", statuses)
    .limit(Math.max(1, Math.min(options.limit ?? 200, 500)))
    .get();
  return snapshot.docs.map((doc) => doc.data() as RobotTeamRecord);
}

async function writeRecord(record: RobotTeamRecord) {
  if (!db) return;
  await db
    .collection(ROBOT_TEAMS_COLLECTION)
    .doc(record.id)
    .set({ ...record, updatedAt: nowIso() }, { merge: true });
}

/* ------------------------------------------------------------- trigger 1 */

/**
 * A robot team submitted or updated their intake.
 *
 * Their own answers, in the enums the matcher already speaks, so this is a
 * direct write at `self_reported`. The gate answers come through too:
 * `deploymentGeography` is a gate on the robot side and a hard constraint here.
 */
export async function upsertRobotTeamFromIntake(params: {
  requestId: string;
  company: string;
  contactEmail?: string | null;
  gates: Record<string, string>;
  spec: Record<string, string>;
  capabilityDescription?: string | null;
  evidenceBar?: string | null;
}): Promise<RobotTeamRecord | null> {
  if (!db) return null;

  const id = `team_${params.company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)}`;

  const existing = (await getRobotTeam(id)) ?? {
    id,
    name: params.company,
    status: "applied" as RobotTeamStatus,
    capability: {},
    fieldProvenance: {},
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const { capability, fieldProvenance, changed } = mergeCapability(
    existing,
    {
      payloadCapacity: params.spec.payloadCapacity,
      humanProximity: params.spec.humanProximity,
      cycleTime: params.spec.cycleTime,
      dutyCycle: params.spec.dutyCycle,
      demonstratedSuccessRate: params.spec.demonstratedSuccessRate,
      lighting: params.spec.lighting,
      budgetBand: params.spec.budgetBand,
      objectHandling: params.spec.objectHandling,
      taskFamily: params.spec.taskFamily,
      deploymentGeography: params.gates.deploymentGeography,
    },
    { grade: "self_reported", source: `inboundRequest:${params.requestId}` },
  );

  const record: RobotTeamRecord = {
    ...existing,
    name: params.company,
    inboundRequestId: params.requestId,
    contactEmail: params.contactEmail ?? existing.contactEmail ?? null,
    // An application is an application. It never promotes a team to engaged.
    status: existing.status === "declined" ? "declined" : existing.status || "applied",
    capability,
    fieldProvenance,
    capabilityDescription: params.capabilityDescription ?? existing.capabilityDescription ?? null,
    evidenceBar: params.evidenceBar ?? existing.evidenceBar ?? null,
    updatedAt: nowIso(),
  };

  await writeRecord(record);
  logger.info(
    { robotTeamId: id, requestId: params.requestId, changed },
    "Robot team registry updated from intake",
  );
  return record;
}

/* ------------------------------------------------------------- trigger 2 */

/**
 * An evaluation finished. Measured beats claimed.
 *
 * This is the only writer that produces `measured`, and because nothing
 * outranks it, a real result is permanent until another real result replaces
 * it. A team's own optimistic number cannot paper over it later.
 */
export async function recordEvaluationOutcome(params: {
  robotTeamId: string;
  runId: string;
  demonstratedSuccessRate?: string | null;
  cycleTime?: string | null;
  observedAt?: string;
}): Promise<RobotTeamRecord | null> {
  const existing = await getRobotTeam(params.robotTeamId);
  if (!existing) return null;

  const { capability, fieldProvenance, changed } = mergeCapability(
    existing,
    {
      demonstratedSuccessRate: params.demonstratedSuccessRate ?? null,
      cycleTime: params.cycleTime ?? null,
    },
    {
      grade: "measured",
      source: `evaluationRun:${params.runId}`,
      observedAt: params.observedAt,
    },
  );

  const record: RobotTeamRecord = { ...existing, capability, fieldProvenance };
  await writeRecord(record);
  logger.info(
    { robotTeamId: params.robotTeamId, runId: params.runId, changed },
    "Robot team registry updated from evaluation result",
  );
  return record;
}

/* ------------------------------------------------------------- trigger 3 */

export async function saveCapabilityProposals(
  proposals: readonly Omit<CapabilityProposal, "id" | "status" | "proposedAt">[],
): Promise<number> {
  if (!db || !proposals.length) return 0;
  const batch = db.batch();
  const proposedAt = nowIso();
  for (const proposal of proposals) {
    const ref = db.collection(CAPABILITY_PROPOSALS_COLLECTION).doc();
    batch.set(ref, {
      ...proposal,
      id: ref.id,
      status: "pending",
      proposedAt,
    } satisfies CapabilityProposal);
  }
  await batch.commit();
  return proposals.length;
}

export async function listPendingProposals(limit = 100): Promise<CapabilityProposal[]> {
  if (!db) return [];
  const snapshot = await db
    .collection(CAPABILITY_PROPOSALS_COLLECTION)
    .where("status", "==", "pending")
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => doc.data() as CapabilityProposal);
}

/**
 * Accept one proposal into the registry.
 *
 * Deliberately requires a reviewer id. There is no code path that applies a
 * model's proposal without a person on the other end of it — that is the whole
 * point of the queue, and an `autoApply` convenience would quietly remove it.
 */
export async function applyProposal(params: {
  proposalId: string;
  reviewedBy: string;
  accept: boolean;
}): Promise<RobotTeamRecord | null> {
  if (!db) return null;
  const ref = db.collection(CAPABILITY_PROPOSALS_COLLECTION).doc(params.proposalId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const proposal = snapshot.data() as CapabilityProposal;

  await ref.set(
    {
      status: params.accept ? "accepted" : "rejected",
      reviewedAt: nowIso(),
      reviewedBy: params.reviewedBy,
    },
    { merge: true },
  );

  if (!params.accept) return null;

  const existing = await getRobotTeam(proposal.robotTeamId);
  if (!existing) return null;

  const { capability, fieldProvenance } = mergeCapability(
    existing,
    { [proposal.field]: proposal.proposedValue } as Partial<
      Record<RobotCapabilityField, string | number | null>
    >,
    {
      grade: proposal.grade,
      source: proposal.source,
      proposedBy: proposal.proposedBy,
    },
  );

  const record: RobotTeamRecord = { ...existing, capability, fieldProvenance };
  await writeRecord(record);
  return record;
}

export const __testing = { GRADE_RANK, admin };
