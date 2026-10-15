/**
 * Whether approved robot teams may see a site's job and request an evaluation
 * on it. One answer, asked the same way on every surface.
 *
 * ## Why there is one predicate
 *
 * The job library offered approved teams "Request a free invited evaluation"
 * by one rule (`isRunnableTask`), while the opening page and
 * `POST /api/workspace/evaluations` admitted by another: the retired pilot
 * dossier gate, which needed fields the public start form never sends. Every
 * team that followed the library link, or the link in its notification email,
 * landed on "Opening unavailable", and free admission never received the
 * `workspace_evaluation` it starts from. Each surface now reads this module:
 *
 * - the library card and its `evaluationAvailable` (`taskBrowse.ts`);
 * - the opening page API and `POST /api/workspace/evaluations`
 *   (`routes/workspace.ts`), which the notification email links lead to;
 * - free admission, re-checked when Blueprint approves the run
 *   (`freeEvaluationHandoff.ts`);
 * - the agent API's candidate list (`teamEvalCandidates.ts`);
 * - the site's own "Open for evaluations" status (`workspace-projection.ts`).
 *
 * ## The site's consent is the card
 *
 * On the start form a site either authorizes the anonymized job card that
 * approved robot teams see (`public_task_listing`) or keeps the job private.
 * No card, no team access. A team only ever sees the card's approved fields
 * (`approvedTaskDetails`), never raw intake, footage or the rebuilt scene.
 *
 * A record written under the retired dossier (`request.pilotOpportunity`) can
 * narrow access and never widen it: a dossier marked private, or shared only
 * with named teams, closes the job to every team. The beta's card is shown to
 * every approved team, so it cannot honour a narrower named list; refusing
 * everyone is the reading that never shows the job to a team the site did not
 * name.
 *
 * ## Which record to pass
 *
 * Every field read here is stored in plaintext, so pass the record as stored.
 * `decryptInboundRequestForAdmin` rebuilds `request` without the recording
 * grant (`request.consent_attestation`); a caller holding only that view must
 * carry the stored grant across, as `decodeWorkspaceRequest` does.
 *
 * ## What this does not decide
 *
 * Who counts as an approved robot team. That is the account gate each route
 * already enforces (an invited, approved, verified robot-team account); this
 * module answers only for the job and never widens that gate.
 */
import type { TaskListingDetails, TeamEvaluationTerms, TeamJobOpening } from "../../client/src/types/taskBrowse";
import type { InboundRequest } from "../types/inbound-request";
import { assessReadiness } from "../../client/src/lib/siteTaskReadiness";
import { approvedTaskDetails } from "./taskListingDetails";
import { operatorListingPaused } from "./operatorListing";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { coverageEvidenceFrom } from "./captureCoverageEvidence";
import { sceneRunnableReadiness } from "./sceneRunnableReadiness";
import { gateAnswersOnFile } from "./gateAnswersOnFile";

/** Why a job is closed to robot teams, in the order the checks run. */
export type TeamJobClosedReason =
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
  /** The site withdrew its recording permission. */
  | "consent_withdrawn"
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
 * Whether a site's scene can run an evaluation: screened, confirmed,
 * reconstructed, and proven runnable.
 *
 * ## Four conditions, and each one used to be missing or wrong
 *
 * - **A scene has to exist.** A world manifest proves reconstruction.
 * - **The operator has to have confirmed the brief.** Otherwise the gates are
 *   our reading of their evidence rather than their answers, and a description
 *   alone could inflate supply.
 * - **Every binding gate has to be answered**, which `qualified` implies and
 *   `assessReadiness` re-checks.
 * - **An evaluation has to be able to run against the scene.**
 *   `sceneRunnableReadiness` requires an internal proof that our harness can
 *   load and step it, and fails closed: unverified is held back.
 *
 * Measured coverage is used where we have it, and the old inference where we
 * do not: a built scene means coverage sufficed, which is true by
 * construction. What this must never do is read "nobody checked" as "does not
 * cover", because that would silently drop supply.
 */
