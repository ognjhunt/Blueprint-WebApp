/**
 * We write the brief. The operator corrects it. That correction is the gate.
 *
 * ## The inversion
 *
 * The intake used to ask a site to describe its own room in dropdowns before we
 * would accept a film of the same room. Moving the questions behind a
 * disclosure did not fix that — it hid it, and left the site with no way to
 * ever become supply, because a blank gate never qualifies and footage may only
 * lower a verdict.
 *
 * So the questions do not come back. Instead: we read whatever the site sent —
 * a description, photographs, a walkthrough — and we draft what we think the
 * job is, gate answers included, each one labelled with what it rests on. The
 * operator reads our version and fixes what we got wrong.
 *
 * **Confirming that brief is the attestation.** It is the operator stating
 * these answers, which is exactly what `gateAnswerSources` means by
 * `operator_stated`, and it is what lets a verdict stand. One review of our
 * reading replaces six questions, and it is easier because we did the work
 * first.
 *
 * ## Our reading is not a fact about their site
 *
 * Every proposed answer carries its basis. A `description` answer is what they
 * told us; an `observation` is what we saw in the footage; an `assumption` is
 * us filling a gap and is never confirmable in place — it has to be answered.
 *
 * That distinction is the difference between this and a form that fills itself
 * in. An extracted statement is not a verified physical fact, and an assumption
 * that quietly became an operator statement would be the worst outcome
 * available here: a `qualified` verdict nobody actually made.
 *
 * ## "I do not know" is a real answer
 *
 * It leaves the gate blank, and a blank gate still blocks whatever it blocks.
 * What it must never do is loop — the question is recorded as outstanding and
 * the operator moves on. An unknown answer is a specific outstanding
 * requirement, not a failed form.
 */

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  defaultCaptureMode,
  gateFields,
  isCaptureMode,
  type CaptureMode,
} from "../../client/src/data/siteTaskQualification";
import { triageGateAnswers } from "../../client/src/lib/gateTriage";
import {
  assessReadiness,
  bindingGates,
  type ReadinessVerdict,
} from "../../client/src/lib/siteTaskReadiness";
import type { GateAnswerSources } from "../../client/src/lib/gateProvenance";
import { gateAnswersOnFile } from "./gateAnswersOnFile";

export const TASK_BRIEFS_COLLECTION = "siteTaskBriefs";

/**
 * What a proposed answer rests on.
 *
 * Ranked by how much weight it can carry on its own, and the ranking matters:
 * only the first two may be confirmed in place. An assumption has to be
 * answered, because confirming our guess back to us establishes nothing.
 */
export type BriefBasis =
  /** The operator told us, in their own words. */
  | "description"
  /** We saw it in the footage or the photographs. */
  | "observation"
  /** A measurement they gave us. */
  | "measurement"
  /** We filled a gap. Never confirmable; always a question. */
  | "assumption";

export const CONFIRMABLE_BASES: readonly BriefBasis[] = [
  "description",
  "observation",
  "measurement",
];

export interface ProposedGateAnswer {
  fieldId: string;
  /** The option value we think is right. */
  value: string;
  basis: BriefBasis;
  /** Our words for why, shown next to the answer so they can disagree with it. */
  reading: string;
}

