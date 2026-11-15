/**
 * Whether approved deployment companies may see a site's job. One answer, asked the same way on every surface.
 *
 * ## The rule (package E, E2, owner direction of 2026-11-12)
 *
 * Sharing is the service: a job is listed for every approved deployment company if and only if ALL hold:
 * - the site accepted recording statement `2026-11-12.v4` or later, and the grant stands (`RECORDING_VERSIONS_THAT_SHARE`);
 * - the listing record is `job-shared-2026-11-12` (`sharedJobListing`); older cards drop out with no data change;
 * - the video passed the privacy screen (the stored privacy decision `proceeded`);
 * - the job sentence exists (the site's brief holds a real sentence);
 * and none of: the site's withdrawal, Blueprint's operator hold, a rights hold, an authority end (the Pipeline's
 * preparation `authority_ended`), the site closing its job (`website_run_closures`, or `workspace_task` paused/closed).
 * A first look or a simulation is NOT required.
 *
 * Two of these facts live outside the job record (the brief, the preparation state). A caller that holds only the
 * record and passes no `context` gets every other check; every company-facing surface uses `loadCompanyJobAccess`,
 * which reads both and applies the whole rule on every request.
 *
 * ## Who
 *
 * Who counts as an approved company is the account gate each route enforces (`companyViewerForRequest`); this
 * module answers only for the job and never widens that gate.
 *
 * ## Which record to pass
 *
 * Every field read here is stored in plaintext, so pass the record as stored.
 */
import { sceneScreenGateEnded } from "./sceneScreenGate";
import type { TaskListingDetails, TeamEvaluationTerms } from "../../client/src/types/taskBrowse";
import type { InboundRequest } from "../types/inbound-request";
import { assessReadiness } from "../../client/src/lib/siteTaskReadiness";
import { sharedJobListing } from "./taskListingDetails";
import { SHARING_RECORDING_STATEMENT_VERSIONS } from "../../client/src/lib/recordingRightsStatement";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { operatorListingHold, operatorListingPaused } from "./operatorListing";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { coverageEvidenceFrom } from "./captureCoverageEvidence";
import { sceneRunnableReadiness } from "./sceneRunnableReadiness";
import { disclosedUnknownGates, gateAnswersOnFile } from "./gateAnswersOnFile";

/** Why a job is closed to robot teams, in the order the checks run. */
export type TeamJobClosedReason =
  /** Not a site's job: a robot team's own request, or no buyer type at all. */
  | "not_a_site_job"
  /** A placeholder the Pipeline created, not a site's submission. */
  | "pipeline_placeholder"
  /** The confirmed job is a kind the simulation cannot score yet (`siteTaskScope.ts`). */
  | "task_not_yet_supported"
  /** No current card grant: the site kept the job private, hid the card, or a material change awaits its review. */
  | "not_listed"
  /** The retired dossier recorded the job as private. */
  | "kept_private"
  /** The retired dossier shared the job only with named teams. */
  | "restricted_to_named_teams"
  /** The site paused or closed the job. */
  | "operator_paused"
  /** The job was not submitted under a recording statement that shares it (v4 or later), or the grant does not stand. */
  | "older_statement"
  /** The video has not passed the privacy screen. */
  | "privacy_screen_pending"
  /** The site has not given the job's sentence yet. */
  | "no_job_sentence"
  /** The Pipeline ended Blueprint's authority to work on the job. */
  | "authority_ended"
  /** The site closed its job. */
  | "closed_by_site"
  /** The site withdrew its recording permission. */
  | "consent_withdrawn"
  /** Blueprint stopped showing the job to companies from the job console (`operator_listing_hold`). */
  | "blueprint_hold"
  /** A development capture, never a site's live job. */
  | "development_only"
  /** The rights review blocked the capture. */
  | "rights_blocked"
  /** The rights review has not cleared the capture. */
  | "rights_needs_review"
  /** No current recording grant covers building and evaluating the scene. */
  | "recording_consent_missing"
  /** The scene has not been shown to run an evaluation yet. */
  | "scene_not_runnable";

export type TeamJobAccess =
  | { listed: false; evaluationAvailable: false; reason: TeamJobClosedReason; details: null }
  | { listed: true; evaluationAvailable: false; reason: TeamJobClosedReason; details: TaskListingDetails }
  | { listed: true; evaluationAvailable: true; reason: null; details: TaskListingDetails };

type RecordLike = InboundRequest | Record<string, unknown> | null | undefined;

function hasBuiltScene(request: Record<string, any>): boolean {
  return Boolean(request.pipeline?.artifacts?.worldlabs_world_manifest_uri);
}

