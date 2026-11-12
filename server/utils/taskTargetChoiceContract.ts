/** The one optional in-job question (website_preparation_status.v4): preparation already went on with
 * its best supported guess of the object the robot moves; the site may confirm it, pick another found
 * object (the same job reruns from retained work) or say none of these (same-job walkthrough update).
 * Mirrors contracts/pipeline/website-task-target-choice.v1.schema.json. Candidates are opaque ids
 * and position labels the Pipeline derived from segmentation masks; no image or pixel data. */
import { z } from "zod";

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const taskTargetIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
/** An object's id (`c…`) or, since the place question (2026-11-12), a place's id (`p…`). */
export const taskTargetCandidateIdSchema = z.string().regex(/^[cp][0-9a-f]{16}$/);
const objectCandidateId = z.string().regex(/^c[0-9a-f]{16}$/);
const placeCandidateId = z.string().regex(/^p[0-9a-f]{16}$/);
export const taskObjectChoiceQuestionSchema = z.object({
  kind: z.literal("task_target_choice"),
  question_digest: digest,
  target_id: taskTargetIdSchema,
  semantic_label: z.string().min(1).max(60),
  candidate_set_digest: digest,
  guessed_candidate_id: objectCandidateId,
  candidates: z.array(z.object({
    candidate_id: objectCandidateId,
    label: z.string().min(1).max(120),
    reference_time_ms: z.number().int().min(0).max(86_400_000).nullable(),
  }).strict()).min(1).max(8),
}).strict().refine(value => new Set(value.candidates.map(row => row.candidate_id)).size === value.candidates.length
  && value.candidates.some(row => row.candidate_id === value.guessed_candidate_id), "candidate ids repeat or miss the guess");

/**
 * The optional place question (Pipeline `website_destination_choice.public_place_question`, 2026-11-12): "We will test
 * moving the {object} from here to here.", with 2 to 4 places to pick from instead, and the reference of ONE private
 * picture from the site's own video (the object outlined where it starts, the scored area in green). It is answered
 * like the object question (confirm, or another place); "none of these" has no meaning for a place. The job never
 * waits on it. Its `sentence` and place labels are not shown: the page has its own sentence and names the places
 * "Place A", "Place B"… in the order the picture letters them. The one word it shows from the Pipeline is the object's
 * name as read from the video (`semantic_label`), letters, digits and spaces only (else "object").
 */
export const TASK_DESTINATION_TARGET_ID = "destination.place";
export const taskDestinationChoiceQuestionSchema = z.object({
  kind: z.literal("task_destination_choice"),
  question_digest: digest,
  target_id: z.literal(TASK_DESTINATION_TARGET_ID),
  semantic_label: z.string().min(1).max(60),
  sentence: z.string().min(1).max(200),
  candidate_set_digest: digest,
  guessed_candidate_id: placeCandidateId,
  candidates: z.array(z.object({
    candidate_id: placeCandidateId,
    label: z.string().min(1).max(120),
    reference_time_ms: z.number().int().min(0).max(86_400_000).nullable(),
  }).passthrough()).min(2).max(4),
  picture: z.object({ png_sha256: digest, frame_id: z.string().min(1).max(128) }).passthrough().optional(),
}).passthrough().refine(value => new Set(value.candidates.map(row => row.candidate_id)).size === value.candidates.length
  && value.candidates.some(row => row.candidate_id === value.guessed_candidate_id), "candidate ids repeat or miss the guess");
export type TaskDestinationChoiceQuestion = z.infer<typeof taskDestinationChoiceQuestionSchema>;

/** Which place a candidate is, from the Pipeline's own fixed label for it. Kept for staff; the page names places by letter. */
export const PLACE_KINDS = ["named_place", "words_place", "surface_end", "farthest_spot", "site_choice", "other"] as const;
export type PlaceKind = typeof PLACE_KINDS[number];
const PIPELINE_PLACE_LABELS: Readonly<Record<string, PlaceKind>> = {
  "The place your job names": "named_place",
  "The place we found from your job's words": "words_place",
  "The other end of the same surface": "surface_end",
  "The spot on the same surface farthest from where it starts": "farthest_spot",
  "The place you picked": "site_choice",
};
export const placeKindOf = (label: string): PlaceKind => Object.hasOwn(PIPELINE_PLACE_LABELS, label) ? PIPELINE_PLACE_LABELS[label] : "other";

/** The keys a question and its candidates are read by; any other key is kept (sealed in the status digest), ignored and alerted. */
export const TASK_CHOICE_QUESTION_KEYS: readonly string[] = ["kind", "question_digest", "target_id", "semantic_label", "sentence",
  "candidate_set_digest", "guessed_candidate_id", "candidates", "picture"];
export const TASK_CHOICE_CANDIDATE_KEYS: readonly string[] = ["candidate_id", "label", "reference_time_ms"];
export const TASK_CHOICE_PICTURE_KEYS: readonly string[] = ["png_sha256", "frame_id"];

/** The question kinds this release answers. */
export const KNOWN_TASK_CHOICE_KINDS = ["task_target_choice", "task_destination_choice"] as const;
/**
 * A question of a kind this release does not know: read (it never fails the status, review 2026-11-12) and never
 * shown or answered.
 */
const unknownTaskChoiceQuestionSchema = z.object({ kind: z.string().min(1).max(64) }).passthrough()
  // The object question keeps its strictness exactly as before (a malformed one fails the read). A place question
  // that does not keep its shape is read like a kind this release does not know: not shown, alerted, never a failed read.
  .refine(value => value.kind !== "task_target_choice", "the object question keeps its own shape");
/** The status's one optional question: the object question, the place question, or one this release does not know. */
export const taskTargetChoiceQuestionSchema = z.union([taskObjectChoiceQuestionSchema, taskDestinationChoiceQuestionSchema,
  unknownTaskChoiceQuestionSchema]);
/** A question this release can show and answer. */
export type TaskTargetChoiceQuestion = z.infer<typeof taskObjectChoiceQuestionSchema> | TaskDestinationChoiceQuestion;
export const isKnownTaskChoiceQuestion = (value: unknown): value is TaskTargetChoiceQuestion =>
  taskObjectChoiceQuestionSchema.safeParse(value).success || taskDestinationChoiceQuestionSchema.safeParse(value).success;

/** As stored and read by the Pipeline: confirm_guess names the guess; other_candidate names a different one. */
export const taskTargetChoiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirm_guess"), candidate_id: taskTargetCandidateIdSchema }).strict(),
  z.object({ kind: z.literal("other_candidate"), candidate_id: taskTargetCandidateIdSchema }).strict(),
  z.object({ kind: z.literal("none_of_these") }).strict(),
]);
/** What the job page sends: confirm the guess, choose another found object, or none of these. */
export const taskTargetChoiceRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("confirm_guess") }).strict(),
  z.object({ kind: z.literal("other_candidate"), candidate_id: taskTargetCandidateIdSchema }).strict(),
  z.object({ kind: z.literal("none_of_these") }).strict(),
]);
export type TaskTargetChoiceRequest = z.infer<typeof taskTargetChoiceRequestSchema>;
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
