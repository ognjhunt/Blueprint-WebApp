/**
 * Whether approved deployment companies may see a site's job. One answer, asked the same way on every surface.
 *
 * ## The rule (package E, E2, owner direction of 2026-11-12)
 *
 * Sharing is the service: a job is listed for every approved deployment company if and only if ALL hold:
 * - it is not an internal test job (`internal_test`, checked before anything else);
 * - the site accepted recording statement `2026-11-12.v4` or later, and the grant stands (`RECORDING_VERSIONS_THAT_SHARE`),
 *   and a verified company video for the current capture is available;
 * - the listing record is `job-shared-2026-11-12` (`sharedJobListing`); older cards drop out with no data change;
 * - the job sentence exists (the site's brief holds a real sentence);
 * and none of: the site's withdrawal, Blueprint's operator hold, a rights hold, an authority end (the Pipeline's
 * preparation `authority_ended`), the site closing its job (`website_run_closures`, or `workspace_task` paused/closed),
 * the job ended because what was needed from the site never came (the no-grant ending, a wait on the site).
 * A first look or a simulation is NOT required. Nor is an upload-time privacy decision: no screen has held a capture
 * since 2026-09-24 (`capturePrivacyScreen.ts` always proceeds), so waiting for its record only stranded jobs.
 *
 * The brief and the capture session supply the remaining facts. A caller that holds only the job record can check
 * its stored restrictions. Company-facing surfaces use `loadCompanyJobAccess` for the full rule.
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
import type { TaskListingDetails, TeamEvaluationTerms } from "../../client/src/types/taskBrowse";
import type { InboundRequest } from "../types/inbound-request";
import { listingDetailsForSentence, sharedJobListing } from "./taskListingDetails";
import { SHARING_RECORDING_STATEMENT_VERSIONS } from "../../client/src/lib/recordingRightsStatement";
import { recordingStatementShares } from "./jobSharedListing";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { operatorListingHold } from "./operatorListing";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { isInternalTestJob } from "./internalTestJob";
import { recordedWebsiteJobNoGrantEnding } from "./websiteJobWindowEnding";
import { siteWalkthroughIdentity } from "./siteWalkthrough";

/** Why a job is closed to robot teams, in the order the checks run. */
export type TeamJobClosedReason =
  /** An internal test job (`internalTestJob.ts`): never shown to any company, whatever else it holds. Checked first. */
  | "internal_test_job"
  /** Not a site's job: a robot team's own request, or no buyer type at all. */
  | "not_a_site_job"
  /** A placeholder the Pipeline created, not a site's submission. */
  | "pipeline_placeholder"
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
  /** Listed, but the company simulation of the current capture is not stored yet (`storedCompanySimulation`). */
  | "simulation_not_ready"
  /** The required company video is not available for this capture. */
  | "video_required"
  /**
   * The job ended because what was needed from the site never came (`websiteJobWindowSweep`'s no-grant ending, a wait
   * on the site): its page says so and asks for a new job, so no company sees it either.
   */
  | "job_ended";

export type TeamJobAccess =
  | { listed: false; evaluationAvailable: false; reason: TeamJobClosedReason; details: null }
  | { listed: true; evaluationAvailable: false; reason: TeamJobClosedReason; details: TaskListingDetails }
  | { listed: true; evaluationAvailable: true; reason: null; details: TaskListingDetails };

type RecordLike = InboundRequest | Record<string, unknown> | null | undefined;

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

/**
 * How much of the place a company may see, by the recording statement version the site accepted: "state" shows the
 * state and country, "city" the city, state and country. A version not listed shows the country alone (`companyPlaceOf`).
 * Recording statement 2026-11-23.v6 names "the city and state it is in" (owner, 2026-11-23); v4 and older do not.
 */
export const RECORDING_VERSION_PLACE_LEVEL: Readonly<Record<string, "state" | "city">> = { "2026-11-23.v6": "city" };