/**
 * Whether a site's scene can run an evaluation: confirmed, reconstructed and
 * proven runnable.
 *
 * ## What decides
 *
 * - **A scene has to exist.** A world manifest proves reconstruction.
 * - **The operator has to have confirmed the brief.** Otherwise the gates are
 *   our reading of their evidence rather than their answers, and a description
 *   alone could inflate supply.
 * - **Every binding gate has to be answered**, which `assessReadiness` checks
 *   (an answer the site disclosed as unknown counts).
 * - **An evaluation has to be able to run against the scene.**
 *   `sceneRunnableReadiness` requires an internal proof that our harness can
 *   load and step it, and fails closed: unverified is held back.
 *
 * The four-conditions screen's disposition decides nothing for a job whose
 * video arrived after the owner's decision of 2026-11-11 (`sceneScreenGateEnded`);
 * it stays a note for staff. A job uploaded before it still needs `qualified`,
 * until the owner decides about those. The site's consent, its listing and its
 * own pause are checked by `teamJobAccess` around this.
 *
 * Measured coverage is used where we have it, and the old inference where we
 * do not: a built scene means coverage sufficed, which is true by
 * construction. What this must never do is read "nobody checked" as "does not
 * cover", because that would silently drop supply.
 */
/** The old screen still holds only jobs uploaded before the owner's decision of 2026-11-11. */
export function screenAllowsSupply(request: Record<string, any>): boolean {
  return request.site_task_triage?.disposition === "qualified"
    || sceneScreenGateEnded(request, typeof request.requestId === "string" ? request.requestId : "");
}

export function isRunnableTask(request: InboundRequest): boolean {
  // Runs (robot teams running their own software, "later") still respect a site's pause: it no longer hides the job
  // from companies (must-fix 3), but it keeps stopping paid runs, which is the conservative reading.
  if (request.request?.buyerType === "robot_team" || operatorListingPaused(request)
    || !screenAllowsSupply(request as unknown as Record<string, any>)) return false;
  const measured = coverageEvidenceFrom(request as never);
  const readiness = assessReadiness({
    answers: gateAnswersOnFile(request),
    captureMode: request.request?.capture_mode ?? null,
    briefDrafted: true,
    briefConfirmed: Boolean(request.site_task_brief_confirmed_at),
    evidence: {
      hasAny: true,
      hasVisual: true,
      explainsTask: true,
      coversScene: measured?.coversScene ?? true,
      missingCoverage: measured?.missingCoverage,
    },
    reconstructed: hasBuiltScene(request as unknown as Record<string, any>),
    // Gates a site left open when it confirmed its task at submission are
    // disclosed unknowns, never a stop (owner decision 2026-11-07).
    disclosedUnknown: disclosedUnknownGates(request),
  });
  if (!readiness.isSupply) return false;
  // Site-ready is not run-ready: see `sceneRunnableReadiness`.
  return sceneRunnableReadiness(request.evaluation_readiness).runnable;
}

/** A retired-dossier choice narrower than the beta's card, if the record carries one. */
function legacyRestriction(raw: Record<string, any>): TeamJobClosedReason | null {
  const dossier = raw.request?.pilotOpportunity;
  if (!dossier || dossier.requested !== true || dossier.visibility === "anonymized") return null;
  // Anything other than the anonymized audience is narrower than the card:
  // named teams, private, or a value we do not recognize.
  return dossier.visibility === "approved_robot_teams" ? "restricted_to_named_teams" : "kept_private";
}

/**
 * The Pipeline reports its rights verdict on `evaluation_readiness`; older
 * records and fixtures carry it on `pipeline`. Either one blocking is enough.
 */
function rightsHold(raw: Record<string, any>): TeamJobClosedReason | null {
  const verdicts = [raw.pipeline?.rights_review_status, raw.evaluation_readiness?.rights_review_status];
  if (verdicts.includes("blocked")) return "rights_blocked";
  if (verdicts.includes("needs_review")) return "rights_needs_review";
  return null;
}

/** Recording statement versions whose wording shares the job with approved deployment companies (`recordingRightsStatement.ts`). */
export const RECORDING_VERSIONS_THAT_SHARE: readonly string[] = SHARING_RECORDING_STATEMENT_VERSIONS;

/** The facts `teamJobAccess` needs that live outside the job record. Absent fields are not checked (see the header). */
export interface TeamJobAccessContext {
  /** The site's brief (`siteTaskBriefs/{id}`), or null when it has none. */
  brief?: { summary?: string | null; confirmedAtIso?: string | null } | null;
  /** The stored preparation state of the job's current capture (`website_preparation.status.state`), or null. */
  preparationState?: string | null;
}

