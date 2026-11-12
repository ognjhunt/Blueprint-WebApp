/** Redacted, deterministic closeout of existing source-bound preparation evidence.
 * Never classify an exception string, an estimated height or an agent's opinion
 * as robot incompatibility. Status reads do not retry work or grant spending.
 */
import { z } from "zod";
import type { TaskOutcome } from "../../client/src/types/taskOutcome";
import { selectWebsiteAtlasPreview, type WebsiteAtlasPreview } from "./websiteAtlasPreview";
import { websiteLargeVideoAsk } from "./websiteJobWindowEnding";

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const carryPathRejected = z.object({ reason: z.literal("robot_carry_path_rejected"), category: z.literal("robot_incompatibility"),
  basis: z.literal("conservative_configuration_check"), robot_id: z.literal("franka_panda"), evidence_digest: digest }).strict();
const taskEvidenceIncomplete = z.object({ reason: z.literal("task_evidence_incomplete"), category: z.literal("insufficient_evidence"),
  basis: z.literal("missing_evidence"), robot_id: z.null(), evidence_digest: digest }).strict();
/**
 * An outcome whose reason this release does not know (review, 2026-11-12): it never fails the status read. Its shape
 * is still checked (a code-shaped category and basis, and a sealed evidence digest); the site sees one general sentence for it
 * (`unknownOutcome`) and staff hear once per job and code. A known reason must keep its own exact shape.
 */
export const KNOWN_PREPARATION_OUTCOME_REASONS = new Set<string>(["robot_carry_path_rejected", "task_evidence_incomplete",
  "robot_fit_none"]);
const unknownReasonOutcome = z.object({ reason: z.string().regex(/^[a-z][a-z0-9_:.-]{0,127}$/),
  // Open too (review, 2026-11-12): a category this release does not know reads as the same general sentence.
  category: z.string().regex(/^[a-z][a-z0-9_:.-]{0,127}$/), basis: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  robot_id: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/).nullable(), evidence_digest: digest }).strict()
  .refine(value => !KNOWN_PREPARATION_OUTCOME_REASONS.has(value.reason) && !isRecaptureReason(value.reason)
    && value.reason !== TASK_NOT_NAMED_REASON, "A known reason keeps its own shape");
/** Preparation status v3–v5 keep this vocabulary, and accept a reason they do not know. */
export const preparationOutcomeSchema = z.union([z.discriminatedUnion("reason", [carryPathRejected, taskEvidenceIncomplete]),
  unknownReasonOutcome]);
/** v6 adds the early robot fit hold (Pipeline #3336): no robot Blueprint runs fits the task in this room,
 * decided before any spend. Its evidence is the precheck's digest. */
export const preparationOutcomeV6Schema = z.union([z.discriminatedUnion("reason", [carryPathRejected, taskEvidenceIncomplete,
  z.object({ reason: z.literal("robot_fit_none"), category: z.literal("robot_incompatibility"),
    basis: z.literal("conservative_pre_spend_fit_check"), robot_id: z.null(), evidence_digest: digest }).strict()]),
  unknownReasonOutcome]);
/** The preparation stops only a new video can clear (Pipeline `website_recapture_required`): the reason is the
 * stop's own code. Each has its sentences in `RECAPTURE_SENTENCES`. */
export const PREPARATION_RECAPTURE_REASONS = ["website_front_normal_undetermined", "website_registration_ambiguous",
  "website_registration_poor_fit", "website_registration_conflicts_provider_anchor",
  "website_registration_anchor_deviation", "website_registration_ground_plane_inconsistent",
  // The object the job moves was never seen, or no frame of the video could be used (review, 2026-11-12).
  "website_task_object_not_observed", "website_capture_frames_unusable"] as const;
/**
 * The job has no sentence saying what the robot should do, so the Pipeline cannot prepare it and retries hourly. The
 * site names its job; the page asks for it, and no "needs attention" email goes out. Sent by the Atlas preview as
 * `needs_input`, and by the preparation status as an outcome with this reason.
 */
export const TASK_NOT_NAMED_REASON = "website_task_not_named";
/** v7 adds those stops: the preparation ended at once and the site is asked to film again. */
export const preparationOutcomeV7Schema = z.union([preparationOutcomeV6Schema, z.object({
  reason: z.enum([...PREPARATION_RECAPTURE_REASONS, TASK_NOT_NAMED_REASON]), category: z.literal("insufficient_evidence"),
  basis: z.literal("missing_evidence"), robot_id: z.null(), evidence_digest: digest }).strict()]);
