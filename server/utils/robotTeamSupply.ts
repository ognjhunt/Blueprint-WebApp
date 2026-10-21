/**
 * Independent technology, evaluation and delivery relationships, plus legacy
 * combined supply. Recording one relationship never requires the other two.
 * A scoped delivery proposal and actual execution admission remain separate.
 *
 * ## The rule
 *
 * A team is supply — `engaged` — only after it has agreed to three things,
 * and each agreement is on record with the day it was given, a reference to
 * where it is kept, and the operator who recorded it:
 *
 * 1. `supportedInterface`: it will run a policy on a recorded evaluation
 *    interface, using either its own declared robot of any form or the
 *    built-in DROID Franka;
 * 2. `freeEvaluation`: it accepts a free evaluation on a real site job;
 * 3. `pilotIfPassed`: it will take the physical pilot if that evaluation passes.
 *
 * Until all three are recorded the team stays where it was — `prospect`,
 * `applied` or `self_registered`. That legacy combined supply promise is not a
 * gate on technology access: `readRobotTeamRoles` reads the three records
 * independently. None establishes a partner's scoped delivery proposal.
 *
 * ## Why the status is derived, not trusted
 *
 * `status: "engaged"` is one string in a document. A seed script, a research
 * agent, a hand edit or a test fixture can write it, and every one of those has
 * at some point wanted to. So the stored word is not the authority: the
 * agreement record is. `effectiveTeamStatus` reads an `engaged` that has no
 * complete agreement behind it as the status the team had before, and the
 * registry applies it on every read. The only writer that sets `engaged` is
 * `applySupplyAgreementTerms`, and only once the record is complete.
 *
 * ## What the record holds
 *
 * References, not content. `gmail-thread:18c2f0a1b2c3d4e5` or
 * `signed-note:2026-10-20-team-a` lets a reviewer open the thread or note; the
 * text of a team's email does not belong in the registry, and neither does a
 * personal address. `recordedBy` is taken from the authenticated operator,
 * never from the request body.
 *
 * Everything here is pure, so the rule is tested without a database.
 */
import { isDeepStrictEqual } from "node:util";
import { robotEmbodimentSchema } from "../../client/src/types/robotEmbodiment";
import { isTeamEvaluationProfile, TEAM_CANDIDATE_HTTPS_INTERFACE, TEAM_ROBOT_HTTPS_INTERFACE,
  TEAM_DREAM_HTTPS_INTERFACE, TEAM_OWN_ROBOT_INTERFACES } from "./policyIntegration";
import {
  SUPPLY_AGREEMENT_SCHEMA_VERSION,
  SUPPLY_AGREEMENT_TERMS,
  type RobotTeamRecord,
  type RobotTeamStatus,
  type RobotTeamSupplyAgreement,
  type RobotTeamRole,
  type RobotTeamRoleReading,
  type SupplyAgreementEntry,
  type SupplyAgreementTerm,
  type SupplyAgreementWithdrawal,
} from "../types/robot-team-registry";

/**
 * Historical DROID agreement identifier. Keep existing records readable;
 * new records name their interface explicitly and never default to this robot.
 */
export const LEGACY_DROID_SUPPLY_INTERFACE_ID = "droid_franka_panda_robotiq_2f85_v1" as const;
export const SUPPORTED_SUPPLY_INTERFACES = [
  { interfaceId: TEAM_DREAM_HTTPS_INTERFACE, label: "Dream API on the team's configured dual arms", robotEmbodimentRequired: true },
  { interfaceId: TEAM_ROBOT_HTTPS_INTERFACE, label: "Team's own robot of any form", robotEmbodimentRequired: true },
  { interfaceId: TEAM_CANDIDATE_HTTPS_INTERFACE, label: "Blueprint's DROID Franka", robotEmbodimentRequired: false },
  { interfaceId: LEGACY_DROID_SUPPLY_INTERFACE_ID, label: "DROID Franka (legacy agreement identifier)", robotEmbodimentRequired: false },
] as const;
export const SUPPORTED_SUPPLY_INTERFACE_IDS: readonly string[] = SUPPORTED_SUPPLY_INTERFACES.map(row => row.interfaceId);