/** The recording grant stands and was given under a statement that shares the job. */
export function recordingSharesJob(raw: Record<string, any>): boolean {
  const grant = raw.request?.consent_attestation;
  return Boolean(grant) && grant.granted === true && RECORDING_VERSIONS_THAT_SHARE.includes(String(grant.statement_version))
    && !grant.revoked_at_iso && !grant.withdrawn_at_iso;
}

/** The stored privacy decision for the video let it proceed. */
export function privacyScreenPassed(raw: Record<string, any>): boolean {
  const decision = raw.capture_privacy_source_bound_decision || raw.capture_privacy_screen;
  return decision?.proceeded === true && decision?.eligibility !== "rejected" && decision?.eligibility !== "pending";
}

/** The site closed its job: a run closure on record for any capture. */
export function closedBySite(raw: Record<string, any>): boolean {
  const closures = raw.website_run_closures;
  return Boolean(closures) && typeof closures === "object"
    && Object.values(closures as Record<string, unknown>).some(value => Boolean(value) && typeof value === "object");
}

const PLACEHOLDER_SUMMARY = "Your site task";
function briefHasSentence(brief: TeamJobAccessContext["brief"]): boolean {
  const text = (brief?.summary ?? "").trim();
  return Boolean(text) && text !== PLACEHOLDER_SUMMARY;
}

/**
 * The one predicate: may approved deployment companies see this job? `listed` decides whether it appears anywhere a
 * company looks (the library, the job's page, every media route, the response route, introductions and the automatic
 * send). `evaluationAvailable` is kept for older readers; it is never true for a job that is not listed.
 */
export function teamJobAccess(record: RecordLike, context: TeamJobAccessContext = {}): TeamJobAccess {
  const raw = (record ?? {}) as Record<string, any>;
  const closed = (reason: TeamJobClosedReason): TeamJobAccess =>
    ({ listed: false, evaluationAvailable: false, reason, details: null });
  if (raw.request?.buyerType !== "site_operator") return closed("not_a_site_job");
  if (raw.debug?.autoCreatedByPipeline === true) return closed("pipeline_placeholder");
  const rights = projectWebsiteCaptureRights(raw);
  // The stops come first, so a withdrawn or held job is reported as such whatever else it lacks.
  // A withdrawal is found by its own fields (it also sets `workspace_task.paused`, which no longer closes on its own).
  if (rights.consent_revoked || raw.capture_withdrawal) return closed("consent_withdrawn");
  if (operatorListingHold(raw)) return closed("blueprint_hold");
  const hold = rightsHold(raw);
  if (hold) return closed(hold);
  if (context.preparationState === "authority_ended") return closed("authority_ended");
  // The site closing its job: a run closure, or the old workspace "close" (`workspace_task.archived`). A site-set
  // `workspace_task.paused` from the retired pause control does NOT close: under E2 there is no site pause, and a job
  // paused before 2026-11-12 must not be stranded (planner, 15:07Z).
  if (closedBySite(raw) || raw.workspace_task?.archived === true) return closed("closed_by_site");
  if (raw.evidence_tier === "development_only" || raw.pipeline?.evidence_tier === "development_only")
    return closed("development_only");
  const legacy = legacyRestriction(raw);
  if (legacy) return closed(legacy);
  if (!recordingSharesJob(raw)) return closed("older_statement");
  const listing = sharedJobListing(raw);
  if (!listing) return closed("not_listed");
  if (!privacyScreenPassed(raw)) return closed("privacy_screen_pending");
  if (context.brief !== undefined && !briefHasSentence(context.brief)) return closed("no_job_sentence");
  const details = listing.details;
  if (!rights.derived_scene_generation_allowed)
    return { listed: true, evaluationAvailable: false, reason: "recording_consent_missing", details };
  if (!isRunnableTask(raw as InboundRequest))
    return { listed: true, evaluationAvailable: false, reason: "scene_not_runnable", details };
  return { listed: true, evaluationAvailable: true, reason: null, details };
}

/** The stored preparation state of the job's current capture, or null. Never calls the Pipeline. */
export async function storedPreparationState(requestId: string, record: Record<string, any> | null | undefined,
  tx?: FirebaseFirestore.Transaction): Promise<string | null> {
  if (!db) return null;
  const { siteWalkthroughIdentity } = await import("./siteWalkthrough");
  const ref = db.collection("captureUploadSessions").doc(siteWalkthroughIdentity(requestId, record ?? undefined).captureId);
  const preparation = (tx ? await tx.get(ref) : await ref.get()).data()?.website_preparation;
  if (preparation?.selector?.request_id !== requestId) return null;
  return typeof preparation?.status?.state === "string" ? preparation.status.state : null;
}