export function isRunnableTask(request: InboundRequest): boolean {
  if (request.request?.buyerType === "robot_team" || operatorListingPaused(request)
    || request.site_task_triage?.disposition !== "qualified") return false;
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

/**
 * The one predicate: may approved robot teams see this job, and may they
 * request an evaluation on it?
 *
 * `listed` decides whether the card appears at all. `evaluationAvailable`
 * decides whether a team may open the job and request an evaluation; it is
 * never true for a job that is not listed.
 */
export function teamJobAccess(record: RecordLike): TeamJobAccess {
  const raw = (record ?? {}) as Record<string, any>;
  const closed = (reason: TeamJobClosedReason): TeamJobAccess =>
    ({ listed: false, evaluationAvailable: false, reason, details: null });
  if (raw.request?.buyerType !== "site_operator") return closed("not_a_site_job");
  if (raw.debug?.autoCreatedByPipeline === true) return closed("pipeline_placeholder");
  // A grant is for the card's text fields only. It never authorizes footage or raw intake.
  const details = approvedTaskDetails(raw);
  if (!details) return closed("not_listed");
  const legacy = legacyRestriction(raw);
  if (legacy) return closed(legacy);
  if (operatorListingPaused(raw)) return closed("operator_paused");
  const rights = projectWebsiteCaptureRights(raw);
  if (rights.consent_revoked) return closed("consent_withdrawn");
  if (raw.evidence_tier === "development_only" || raw.pipeline?.evidence_tier === "development_only")
    return closed("development_only");
  const hold = rightsHold(raw);
  if (hold) return closed(hold);
  // Listed. An evaluation also needs the recording grant free admission
  // requires, and a scene that is proven to run.
  if (!rights.derived_scene_generation_allowed)
    return { listed: true, evaluationAvailable: false, reason: "recording_consent_missing", details };
  if (!isRunnableTask(raw as InboundRequest))
    return { listed: true, evaluationAvailable: false, reason: "scene_not_runnable", details };
  return { listed: true, evaluationAvailable: true, reason: null, details };
}

/** The card image route, when the site approved a thumbnail with its card. */
export function taskThumbnailUrl(id: string, record: RecordLike): string | null {
  const digest = (record as { public_task_listing?: { thumbnailDigest?: unknown } } | null | undefined)
    ?.public_task_listing?.thumbnailDigest;
  return typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest)
    ? `/api/site-worlds/tasks/${encodeURIComponent(id)}/thumbnail` : null;
}

/**
 * The job as an approved robot team opens it to request an evaluation: the
 * site-approved card and nothing more. Null whenever the job is not open.
 */
export function projectTeamJobOpening(id: string, record: RecordLike): TeamJobOpening | null {
  const access = teamJobAccess(record);
  if (!access.evaluationAvailable) return null;
  const listing = (record as { public_task_listing: { approvedAtIso: string } }).public_task_listing;
  return { ...access.details, id, publishedAtIso: listing.approvedAtIso, thumbnailUrl: taskThumbnailUrl(id, record),
    evaluation: teamEvaluationTerms(record) };
}

const POLICY_INTERFACE_SUMMARIES: Record<string, { robot: "droid_franka" | "team_declared"; summary: string }> = {
  "openpi_droid_https.v1": { robot: "droid_franka",
    summary: "Blueprint's simulated DROID Franka with a Robotiq 2F-85: two 224×224 views, joint and gripper state and the instruction in; joint-position action chunks out." },
  "blueprint_policy_https.v1": { robot: "team_declared",
    summary: "Your own fixed-base arm and cameras, declared as a robot manifest with its USD model: your cameras, joint state and gripper closure in; joint targets and gripper closure out, at 15, 30 or 60 Hz." },
};

function finiteRecord(value: unknown): Record<string, number> {
  return Object.fromEntries(Object.entries(value && typeof value === "object" ? value as Record<string, unknown> : {})
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])).slice(0, 16));
}

/**
 * The job's team evaluation terms from the Pipeline's published offer, or null
 * when the scene does not offer one yet. Only what a team needs to prepare:
 * the instruction, the published practice cells, the scored families and
 * their bounds, and the policy interfaces. Never the site's geometry.
 */
export function teamEvaluationTerms(record: RecordLike): TeamEvaluationTerms | null {
  const offer = (record as { agent_execution_offer?: { team_evaluation?: Record<string, any> } } | null | undefined)
    ?.agent_execution_offer?.team_evaluation;
  const contract = offer?.contract;
  if (!offer || !contract || typeof contract.instruction !== "string") return null;
  const listing = (purpose: "practice" | "scored") => ({ available: offer[purpose]?.available === true,
    reason: typeof offer[purpose]?.reason === "string" ? offer[purpose].reason : null,
    episodes: Number(offer[purpose]?.episodes) || 0 });
  const cells = Array.isArray(contract.practice?.cells) ? contract.practice.cells.slice(0, 20) : [];
  const bounds = contract.scored?.parameter_bounds && typeof contract.scored.parameter_bounds === "object"
    ? Object.fromEntries(Object.entries(contract.scored.parameter_bounds as Record<string, unknown>)
      .filter((entry): entry is [string, [number, number]] => Array.isArray(entry[1]) && entry[1].length === 2
        && entry[1].every(value => typeof value === "number" && Number.isFinite(value))).slice(0, 16)) : {};
  const interfaces = Array.isArray(contract.policy_interfaces) ? contract.policy_interfaces : [];
  return {
    instruction: contract.instruction.slice(0, 1000),
    taskKind: String(contract.task_kind || ""),
    practice: { ...listing("practice"), cells: cells.map((cell: Record<string, unknown>) => ({
      cellId: String(cell.cell_id || ""), family: String(cell.family || ""), parameters: finiteRecord(cell.parameters) })) },
    scored: { ...listing("scored"), families: Array.isArray(contract.scored?.families)
      ? contract.scored.families.map(String).slice(0, 16) : [], parameterBounds: bounds },
    policyInterfaces: interfaces.map((row: Record<string, unknown>) => String(row.policy_interface_id || ""))
      .filter((key: string) => key in POLICY_INTERFACE_SUMMARIES)
      .map((key: string) => ({ policyInterfaceId: key, ...POLICY_INTERFACE_SUMMARIES[key] })),
  };
}