/** How each agreement is described to an operator, in plain words. */
export const SUPPLY_AGREEMENT_TERM_LABELS: Record<SupplyAgreementTerm, string> = {
  supportedInterface: "Runs a policy on the recorded interface and robot setup (own robot of any form, or Blueprint's DROID Franka)",
  freeEvaluation: "Accepts a free evaluation on a real site job",
  pilotIfPassed: "Takes the physical pilot if its evaluation passes",
};

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** `scheme:identifier`, no whitespace: a pointer, not a paragraph. */
const EVIDENCE_REF = /^[a-z][a-z0-9+.-]{1,40}:\S{3,}$/i;
const EVIDENCE_REF_MAX = 300;

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !CALENDAR_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isIsoInstant(value: unknown): value is string {
  return typeof value === "string" && value.length >= 10 && Number.isFinite(Date.parse(value));
}

/** Why an evidence reference is not acceptable, or null when it is. */
export function evidenceRefProblem(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return "an evidence reference is required";
  const ref = value.trim();
  if (ref.length > EVIDENCE_REF_MAX) return `the evidence reference is longer than ${EVIDENCE_REF_MAX} characters; record a pointer, not the content`;
  if (!EVIDENCE_REF.test(ref)) {
    return "the evidence reference must be a pointer such as gmail-thread:<thread id> or signed-note:<note id>, with no spaces";
  }
  if (/^mailto:/i.test(ref)) return "an email address is not an evidence reference; record the thread or note id";
  return null;
}

/** Why one recorded agreement does not count, or null when it does. */
export function entryProblem(term: SupplyAgreementTerm, entry: SupplyAgreementEntry | null | undefined): string | null {
  if (!entry || typeof entry !== "object") return "not recorded";
  if (!isCalendarDate(entry.agreedOn)) return "the agreement date is missing or not a YYYY-MM-DD date";
  const refProblem = evidenceRefProblem(entry.evidenceRef);
  if (refProblem) return refProblem;
  if (typeof entry.recordedBy !== "string" || !entry.recordedBy.trim()) return "nobody is recorded as having recorded it";
  if (!isIsoInstant(entry.recordedAt)) return "the time it was recorded is missing";
  if (entry.agreedOn > entry.recordedAt.slice(0, 10)) return "the agreement date is after the day it was recorded";
  if (term === "supportedInterface") {
    if (!SUPPORTED_SUPPLY_INTERFACE_IDS.includes(String(entry.interfaceId ?? ""))) {
      return `record the agreed interfaceId explicitly: ${SUPPORTED_SUPPLY_INTERFACE_IDS.join(", ")}`;
    }
    if (TEAM_OWN_ROBOT_INTERFACES.includes(String(entry.interfaceId))) {
      const parsed = robotEmbodimentSchema.safeParse(entry.robotEmbodiment);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return `robotEmbodiment must be the team's valid blueprint.robot_embodiment.v1 declaration (${issue.path.join(".") || "robotEmbodiment"}: ${issue.message})`;
      }
    } else if (entry.robotEmbodiment != null) {
      return `a declared own robot uses interfaceId ${TEAM_ROBOT_HTTPS_INTERFACE}; the DROID interface uses its built-in robot`;
    }
  }
  return null;
}

export interface SupplyAgreementReading {
  /** True only when all three agreements are recorded and none is withdrawn. */
  complete: boolean;
  /** Agreements with no valid record, in `SUPPLY_AGREEMENT_TERMS` order. */
  missing: SupplyAgreementTerm[];
  /** Why each missing agreement does not count. */
  problems: Array<{ term: SupplyAgreementTerm; problem: string }>;
  /** The most recent withdrawal, when the current agreement was withdrawn. */
  withdrawnOn: string | null;
}

/** Read what a team has agreed to. Never throws on malformed data; it just does not count. */
export function readSupplyAgreement(record: Pick<RobotTeamRecord, "supplyAgreement">): SupplyAgreementReading {
  const agreement = record.supplyAgreement;
  const terms = agreement && agreement.schemaVersion === SUPPLY_AGREEMENT_SCHEMA_VERSION && agreement.terms
    && typeof agreement.terms === "object" ? agreement.terms : {};
  const problems = SUPPLY_AGREEMENT_TERMS
    .map(term => ({ term, problem: entryProblem(term, terms[term]) }))
    .filter((row): row is { term: SupplyAgreementTerm; problem: string } => row.problem !== null);
  const history = Array.isArray(agreement?.history) ? agreement!.history : [];
  const lastWithdrawal = history.length ? history[history.length - 1]?.withdrawal?.withdrawnOn ?? null : null;
  const hasCurrentTerms = SUPPLY_AGREEMENT_TERMS.some(term => terms[term]);
  return {
    complete: problems.length === 0,
    missing: problems.map(row => row.term),
    problems,
    withdrawnOn: hasCurrentTerms ? null : lastWithdrawal,
  };
}

