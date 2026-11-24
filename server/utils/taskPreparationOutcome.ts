/** Redacted, deterministic closeout of existing source-bound preparation evidence.
 * Never classify an exception string, an estimated height or an agent's opinion
 * as robot incompatibility. Status reads do not retry work or grant spending.
 */
import { z } from "zod";
import type { TaskOutcome } from "../../client/src/types/taskOutcome";
import { atlasPreviewReachedSpendingCap, selectWebsiteAtlasPreview, type WebsiteAtlasPreview } from "./websiteAtlasPreview";
import { OUTLOOK_SENTENCES } from "../../client/src/lib/jobOutlook";
import { websiteLargeVideoAsk } from "./websiteJobWindowEnding";

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
/**
 * The outcome's category is never a reason to fail a read (review, 2026-11-12), for a known reason or an unknown one:
 * any code-shaped value is read; the site's sentence follows the reason, and staff hear of a category this release
 * does not know (`KNOWN_PREPARATION_OUTCOME_CATEGORIES`).
 */
const category = z.string().regex(/^[a-z][a-z0-9_:.-]{0,127}$/);
// `processing_failure`: the retries-spent ending's own category (Pipeline `website_preparation_outcome`), known since
// that ending was read; it raised a false unknown-category alert on every such job (round 2, 2026-11-24).
export const KNOWN_PREPARATION_OUTCOME_CATEGORIES: readonly string[] = ["robot_incompatibility", "insufficient_evidence", "processing_failure"];
const carryPathRejected = z.object({ reason: z.literal("robot_carry_path_rejected"), category,
  basis: z.literal("conservative_configuration_check"), robot_id: z.literal("franka_panda"), evidence_digest: digest }).passthrough();
const taskEvidenceIncomplete = z.object({ reason: z.literal("task_evidence_incomplete"), category,
  basis: z.literal("missing_evidence"), robot_id: z.null(), evidence_digest: digest }).passthrough();
/**
 * An outcome whose reason this release does not know (review, 2026-11-12): it never fails the status read. Its shape
 * is still checked (a code-shaped category and basis, and a sealed evidence digest); the site sees one general sentence for it
 * (`unknownOutcome`) and staff hear once per job and code. A known reason must keep its own exact shape.
 */
export const KNOWN_PREPARATION_OUTCOME_REASONS = new Set<string>(["robot_carry_path_rejected", "task_evidence_incomplete",
  "robot_fit_none"]);
const unknownReasonOutcome = z.object({ reason: z.string().regex(/^[a-z][a-z0-9_:.-]{0,127}$/),
  // Open too (review, 2026-11-12): a category this release does not know reads as the same general sentence.
  category, basis: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  robot_id: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/).nullable(), evidence_digest: digest }).passthrough()
  .refine(value => !KNOWN_PREPARATION_OUTCOME_REASONS.has(value.reason) && !isRecaptureReason(value.reason)
    && value.reason !== TASK_NOT_NAMED_REASON && value.reason !== "website_preparation_not_possible"
    && value.reason !== "website_preparation_retries_spent", "A known reason keeps its own shape");
/** Preparation status v3–v5 keep this vocabulary, and accept a reason they do not know. */
export const preparationOutcomeSchema = z.union([z.discriminatedUnion("reason", [carryPathRejected, taskEvidenceIncomplete]),
  unknownReasonOutcome]);
/** v6 adds the early robot fit hold (Pipeline #3336): no robot Blueprint runs fits the task in this room,
 * decided before any spend. Its evidence is the precheck's digest. */
export const preparationOutcomeV6Schema = z.union([z.discriminatedUnion("reason", [carryPathRejected, taskEvidenceIncomplete,
  z.object({ reason: z.literal("robot_fit_none"), category,
    basis: z.literal("conservative_pre_spend_fit_check"), robot_id: z.null(), evidence_digest: digest }).passthrough()]),
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
/** The one test of whether the Pipeline asks for the job's sentence: a preparation status or an Atlas preview. */
export const pipelineAsksForSentence = (value: { outcome?: { reason?: unknown } | null; state?: unknown; reason?: unknown } | null | undefined) =>
  value?.outcome?.reason === TASK_NOT_NAMED_REASON || (value?.state === "needs_input" && value.reason === TASK_NOT_NAMED_REASON);
/**
 * Part 6 (Pipeline `website_preparation_outcome`, 2026-11-12): two endings that used to say "Blueprint will review",
 * which nothing did. `website_preparation_not_possible`: this release cannot prepare the job, for the `cause` it
 * names (a blocker code), and it is looked at again when a release changes that step. `website_preparation_retries_spent`:
 * a step kept failing after its timed retries; it runs again on each new release.
 */
export const PREPARATION_NOT_POSSIBLE_REASON = "website_preparation_not_possible";
export const PREPARATION_RETRIES_SPENT_REASON = "website_preparation_retries_spent";
const notPossible = z.object({ reason: z.literal(PREPARATION_NOT_POSSIBLE_REASON), category,
  cause: z.string().regex(/^[a-z][a-z0-9_:.-]{0,127}$/).optional(),
  basis: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), robot_id: z.null(), evidence_digest: digest }).passthrough();
const retriesSpent = z.object({ reason: z.literal(PREPARATION_RETRIES_SPENT_REASON), category,
  basis: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), robot_id: z.null(), evidence_digest: digest }).passthrough();