export type PreparationOutcomeReceipt = z.infer<typeof preparationOutcomeV7Schema>;

/** What the v6 precheck says about a robot fit hold, when it binds to the same evidence as the outcome. */
export type RobotFitHoldEvidence = { holdReason: string | null; precheckDigest: string;
  counts: { fit: number; noFit: number; unknown: number; unavailable: number } };

export const ROBOT_FIT_HOLD_PREFIX = "website_robot_fit_none:";
/** The precheck's hold cause in plain words: why none of the robots fits. Never more than the precheck says. */
const ROBOT_FIT_HOLD_CAUSES: Record<string, string> = {
  reach: "the robot arms were ruled out on reach. Measured from your scene, the spot where the object is picked up or "
    + "put down is farther than the arm can reach from any place it could be mounted level with the lower work surface.",
  task_kind: "none of the robot software we run handles this kind of task yet.",
  gpu_memory: "the robot software that could do this task needs more graphics-card (GPU) memory than any machine we can "
    + "rent to test it.",
  no_candidate_available: "none of the robot setups we run is available for this job right now, for example because it "
    + "is switched off or not licensed for commercial use.",
};
export function robotFitHoldCause(holdReason: string | null | undefined): string | null {
  return holdReason?.startsWith(ROBOT_FIT_HOLD_PREFIX)
    ? ROBOT_FIT_HOLD_CAUSES[holdReason.slice(ROBOT_FIT_HOLD_PREFIX.length)] ?? null : null;
}

function robotFitHold(receipt: Extract<PreparationOutcomeReceipt, { reason: "robot_fit_none" }>,
  precheck?: RobotFitHoldEvidence | null): TaskOutcome {
  const bound = precheck && precheck.precheckDigest === receipt.evidence_digest ? precheck : null;
  const cause = robotFitHoldCause(bound?.holdReason);
  const total = bound ? bound.counts.fit + bound.counts.noFit + bound.counts.unknown + bound.counts.unavailable : 0;
  const checked = total > 0 ? `None of the ${total} robot setups we can simulate fits this job` : "None of the robot setups we can simulate fits this job";
  return {
    category: "robot_incompatibility", basis: receipt.basis,
    title: "The simulation is held: none of the robots we can simulate fits this job yet",
    reason: cause ? `${checked}. The main reason: ${cause}` : `${checked}.`,
    scope: "A check made before any paid work, from your scene as rebuilt from your video. It is an estimate: no robot was tried on your job, and it does not show that no robot could ever do it.",
    nextStep: "Nothing is needed from you. Blueprint checks this job again when the robots we run change. Your answer stays on your job page, and your recording is saved; you do not need to send it again.",
    actionOwner: "blueprint", evidence: [{ label: "Robot fit check before any spend", digest: receipt.evidence_digest }],
  };
}

export function projectPreparationOutcome(receipt: PreparationOutcomeReceipt, precheck?: RobotFitHoldEvidence | null,
  objectName?: string | null): TaskOutcome {
  if (receipt.reason === TASK_NOT_NAMED_REASON) return taskNotNamedOutcome(receipt.evidence_digest);
  if (isRecaptureReason(receipt.reason)) return recaptureNeeded(receipt.reason, receipt.evidence_digest, objectName);
  if (!KNOWN_PREPARATION_OUTCOME_REASONS.has(receipt.reason)) return unknownOutcome(receipt.evidence_digest);
  if (receipt.reason === "robot_fit_none") return robotFitHold(receipt as Extract<PreparationOutcomeReceipt, { reason: "robot_fit_none"; basis: "conservative_pre_spend_fit_check" }>, precheck);
  if (receipt.reason === "robot_carry_path_rejected") return {
    category: "robot_incompatibility", basis: "conservative_configuration_check", title: "The checked robot configuration was rejected",
    reason: "No collision-free pickup-to-placement path was found for the Franka configuration, top-down grasp and bounded set of stations checked. Paid construction and policy evaluation were not admitted by this check.",
    scope: "Conservative rejection for this prepared scene estimate and checked configuration. This is not proof that the task is impossible, that every robot would fail, or that it was tested physically.",
    nextStep: "Blueprint must review the retained geometry, scale uncertainty, grasp and station evidence before proposing another compatible configuration. Your recording and findings remain saved.",
    actionOwner: "blueprint", evidence: [{ label: "Robot configuration check", digest: receipt.evidence_digest }],
  };
  return evidenceNeeded("The retained task geometry or acceptance evidence is incomplete.", receipt.evidence_digest,
    "Task preparation finding");
}

