/** The site's answer to "we picked this object; is it the one the robot should move?", bound to the
 * job's exact capture source, the question, its guess and the candidate list it answered. Optional:
 * the job never waits on it. The Pipeline reads it through its signed control transport: a confirmation
 * changes nothing, another candidate reruns the same job from retained work, and "none of these" retires
 * the guessed result with an honest evidence limit. No new grant, job or approval step. */
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";
import { TASK_TARGET_CHOICE_ANSWER_SCHEMA, taskTargetCandidateIdSchema, taskTargetChoiceSchema,
  taskTargetChoiceSelectorShape, taskTargetIdSchema, type TaskTargetChoice, type TaskTargetChoiceQuestion,
  type TaskTargetChoiceRequest } from "./taskTargetChoiceContract";
import { loadCurrentTaskTargetChoiceQuestion, verifyCurrentWebsitePreparationSelector,
  type WebsitePreparationSelector } from "./websitePreparationStatus";

export const WEBSITE_TASK_TARGET_CHOICE_FIELD = "website_task_target_choice";
export const WEBSITE_TASK_TARGET_CHOICES_FIELD = "website_task_target_choices";
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const selectorShape = taskTargetChoiceSelectorShape;
export const taskTargetChoiceAnswerSchema = z.object({
  schema_version: z.literal(TASK_TARGET_CHOICE_ANSWER_SCHEMA), ...selectorShape,
  question_digest: digest, target_id: taskTargetIdSchema, candidate_set_digest: digest,
  guessed_candidate_id: taskTargetCandidateIdSchema,
  choice: taskTargetChoiceSchema, answered_at: z.string().max(40), answer_digest: digest,
}).strict().refine(value => value.choice.kind === "none_of_these"
  || (value.choice.kind === "confirm_guess") === (value.choice.candidate_id === value.guessed_candidate_id),
  "choice does not match the guess");
export type TaskTargetChoiceAnswer = z.infer<typeof taskTargetChoiceAnswerSchema>;
/** What the Pipeline asks with: the exact status selectors plus the question it is waiting on. */
export const taskTargetChoiceReadSchema = z.object({...selectorShape, question_digest: digest}).strict();

function selectorOf(value: WebsitePreparationSelector): WebsitePreparationSelector {
  const {request_id, scene_id, capture_id, completion_marker_generation, producer_delivery_key,
    source_payload_sha256, task_context_digest} = value;
  return {request_id, scene_id, capture_id, completion_marker_generation, producer_delivery_key,
    source_payload_sha256, task_context_digest};
}
export function parseStoredTaskTargetChoice(value: unknown): TaskTargetChoiceAnswer | null {
  const parsed = taskTargetChoiceAnswerSchema.safeParse(value);
  return parsed.success && crossRuntimeArtifactDigest(parsed.data as unknown as Record<string, unknown>,
    "answer_digest") === parsed.data.answer_digest ? parsed.data : null;
}
/** The stored answer to exactly this question, if any; any other question's answer is not one. */
export function answerForQuestion(stored: unknown, question: TaskTargetChoiceQuestion | null | undefined) {
  const answer = parseStoredTaskTargetChoice(stored);
  return answer && question && answer.question_digest === question.question_digest
    && answer.candidate_set_digest === question.candidate_set_digest
    && answer.guessed_candidate_id === question.guessed_candidate_id ? answer : null;
}

/** Current source facts survive the question disappearing after a correction.
 * They do not issue authority, or turn a previous scene's result into a new one. */
export function taskTargetSelection(session: Record<string, any> | null | undefined) {
  const selector = session?.website_preparation?.selector;
  const latest = new Map<string, TaskTargetChoiceAnswer>();
  if (selector) for (const value of [...Object.values(session?.[WEBSITE_TASK_TARGET_CHOICES_FIELD] ?? {}),
    session?.[WEBSITE_TASK_TARGET_CHOICE_FIELD]]) {
    const answer = parseStoredTaskTargetChoice(value);
    if (!answer || crossRuntimeDigest(selectorOf(answer)) !== crossRuntimeDigest(selectorOf(selector))) continue;
    const prior = latest.get(answer.target_id);
    if (!prior || answer.answered_at >= prior.answered_at) latest.set(answer.target_id, answer);
  }
  const answers = [...latest.values()].sort((a, b) => a.target_id < b.target_id ? -1 : a.target_id > b.target_id ? 1 : 0);
  const corrections = answers.filter(row => row.choice.kind !== "confirm_guess").map(row => ({
    target_id: row.target_id, question_digest: row.question_digest,
    ...(row.choice.kind === "none_of_these" ? {kind: "none_of_these"} : {candidate_id: row.choice.candidate_id}),
  }));
  return { answers, rejected: answers.some(row => row.choice.kind === "none_of_these"),
    correctionsDigest: corrections.length ? crossRuntimeDigest({corrections}) : null };
}