export interface SiteTaskBriefRecord {
  requestId: string;
  /** One line: what we think the job is. */
  summary: string;
  /** What we read, and what each reading rests on. */
  proposed: ProposedGateAnswer[];
  /**
   * Gates nothing in the evidence could settle, in the order worth asking.
   *
   * Only the ones that change the next action lead. A question that will
   * eventually be needed but changes nothing today is still recorded, and is
   * not what the operator is asked first.
   */
  unresolved: string[];
  captureMode: CaptureMode;
  draftedAtIso: string;
  /** What we had to read when we drafted this. */
  draftedFrom: BriefBasis[];
  confirmedAtIso: string | null;
  /** Who confirmed it. A person, because an attestation needs one. */
  confirmedBy: string | null;
  /** Answers the operator supplied or corrected at confirmation. */
  operatorAnswers: Record<string, string> | null;
  /** Gates the operator explicitly said they did not know. */
  operatorUnknown: string[] | null;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * Draft a brief from whatever arrived.
 *
 * Deliberately not a model call. The reading of free text and footage is
 * already done upstream by `inbound_qualification` and the footage review; this
 * assembles their output into something an operator can correct, and decides
 * which unanswered gates are worth asking about first.
 *
 * Keeping the assembly deterministic is the point. A model can interpret a
 * submission and suggest a question; whether a site is ready for a capture or a
 * sale follows explicit rules, or nobody can say afterwards why it was.
 */
export function draftBrief(params: {
  requestId: string;
  summary: string;
  captureMode?: string | null;
  /** Gate answers we already hold, with what each one rests on. */
  proposed: readonly ProposedGateAnswer[];
}): SiteTaskBriefRecord {
  const captureMode = isCaptureMode(params.captureMode)
    ? params.captureMode
    : defaultCaptureMode;

  const binding = bindingGates(captureMode);
  const unresolved = unresolvedGates(captureMode, params.proposed);

  return {
    requestId: params.requestId,
    summary: params.summary,
    proposed: params.proposed.filter((answer) =>
      binding.some((field) => field.id === answer.fieldId),
    ),
    unresolved,
    captureMode,
    draftedAtIso: nowIso(),
    draftedFrom: [...new Set(params.proposed.map((answer) => answer.basis))],
    confirmedAtIso: null,
    confirmedBy: null,
    operatorAnswers: null,
    operatorUnknown: null,
  };
}

export async function saveBrief(brief: SiteTaskBriefRecord): Promise<void> {
  if (!db) return;
  await db.collection(TASK_BRIEFS_COLLECTION).doc(brief.requestId).set(brief, { merge: true });
}

export async function getBrief(requestId: string): Promise<SiteTaskBriefRecord | null> {
  if (!db) return null;
  const snapshot = await db.collection(TASK_BRIEFS_COLLECTION).doc(requestId).get();
  return snapshot.exists ? (snapshot.data() as SiteTaskBriefRecord) : null;
}

/**
 * The gates still open, given what is proposed.
 *
 * An assumption is not an answer, so a gate we guessed at is still
 * unresolved. This is the line that stops the brief from filling itself in.
 * Capture-blocking gates come first: those are the ones whose answers change
 * what we would ask them to film, and therefore the only ones worth holding a
 * recording for.
 */
export function unresolvedGates(
  captureMode: CaptureMode,
  proposed: readonly ProposedGateAnswer[],
): string[] {
  const proposedIds = new Set(
    proposed
      .filter((answer) => CONFIRMABLE_BASES.includes(answer.basis))
      .map((answer) => answer.fieldId),
  );
  return bindingGates(captureMode)
    .filter((field) => !proposedIds.has(field.id))
    .sort((a, b) => Number(b.blocks === "capture") - Number(a.blocks === "capture"))
    .map((field) => field.id);
}

/**
 * How much weight each basis carries, for deciding which proposal stands when
 * two bear on the same gate. A measurement outranks what we saw, what we saw
 * outranks what we were told, and a guess outranks nothing.
 */
export const BASIS_RANK: Record<BriefBasis, number> = {
  assumption: 0,
  description: 1,
  observation: 2,
  measurement: 3,
};

/**
 * Fold new proposals into existing ones, one per gate.
 *
 * A stronger basis replaces a weaker one; a weaker one never replaces a
 * stronger one; a tie keeps what is there, so a later reading of the same
 * evidence cannot flip an answer the operator may already be looking at.
 */
export function mergeProposals(
  existing: readonly ProposedGateAnswer[],
  incoming: readonly ProposedGateAnswer[],
): ProposedGateAnswer[] {
  const byField = new Map(existing.map((answer) => [answer.fieldId, answer]));
  for (const answer of incoming) {
    const current = byField.get(answer.fieldId);
    if (!current || BASIS_RANK[answer.basis] > BASIS_RANK[current.basis]) {
      byField.set(answer.fieldId, answer);
    }
  }
  return [...byField.values()];
}

/**
 * Evidence that arrived after the brief was drafted.
 *
 * The brief was drafted once, at submit, from what the operator typed. The
 * model's read of that text and the footage reader's observations both land
 * later, and this is where they land. A brief the operator has confirmed is
 * never touched: their statement stands, and anything new is for the record.
 *
 * Returns the merged brief, or null when there is nothing to merge into.
 */
export async function mergeBriefProposals(params: {
  requestId: string;
  proposals: readonly ProposedGateAnswer[];
}): Promise<SiteTaskBriefRecord | null> {
  if (!db) return null;
  const ref = db.collection(TASK_BRIEFS_COLLECTION).doc(params.requestId);
  let incoming: ProposedGateAnswer[] = [];
  const merged = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const brief = snapshot.data() as SiteTaskBriefRecord;
    if (brief.confirmedAtIso) return null;

    const binding = bindingGates(brief.captureMode);
    incoming = params.proposals.filter((answer) =>
      binding.some((field) => field.id === answer.fieldId),
    );
    const proposed = mergeProposals(brief.proposed, incoming);
    const next: SiteTaskBriefRecord = {
      ...brief,
      proposed,
      unresolved: unresolvedGates(brief.captureMode, proposed),
      draftedFrom: [...new Set([...brief.draftedFrom, ...proposed.map((answer) => answer.basis)])],
    };
    transaction.set(ref, next);
    return next;
  });
  if (!merged) return null;
  logger.info(
    {
      requestId: params.requestId,
      merged: incoming.map((answer) => `${answer.fieldId}:${answer.basis}`),
      unresolved: merged.unresolved,
    },
    "Site task brief updated from later evidence",
  );
  return merged;
}