/** v7 adds those stops: the preparation ended at once and the site is asked to film again; and the two part-6 endings. */
export const preparationOutcomeV7Schema = z.union([notPossible, retriesSpent, preparationOutcomeV6Schema, z.object({
  reason: z.enum([...PREPARATION_RECAPTURE_REASONS, TASK_NOT_NAMED_REASON]), category,
  basis: z.literal("missing_evidence"), robot_id: z.null(), evidence_digest: digest }).passthrough()]);
/** The keys an outcome record is read by; any other key is kept (it is sealed in the status digest), ignored and alerted. */
export const PREPARATION_OUTCOME_KEYS: readonly string[] = ["reason", "category", "cause", "basis", "robot_id", "evidence_digest"];
export type PreparationOutcomeReceipt = z.infer<typeof preparationOutcomeV7Schema>;

/** What the v6 precheck says about a robot fit hold, when it binds to the same evidence as the outcome. */
export type RobotFitHoldEvidence = { holdReason: string | null; precheckDigest: string;
  counts: { fit: number; noFit: number; unknown: number; unavailable: number } };

export const ROBOT_FIT_HOLD_PREFIX = "website_robot_fit_none:";
/**
 * The precheck's hold cause in plain words: why none of the robots fits. Never more than the precheck says. Only the
 * reach cause is said: the other causes (`task_kind`, `gpu_memory`, `no_candidate_available`) describe running robot
 * software, which Blueprint no longer does (owner, 2026-11-14), so with them the reason names only the robots checked.
 */
const ROBOT_FIT_HOLD_CAUSES: Record<string, string> = {
  reach: "the spot where the object is picked up or put down is farther than their arms can reach.",
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
  const checked = total > 0 ? `None of the ${total} robots we checked fits this job` : "None of the robots we checked fits this job";
  return {
    category: "robot_incompatibility", basis: receipt.basis,
    title: "The simulation is on hold: none of the robots we checked fits this job",
    reason: cause ? `${checked}. The main reason: ${cause}` : `${checked}.`,
    scope: "This is an estimate from your video. It does not mean no robot could do the job.",
    nextStep: "Nothing is needed from you. Your first look stays on your job page, and your video is saved.",
    actionOwner: "blueprint", evidence: [{ label: "Robot fit check before any spend", digest: receipt.evidence_digest }],
  };
}

export function projectPreparationOutcome(receipt: PreparationOutcomeReceipt, precheck?: RobotFitHoldEvidence | null,
  objectName?: string | null): TaskOutcome {
  if (receipt.reason === TASK_NOT_NAMED_REASON) return taskNotNamedOutcome(receipt.evidence_digest);
  if (isRecaptureReason(receipt.reason)) return recaptureNeeded(receipt.reason, receipt.evidence_digest, objectName);
  if (receipt.reason === PREPARATION_NOT_POSSIBLE_REASON) return preparationNotPossible((receipt as { cause?: string }).cause, receipt.evidence_digest);
  if (receipt.reason === PREPARATION_RETRIES_SPENT_REASON) return preparationRetriesSpent(receipt.evidence_digest);
  if (!KNOWN_PREPARATION_OUTCOME_REASONS.has(receipt.reason)) return unknownOutcome(receipt.evidence_digest);
  if (receipt.reason === "robot_fit_none") return robotFitHold(receipt as Extract<PreparationOutcomeReceipt, { reason: "robot_fit_none"; basis: "conservative_pre_spend_fit_check" }>, precheck);
  if (receipt.reason === "robot_carry_path_rejected") return {
    category: "robot_incompatibility", basis: "conservative_configuration_check", title: "The robot arm we checked has no clear path for this job",
    reason: "In the simulation of your site, the arm we checked could not carry the object from where it starts to where it goes without hitting something.",
    scope: "This is an estimate. It does not mean no robot could do the job.",
    nextStep: "Nothing is needed from you. Your video is saved.",
    actionOwner: "blueprint", evidence: [{ label: "Robot configuration check", digest: receipt.evidence_digest }],
  };
  return evidenceNeeded(receipt.evidence_digest, "Task preparation finding");
}

/**
 * Why this release cannot prepare the job, by the Pipeline's blocker code (`website_preparation_outcome._MISSING`).
 * Each says only what the code names; a cause without words here keeps the general sentence.
 */
export const PREPARATION_NOT_POSSIBLE_CAUSES: Readonly<Record<string, string>> = {
  website_registration_scale_conflicts_declared: "The sizes we measured in your video do not match the sizes given for your job.",
  support_surface_not_found_under_subject: "We could not find the surface the object rests on in your video.",
  task_destination_pose_required: "We could not work out how the object should sit where it goes.",
  task_destination_relation_required: "We could not work out whether the object goes on, in or next to the place it goes.",
  task_destination_interior_geometry_required: "We cannot yet build the inside of the place the object goes into.",
  task_destination_surface_contact_required: "We could not find the surface the object should be put down on.",
  website_owner_success_criteria_translation_required: "We cannot yet turn the way you judge success into a check in the simulation.",
  website_assembly_whole_object_coverage_required: "Your video does not show the whole of the object the job assembles.",
  website_synthetic_subject_start_unplaceable: "We could not place the object where it starts in the simulated scene.",
};
/**
 * The words for the part-6 endings, as constants so one line changes when the Pipeline confirms what happens next.
 * Nothing here says the job is looked at or tried again: no code confirmed yet does either (review, 2026-11-12).
 */