/** The facts `teamJobAccess` needs that live outside the job record. Absent fields are not checked (see the header). */
export interface TeamJobAccessContext {
  /** Verified on production reads from the current capture's stored company clip. */
  companyVideoReady?: boolean;
  /** The site's brief (`siteTaskBriefs/{id}`), or null when it has none. */
  brief?: { summary?: string | null; confirmedAtIso?: string | null } | null;
  /** The stored preparation state of the job's current capture (`website_preparation.status.state`), or null. */
  preparationState?: string | null;
  /** The company simulation of the current capture is stored (`storedCompanySimulation`). Absent reads as not ready. */
  companySimulationReady?: boolean;
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
 * send). `evaluationAvailable` (a job card's "Ready") is true once a listed job's company simulation is stored.
 */
export function teamJobAccess(record: RecordLike, context: TeamJobAccessContext = {}): TeamJobAccess {
  const raw = (record ?? {}) as Record<string, any>;
  const closed = (reason: TeamJobClosedReason): TeamJobAccess =>
    ({ listed: false, evaluationAvailable: false, reason, details: null });
  // An internal test job stays internal (owner, 2026-11-15): refused before every other stop, with its own reason.
  if (isInternalTestJob(raw)) return closed("internal_test_job");
  if (raw.request?.buyerType !== "site_operator") return closed("not_a_site_job");
  if (raw.debug?.autoCreatedByPipeline === true) return closed("pipeline_placeholder");
  const rights = projectWebsiteCaptureRights(raw);
  // The stops come first, so a withdrawn or held job is reported as such whatever else it lacks.
  // A withdrawal is found by its own fields (it also sets `workspace_task.paused`, which no longer closes on its own).
  if (rights.consent_revoked || raw.capture_withdrawal) return closed("consent_withdrawn");
  if (operatorListingHold(raw)) return closed("blueprint_hold");
  const hold = rightsHold(raw);
  if (hold) return closed(hold);
  // An ended authority closes the listing only for a source revocation (the recorded grant no longer allows scene
  // building); a withdrawal is caught above and an owner close just below. The Pipeline also ends authority when
  // Blueprint's own work window runs out (`consent_expired`): that stops further work only, so the job stays listed
  // and Introduce us keeps working (finding G-01).
  if (context.preparationState === "authority_ended" && !rights.derived_scene_generation_allowed) return closed("authority_ended");
  // The site closing its job: a run closure, or the old workspace "close" (`workspace_task.archived`). A site-set
  // `workspace_task.paused` from the retired pause control does NOT close: under E2 there is no site pause, and a job
  // paused before 2026-11-12 must not be stranded (planner, 15:07Z).
  if (closedBySite(raw) || raw.workspace_task?.archived === true) return closed("closed_by_site");
  // The job's page and its listing say the same: a job ended for want of the site's step is not shown to companies. A
  // wait on Blueprint that ran out holds only the simulation; the job stays listed (`jobNoGrantEndingMessage`).
  if (recordedWebsiteJobNoGrantEnding(raw)?.waiting_on === "site") return closed("job_ended");
  if (raw.evidence_tier === "development_only" || raw.pipeline?.evidence_tier === "development_only")
    return closed("development_only");
  const legacy = legacyRestriction(raw);
  if (legacy) return closed(legacy);
  if (!recordingStatementShares(raw)) return closed("older_statement");
  const listing = sharedJobListing(raw);
  if (!listing) return closed("not_listed");
  if (context.brief !== undefined && !briefHasSentence(context.brief)) return closed("no_job_sentence");
  if (context.companyVideoReady === false) return closed("video_required");
  const details = listingDetailsForSentence(listing.details, context.brief?.summary);
  if (!rights.derived_scene_generation_allowed)
    return { listed: true, evaluationAvailable: false, reason: "recording_consent_missing", details };
  // A job card's "Ready" is the company simulation itself, never the retired trial's runnable proof.
  if (context.companySimulationReady !== true)
    return { listed: true, evaluationAvailable: false, reason: "simulation_not_ready", details };
  return { listed: true, evaluationAvailable: true, reason: null, details };
}

/**
 * The whole E2 rule for one job, on every company-facing request: reads the job (unless given), the brief and the
 * stored preparation state. Inside a transaction, pass `tx` so every read participates.
 */
export async function loadCompanyJobAccess(requestId: string, given?: Record<string, any> | null,
  tx?: FirebaseFirestore.Transaction): Promise<{ record: Record<string, any> | null; access: TeamJobAccess;
    brief: FirebaseFirestore.DocumentData | undefined; session: FirebaseFirestore.DocumentData | undefined }> {
  if (!db) throw new Error("company_job_store_unavailable");
  let record = given ?? null;
  if (given === undefined) {
    const ref = db.collection("inboundRequests").doc(requestId);
    record = (tx ? await tx.get(ref) : await ref.get()).data() ?? null;
  }
  if (!record) return { record: null, access: teamJobAccess(null), brief: undefined, session: undefined };
  const { captureId } = siteWalkthroughIdentity(requestId, record);
  const read = (ref: FirebaseFirestore.DocumentReference) => (tx ? tx.get(ref) : ref.get()).then(snapshot => snapshot.data());
  const [brief, session] = await Promise.all([read(db.collection("siteTaskBriefs").doc(requestId)),
    read(db.collection("captureUploadSessions").doc(captureId))]);
  const preparation = session?.website_preparation;
  const preparationState = preparation?.selector?.request_id === requestId && typeof preparation?.status?.state === "string"
    ? preparation.status.state : null;
  const briefForAccess = brief ? { summary: typeof brief.summary === "string" ? brief.summary : null,
    confirmedAtIso: typeof brief.confirmedAtIso === "string" ? brief.confirmedAtIso : null } : null;
  const { storedCompanyClip } = await import("./websiteCompanyClip");
  const clip = storedCompanyClip(session, captureId);
  const privateClip = clip?.permission_basis === "internal_test";
  const companyVideoReady = Boolean(clip) && !privateClip;
  const { storedCompanySimulation } = await import("./websiteCompanySimulation");
  const companySimulationReady = Boolean(storedCompanySimulation(session, captureId));
  return { record, access: teamJobAccess(record, { brief: briefForAccess, preparationState, companyVideoReady,
    companySimulationReady }), brief, session };
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