export interface ConfirmationResult {
  brief: SiteTaskBriefRecord;
  /** The gate answers now on file, all operator-stated. */
  answers: Record<string, string>;
  sources: GateAnswerSources;
  disposition: string;
  readiness: ReadinessVerdict;
}

/**
 * The operator signs off on our reading, and the gates become theirs.
 *
 * ## Why this can replace a questionnaire
 *
 * `gateAnswerSources` distinguishes an answer the operator stated from one we
 * inferred, and only the first can qualify a site. A confirmation is a
 * statement: the operator has read our proposed answer, its basis, and our
 * reasoning, and has either accepted or corrected it. That is a stronger act
 * than picking an option out of a dropdown they were shown cold, and it is why
 * one review can stand in for six questions.
 *
 * ## What it cannot do
 *
 * Confirm an assumption. `draftBrief` never proposes one as confirmable, and
 * this refuses to accept one even if a client sends it back: a gate whose only
 * basis is our own guess has to be answered, and accepting the guess would
 * manufacture an operator statement nobody made.
 *
 * Nor does it decide a disposition. It writes operator-stated answers and then
 * re-runs `triageGateAnswers`, which is the same deterministic scorer the form
 * always used. The verdict is unchanged; what changed is that a site can now
 * reach it.
 */
export async function confirmBrief(params: {
  requestId: string;
  /** A person. An attestation with no one behind it is not one. */
  confirmedBy: string;
  /** Corrections and answers, keyed by gate id. */
  operatorAnswers?: Record<string, string>;
  /** Gates the operator said they do not know. Left blank, recorded, not looped. */
  operatorUnknown?: readonly string[];
}): Promise<ConfirmationResult | null> {
  const brief = await getBrief(params.requestId);
  if (!brief) return null;

  const unknown = new Set(params.operatorUnknown ?? []);
  const supplied = params.operatorAnswers ?? {};
  const answers: Record<string, string> = {};

  // Our proposed answers, except the ones we only assumed. An assumption is a
  // question wearing an answer's clothes, and confirming it back to ourselves
  // would establish nothing while looking like it established everything.
  for (const answer of brief.proposed) {
    if (!CONFIRMABLE_BASES.includes(answer.basis)) continue;
    if (unknown.has(answer.fieldId)) continue;
    answers[answer.fieldId] = answer.value;
  }

  // Then the operator's own words, which win over ours wherever they differ.
  // This is the correction path, and it has to be last.
  for (const [fieldId, value] of Object.entries(supplied)) {
    if (unknown.has(fieldId)) continue;
    if (!value) continue;
    if (!gateFields.some((field) => field.id === fieldId)) continue;
    answers[fieldId] = value;
  }

  // Everything on file is now something the operator stated, either by
  // accepting our reading of their own evidence or by correcting it.
  const sources: Record<string, "operator_stated"> = {};
  for (const fieldId of Object.keys(answers)) {
    sources[fieldId] = "operator_stated";
  }

  const verdict = triageGateAnswers(answers, undefined, brief.captureMode);

  const confirmed: SiteTaskBriefRecord = {
    ...brief,
    confirmedAtIso: nowIso(),
    confirmedBy: params.confirmedBy,
    operatorAnswers: supplied,
    operatorUnknown: [...unknown],
    // Whatever they did not answer stays outstanding, in the same order.
    unresolved: brief.unresolved.filter((fieldId) => !answers[fieldId]),
  };

  if (db) {
    await db
      .collection(TASK_BRIEFS_COLLECTION)
      .doc(params.requestId)
      .set(confirmed, { merge: true });

    await db
      .collection("inboundRequests")
      .doc(params.requestId)
      .set(
        {
          siteTaskGates: answers,
          site_task_gate_sources: sources,
          site_task_triage: {
            disposition: verdict.disposition,
            blocking_field_ids: verdict.blockers.map((blocker) => blocker.fieldId),
            blockers: verdict.blockers.map(
              (blocker) => `${blocker.answer} — ${blocker.detail}`,
            ),
            open_questions: verdict.openQuestions.map(
              (question) => `${question.answer} — ${question.detail}`,
            ),
            open_question_field_ids: verdict.openQuestions.map((question) => question.fieldId),
            unanswered_field_ids: verdict.unanswered,
            incomplete: verdict.incomplete,
            evaluated_at: nowIso(),
          },
          site_task_brief_confirmed_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  }

  const readiness = assessReadiness({
    answers,
    captureMode: brief.captureMode,
    briefDrafted: true,
    briefConfirmed: true,
    // Unknown here. The caller that owns the request record supplies the real
    // values; this reports readiness as of the answers, which is what the
    // operator is being told about at the moment they confirm.
    evidence: { hasAny: true, hasVisual: true, explainsTask: true, coversScene: false },
    reconstructed: false,
  });

  logger.info(
    {
      requestId: params.requestId,
      disposition: verdict.disposition,
      answered: Object.keys(answers).length,
      unknown: [...unknown],
      stage: readiness.stage,
    },
    "Site task brief confirmed by the operator",
  );

  return {
    brief: confirmed,
    answers,
    sources,
    disposition: verdict.disposition,
    readiness,
  };
}

export interface CallOutcomeResult {
  disposition: "qualified" | "needs_conversation" | "not_now";
  answers: Record<string, string>;
  clearedFieldIds: string[];
  blockingFieldIds: string[];
  openQuestionFieldIds: string[];
  unansweredFieldIds: string[];
}

export class CallOutcomeError extends Error {}

/**
 * Records what a screening call settled, and re-screens the site.
 *
 * `needs_conversation` means our screen cannot decide from a form: an answer
 * is marginal, or a gate is still open. The call decides it. What the site
 * said on the call is operator-stated -- we transcribe it -- so answers given
 * here join the confirmed set and the same deterministic scorer runs again.
 *
 * A marginal answer can stay the same and still be settled: "the room mostly
 * stays put" is fine once somebody has asked what "mostly" means. Those go in
 * `clearedFieldIds`. Clearing is only for marginal answers. A blocker has to
 * change its answer, and a blank has to be answered; neither is waved through.
 *
 * When the result is `qualified`, the Pipeline's next retry of the held capture
 * is funded and the scene builds. Nothing else has to be re-sent.
 */
export async function recordSiteTaskCallOutcome(params: {
  requestId: string;
  answers?: Record<string, string>;
  clearedFieldIds?: readonly string[];
  note: string;
  resolvedBy: string;
}): Promise<CallOutcomeResult> {
  if (!db) throw new CallOutcomeError("Database not available");
  const ref = db.collection("inboundRequests").doc(params.requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new CallOutcomeError("Request not found");
  const record = snap.data() as Record<string, any>;
  if (record.request?.buyerType !== "site_operator") {
    throw new CallOutcomeError("Only a site task has a screening call");
  }
  if (!record.site_task_brief_confirmed_at) {
    throw new CallOutcomeError("The site has not confirmed its brief yet");
  }

  const answers = { ...gateAnswersOnFile(record) };
  const sources: Record<string, "operator_stated"> = {};
  for (const [fieldId, value] of Object.entries(params.answers ?? {})) {
    const field = gateFields.find((candidate) => candidate.id === fieldId);
    if (!field || !field.options.some((option) => option.value === value)) {
      throw new CallOutcomeError(`Unknown answer for ${fieldId}`);
    }
    answers[fieldId] = value;
    sources[fieldId] = "operator_stated";
  }

  const captureMode = isCaptureMode(record.request?.capture_mode)
    ? record.request.capture_mode
    : defaultCaptureMode;
  const verdict = triageGateAnswers(answers, undefined, captureMode);
  const cleared = new Set(params.clearedFieldIds ?? []);
  const notMarginal = [...cleared].filter(
    (fieldId) => !verdict.openQuestions.some((question) => question.fieldId === fieldId),
  );
  if (notMarginal.length) {
    throw new CallOutcomeError(
      `Only a marginal answer can be settled on a call: ${notMarginal.join(", ")}`,
    );
  }
  const openQuestions = verdict.openQuestions.filter((question) => !cleared.has(question.fieldId));
  const disposition = verdict.blockers.length
    ? "not_now"
    : openQuestions.length || verdict.unanswered.length
      ? "needs_conversation"
      : "qualified";

  await ref.set(
    {
      siteTaskGates: answers,
      site_task_gate_sources: { ...(record.site_task_gate_sources ?? {}), ...sources },
      site_task_triage: {
        disposition,
        blocking_field_ids: verdict.blockers.map((blocker) => blocker.fieldId),
        blockers: verdict.blockers.map((blocker) => `${blocker.answer} — ${blocker.detail}`),
        open_questions: openQuestions.map((question) => `${question.answer} — ${question.detail}`),
        open_question_field_ids: openQuestions.map((question) => question.fieldId),
        unanswered_field_ids: verdict.unanswered,
        incomplete: verdict.incomplete,
        evaluated_at: nowIso(),
        call_resolution: {
          cleared_field_ids: [...cleared],
          answered_field_ids: Object.keys(sources),
          resolved_by: params.resolvedBy,
          resolved_at: nowIso(),
          note: params.note,
        },
      },
    },
    { merge: true },
  );

  logger.info(
    { requestId: params.requestId, disposition, cleared: [...cleared], answered: Object.keys(sources) },
    "Site screening call outcome recorded",
  );

  // The site hears what the call decided. Still needing a conversation is not
  // news to them -- they were on the call -- so only a decision is emailed.
  if (disposition !== "needs_conversation") {
    const { enqueueTaskLifecycleNotification } = await import("./taskLifecycleNotifications");
    await enqueueTaskLifecycleNotification({
      requestId: params.requestId,
      milestone: disposition === "qualified" ? "screening_cleared" : "screening_not_now",
      eventId: String(Date.now()),
      detail: disposition === "qualified" && !record.account_owner_uid
        ? "once the site is saved to your account (claim it from your task page)"
        : undefined,
    }).catch((error) => logger.warn({ error, requestId: params.requestId }, "Could not queue the call-outcome email"));
  }

  return {
    disposition,
    answers,
    clearedFieldIds: [...cleared],
    blockingFieldIds: verdict.blockers.map((blocker) => blocker.fieldId),
    openQuestionFieldIds: openQuestions.map((question) => question.fieldId),
    unansweredFieldIds: [...verdict.unanswered],
  };
}

export type SelfCaptureSwitchResult =
  | "switched"
  | "already_self_capture"
  | "not_a_site_task"
  | "not_found";

/**
 * A site that asked for someone to come decides to film it itself.
 *
 * A visit is scheduled by hand and bound to where a person can drive, so the
 * site's own phone is nearly always the faster path, and nobody has to find a
 * free afternoon before the site can move. The switch goes one way only:
 * self-capture is the looser mode (the service-area gate stops binding), and
 * going back to a visit commits someone's time, so that stays a conversation.
 *
 * The gates are re-scored by the same deterministic scorer under the new mode,
 * and whatever a screening call already settled stays settled.
 */
export async function switchSiteToSelfCapture(requestId: string): Promise<SelfCaptureSwitchResult> {
  if (!db) throw new Error("Database not available");
  const store = db;
  const requestRef = store.collection("inboundRequests").doc(requestId);
  const briefRef = store.collection(TASK_BRIEFS_COLLECTION).doc(requestId);
  return store.runTransaction(async (tx) => {
    const [snap, briefSnap] = await Promise.all([tx.get(requestRef), tx.get(briefRef)]);
    if (!snap.exists) return "not_found" as const;
    const record = snap.data() as Record<string, any>;
    if (record.request?.buyerType !== "site_operator") return "not_a_site_task" as const;
    if (record.request?.capture_mode === "self_capture") return "already_self_capture" as const;

    const verdict = triageGateAnswers(gateAnswersOnFile(record), undefined, "self_capture");
    const priorCall = record.site_task_triage?.call_resolution;
    const cleared = new Set<string>(priorCall?.cleared_field_ids ?? []);
    const openQuestions = verdict.openQuestions.filter((question) => !cleared.has(question.fieldId));
    const disposition = verdict.blockers.length
      ? "not_now"
      : openQuestions.length || verdict.unanswered.length
        ? "needs_conversation"
        : "qualified";
    const at = nowIso();

    tx.set(
      requestRef,
      {
        request: { capture_mode: "self_capture" },
        capture_mode_switch: { from: "site_visit", to: "self_capture", by: "site_owner_link", at },
        site_task_triage: {
          disposition,
          blocking_field_ids: verdict.blockers.map((blocker) => blocker.fieldId),
          blockers: verdict.blockers.map((blocker) => `${blocker.answer} — ${blocker.detail}`),
          open_questions: openQuestions.map((question) => `${question.answer} — ${question.detail}`),
          open_question_field_ids: openQuestions.map((question) => question.fieldId),
          unanswered_field_ids: verdict.unanswered,
          incomplete: verdict.incomplete,
          evaluated_at: at,
          ...(priorCall ? { call_resolution: priorCall } : {}),
        },
      },
      { merge: true },
    );
    if (briefSnap.exists) {
      const brief = briefSnap.data() as SiteTaskBriefRecord;
      const binding = new Set(bindingGates("self_capture").map((field) => field.id));
      tx.set(
        briefRef,
        {
          captureMode: "self_capture",
          unresolved: (brief.unresolved ?? []).filter((fieldId) => binding.has(fieldId)),
        },
        { merge: true },
      );
    }
    logger.info({ requestId, disposition }, "Site switched from a visit to filming it themselves");
    return "switched" as const;
  });
}