export const PREPARATION_NOT_POSSIBLE_SENTENCES = {
  title: "We cannot prepare the simulation of your job",
  /** After a cause's own sentence. */
  withCause: "We cannot prepare the simulation of your job, so it has stopped.",
  /** With no cause, or one without words. */
  general: "Preparing the simulation of your job needs a step we cannot do yet, so it has stopped.",
  nextStep: "Nothing is needed from you now. Your video is saved.",
} as const;
/** A next step of its own, by cause. The page offers "Send a new video" to the owner in every preparation state. */
const NOT_POSSIBLE_NEXT_STEPS: Readonly<Record<string, string>> = {
  website_assembly_whole_object_coverage_required: "A new video that shows the whole object would let us try again. Your video is saved.",
  website_registration_scale_conflicts_declared: "Your video is saved.",
};
export function preparationNotPossible(cause: string | undefined, evidenceDigest: string): TaskOutcome {
  const known = cause !== undefined && Object.hasOwn(PREPARATION_NOT_POSSIBLE_CAUSES, cause);
  return { category: "insufficient_evidence", basis: "missing_evidence", title: PREPARATION_NOT_POSSIBLE_SENTENCES.title,
    reason: known ? `${PREPARATION_NOT_POSSIBLE_CAUSES[cause!]} ${PREPARATION_NOT_POSSIBLE_SENTENCES.withCause}`
      : PREPARATION_NOT_POSSIBLE_SENTENCES.general,
    scope: "",
    nextStep: known && Object.hasOwn(NOT_POSSIBLE_NEXT_STEPS, cause!) ? NOT_POSSIBLE_NEXT_STEPS[cause!] : PREPARATION_NOT_POSSIBLE_SENTENCES.nextStep,
    actionOwner: "blueprint", evidence: [{ label: "Preparation finding", digest: evidenceDigest }] };
}
export const PREPARATION_RETRIES_SPENT_SENTENCES = {
  title: "We could not finish preparing your job",
  reason: "We could not finish preparing your job after several tries, for a reason on our side.",
  nextStep: "Nothing is needed from you now. Your video is saved.",
} as const;
export function preparationRetriesSpent(evidenceDigest: string): TaskOutcome {
  return { category: "processing_failure", basis: "execution_failure", title: PREPARATION_RETRIES_SPENT_SENTENCES.title,
    reason: PREPARATION_RETRIES_SPENT_SENTENCES.reason,
    scope: "",
    nextStep: PREPARATION_RETRIES_SPENT_SENTENCES.nextStep, actionOwner: "blueprint",
    evidence: [{ label: "Preparation finding", digest: evidenceDigest }] };
}
/** The part-6 endings say all there is: the page adds nothing beside them. */
const CAP_OUTCOME_TITLE = "We stopped building the simulation of your site";
export const isSpendingCapOutcome = (outcome: Pick<TaskOutcome, "title"> | null | undefined) =>
  outcome?.title === CAP_OUTCOME_TITLE;
/** Read by title and reason: a processing failure shares the retries-spent title but is not a part-6 ending. */
export const isCompletePreparationOutcome = (outcome: Pick<TaskOutcome, "title" | "reason"> | null | undefined) =>
  outcome?.title === PREPARATION_NOT_POSSIBLE_SENTENCES.title
  || outcome?.title === PREPARATION_RETRIES_SPENT_SENTENCES.title && outcome.reason === PREPARATION_RETRIES_SPENT_SENTENCES.reason
  || isSpendingCapOutcome(outcome);

/** The planner held back and the preparation status names no outcome: said with no promise (review, 2026-11-12). */
export const PLANNER_ABSTAINED_SENTENCES = {
  title: "Your video didn't show enough of the job",
  reason: "The views in your video did not show enough of the work area for this job.",
  nextStep: "Nothing is needed from you now. Your video stays saved.",
} as const;

/**
 * Every final stop with no words of its own. Its title is the retries-spent title: the same situation, said the same
 * way. A stop the Pipeline will run again by itself is `processingRetrying` instead.
 */
export const PROCESSING_FAILURE_SENTENCES = {
  title: PREPARATION_RETRIES_SPENT_SENTENCES.title,
  reason: "A step on our side stopped before it finished.",
  nextStep: "Nothing is needed from you. Your video is saved; you don't need to send it again.",
} as const;
export function processingFailure(evidence?: {label: string; digest: string}): TaskOutcome {
  return { category: "processing_failure", basis: "execution_failure", title: PROCESSING_FAILURE_SENTENCES.title,
    reason: PROCESSING_FAILURE_SENTENCES.reason, scope: "", nextStep: PROCESSING_FAILURE_SENTENCES.nextStep,
    actionOwner: "blueprint", evidence: evidence ? [evidence] : [] };
}
/**
 * A stop the Pipeline runs again by itself (round 2, 2026-11-24), titled as still being worked on, never as final: a
 * preparation `failed_retryable`, or an Atlas job parked on a reason with no words here, which the Pipeline reopens by
 * the clock (`atlas_preparation_job_control.automatic_reopens`, Pipeline 0bcbe320c). A preparation that then ends
 * (`failed_terminal`) is said with `processingFailure`'s final title (`taskStatusProjection`).
 */
