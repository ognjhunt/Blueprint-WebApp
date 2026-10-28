/** Redacted, deterministic closeout of existing source-bound preparation evidence.
 * Never classify an exception string, an estimated height or an agent's opinion
 * as robot incompatibility. Status reads do not retry work or grant spending.
 */
import { z } from "zod";
import type { TaskOutcome } from "../../client/src/types/taskOutcome";
import type { WebsiteAtlasPreview } from "./websiteAtlasPreview";

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const preparationOutcomeSchema = z.discriminatedUnion("reason", [
  z.object({ reason: z.literal("robot_carry_path_rejected"), category: z.literal("robot_incompatibility"),
    basis: z.literal("conservative_configuration_check"), robot_id: z.literal("franka_panda"), evidence_digest: digest }).strict(),
  z.object({ reason: z.literal("task_evidence_incomplete"), category: z.literal("insufficient_evidence"),
    basis: z.literal("missing_evidence"), robot_id: z.null(), evidence_digest: digest }).strict(),
]);
export type PreparationOutcomeReceipt = z.infer<typeof preparationOutcomeSchema>;

export function projectPreparationOutcome(receipt: PreparationOutcomeReceipt): TaskOutcome {
  if (receipt.reason === "robot_carry_path_rejected") return {
    category: "robot_incompatibility", basis: receipt.basis, title: "The checked robot configuration was rejected",
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

function evidenceNeeded(reason: string, evidenceDigest: string, label: string): TaskOutcome {
  return { category: "insufficient_evidence", basis: "missing_evidence", title: "There is not enough evidence for a robot decision",
    reason, scope: "The current capture and task evidence. No robot incompatibility or qualified evaluation result has been established.",
    nextStep: "Blueprint must review the saved evidence and identify the exact missing measurement, view or task fact. We will request only what is needed; do not record or upload the same video again.",
    actionOwner: "blueprint", evidence: [{ label, digest: evidenceDigest }] };
}

const COVERAGE_REASONS = new Set(["atlas_scene_planner_abstained", "atlas_task_and_scene_coverage_gap",
  "atlas_insufficient_overlapping_distinct_views", "atlas_coverage_anchor_quality_insufficient"]);
const TASK_REASONS = new Set(["atlas_scene_subject_origin_uncertain", "atlas_scene_subject_origin_changed",
  "atlas_synthetic_subject_requires_preserved_capture"]);

/** Takes only an already verified, capture-specific receipt. A ready/newer state clears the stop. */
export function projectAtlasPreparationOutcome(preview: WebsiteAtlasPreview | null): TaskOutcome | null {
  if (!preview || preview.state === "ready" || preview.state === "processing" || preview.state === "withdrawn") return null;
  if (preview.state === "needs_input" && COVERAGE_REASONS.has(preview.reason ?? ""))
    return evidenceNeeded("The available source views did not establish enough scene coverage for this task.",
      preview.preview_digest, "Scene coverage finding");
  if (preview.state === "needs_input" && preview.reason === "atlas_scene_requires_preserved_capture")
    return evidenceNeeded("The scene-preparation plan could not preserve the captured objects required by this task.",
      preview.preview_digest, "Scene preservation finding");
  if (preview.state === "needs_input" && TASK_REASONS.has(preview.reason ?? ""))
    return evidenceNeeded("The task subject and the captured objects could not be bound consistently without changing the observed scene.",
      preview.preview_digest, "Task subject finding");
  return processingFailure({ label: "Reconstruction status", digest: preview.preview_digest });
}