export function processingFailure(evidence?: {label: string; digest: string}): TaskOutcome {
  return { category: "processing_failure", basis: "execution_failure", title: "Blueprint could not finish processing this attempt",
    reason: "A processing step stopped before a usable robot evaluation was produced. This does not establish that the robot or your site is unsuitable.",
    scope: "This preparation attempt only. No robot pass, failure or physical-world validation is established by this outcome.",
    nextStep: "Blueprint needs to resolve the processing issue and reconcile any unfinished work before an authorized retry. Your recording is saved; you do not need to record or upload it again.",
    actionOwner: "blueprint", evidence: evidence ? [evidence] : [] };
}

/**
 * Preparation ended `capacity_blocked` (review, 2026-11-12). Every cause the Pipeline sends it for is ours: its disk or
 * staging stayed short through its retries, or the job waited for room until its grant ran out. So it is said as ours,
 * without naming either, and offers nothing the page cannot do. Staff see the code in the preparation watch.
 */
export function capacityEnded(evidence?: {label: string; digest: string}): TaskOutcome {
  return { category: "processing_failure", basis: "execution_failure", title: "We could not prepare your job in time",
    reason: "We could not start or finish preparing your job in time, for a reason on our side. Nothing you did caused it, and it says nothing about whether a robot suits your site.",
    scope: "This preparation attempt only. No robot pass, failure or physical-world validation is established by this outcome.",
    nextStep: "Nothing is needed from you. Your recording is saved; you do not need to record or upload it again.",
    actionOwner: "blueprint", evidence: evidence ? [evidence] : [] };
}

function evidenceNeeded(reason: string, evidenceDigest: string, label: string): TaskOutcome {
  return { category: "insufficient_evidence", basis: "missing_evidence", title: "There is not enough evidence for a robot decision",
    reason, scope: "The current capture and task evidence. No robot incompatibility or qualified evaluation result has been established.",
    nextStep: "Blueprint will review the saved evidence and identify the exact missing measurement, view or task fact. We will continue the work this recording supports and report its limits here. Your recording stays saved; no repeat upload is needed.",
    actionOwner: "blueprint", evidence: [{ label, digest: evidenceDigest }] };
}

const COVERAGE_REASONS = new Set(["atlas_scene_planner_abstained"]);

/**
 * Stops that only a new video can clear (Pipeline `atlas_video_inputs`, `website_atlas_pipeline`): the same
 * video gives the same answer, so the Pipeline ends the job at once instead of retrying it. Each says what
 * the video lacked and what to film; the site acts next. Never a finding about a robot or the site.
 */