/**
 * Read each relationship from its own current evidence. Interface willingness
 * is not actual licensed/executable policy access; that remains with the
 * checkpoint/container and runtime admission contracts. A decline wins over
 * any historical agreement. No pilot promise is needed for interface access.
 */
export function readRobotTeamRoles(
  record: Pick<RobotTeamRecord, "status" | "supplyAgreement">,
): RobotTeamRoleReading {
  const reading = readSupplyAgreement(record);
  const recorded = (term: SupplyAgreementTerm) => record.status !== "declined" && !reading.missing.includes(term);
  const technologyInterfaceRecorded = recorded("supportedInterface");
  return {
    technologyInterfaceRecorded,
    evaluationParticipationRecorded: recorded("freeEvaluation"),
    deliveryInterestRecorded: recorded("pilotIfPassed"),
    interfaceId: technologyInterfaceRecorded ? record.supplyAgreement!.terms.supportedInterface!.interfaceId! : null,
  };
}

export function hasRobotTeamRole(record: RobotTeamRecord, role: RobotTeamRole): boolean {
  const reading = readRobotTeamRoles(record);
  return role === "technology" ? reading.technologyInterfaceRecorded
    : role === "evaluation" ? reading.evaluationParticipationRecorded : reading.deliveryInterestRecorded;
}

const NON_ENGAGED_STATUSES: readonly RobotTeamStatus[] = ["self_registered", "applied", "prospect", "declined"];

/** Where a team goes when it is not, or is no longer, engaged. */
function statusWithoutAgreement(record: Pick<RobotTeamRecord, "statusBeforeEngaged" | "registrationSource">): RobotTeamStatus {
  const before = record.statusBeforeEngaged;
  if (before && NON_ENGAGED_STATUSES.includes(before)) return before;
  // A self-serve row was created by an open endpoint; it does not become a
  // researched prospect because somebody typed "engaged" into it.
  return record.registrationSource === "self_serve" ? "self_registered" : "prospect";
}

/**
 * The status a team actually has. `engaged` only with a complete agreement;
 * every other stored status is returned unchanged.
 */
export function effectiveTeamStatus(
  record: Pick<RobotTeamRecord, "status" | "supplyAgreement" | "statusBeforeEngaged" | "registrationSource">,
): RobotTeamStatus {
  if (record.status !== "engaged") return record.status;
  return readSupplyAgreement(record).complete ? "engaged" : statusWithoutAgreement(record);
}

/** The record with its effective status. Adds no fields, so it is safe to write back. */
export function withEffectiveStatus<T extends RobotTeamRecord>(record: T): T {
  const status = effectiveTeamStatus(record);
  return status === record.status ? record : { ...record, status };
}

/**
 * Whether a site may be told this team will evaluate and pilot their job.
 *
 * Both halves are required: the stored status says the team is engaged (so a
 * `declined` written later wins), and the agreement record backs it.
 */
export function isWillingSupply(
  record: Pick<RobotTeamRecord, "status" | "supplyAgreement" | "statusBeforeEngaged" | "registrationSource"> | null | undefined,
): boolean {
  if (!record) return false;
  return record.status === "engaged" && effectiveTeamStatus(record) === "engaged";
}

/**
 * Willingness must cover the setup this run actually admitted. An agreement
 * never proves task compatibility or a passing result; those checks remain
 * with execution admission and recommendation evidence. Missing historical
 * execution bindings cannot establish a new recommendation's robot setup.
 */
export function isWillingSupplyForExecution(
  record: RobotTeamRecord | null | undefined,
  executionAdmission: unknown,
): boolean {
  return Boolean(record && isWillingSupply(record) && hasRecordedInterfaceForExecution(record, executionAdmission));
}