export function taskTargetSelectionApplies(session: Record<string, any> | null | undefined,
  intake?: Record<string, any> | null) {
  const selection = taskTargetSelection(session);
  if (selection.rejected) return false;
  if (!selection.correctionsDigest) return true;
  const context = selection.answers[0]?.task_context_digest;
  const taskId = context ? `website-${context.slice(7, 27)}` : null;
  return Boolean(taskId && [taskId, `${taskId}-development`].includes(intake?.request?.task?.task_id)
    && intake?.request?.task?.subject?.website_preparation_revision?.corrections_digest === selection.correctionsDigest);
}

/** The site's stored answer to the question the Pipeline currently reports, or null. */
export function currentTaskTargetChoiceAnswer(session: Record<string, any> | undefined,
  status: {state: string; question?: TaskTargetChoiceQuestion | null}): TaskTargetChoice["kind"] | null {
  if (["authority_ended", "unavailable"].includes(status.state) || !session) return null;
  if (!status.question) {
    const selection = taskTargetSelection(session);
    return selection.rejected ? "none_of_these" : selection.correctionsDigest ? "other_candidate" : null;
  }
  const stored = session[WEBSITE_TASK_TARGET_CHOICES_FIELD]?.[status.question.question_digest]
    ?? session[WEBSITE_TASK_TARGET_CHOICE_FIELD];
  const answer = answerForQuestion(stored, status.question);
  const selector = session.website_preparation?.selector;
  return answer && selector && crossRuntimeDigest(selectorOf(answer)) === crossRuntimeDigest(selectorOf(selector))
    ? answer.choice.kind : null;
}

export function buildTaskTargetChoiceAnswer(selector: WebsitePreparationSelector, question: TaskTargetChoiceQuestion,
  choice: TaskTargetChoice, answeredAt: string): TaskTargetChoiceAnswer {
  const record = {schema_version: TASK_TARGET_CHOICE_ANSWER_SCHEMA, ...selectorOf(selector),
    question_digest: question.question_digest, target_id: question.target_id,
    candidate_set_digest: question.candidate_set_digest, guessed_candidate_id: question.guessed_candidate_id,
    choice, answered_at: answeredAt};
  return taskTargetChoiceAnswerSchema.parse({...record,
    answer_digest: crossRuntimeArtifactDigest(record as Record<string, unknown>, "answer_digest")});
}

export interface TaskTargetChoiceDeps {
  verifyCurrent(selector: WebsitePreparationSelector): Promise<void>;
  loadQuestion(requestId: string, captureId: string):
    Promise<{selector: WebsitePreparationSelector; question: TaskTargetChoiceQuestion} | null>;
  /** Writes `answer` unless one is stored; returns the answer that is stored afterwards. */
  commit(answer: TaskTargetChoiceAnswer): Promise<TaskTargetChoiceAnswer>;
  readStored(captureId: string, questionDigest?: string): Promise<unknown>;
}
export async function commitTaskTargetChoiceAnswer(answer: TaskTargetChoiceAnswer, store = db) {
    if (!store) throw new Error("task_target_choice_unavailable");
    return store.runTransaction(async tx => {
      const ref = store.collection("captureUploadSessions").doc(answer.capture_id);
      const session = (await tx.get(ref)).data();
      // The status commit stores the receipt for this same source; never answer for another one.
      const stored = session?.website_preparation?.selector;
      if (!session || !stored || crossRuntimeDigest(selectorOf(stored)) !== crossRuntimeDigest(selectorOf(answer)))
        throw new Error("task_target_choice_question_changed");
      const prior = parseStoredTaskTargetChoice(session[WEBSITE_TASK_TARGET_CHOICES_FIELD]?.[answer.question_digest]
        ?? session[WEBSITE_TASK_TARGET_CHOICE_FIELD]);
      const sameSource = prior && crossRuntimeDigest(selectorOf(prior)) === crossRuntimeDigest(selectorOf(answer));
      if (sameSource && prior.question_digest === answer.question_digest) {
        if (crossRuntimeDigest(prior.choice) === crossRuntimeDigest(answer.choice)) return prior;
        // A negative answer never consumes the question. An owner may clarify it
        // later, but only while this same source-bound question is still current.
        if (prior.choice.kind !== "none_of_these") return prior;
      }
      const history = prior ? ref.collection("taskTargetChoiceHistory").doc(prior.answer_digest.slice(7)) : null;
      const retained = history ? (await tx.get(history)).data() : null;
      if (retained && crossRuntimeDigest(retained) !== crossRuntimeDigest(prior))
        throw new Error('task_target_choice_history_changed');
      if (history && !retained) tx.set(history, prior!);
      tx.set(ref, {[WEBSITE_TASK_TARGET_CHOICE_FIELD]: answer,
        [WEBSITE_TASK_TARGET_CHOICES_FIELD]: {...session[WEBSITE_TASK_TARGET_CHOICES_FIELD],
          ...(prior ? {[prior.question_digest]: prior} : {}), [answer.question_digest]: answer}},
        {mergeFields: [WEBSITE_TASK_TARGET_CHOICE_FIELD, WEBSITE_TASK_TARGET_CHOICES_FIELD]});
      return answer;
    });
}