const OBJECT_PLACEMENT_SENTENCES = {
  reason: "We could not place the object in our rebuild of your space: what your video shows of it did not line up with the room around it in one clear position.",
  nextStep: "Please film again with the object clear of clutter, resting where the job starts, and move around it so it is seen from several sides. Then send us the new video.",
} as const;
export const RECAPTURE_SENTENCES = {
  atlas_task_and_scene_coverage_gap: {
    reason: "Your video does not connect the place where the job happens to the room around it: we could not find views that overlap between them.",
    nextStep: "Please film again in one slow, continuous pass that starts on the room around the job, moves to where the job happens and keeps both in view on the way. Then send us the new video.",
  },
  atlas_insufficient_overlapping_distinct_views: {
    reason: "Your video does not show the work area from enough different angles, with each view overlapping the next, for us to rebuild it.",
    nextStep: "Please film again, moving slowly around the work area so it is seen from several angles, with each view overlapping the one before. Then send us the new video.",
  },
  atlas_coverage_anchor_quality_insufficient: {
    reason: "The part of your video that shows where the job happens is too blurred, or too bright or too dark, for us to rebuild it.",
    nextStep: "Please film again with slow, steady movement and even lighting, and hold on the place where the job happens for a few seconds. Then send us the new video.",
  },
  // Preparation stops (preparation status v7). Which way the object faces is read only from a side of it.
  website_front_normal_undetermined: {
    reason: "We could not tell from your video which way the object faces: no view we could use shows a side of it facing outward.",
    nextStep: "Please film again and hold the front of the object in view for a few seconds, from about the height of the object. Then send us the new video.",
  },
  // The object's shape, as filmed, fitted the rebuilt room in no single clear place: nowhere well
  // (poor_fit), in several places (ambiguous), better away from where the reconstruction puts it
  // (conflicts_provider_anchor, anchor_deviation) or off its floor (ground_plane_inconsistent).
  website_registration_ambiguous: OBJECT_PLACEMENT_SENTENCES,
  website_registration_poor_fit: OBJECT_PLACEMENT_SENTENCES,
  website_registration_conflicts_provider_anchor: OBJECT_PLACEMENT_SENTENCES,
  website_registration_anchor_deviation: OBJECT_PLACEMENT_SENTENCES,
  website_registration_ground_plane_inconsistent: OBJECT_PLACEMENT_SENTENCES,
  // The object the job moves was not seen in the video (the named form: `recaptureSentences`).
  website_task_object_not_observed: {
    reason: "We could not find the object the job moves in your video.",
    nextStep: "Please film again with it in view. Then send us the new video.",
  },
  // No frame of the video could be used.
  website_capture_frames_unusable: {
    reason: "We could not use any of the frames in your video.",
    nextStep: "Please film again slowly, in good light. Then send us the new video.",
  },
  atlas_scale_review_unresolved: {
    reason: "From your video we could not work out how large the space is: nothing in it gave us a size we could rely on.",
    nextStep: "Please film again with an object of standard size in view near where the job happens, such as a door or a tape measure laid open on the floor. Then send us the new video.",
  },
} as const satisfies Record<string, { reason: string; nextStep: string }>;
export type RecaptureReason = keyof typeof RECAPTURE_SENTENCES;
export const isRecaptureReason = (value: unknown): value is RecaptureReason =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(RECAPTURE_SENTENCES, value);

/** The title of every new-video ask; the needs-attention email for these stops uses it as its subject. */
export const RECAPTURE_TITLE = "We need a new video to build the simulation of your site";
/** The new-video ask a verified Atlas preview names for its capture, or null. */
export const recaptureReasonOf = (preview: WebsiteAtlasPreview | null): RecaptureReason | null =>
  preview?.state === "needs_input" && isRecaptureReason(preview.reason) ? preview.reason : null;

function recaptureOutcome(sentences: { reason: string; nextStep: string }, evidenceDigest: string, label: string): TaskOutcome {
  return { category: "insufficient_evidence", basis: "missing_evidence", title: RECAPTURE_TITLE,
    reason: sentences.reason,
    scope: "This is for the simulation of your site only. It is not a finding about any robot or about your site, and your answer stays on your job page.",
    nextStep: sentences.nextStep,
    actionOwner: "site", evidence: [{ label, digest: evidenceDigest }] };
}
function recaptureNeeded(reason: RecaptureReason, evidenceDigest: string, objectName?: string | null): TaskOutcome {
  return recaptureOutcome(recaptureSentences(reason, objectName), evidenceDigest, "Video coverage finding");
}