/** Setup-scoped interface agreement, independent of evaluation participation or delivery interest. */
export function hasRecordedInterfaceForExecution(
  record: RobotTeamRecord | null | undefined,
  executionAdmission: unknown,
): boolean {
  if (!record || !readRobotTeamRoles(record).technologyInterfaceRecorded) return false;
  const admission = executionAdmission as { envelope?: { canonical_execution_request?: {
    policy_package?: { policy_api_endpoint?: { policy_interface_id?: unknown; execution_profile?: unknown; robot_embodiment?: unknown } };
  } } } | null | undefined;
  const policy = admission?.envelope?.canonical_execution_request?.policy_package?.policy_api_endpoint;
  if (!policy || !isTeamEvaluationProfile(policy.execution_profile)) return false;
  const entry = record.supplyAgreement!.terms.supportedInterface!;
  if (policy.policy_interface_id === TEAM_CANDIDATE_HTTPS_INTERFACE) {
    return [LEGACY_DROID_SUPPLY_INTERFACE_ID, TEAM_CANDIDATE_HTTPS_INTERFACE].includes(String(entry.interfaceId))
      && policy.robot_embodiment == null;
  }
  if (!TEAM_OWN_ROBOT_INTERFACES.includes(String(policy.policy_interface_id))
    || entry.interfaceId !== policy.policy_interface_id) return false;
  const executed = robotEmbodimentSchema.safeParse(policy.robot_embodiment);
  const agreed = robotEmbodimentSchema.safeParse(entry.robotEmbodiment);
  return executed.success && agreed.success && isDeepStrictEqual(executed.data, agreed.data);
}

/** What an operator submits for one agreement. */
export interface SupplyAgreementTermInput {
  term: SupplyAgreementTerm;
  agreedOn: string;
  evidenceRef: string;
  interfaceId?: string | null;
  robotEmbodiment?: SupplyAgreementEntry["robotEmbodiment"];
}

export type ApplySupplyAgreementResult =
  | { ok: true; record: RobotTeamRecord; reading: SupplyAgreementReading; recorded: SupplyAgreementTerm[]; engagedNow: boolean }
  | { ok: false; errors: Array<{ term: SupplyAgreementTerm | null; problem: string }> };

function emptyAgreement(): RobotTeamSupplyAgreement {
  return { schemaVersion: SUPPLY_AGREEMENT_SCHEMA_VERSION, terms: {}, history: [] };
}

function currentAgreement(record: Pick<RobotTeamRecord, "supplyAgreement">): RobotTeamSupplyAgreement {
  const agreement = record.supplyAgreement;
  if (!agreement || agreement.schemaVersion !== SUPPLY_AGREEMENT_SCHEMA_VERSION) return emptyAgreement();
  return {
    schemaVersion: SUPPLY_AGREEMENT_SCHEMA_VERSION,
    terms: { ...(agreement.terms ?? {}) },
    history: Array.isArray(agreement.history) ? [...agreement.history] : [],
  };
}

/**
 * Record one or more agreements on a team.
 *
 * Each entry is validated on its own and the whole call fails if any entry is
 * wrong, so a half-valid submission never lands. Re-recording an agreement
 * replaces it (a better reference, a corrected date); the event log written
 * beside the record keeps the earlier one. The team becomes `engaged` the
 * moment the third agreement lands, and not before.
 */
export function applySupplyAgreementTerms(
  record: RobotTeamRecord,
  inputs: readonly SupplyAgreementTermInput[],
  actor: string,
  nowIso: string,
): ApplySupplyAgreementResult {
  const recordedBy = typeof actor === "string" ? actor.trim() : "";
  if (!recordedBy) return { ok: false, errors: [{ term: null, problem: "a named operator must record the agreement" }] };
  if (!inputs.length) return { ok: false, errors: [{ term: null, problem: "record at least one agreement" }] };

  const seen = new Set<SupplyAgreementTerm>();
  const errors: Array<{ term: SupplyAgreementTerm | null; problem: string }> = [];
  const entries: Array<[SupplyAgreementTerm, SupplyAgreementEntry]> = [];
  for (const input of inputs) {
    if (!SUPPLY_AGREEMENT_TERMS.includes(input.term)) {
      errors.push({ term: null, problem: `unknown agreement "${String(input.term)}"` });
      continue;
    }
    if (seen.has(input.term)) {
      errors.push({ term: input.term, problem: "the same agreement was submitted twice" });
      continue;
    }
    seen.add(input.term);
    const entry: SupplyAgreementEntry = {
      agreedOn: typeof input.agreedOn === "string" ? input.agreedOn.trim() : "",
      evidenceRef: typeof input.evidenceRef === "string" ? input.evidenceRef.trim() : "",
      recordedBy,
      recordedAt: nowIso,
      ...(input.term === "supportedInterface"
        ? { interfaceId: typeof input.interfaceId === "string" ? input.interfaceId.trim() : "",
          ...(input.robotEmbodiment != null ? { robotEmbodiment: input.robotEmbodiment } : {}) }
        : {}),
    };
    const problem = entryProblem(input.term, entry);
    if (problem) errors.push({ term: input.term, problem });
    else {
      if (TEAM_OWN_ROBOT_INTERFACES.includes(String(entry.interfaceId))) entry.robotEmbodiment = robotEmbodimentSchema.parse(entry.robotEmbodiment);
      entries.push([input.term, entry]);
    }
  }
  if (errors.length) return { ok: false, errors };

  const agreement = currentAgreement(record);
  for (const [term, entry] of entries) agreement.terms[term] = entry;

  const wasEngaged = isWillingSupply(record);
  const reading = readSupplyAgreement({ supplyAgreement: agreement });
  const priorStatus = effectiveTeamStatus(record);
  const next: RobotTeamRecord = {
    ...record,
    supplyAgreement: agreement,
    status: reading.complete ? "engaged" : priorStatus,
    statusBeforeEngaged: reading.complete
      ? (wasEngaged ? record.statusBeforeEngaged ?? null : priorStatus)
      : record.statusBeforeEngaged ?? null,
    updatedAt: nowIso,
  };
  return { ok: true, record: next, reading, recorded: entries.map(([term]) => term), engagedNow: reading.complete && !wasEngaged };
}