/** The site's brief for the predicate: its sentence and confirmation only. */
export async function briefForAccess(requestId: string, tx?: FirebaseFirestore.Transaction): Promise<TeamJobAccessContext["brief"]> {
  if (!db) return null;
  const ref = db.collection("siteTaskBriefs").doc(requestId);
  const brief = (tx ? await tx.get(ref) : await ref.get()).data();
  return brief ? { summary: typeof brief.summary === "string" ? brief.summary : null,
    confirmedAtIso: typeof brief.confirmedAtIso === "string" ? brief.confirmedAtIso : null } : null;
}

/**
 * The whole E2 rule for one job, on every company-facing request: reads the job (unless given), the brief and the
 * stored preparation state. Inside a transaction, pass `tx` so every read participates.
 */
export async function loadCompanyJobAccess(requestId: string, given?: Record<string, any> | null,
  tx?: FirebaseFirestore.Transaction): Promise<{ record: Record<string, any> | null; access: TeamJobAccess }> {
  if (!db) throw new Error("company_job_store_unavailable");
  let record = given ?? null;
  if (given === undefined) {
    const ref = db.collection("inboundRequests").doc(requestId);
    record = (tx ? await tx.get(ref) : await ref.get()).data() ?? null;
  }
  if (!record) return { record: null, access: teamJobAccess(null) };
  const [brief, preparationState] = await Promise.all([briefForAccess(requestId, tx), storedPreparationState(requestId, record, tx)]);
  return { record, access: teamJobAccess(record, { brief, preparationState }) };
}

/** The card image route, when the site approved a thumbnail with its card. */
export function taskThumbnailUrl(id: string, record: RecordLike): string | null {
  const digest = (record as { public_task_listing?: { thumbnailDigest?: unknown } } | null | undefined)
    ?.public_task_listing?.thumbnailDigest;
  return typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest)
    ? `/api/site-worlds/tasks/${encodeURIComponent(id)}/thumbnail` : null;
}

const POLICY_INTERFACE_SUMMARIES: Record<string, { robot: "droid_franka" | "team_declared"; summary: string }> = {
  "dreamlabs_dream1.v1": { robot: "team_declared",
    summary: "Your configured dual-arm robot and Dream account model: overview and two wrist views at 5 Hz, measured arm poses and the instruction in; independent end-effector poses and gripper commands at 20 Hz, executed by the 60 Hz simulator controller." },
  "openpi_droid_https.v1": { robot: "droid_franka",
    summary: "Blueprint's simulated DROID Franka with a Robotiq 2F-85: two 224×224 views, joint and gripper state and the instruction in; joint-position action chunks out." },
  "blueprint_policy_https.v1": { robot: "team_declared",
    summary: "Your own robot of any form (fixed or free base) and cameras, declared as a robot manifest with its USD model: your cameras, joint positions and velocities, gripper closure and base state in; a position per joint (a velocity per wheel) and gripper closure out, at 15, 30, 60 or 120 Hz." },
};

/**
 * The job's team evaluation terms from the Pipeline's published offer, or null
 * when the scene does not offer one yet. Only what a team needs to prepare:
 * the instruction, the scored families and their bounds, and the policy
 * interfaces. Never the site's geometry, and never a cell's draw.
 */
export function teamEvaluationTerms(record: RecordLike): TeamEvaluationTerms | null {
  const offer = (record as { agent_execution_offer?: { team_evaluation?: Record<string, any> } } | null | undefined)
    ?.agent_execution_offer?.team_evaluation;
  const contract = offer?.contract;
  if (!offer || !contract || typeof contract.instruction !== "string") return null;
  const bounds = contract.scored?.parameter_bounds && typeof contract.scored.parameter_bounds === "object"
    ? Object.fromEntries(Object.entries(contract.scored.parameter_bounds as Record<string, unknown>)
      .filter((entry): entry is [string, [number, number]] => Array.isArray(entry[1]) && entry[1].length === 2
        && entry[1].every(value => typeof value === "number" && Number.isFinite(value))).slice(0, 16)) : {};
  const interfaces = Array.isArray(contract.policy_interfaces) ? contract.policy_interfaces : [];
  return {
    instruction: contract.instruction.slice(0, 1000),
    taskKind: String(contract.task_kind || ""),
    scored: { available: offer.scored?.available === true,
      reason: typeof offer.scored?.reason === "string" ? offer.scored.reason : null,
      episodes: Number(offer.scored?.episodes) || 0, families: Array.isArray(contract.scored?.families)
      ? contract.scored.families.map(String).slice(0, 16) : [], parameterBounds: bounds },
    policyInterfaces: interfaces.map((row: Record<string, unknown>) => String(row.policy_interface_id || ""))
      .filter((key: string) => key in POLICY_INTERFACE_SUMMARIES)
      .map((key: string) => ({ policyInterfaceId: key, ...POLICY_INTERFACE_SUMMARIES[key] })),
  };
}