export const PROCESSING_RETRYING_SENTENCES = {
  title: "We're still working on your job",
  reason: "A step on our side stopped before it finished. We will try it again by ourselves.",
  nextStep: PROCESSING_FAILURE_SENTENCES.nextStep,
} as const;
export function processingRetrying(evidence?: {label: string; digest: string}): TaskOutcome {
  return { ...processingFailure(evidence), title: PROCESSING_RETRYING_SENTENCES.title, reason: PROCESSING_RETRYING_SENTENCES.reason };
}
export const isProcessingRetrying = (outcome: Pick<TaskOutcome, "title"> | null | undefined) =>
  outcome?.title === PROCESSING_RETRYING_SENTENCES.title;

/**
 * The account's monthly spending limit holds new paid work (round 2, 2026-11-24): a scene outcome `account_limit_wait`,
 * or an Atlas preview whose reason is the account's monthly spend check (`account_monthly_spend_*`: the limit reached,
 * the month's spend journal or report unreadable or stale, no limit configured, ...). Each refuses new spend until the
 * check passes again, and the job resumes by itself; nothing is the site's to do. Money is Blueprint's control, never
 * a step for the site, and staff see it as a money stop on the job's admin page (`jobConsoleData`).
 */
export const ACCOUNT_LIMIT_WAIT_SENTENCES = {
  title: "Your job is paused on our side",
  reason: "Your job is paused on our side for a spending limit.",
  nextStep: "It resumes by itself; nothing is needed from you.",
} as const;
export const ACCOUNT_LIMIT_WAIT_REASON = "account_limit_wait";
/** The account's monthly spend check's codes, as the Pipeline names them (`account_monthly_spend`). */
export const ACCOUNT_MONTHLY_SPEND_REASONS = ["account_monthly_spend_limit_reached", "account_monthly_spend_journal_unreadable",
  "account_monthly_spend_report_stale", "account_monthly_spend_limit_not_configured", "account_monthly_spend_limit_config_invalid",
  "account_monthly_spend_report_missing_or_invalid", "account_monthly_spend_limit_unavailable",
  "account_monthly_spend_call_cost_invalid"] as const;
/**
 * The Google Cloud project's monthly budget check (Pipeline `gcp_monthly_budget_admission`), which refuses new spend the
 * same way until its next report passes (stress round 2, 2026-11-24): the same money wait on our side.
 */
export const GCP_MONTHLY_BUDGET_REASONS = ["gcp_monthly_budget_admission_blocked", "gcp_monthly_budget_report_missing_or_invalid",
  "gcp_monthly_budget_report_unavailable", "gcp_monthly_budget_project_binding_missing"] as const;
/**
 * A code of a monthly spending check: the account's (one listed, or any other it names by its own prefix) or the Google
 * Cloud project's budget.
 */
export const isAccountMonthlySpendReason = (reason: unknown): reason is string =>
  typeof reason === "string" && (reason.startsWith("account_monthly_spend_")
    || (GCP_MONTHLY_BUDGET_REASONS as readonly string[]).includes(reason));
export function accountLimitWaitOutcome(evidence?: {label: string; digest: string}): TaskOutcome {
  return { category: "processing_failure", basis: "execution_failure", title: ACCOUNT_LIMIT_WAIT_SENTENCES.title,
    reason: ACCOUNT_LIMIT_WAIT_SENTENCES.reason, scope: "", nextStep: ACCOUNT_LIMIT_WAIT_SENTENCES.nextStep,
    actionOwner: "none", evidence: evidence ? [evidence] : [] };
}

/**
 * Preparation ended `capacity_blocked` (review, 2026-11-12). Every cause the Pipeline sends it for is ours: its disk or
 * staging stayed short through its retries, or the job waited for room until its grant ran out. So it is said as ours,
 * without naming either, and offers nothing the page cannot do. Staff see the code in the preparation watch.
 */
export function capacityEnded(evidence?: {label: string; digest: string}): TaskOutcome {
  return { category: "processing_failure", basis: "execution_failure", title: "We could not prepare your job in time",
    reason: "We couldn't finish preparing your job. The problem was on our side, not yours.",
    scope: "",
    nextStep: "Nothing is needed from you. Your video is saved; you don't need to send it again.",
    actionOwner: "blueprint", evidence: evidence ? [evidence] : [] };
}

/**
 * The work area and the object could not be rebuilt clearly enough. These are not new-video asks (when the video is at
 * fault the Pipeline asks for a new one), so the reason never blames the video. One reason for every such stop.
 */