/** A new-video ask's sentences; the one about an unseen object names it from the site's own brief when it can. */
export function recaptureSentences(reason: RecaptureReason, objectName?: string | null): { reason: string; nextStep: string } {
  if (reason !== "website_task_object_not_observed") return RECAPTURE_SENTENCES[reason];
  const name = typeof objectName === "string" ? objectName.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  return name && /^[\p{L}\p{N} ,.'()-]+$/u.test(name)
    ? { reason: `We could not find ${name} in your video.`, nextStep: "Please film again with it in view. Then send us the new video." }
    : RECAPTURE_SENTENCES.website_task_object_not_observed;
}

/** The verified Atlas preview of the job's capture says the job has no sentence to prepare from. */
export function jobAwaitsItsSentence(record: Record<string, any> | null | undefined, captureId: string): boolean {
  const preview = record ? selectWebsiteAtlasPreview(record, captureId) : null;
  return preview?.state === "needs_input" && preview.reason === TASK_NOT_NAMED_REASON;
}

/** The job waits for its sentence: the site names it on its job page. Not a failure, and not ours to fix. */
export const TASK_NOT_NAMED_SENTENCES = {
  title: "Tell us the job in one sentence",
  reason: "We need one sentence saying what the robot should do before we can build the simulation of your job.",
  nextStep: "Write it at the top of your job page, for example \"Pick up each box and put it on the shelf.\" We start as soon as you send it.",
} as const;
export function taskNotNamedOutcome(evidenceDigest: string): TaskOutcome {
  return { category: "insufficient_evidence", basis: "missing_evidence", title: TASK_NOT_NAMED_SENTENCES.title,
    reason: TASK_NOT_NAMED_SENTENCES.reason,
    scope: "This is about your job's description only. It is not a finding about any robot or about your site.",
    nextStep: TASK_NOT_NAMED_SENTENCES.nextStep, actionOwner: "site", evidence: [{ label: "Job description", digest: evidenceDigest }] };
}

/** An outcome whose reason this release does not know: one true, general sentence, and no claim about why. */
export const UNKNOWN_OUTCOME_SENTENCES = {
  title: "The preparation of your simulation stopped",
  reason: "Preparing the simulation of your site stopped, for a reason this page cannot show yet. Our team is alerted when this happens.",
  nextStep: "We'll email you if anything is needed from you. Your recording is saved.",
} as const;
export function unknownOutcome(evidenceDigest: string): TaskOutcome {
  return { category: "insufficient_evidence", basis: "missing_evidence", title: UNKNOWN_OUTCOME_SENTENCES.title,
    reason: UNKNOWN_OUTCOME_SENTENCES.reason,
    scope: "This preparation attempt only. It is not a finding about any robot or about your site.",
    nextStep: UNKNOWN_OUTCOME_SENTENCES.nextStep, actionOwner: "blueprint", evidence: [{ label: "Preparation finding", digest: evidenceDigest }] };
}

/**
 * The new-video ask for a video too large to process (`websiteLargeVideoBlock.ts`): frame extraction
 * refused it before reading it, so nothing in Blueprint started. Same title and card as every new-video
 * ask; the site sends the new video into the same job. The limit is not named: it is set where the
 * video is processed and is not known here.
 */
export const LARGE_VIDEO_RECAPTURE_SENTENCES = {
  reason: "Your video is too large for us to process.",
  nextStep: "Please film a shorter clip, or record at 1080p. Then send us the new video.",
} as const;
export const largeVideoRecaptureOutcome = (askDigest: string): TaskOutcome =>
  recaptureOutcome(LARGE_VIDEO_RECAPTURE_SENTENCES, askDigest, "Video size check");
/** The job page's new-video ask for its active capture's too-large video, or null when none is recorded for it. */
export function largeVideoAskOutcome(record: Record<string, any> | undefined, requestId: string, captureId: string): TaskOutcome | null {
  const ask = websiteLargeVideoAsk(record, requestId, captureId);
  return ask ? largeVideoRecaptureOutcome(ask.ask_digest) : null;
}
const TASK_REASONS = new Set(["atlas_scene_subject_origin_uncertain", "atlas_scene_subject_origin_changed",
  "atlas_synthetic_subject_requires_preserved_capture"]);
const GEOMETRY_REASONS = new Set(["atlas_preserved_completion_no_exportable_geometry",
  "atlas_generated_view_registration_unresolved", "atlas_source_visibility_uncertain"]);

/**
 * The Pipeline's early task hold (`website_early_task_hold.py`): right after its review of the job, before
 * any scene is bought, it holds a job Blueprint cannot simulate yet. Each reason's one held sentence, said the
 * same way on the job page and in the email. None is a question the site can answer: an operation-coverage
 * question the site could answer is never held here (the Pipeline asks it instead), so this hold is a step
 * no simulation covers yet. None is a finding that a robot could not do the job.
 */
export const EARLY_TASK_HOLD_SENTENCES = {
  // No simulation of this kind of task exists (for example closing a door, pushing, pouring a liquid).
  website_native_task_profile_preparation_required: "The simulation is held: we can't simulate this kind of job yet.",
  // The kind of task is known, but the simulator it needs is not installed where we run jobs.
  website_task_family_runtime_preparation_required:
    "The simulation is held: we can't simulate this kind of job yet, because the simulator it needs isn't set up on our side.",
  // Part of what the job asks for maps to no step we can simulate, even after any clarification.
  website_task_operation_coverage_unresolved: "The simulation is held: we can't simulate every step this job asks for yet.",
} as const satisfies Record<string, string>;
export type EarlyTaskHoldReason = keyof typeof EARLY_TASK_HOLD_SENTENCES;
export const isEarlyTaskHoldReason = (value: unknown): value is EarlyTaskHoldReason =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(EARLY_TASK_HOLD_SENTENCES, value);
/** The held sentence for an early-hold reason, or null for any other reason. */
export const earlyTaskHoldSentence = (reason: unknown): string | null =>
  isEarlyTaskHoldReason(reason) ? EARLY_TASK_HOLD_SENTENCES[reason] : null;
/** What an early hold adds to its sentence; the job page and the email both read it. */
export const EARLY_TASK_HOLD_DETAIL = "No robot was tested in a simulation of your job, and this is not a finding that a robot could not do it. "
  + "Your answer stays on your job page.";

/**
 * A job whose preparation authority ended (Pipeline `authority_ended`). It is final, never a hold or a
 * check in progress. The Pipeline ends it for an expired job window (`consent_expired`) or for rights
 * that no longer allow scene building (`source_revoked`); the WebApp reads which from the job's own
 * window. A withdrawn recording says so first, on its own.
 */
export const PREPARATION_ENDED_NEXT = "Nothing more is needed from you. Keep your original recording; "
  + "to have Blueprint work on this site again, you can start a new job.";
/** The site has its answer whatever happens to the simulation; a stop of the simulation says so. */
export const ANSWER_STAYS_ON_JOB_PAGE = "Your answer stays on your job page.";
/** Said about the simulation: the time Blueprint was authorized to work ran out, and the answer stays. */
export const JOB_WINDOW_ENDED_SENTENCE = "The simulation of your site has stopped because the time Blueprint was authorized to work on this job ran out.";
export const AUTHORITY_ENDED_SENTENCE = "This job has ended because Blueprint is no longer authorized to work on it.";

/**
 * A job the WebApp's own window sweep ended (`websiteJobWindowSweep`): its work window ran out with no
 * result, hold or withdrawal on record. It is true however the job got there (the Pipeline went quiet, a
 * stage refused, a wait never cleared): Blueprint did not finish in the time it was authorized, the
 * Pipeline starts nothing more for a job past its window, and a new job is how the site starts again. It
 * promises no follow-up, because nothing schedules one. The job page and the one email both say exactly this.
 */
export const JOB_WINDOW_UNFINISHED_SENTENCE = "Blueprint did not finish the simulation in that time, and no more simulation work will run on this job.";
export const JOB_WINDOW_ENDING_MESSAGE = `${JOB_WINDOW_ENDED_SENTENCE} ${JOB_WINDOW_UNFINISHED_SENTENCE} ${ANSWER_STAYS_ON_JOB_PAGE} ${PREPARATION_ENDED_NEXT}`;
/** The subject when the simulation stopped (the window ran out, or Blueprint never started it). */
export const JOB_WINDOW_ENDING_SUBJECT = "The simulation of your site has stopped";
/** The subject when the site never sent what was needed to start: the job itself ended, as before. */
export const JOB_NO_GRANT_SITE_ENDING_SUBJECT = "Your Blueprint job has ended";

/**
 * A job that never received a grant, ended by the same sweep once it waited as long as a grant's
 * window lasts (`websiteJobWindowSweep`). Each says only what is true of every job in that wait and
 * promises no follow-up. The job page and the one email (subject `JOB_WINDOW_ENDING_SUBJECT`) both say it.
 *
 * - The site never sent what was needed (a finished recording, or the one step a held job asks of it).
 * - The site did its part and Blueprint never started the simulation: held, with no estimate.
 */
export const JOB_NO_GRANT_SITE_ENDING_MESSAGE = "This job has ended because we did not receive what was needed to start it "
  + "while it was open. To have Blueprint work on this site, you can start a new job.";
export const JOB_NO_GRANT_BLUEPRINT_ENDING_MESSAGE = "The simulation of your site is held because Blueprint did not start it while "
  + `your job was open, so there is no simulation result. ${ANSWER_STAYS_ON_JOB_PAGE} ${PREPARATION_ENDED_NEXT}`;
/**
 * A no-grant job that was asked for a smaller video (`websiteLargeVideoBlock.ts`) and received none
 * while it was open: the ending for a wait on the site, naming why.
 */
export const JOB_NO_GRANT_LARGE_VIDEO_ENDING_MESSAGE = "This job has ended because the video we received was too large "
  + "for us to process, and no new video arrived while the job was open. To have Blueprint work on this site, you can start a new job.";
export const jobNoGrantEndingMessage = (waitingOn: "site" | "blueprint", reason?: "video_over_ingest_limit") =>
  reason === "video_over_ingest_limit" ? JOB_NO_GRANT_LARGE_VIDEO_ENDING_MESSAGE
    : waitingOn === "site" ? JOB_NO_GRANT_SITE_ENDING_MESSAGE : JOB_NO_GRANT_BLUEPRINT_ENDING_MESSAGE;

/**
 * A video that arrived before its job was saved to an account. Nothing sends a later email about it,
 * so none is promised. The job page, the upload refusal and the one email all read this sentence.
 */
export const FOOTAGE_BEFORE_ACCOUNT_SENTENCE = "Your video arrived before this job was saved to an account, so we can't "
  + "use it to build your scene yet. Blueprint needs to review this older recording. You don't need to send it again.";

export function earlyTaskHoldOutcome(reason: EarlyTaskHoldReason, evidenceDigest: string): TaskOutcome {
  return { category: "held", basis: "simulation_not_available", title: EARLY_TASK_HOLD_SENTENCES[reason],
    reason: EARLY_TASK_HOLD_DETAIL,
    scope: "Decided from what your job asks for, before the simulation of your site was built.",
    // The Pipeline keeps the job and its review; the WebApp keeps the recording. No rerun is scheduled.
    nextStep: "Nothing is needed from you. Your recording is saved; you do not need to send it again.",
    // No step is scheduled for Blueprint or the site, so the card names no owner of a next step.
    actionOwner: "none", evidence: [{ label: "Task check", digest: evidenceDigest }] };
}

/** The early task hold a verified preview names, or null. */
export function earlyTaskHoldOf(preview: WebsiteAtlasPreview | null): EarlyTaskHoldReason | null {
  return preview?.state === "needs_input" && isEarlyTaskHoldReason(preview.reason) ? preview.reason : null;
}

/** Takes only an already verified, capture-specific receipt. A ready/newer state clears the stop. */
export function projectAtlasPreparationOutcome(preview: WebsiteAtlasPreview | null): TaskOutcome | null {
  if (!preview || preview.state === "ready" || preview.state === "processing" || preview.state === "withdrawn") return null;
  const held = earlyTaskHoldOf(preview);
  if (held) return earlyTaskHoldOutcome(held, preview.preview_digest);
  if (preview.state === "needs_input" && preview.reason === TASK_NOT_NAMED_REASON) return taskNotNamedOutcome(preview.preview_digest);
  if (preview.state === "needs_input" && isRecaptureReason(preview.reason))
    return recaptureNeeded(preview.reason, preview.preview_digest);
  if (preview.state === "needs_input" && COVERAGE_REASONS.has(preview.reason ?? ""))
    return evidenceNeeded("The available source views did not establish enough scene coverage for this task.",
      preview.preview_digest, "Scene coverage finding");
  if (preview.state === "needs_input" && preview.reason === "atlas_scene_requires_preserved_capture")
    return evidenceNeeded("The scene-preparation plan could not preserve the captured objects required by this task.",
      preview.preview_digest, "Scene preservation finding");
  if (preview.state === "needs_input" && TASK_REASONS.has(preview.reason ?? ""))
    return evidenceNeeded("The task subject and the captured objects could not be bound consistently without changing the observed scene.",
      preview.preview_digest, "Task subject finding");
  if (preview.state === "needs_input" && GEOMETRY_REASONS.has(preview.reason ?? ""))
    return evidenceNeeded("The available scene evidence did not establish usable, consistently registered geometry for this task.",
      preview.preview_digest, "Scene geometry finding");
  if (preview.state === "needs_input"
    && preview.reason === "atlas_recorded_source_views_must_be_recovered_before_generation")
    return { ...processingFailure({label: "Saved scene views", digest: preview.preview_digest}),
      title: "Blueprint needs to finish reconstructing the saved video",
      reason: "Blueprint identified useful views in your saved video that still need to be incorporated into the reconstruction.",
      nextStep: "Blueprint needs to finish using those saved views before proposing generated completion or a robot evaluation. Your recording remains saved; no new upload is required." };
  return processingFailure({ label: "Reconstruction status", digest: preview.preview_digest });
}
