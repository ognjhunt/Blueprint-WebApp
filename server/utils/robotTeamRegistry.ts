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
import crypto from "node:crypto";

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
    hardwareMaturity: capability.hardwareMaturity ?? null,
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
  // `self_registered` is absent on purpose: see the status union. Anyone can
  // create one of those, so it is not supply until a run has measured it.
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

/* ------------------------------------------------------------- trigger 0 */

/**
 * A robot team registered itself. No form, no gates, no spec answers.
 *
 * ## Why this exists beside the intake
 *
 * The intake asks four gates and nine spec answers before a team is in the
 * registry, and a team that had submitted it still had nothing to do but wait:
 * a key came from an operator, funding came from an operator, and the flow
 * ended at "we will be in touch".
 *
 * Every one of those questions gates *deployment* — where the hardware is, how
 * many engineers they can spare, when they could start. None of them gate
 * *evaluation*, which runs a policy against a scene we already hold and needs
 * exactly one thing: something runnable. Asking deployment questions to unlock
 * an evaluation is a category error, and it was the whole delay.
 *
 * Worse, it was self-defeating. `evalSelection` scores an unknown hard
 * constraint higher than anything else — a team that has told us nothing has
 * the most to learn from a run, by our own ranking. The intake extracted, up
 * front and for free, exactly the information the evaluation exists to produce.
 *
 * So this is the front door: a name, and you are in. The intake stays for teams
 * that would rather talk to someone, and its answers still sharpen the ranking.
 * It is no longer the gate.
 *
 * ## What registering does not grant
 *
 * Nothing spendable. The team lands at `self_registered` with an empty
 * capability, a zero balance and autonomous spend off. A key is an identity,
 * not a credit line, and the first real payment is what proves a counterparty
 * exists — which is why open registration is safe rather than an abuse surface.
 */
export async function registerSelfServeTeam(params: {
  name: string;
  contactEmail?: string | null;
  website?: string | null;
  /**
   * What the robot is for, in the enum the matcher speaks.
   *
   * Asked because understanding the robot is the product, not a gate on it:
   * `taskFamily` is the coarsest ranking input there is, it takes one click,
   * and a run supersedes it later like any other self-reported figure. Leaving
   * it unasked did not make signup faster, it made the first plan worse.
   */
  taskFamily?: string | null;
  /** The team's own words for what they build. For a person to read. */
  capabilityDescription?: string | null;
  /** What the robot is, in the words the plan form offers. Ranked, never gated. */
  embodiment?: string | null;
  /** A fact about the business, not the robot: whether hardware exists today. */
  hardwareMaturity?: string | null;
  /** The one hard constraint no run measures: where the team would deploy. */
  deploymentGeography?: string | null;
}): Promise<RobotTeamRecord | null> {
  if (!db) return null;

  const slug = params.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  // A random suffix always, never the bare slug. Reusing the slug would let a
  // second registration under an existing team's name attach a working key to
  // that team's balance and results — so the one thing this must never do is
  // resolve a name to a record somebody else created.
  const id = `team_${slug || "team"}_${crypto.randomBytes(5).toString("hex")}`;

  const record: RobotTeamRecord = {
    id,
    name: params.name.trim(),
    status: "self_registered",
    registrationSource: "self_serve",
    contactEmail: params.contactEmail?.trim() || null,
    website: params.website?.trim() || null,
    capability: {},
    fieldProvenance: {},
    capabilityDescription: params.capabilityDescription?.trim() || null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  // Whatever they told us about the robot, at the grade a form produces. Still
  // nothing measured and nothing claimed on their behalf -- but a `taskFamily`
  // they chose in one click is the difference between a ranked plan and a
  // generic one, and a run overwrites it the moment there is something better.
  const selfReported: Partial<Record<"taskFamily" | "embodiment" | "hardwareMaturity" | "deploymentGeography", string>> = {};
  if (params.taskFamily?.trim()) selfReported.taskFamily = params.taskFamily.trim();
  if (params.embodiment?.trim()) selfReported.embodiment = params.embodiment.trim();
  if (params.hardwareMaturity?.trim()) selfReported.hardwareMaturity = params.hardwareMaturity.trim();
  if (params.deploymentGeography?.trim()) selfReported.deploymentGeography = params.deploymentGeography.trim();
  if (Object.keys(selfReported).length) {
    const merged = mergeCapability(
      record,
      selfReported,
      { grade: "self_reported", source: `selfServeRegistration:${id}` },
    );
    record.capability = merged.capability;
    record.fieldProvenance = merged.fieldProvenance;
  }

  // Cross-link to any intake application from the same contact email, so a
  // team that used both doors does not become two unlinked rows for ops to
  // dedupe by hand. Pointers only, on both sides: the new key binds to this
  // random-suffixed record exactly as before, and nothing about the intake
  // record's answers or status becomes reachable through a key — the link
  // names the match, it does not merge capabilities or balances.
  const normalizedEmail = params.contactEmail?.trim().toLowerCase() || null;
  if (normalizedEmail && db) {
    try {
      const snap = await db
        .collection(ROBOT_TEAMS_COLLECTION)
        .where("contactEmail", "==", normalizedEmail)
        .limit(10)
        .get();
      const intakeIds = snap.docs
        .filter((doc) => (doc.data() as { registrationSource?: string }).registrationSource !== "self_serve")
        .map((doc) => doc.id);
      if (intakeIds.length > 0) {
        record.linkedIntakeTeamIds = intakeIds;
        await Promise.all(
          intakeIds.map((intakeId) =>
            db!
              .collection(ROBOT_TEAMS_COLLECTION)
              .doc(intakeId)
              .set(
                {
                  selfServeTeamIds: admin.firestore.FieldValue.arrayUnion(id),
                  updatedAt: nowIso(),
                },
                { merge: true },
              ),
          ),
        );
        logger.info(
          { robotTeamId: id, linkedIntakeTeamIds: intakeIds },
          "Self-serve registration linked to intake record by contact email",
        );
      }
    } catch (error) {
      // The registration must not fail because linking did. An unlinked pair
      // is the state that existed before this code; a failed signup is not.
      logger.warn(
        { robotTeamId: id, error },
        "Robot-team intake linking failed; continuing unlinked",
      );
    }
  }

  await writeRecord(record);
  logger.info({ robotTeamId: id }, "Robot team self-registered");
  return record;
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

  const record: RobotTeamRecord = {
    ...existing,
    capability,
    fieldProvenance,
    // A measured result is what earns a self-registered team its place in the
    // list sites are shown. Registration is open, so a name alone buys nothing;
    // a run against a real scene is the evidence, and this is the only path
    // from `self_registered` into matchable supply.
    status:
      existing.status === "self_registered" && changed.length
        ? "applied"
        : existing.status,
  };
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