const EVIDENCE_NEEDED_SENTENCES = {
  title: "We couldn't build the simulation of your site",
  reason: "We could not rebuild the work area and the object clearly enough to build the simulation.",
  // Rewritten (review, 2026-11-12): nothing reviews this, so nothing promises a review.
  nextStep: "Nothing is needed from you. Your video is saved.",
} as const;
function evidenceNeeded(evidenceDigest: string, label: string): TaskOutcome {
  return { category: "insufficient_evidence", basis: "missing_evidence", title: EVIDENCE_NEEDED_SENTENCES.title,
    reason: EVIDENCE_NEEDED_SENTENCES.reason, scope: "",
    nextStep: EVIDENCE_NEEDED_SENTENCES.nextStep,
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
/** A rebuild whose shape and look did not line up: a fresh video gives a fresh rebuild. It does not fault the filming. */
const REBUILD_MISMATCH_SENTENCES = {
  reason: "We could not rebuild your space from this video: the shape of the room and how it looks did not line up in our rebuild.",
  nextStep: "Please film again in one slow, steady pass through the work area, so we can rebuild it from a fresh video. Then send us the new video.",
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
  // Pipeline `atlas_video_inputs` (round 2, 2026-11-24): too few frames were sharp and still enough to rebuild from.
  // The same video gives the same answer, so only a new one clears it.
  atlas_insufficient_sharp_static_views: {
    reason: "Too few of the frames in your video are sharp enough for us to rebuild your space: they are too blurred, or too bright or too dark.",
    nextStep: "Please film again slowly, in even light. Then send us the new video.",
  },
  // Pipeline `atlas_video_inputs` (round 2, 2026-11-24): the file says it is turned by an angle that is not a quarter
  // turn, which a phone camera never writes, so the file was rotated or edited after it was recorded. The same file
  // gives the same answer; the video as the phone recorded it does not.
  atlas_source_rotation_unsupported: {
    reason: "Your video file is turned at an angle we cannot read.",
    nextStep: "Please film again with your phone and leave the file as it was recorded, without rotating or editing it. Then send us the new video.",
  },
  // Pipeline (stress round 1, 2026-11-24): the room's mesh lay on none of its look (`atlas_mesh_not_registered_to_splat`),
  // or as well on two framings (`atlas_mesh_frame_ambiguous`). The job now ends at once instead of waiting for a
  // release until its deadline; only a fresh rebuild clears it. The evidence points at the rebuild, not the filming,
  // so these sentences ask for a new video without saying what was wrong with it.
  atlas_mesh_not_registered_to_splat: REBUILD_MISMATCH_SENTENCES,
  atlas_mesh_frame_ambiguous: REBUILD_MISMATCH_SENTENCES,
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
    scope: "",
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

/**
 * The room was rebuilt and nothing in the video gave its size (Pipeline `atlas_scale_review_unresolved`), or the size
 * review waits for its provider (`atlas_scale_review_waiting_on_provider`). Neither asks for a new video any more: the
 * Pipeline ships the room with its sizes relative, flagged as not measured (`atlas_unscaled_room`, owner 2026-11-23),
 * and asks a waiting review again by itself. A new video with an object of known size is the site's to send if it
 * wants the simulation measured; nothing waits on it.
 */
export const SCALE_NOT_MEASURED_SENTENCES = {
  title: "The size of the simulation of your site is not measured",
  reason: "Nothing in your video gave us a size we could rely on, so the simulation of your site keeps its sizes relative, not in metres.",
  nextStep: "Nothing is needed from you. If you'd like it measured, you can send a new video with an object of known size in view "
    + "near where the job happens, such as a door or a tape measure laid open on the floor.",
} as const;
export const SCALE_REVIEW_WAITING_SENTENCES = {
  title: "We haven't measured the size of the simulation of your site yet",
  reason: "Measuring the size of your space waits on a service we use. We will try again by ourselves.",
  nextStep: "Nothing is needed from you. Your video is saved.",
} as const;
const SCALE_REASONS: Readonly<Record<string, typeof SCALE_NOT_MEASURED_SENTENCES | typeof SCALE_REVIEW_WAITING_SENTENCES>> = {
  atlas_scale_review_unresolved: SCALE_NOT_MEASURED_SENTENCES,
  atlas_scale_review_waiting_on_provider: SCALE_REVIEW_WAITING_SENTENCES,
};

/** The verified Atlas preview of the job's capture says the job has no sentence to prepare from. */
export function jobAwaitsItsSentence(record: Record<string, any> | null | undefined, captureId: string): boolean {
  const preview = record ? selectWebsiteAtlasPreview(record, captureId) : null;
  return pipelineAsksForSentence(preview as never);
}

/** The job waits for its sentence: the site names it on its job page. Not a failure, and not ours to fix. */
export const TASK_NOT_NAMED_SENTENCES = {
  title: "Tell us the job in one sentence",
  reason: "We need one sentence saying what the robot should do before we can build the simulation of your job.",
  nextStep: "Write it in the box on your job page, for example “Pick up each box and put it on the shelf.” Once you send it, we'll start building the simulation of your site.",
} as const;
/** The site has given its sentence and the Pipeline has not re-read the job yet. Ours, not the site's. */
export const TASK_NAMED_SENTENCES = {
  title: "We have your job's sentence",
  // Not "starting": the Pipeline picks the job up on its own next read (review, 2026-11-12).
  reason: "We have your job's sentence and will start building its simulation.",
  nextStep: "Nothing more is needed from you.",
} as const;
export function taskNamedOutcome(): TaskOutcome {
  return { category: "insufficient_evidence", basis: "missing_evidence", title: TASK_NAMED_SENTENCES.title,
    reason: TASK_NAMED_SENTENCES.reason, scope: "",
    nextStep: TASK_NAMED_SENTENCES.nextStep, actionOwner: "blueprint", evidence: [] };
}
export function taskNotNamedOutcome(evidenceDigest: string): TaskOutcome {
  return { category: "insufficient_evidence", basis: "missing_evidence", title: TASK_NOT_NAMED_SENTENCES.title,
    reason: TASK_NOT_NAMED_SENTENCES.reason,
    scope: "",
    nextStep: TASK_NOT_NAMED_SENTENCES.nextStep, actionOwner: "site", evidence: [{ label: "Job description", digest: evidenceDigest }] };
}

/** An outcome whose reason this release does not know: one true, general sentence, and no claim about why. */
export const UNKNOWN_OUTCOME_SENTENCES = {
  title: "The preparation of your simulation stopped",
  reason: "Preparing the simulation of your site stopped on our side.",
  nextStep: "Nothing is needed from you. Your video is saved.",
} as const;
export function unknownOutcome(evidenceDigest: string): TaskOutcome {
  return { category: "insufficient_evidence", basis: "missing_evidence", title: UNKNOWN_OUTCOME_SENTENCES.title,
    reason: UNKNOWN_OUTCOME_SENTENCES.reason,
    scope: "",
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
export const EARLY_TASK_HOLD_DETAIL = "This says nothing about whether a robot could do the job. Your first look stays on your job page.";

/**
 * A job whose preparation authority ended (Pipeline `authority_ended`). It is final, never a hold or a
 * check in progress. The Pipeline ends it for an expired job window (`consent_expired`) or for rights
 * that no longer allow scene building (`source_revoked`); the WebApp reads which from the job's own
 * window. A withdrawn recording says so first, on its own.
 */
export const PREPARATION_ENDED_NEXT = "To try again, start a new job.";
/** The site has its answer whatever happens to the simulation; a stop of the simulation says so. */
export const ANSWER_STAYS_ON_JOB_PAGE = "Your first look stays on your job page.";
/** Said about the simulation: the time for the job ran out, and the answer stays. */
export const JOB_WINDOW_ENDED_SENTENCE = "The simulation of your site has stopped because the time for this job ran out.";
export const AUTHORITY_ENDED_SENTENCE = "This job has ended because we no longer have permission to work on it.";

/**
 * A job the WebApp's own window sweep ended (`websiteJobWindowSweep`): its work window ran out with no
 * result, hold or withdrawal on record. It is true however the job got there (the Pipeline went quiet, a
 * stage refused, a wait never cleared): Blueprint did not finish in the time it was authorized, the
 * Pipeline starts nothing more for a job past its window, and the job stays listed for deployment companies. It
 * promises no follow-up, because nothing schedules one. The job page and the one email both say exactly this.
 */
export const JOB_WINDOW_UNFINISHED_SENTENCE = "It was not finished, and no more work will run on this job.";
// No "start a new job": a window ending keeps the job listed for deployment companies (`teamJobAccess`).
export const JOB_WINDOW_ENDING_MESSAGE = `${JOB_WINDOW_ENDED_SENTENCE} ${JOB_WINDOW_UNFINISHED_SENTENCE} ${ANSWER_STAYS_ON_JOB_PAGE}`;
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
export const JOB_NO_GRANT_SITE_ENDING_MESSAGE = `This job has ended because we didn't receive what we needed to start it. ${PREPARATION_ENDED_NEXT}`;
export const JOB_NO_GRANT_BLUEPRINT_ENDING_MESSAGE = "We didn't start the simulation of your site in time, so there is none for this job. "
  + `${ANSWER_STAYS_ON_JOB_PAGE} Nothing is needed from you.`;
/**
 * A no-grant job that was asked for a smaller video (`websiteLargeVideoBlock.ts`) and received none
 * while it was open: the ending for a wait on the site, naming why.
 */
export const JOB_NO_GRANT_LARGE_VIDEO_ENDING_MESSAGE = "This job has ended because your video was too large for us to process "
  + `and no new video arrived. ${PREPARATION_ENDED_NEXT}`;
export const jobNoGrantEndingMessage = (waitingOn: "site" | "blueprint", reason?: "video_over_ingest_limit") =>
  reason === "video_over_ingest_limit" ? JOB_NO_GRANT_LARGE_VIDEO_ENDING_MESSAGE
    : waitingOn === "site" ? JOB_NO_GRANT_SITE_ENDING_MESSAGE : JOB_NO_GRANT_BLUEPRINT_ENDING_MESSAGE;

/**
 * A video that arrived before its job was saved to an account. Nothing sends a later email about it,
 * so none is promised. The job page, the upload refusal and the one email all read this sentence.
 */
export const FOOTAGE_BEFORE_ACCOUNT_SENTENCE = "Your video arrived before this job was saved to an account, so we can't "
  + "use it. To go ahead, start a new job.";

export function earlyTaskHoldOutcome(reason: EarlyTaskHoldReason, evidenceDigest: string): TaskOutcome {
  return { category: "held", basis: "simulation_not_available", title: EARLY_TASK_HOLD_SENTENCES[reason],
    reason: EARLY_TASK_HOLD_DETAIL,
    scope: "",
    // The Pipeline keeps the job and its review; the WebApp keeps the recording. No rerun is scheduled.
    nextStep: "Nothing is needed from you. Your video is saved; you don't need to send it again.",
    // No step is scheduled for Blueprint or the site, so the card names no owner of a next step.
    actionOwner: "none", evidence: [{ label: "Task check", digest: evidenceDigest }] };
}

/** The early task hold a verified preview names, or null. */
export function earlyTaskHoldOf(preview: WebsiteAtlasPreview | null): EarlyTaskHoldReason | null {
  return preview?.state === "needs_input" && isEarlyTaskHoldReason(preview.reason) ? preview.reason : null;
}

/** Takes only an already verified, capture-specific receipt. A ready/newer state clears the stop. */
export function projectAtlasPreparationOutcome(preview: WebsiteAtlasPreview | null): TaskOutcome | null {
  if (!preview) return null;
  if (atlasPreviewReachedSpendingCap(preview)) return { category: "processing_failure", basis: "execution_failure",
    title: CAP_OUTCOME_TITLE, reason: OUTLOOK_SENTENCES.spending_cap_reached,
    scope: ANSWER_STAYS_ON_JOB_PAGE, nextStep: "Nothing is needed from you.", actionOwner: "none",
    evidence: [{ label: "Reconstruction status", digest: preview.preview_digest }] };
  if (preview.state === "ready" || preview.state === "processing" || preview.state === "withdrawn") return null;
  // Money first: the account's monthly limit holds new spend, and the job resumes by itself.
  if (isAccountMonthlySpendReason(preview.reason))
    return accountLimitWaitOutcome({ label: "Reconstruction status", digest: preview.preview_digest });
  const scale = preview.state === "needs_input" && Object.hasOwn(SCALE_REASONS, preview.reason ?? "") ? SCALE_REASONS[preview.reason!] : null;
  if (scale) return { category: "insufficient_evidence", basis: "missing_evidence", title: scale.title, reason: scale.reason,
    scope: "", nextStep: scale.nextStep, actionOwner: "none", evidence: [{ label: "Scale finding", digest: preview.preview_digest }] };
  const held = earlyTaskHoldOf(preview);
  if (held) return earlyTaskHoldOutcome(held, preview.preview_digest);
  if (preview.state === "needs_input" && preview.reason === TASK_NOT_NAMED_REASON) return taskNotNamedOutcome(preview.preview_digest);
  if (preview.state === "needs_input" && isRecaptureReason(preview.reason))
    return recaptureNeeded(preview.reason, preview.preview_digest);
  // The planner held back (review, 2026-11-12). The preparation status's own outcome, when it has one, takes this
  // card's place on the page; without one, this card says what is true and promises nothing.
  if (preview.state === "needs_input" && COVERAGE_REASONS.has(preview.reason ?? "")) return { category: "insufficient_evidence",
    basis: "missing_evidence", title: PLANNER_ABSTAINED_SENTENCES.title, reason: PLANNER_ABSTAINED_SENTENCES.reason,
    scope: "",
    nextStep: PLANNER_ABSTAINED_SENTENCES.nextStep, actionOwner: "blueprint",
    evidence: [{ label: "Scene coverage finding", digest: preview.preview_digest }] };
  if (preview.state === "needs_input" && preview.reason === "atlas_scene_requires_preserved_capture")
    return evidenceNeeded(preview.preview_digest, "Scene preservation finding");
  if (preview.state === "needs_input" && TASK_REASONS.has(preview.reason ?? ""))
    return evidenceNeeded(preview.preview_digest, "Task subject finding");
  if (preview.state === "needs_input" && GEOMETRY_REASONS.has(preview.reason ?? ""))
    return evidenceNeeded(preview.preview_digest, "Scene geometry finding");
  if (preview.state === "needs_input"
    && preview.reason === "atlas_recorded_source_views_must_be_recovered_before_generation")
    return { ...processingFailure({label: "Saved scene views", digest: preview.preview_digest}),
      title: "We haven't finished building the simulation from your video",
      reason: "Part of your video still needs to go into the simulation.",
      nextStep: "Nothing is needed from you. Your video is saved." };
  const paused = (preview.state === "needs_input" || (preview.state === "failed" && FAILED_ON_OUR_SIDE.has(preview.reason ?? "")))
    && Object.hasOwn(ATLAS_PAUSES, preview.reason ?? "") ? ATLAS_PAUSES[preview.reason!] : null;
  if (paused) return { category: "processing_failure", basis: "execution_failure", title: paused.title, reason: paused.reason,
    scope: "", nextStep: paused.nextStep, actionOwner: paused.actionOwner,
    evidence: [{ label: "Reconstruction status", digest: preview.preview_digest }] };
  // A reason with no words here: parked for input on no wall, the Pipeline reopens it by the clock, so it is still
  // being worked on; ended `failed` (only a release reopens it) or parked on a wall, it is said as stopped.
  return preview.state === "needs_input" && !namesAWall(preview.reason)
    ? processingRetrying({ label: "Reconstruction status", digest: preview.preview_digest })
    : processingFailure({ label: "Reconstruction status", digest: preview.preview_digest });
}

/**
 * Whether a refusal code's words name a privacy, rights or money stop, as the Pipeline reads them
 * (`job_retry_policy.hard_stop_kind`, whole words): an Atlas job parked on one is not reopened by the clock.
 */
const WALL_WORDS = new Set(["consent", "revoked", "revocation", "revoke", "withdrawn", "withdrawal", "rights", "license",
  "licence", "privacy", "takedown", "authority", "authorization", "authorisation", "unauthorized", "unauthorised",
  "spend", "spent", "budget", "ceiling", "credit", "billing", "paid", "price", "cost", "money", "funding", "funds",
  "payment", "usd"]);
const namesAWall = (reason: string | null | undefined) => (reason ?? "").split(/[^0-9a-z]+/).some(word => WALL_WORDS.has(word));

/**
 * Atlas stops that are neither the site's to clear nor retried by the clock (round 2, 2026-11-24), each said as only
 * what is true. The site has no control that gives permission, so none asks it to.
 *
 * - The permission on record does not cover the step (a rights refusal): the recording's consent does not allow scene
 *   building, the video is not the one the grant covers, the planner's terms changed since the grant, or the grant ran
 *   out.
 * - Blueprint's own setup is not finished (`website_atlas_consent_unconfigured`, `website_scene_grant_policy_unconfigured`,
 *   provider terms not configured): ours to finish.
 */
const PERMISSION_NOT_COVERED = { title: "Building the simulation of your site is paused",
  reason: "The permission on record for your video does not cover this step.", nextStep: "Your video is saved.",
  actionOwner: "none" as const };
const SETUP_ON_OUR_SIDE = { title: "Building the simulation of your site is paused on our side",
  reason: "A setup step on our side has to be finished before it can go on.", nextStep: "Nothing is needed from you. Your video is saved.",
  actionOwner: "blueprint" as const };
/**
 * The read of the job's reservations grew past what one signed answer carries (`website_atlas_reservation_summary_too_large`,
 * `website_atlas_accounting_response_too_large`; stress round 2, 2026-11-24): the Pipeline rechecks it and goes on
 * once it fits. Ours to fix, never the site's.
 */
const STEP_ON_OUR_SIDE = { title: "Building the simulation of your site is paused on our side",
  reason: "A step on our side has to be finished before it can go on.", nextStep: "Nothing is needed from you. Your video is saved.",
  actionOwner: "blueprint" as const };
/**
 * The scene planner's own review did not hold together, so the Pipeline refuses it by the part that failed and rechecks
 * it until a release decides differently (stress round 3, 2026-11-24). Each is ours: nothing the site filmed or said
 * is at fault. `atlas_scene_planner_coverage_or_privacy_invalid` is the code those parts had before; stored jobs may
 * still carry it, and its "privacy" names no wall the site can act on.
 */
const PLANNER_REVIEW_CODES = ["atlas_scene_planner_unsafe_frames_invalid", "atlas_scene_planner_required_views_outside_selection",
  "atlas_scene_planner_required_view_unsafe", "atlas_scene_planner_anchor_not_required",
  "atlas_scene_planner_task_or_room_coverage_missing", "atlas_scene_planner_coverage_or_privacy_invalid"] as const;
/**
 * The review of the views generated for parts of the room no frame saw did not pass, or the record that the job goes
 * on without them did not read back (stress round 4, 2026-11-24). The Pipeline now goes on without those views, so
 * these reach a job only from a step that still rechecks them. Ours: the site's video is not at fault.
 */
const COMPLETION_REVIEW_CODES = ["atlas_completion_visual_review_required", "atlas_completion_floor_record_invalid"] as const;
/**
 * A step of building the simulation kept running past its time limit and was ended each time it was tried (stress
 * round 5, 2026-11-24: the host's memory bound slowed one step for hours). Retried by the clock until the retries run
 * out, then the job ends `failed` and only a release reopens it. Either way the fix is ours, never the site's.
 */
const FAILED_ON_OUR_SIDE = new Set(["atlas_preview_step_interrupted"]);
const ATLAS_PAUSES: Readonly<Record<string, typeof PERMISSION_NOT_COVERED | typeof SETUP_ON_OUR_SIDE>> = {
  ...Object.fromEntries(PLANNER_REVIEW_CODES.map(code => [code, STEP_ON_OUR_SIDE])),
  ...Object.fromEntries(COMPLETION_REVIEW_CODES.map(code => [code, STEP_ON_OUR_SIDE])),
  ...Object.fromEntries([...FAILED_ON_OUR_SIDE].map(code => [code, STEP_ON_OUR_SIDE])),
  website_atlas_reservation_summary_too_large: STEP_ON_OUR_SIDE,
  website_atlas_accounting_response_too_large: STEP_ON_OUR_SIDE,
  website_atlas_source_consent_required: PERMISSION_NOT_COVERED,
  website_atlas_planner_consent_required: PERMISSION_NOT_COVERED,
  website_atlas_consent_expired: PERMISSION_NOT_COVERED,
  website_atlas_consent_unconfigured: SETUP_ON_OUR_SIDE,
  website_scene_grant_policy_unconfigured: SETUP_ON_OUR_SIDE,
  provider_terms_not_configured_or_changed: SETUP_ON_OUR_SIDE,
};

/** Whether this release has words of its own for an Atlas preview's reason (`noteUnknownPipelineCode` alerts any other). */
export function atlasPreviewReasonKnown(reason: string | null | undefined): boolean {
  if (!reason) return true;
  return isAccountMonthlySpendReason(reason) || Object.hasOwn(SCALE_REASONS, reason) || isEarlyTaskHoldReason(reason)
    || reason === TASK_NOT_NAMED_REASON || isRecaptureReason(reason) || COVERAGE_REASONS.has(reason)
    || reason === "atlas_scene_requires_preserved_capture" || TASK_REASONS.has(reason) || GEOMETRY_REASONS.has(reason)
    || reason === "atlas_recorded_source_views_must_be_recovered_before_generation" || ATLAS_REASONS_WITHOUT_OWN_WORDS.has(reason)
    || Object.hasOwn(ATLAS_PAUSES, reason);
}
/**
 * Reasons the Atlas preview sends that are said with the general card on purpose (no alert): the spending cap is read
 * from the preview itself (`atlasPreviewReachedSpendingCap`), and an owner's closing of a run has its own card.
 */
const ATLAS_REASONS_WITHOUT_OWN_WORDS = new Set(["spending_cap_reached", "website_run_closed_by_owner"]);