const defaultDeps: TaskTargetChoiceDeps = {
  verifyCurrent: selector => verifyCurrentWebsitePreparationSelector(selector),
  loadQuestion: (requestId, captureId) => loadCurrentTaskTargetChoiceQuestion(requestId, captureId),
  commit: answer => commitTaskTargetChoiceAnswer(answer),
  async readStored(captureId, questionDigest) {
    if (!db) throw new Error("task_target_choice_unavailable");
    const session = (await db.collection("captureUploadSessions").doc(captureId).get()).data();
    return (questionDigest && session?.[WEBSITE_TASK_TARGET_CHOICES_FIELD]?.[questionDigest])
      ?? session?.[WEBSITE_TASK_TARGET_CHOICE_FIELD];
  },
};

/** One answer per question. The question is re-read from the Pipeline first, so a stale page cannot answer. */
export async function answerTaskTargetChoice(requestId: string, captureId: string,
  body: {questionDigest: string; choice: TaskTargetChoiceRequest}, deps = defaultDeps, now = () => new Date()) {
  const current = await deps.loadQuestion(requestId, captureId);
  if (!current || current.question.question_digest !== body.questionDigest)
    throw new Error("task_target_choice_question_changed");
  const guessed = current.question.guessed_candidate_id;
  const request = body.choice;
  if (request.kind === "other_candidate" && (request.candidate_id === guessed
    || !current.question.candidates.some(row => row.candidate_id === request.candidate_id)))
    throw new Error("task_target_choice_candidate_unknown");
  const choice: TaskTargetChoice = request.kind === "confirm_guess" ? {kind: "confirm_guess", candidate_id: guessed} : request;
  const answer = buildTaskTargetChoiceAnswer(current.selector, current.question, choice, now().toISOString());
  const stored = await deps.commit(answer);
  // An answer, once stored, is what the Pipeline may already have applied: it does not change.
  if (crossRuntimeDigest(stored.choice) !== crossRuntimeDigest(answer.choice)) throw new Error("task_target_choice_already_answered");
  return stored;
}

/** The Pipeline's signed read: only the answer to the exact question and source it names. */
export async function readTaskTargetChoiceForPipeline(captureId: string, raw: unknown, deps = defaultDeps) {
  const request = taskTargetChoiceReadSchema.parse(raw);
  if (request.capture_id !== captureId) throw new Error("task_target_choice_read_invalid");
  // The question disappears once its answer is applied. Its retained fact is
  // still readable, under fresh source/rights/task validation, without recursion
  // through the Pipeline status endpoint while that same worker is progressing.
  await deps.verifyCurrent(selectorOf(request));
  const answer = parseStoredTaskTargetChoice(await deps.readStored(captureId, request.question_digest));
  if (!answer || answer.question_digest !== request.question_digest
    || crossRuntimeDigest(selectorOf(answer)) !== crossRuntimeDigest(selectorOf(request))) return null;
  return answer;
}