export type WithdrawSupplyAgreementResult =
  | { ok: true; record: RobotTeamRecord; wasEngaged: boolean }
  | { ok: false; problem: string };

/**
 * Withdraw the named relationships, retaining the other current agreements.
 * Omitted terms preserves legacy full withdrawal. Ended agreements move to
 * history; losing any term removes combined supply without erasing independent
 * policy/interface access or evaluation participation that was not withdrawn.
 */
export function withdrawSupplyAgreement(
  record: RobotTeamRecord,
  input: { withdrawnOn: string; evidenceRef: string; terms?: readonly SupplyAgreementTerm[] },
  actor: string,
  nowIso: string,
): WithdrawSupplyAgreementResult {
  const recordedBy = typeof actor === "string" ? actor.trim() : "";
  if (!recordedBy) return { ok: false, problem: "a named operator must record the withdrawal" };
  const withdrawnOn = typeof input.withdrawnOn === "string" ? input.withdrawnOn.trim() : "";
  if (!isCalendarDate(withdrawnOn) || withdrawnOn > nowIso.slice(0, 10)) {
    return { ok: false, problem: "the withdrawal date must be a YYYY-MM-DD date no later than today" };
  }
  const refProblem = evidenceRefProblem(input.evidenceRef);
  if (refProblem) return { ok: false, problem: refProblem };

  const agreement = currentAgreement(record);
  const selected = input.terms ?? SUPPLY_AGREEMENT_TERMS;
  if (!selected.length || new Set(selected).size !== selected.length
    || selected.some(term => !SUPPLY_AGREEMENT_TERMS.includes(term))) {
    return { ok: false, problem: "name one or more distinct current agreement terms to withdraw" };
  }
  const withdrawnTerms: RobotTeamSupplyAgreement["terms"] = {};
  const remainingTerms = { ...agreement.terms };
  for (const term of selected) {
    if (agreement.terms[term]) withdrawnTerms[term] = agreement.terms[term];
    delete remainingTerms[term];
  }
  if (!Object.keys(withdrawnTerms).length) return { ok: false, problem: "this team has no selected recorded agreement to withdraw" };
  const withdrawal: SupplyAgreementWithdrawal = {
    withdrawnOn, evidenceRef: input.evidenceRef.trim(), recordedBy, recordedAt: nowIso,
  };
  const wasEngaged = isWillingSupply(record);
  const next: RobotTeamRecord = {
    ...record,
    supplyAgreement: {
      schemaVersion: SUPPLY_AGREEMENT_SCHEMA_VERSION,
      terms: remainingTerms,
      history: [...(agreement.history ?? []), { terms: withdrawnTerms, withdrawal }],
    },
    status: record.status === "engaged" ? statusWithoutAgreement(record) : record.status,
    statusBeforeEngaged: null,
    updatedAt: nowIso,
  };
  return { ok: true, record: next, wasEngaged };
}

/** An operator-facing summary: no evidence references, only what is missing. */
export function supplySummary(record: RobotTeamRecord): {
  willingSupply: boolean;
  missingAgreements: SupplyAgreementTerm[];
  withdrawnOn: string | null;
  roles: RobotTeamRoleReading;
} {
  const reading = readSupplyAgreement(record);
  return { willingSupply: isWillingSupply(record), missingAgreements: reading.missing, withdrawnOn: reading.withdrawnOn,
    roles: readRobotTeamRoles(record) };
}
