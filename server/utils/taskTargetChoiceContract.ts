/** The one in-job question "which object should the robot move?" (website_preparation_status.v4).
 * Mirrors contracts/pipeline/website-task-target-choice.v1.schema.json. Candidates are opaque ids
 * and position labels the Pipeline derived from segmentation masks; no image or pixel data. */
import { z } from "zod";

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const taskTargetIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
export const taskTargetCandidateIdSchema = z.string().regex(/^c[0-9a-f]{16}$/);
export const taskTargetChoiceQuestionSchema = z.object({
  kind: z.literal("task_target_choice"),
  question_digest: digest,
  target_id: taskTargetIdSchema,
  semantic_label: z.string().min(1).max(60),
  candidate_set_digest: digest,
  candidates: z.array(z.object({
    candidate_id: taskTargetCandidateIdSchema,
    label: z.string().min(1).max(120),
    reference_time_ms: z.number().int().min(0).max(86_400_000).nullable(),
  }).strict()).min(1).max(8),
}).strict().refine(value => new Set(value.candidates.map(row => row.candidate_id)).size === value.candidates.length,
  "candidate ids repeat");
export type TaskTargetChoiceQuestion = z.infer<typeof taskTargetChoiceQuestionSchema>;

export const taskTargetChoiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("candidate"), candidate_id: taskTargetCandidateIdSchema }).strict(),
  z.object({ kind: z.literal("none_of_these") }).strict(),
]);
export type TaskTargetChoice = z.infer<typeof taskTargetChoiceSchema>;
export const TASK_TARGET_CHOICE_ANSWER_SCHEMA = "website_task_target_choice_answer.v1";
/** The website_preparation_status selectors an answer is bound to (same rules as the status selector). */
export const taskTargetChoiceSelectorShape = {
  request_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/),
  scene_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,124}$/),
  capture_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,131}$/),
  completion_marker_generation: z.string().regex(/^[1-9][0-9]{0,19}$/),
  producer_delivery_key: digest, source_payload_sha256: z.string().regex(/^[a-f0-9]{64}$/), task_context_digest: digest,
};
