import { humanDecisionDigest } from "./human-reply-admission";
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
import type { SitePilotIntent } from "../../client/src/data/sitePilotIntent";
import { gateAnswersOnFile } from "./gateAnswersOnFile";
import { screenTaskScope, taskScopeRecord, type SiteTaskScope } from "./siteTaskScope";
import { confirmFamilyTaskAnswer, familyTaskCaptureFingerprint, familyTaskContextBasis,
  familyTaskQuestionBinding, familyTaskFactsEnabled, type FamilyTaskAnswer, type FamilyTaskBriefState } from "./siteTaskFamilyFacts";
import { projectWebsiteTaskContext, projectWebsiteCaptureRights } from "./websiteTaskContext";
import type { TaskItemInventoryRecord } from "./taskItemInventory";

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
  confidence?: number;
  atSeconds?: number;
  sourceQuote?: string;
}

export interface SiteTaskBriefRecord extends FamilyTaskBriefState {
  requestId: string;
  /** One line: what we think the job is. */
  summary: string;
  /** Native preparation hint; general_task keeps unresolved tasks out of narrower scorers. */
  taskFamily?: "rigid_pick_and_place" | "articulated_open_close" | "general_task";
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
  /** Optional item details the owner supplied after uploading. */
  operatorTaskDetails?: { item_weight?: string; item_make_model?: string } | null;
  successCriteria?: { successDefinition: string | null; successRate: number | null; cycleTimeSeconds: number | null; unknown: boolean } | null;
  pilotIntent?: SitePilotIntent | null;
}

function nowIso() {
  return new Date().toISOString();
}

/**
 * The summary a brief starts with when the site sent footage and no
 * description (`inbound-request.ts`). It says nothing about the job, so it is
 * never screened or confirmed as the job. The existing footage reading drafts
 * the description when it arrives; the site can correct that reading.
 */
export const PLACEHOLDER_TASK_SUMMARY = "Your site task";

/** A summary that does not describe a job yet. */
export function isPlaceholderSummary(summary: string | null | undefined): boolean {
  const text = (summary ?? "").trim();
  return !text || text === PLACEHOLDER_TASK_SUMMARY;
}

/** A confirmation of a brief whose summary still describes no job (audit N3). */
export class BriefSummaryRequiredError extends Error {
  constructor() {
    super("brief_summary_required");
  }
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
    taskFamily: screenTaskScope({ summary: params.summary }).kind ?? "general_task",
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
    successCriteria: null,
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
      .filter((answer) => answer.basis !== "observation")
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
    // A matching clip observation must not replace an already supplied job fact.
    // Contradictions still follow the existing evidence/review path.
    if (current?.value === answer.value) {
      if (answer.basis === "observation" && ["description", "measurement"].includes(current.basis)) continue;
      if (current.basis === "observation" && answer.basis === "description") { byField.set(answer.fieldId, answer); continue; }
    }
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
  /** Reuse the footage reader's description only while the task is unnamed. */
  observedSummary?: string;
  source?: { capture_id: string; evidence_digest: string; brief_digest: string };
}): Promise<SiteTaskBriefRecord | null> {
  if (!db) return null;
  const ref = db.collection(TASK_BRIEFS_COLLECTION).doc(params.requestId);
  let incoming: ProposedGateAnswer[] = [];
  const merged = await db.runTransaction(async (transaction) => {
    const requestRef = db!.collection("inboundRequests").doc(params.requestId);
    const [snapshot, requestSnapshot] = await Promise.all([transaction.get(ref), transaction.get(requestRef)]);
    if (!snapshot.exists) return null;
    const brief = snapshot.data() as SiteTaskBriefRecord;
    const sourceNote = params.source ? {
      ref: ref.collection("footageProposals").doc(humanDecisionDigest(params.source)),
      value: { source: params.source, proposals: params.proposals,
        ...(params.observedSummary ? { observedSummary: params.observedSummary } : {}),
        state: brief.confirmedAtIso ? "owner_review_required" : humanDecisionDigest(brief) !== params.source.brief_digest ? "stale_revision" : "proposed" },
    } : null;
    if (sourceNote && (brief.confirmedAtIso || humanDecisionDigest(brief) !== params.source!.brief_digest)) {
      transaction.set(sourceNote.ref, sourceNote.value);
      return null;
    }
    if (brief.confirmedAtIso) return null;

    const binding = bindingGates(brief.captureMode);
    incoming = params.proposals.filter((answer) =>
      binding.some((field) => field.id === answer.fieldId),
    );
    const proposed = mergeProposals(brief.proposed, incoming);
    const next: SiteTaskBriefRecord = {
      ...brief,
      ...(isPlaceholderSummary(brief.summary) && params.observedSummary?.trim()
        ? { summary: params.observedSummary.trim().slice(0, 2000) } : {}),
      proposed,
      unresolved: unresolvedGates(brief.captureMode, proposed),
      draftedFrom: [...new Set([...brief.draftedFrom, ...proposed.map((answer) => answer.basis)])],
    };
    next.taskFamily = screenTaskScope({ summary: next.summary, successDefinition: next.successCriteria?.successDefinition }).kind ?? "general_task";
    const refresh = requestSnapshot.data()?.site_advisory
      ? await (await import("./siteAssessmentQueue")).prepareBriefContextSiteAssessment(
        transaction, params.requestId, requestSnapshot.data()!, next) : null;
    if (sourceNote) transaction.set(sourceNote.ref, sourceNote.value);
    transaction.set(ref, next);
    const factDigest = (rows: readonly ProposedGateAnswer[]) => humanDecisionDigest(rows.map(({ fieldId, value, basis }) => ({ fieldId, value, basis })).sort((a, b) => a.fieldId.localeCompare(b.fieldId)));
    const changedFacts = brief.summary !== next.summary || factDigest(brief.proposed) !== factDigest(proposed);
    transaction.set(requestRef, { capture_coverage_pending: true,
      ...(changedFacts && requestSnapshot.data()?.pilot_recommendation ? {
        pilot_recommendation: { ...requestSnapshot.data()!.pilot_recommendation, reviewRequired: true },
      } : {}),
    }, { merge: true });
    refresh?.();
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
  /** Whether we can score this kind of job in simulation today, as recorded on the job. */
  scope: SiteTaskScope;
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
export class BriefPilotScopeLockedError extends Error {}

export async function confirmBrief(params: {
  requestId: string;
  /** A person. An attestation with no one behind it is not one. */
  confirmedBy: string;
  /** Corrections and answers, keyed by gate id. */
  operatorAnswers?: Record<string, string>;
  /** Gates the operator said they do not know. Left blank, recorded, not looped. */
  operatorUnknown?: readonly string[];
  successCriteria?: { successDefinition: string | null; successRate: number | null; cycleTimeSeconds: number | null; unknown: boolean };
  pilotIntent?: SitePilotIntent;
  /** The job in the site's own sentence, replacing the drafted summary. Required while that is a placeholder. */
  summary?: string;
  familyTaskFacts?: FamilyTaskAnswer;
}): Promise<ConfirmationResult | null> {
  const brief = await getBrief(params.requestId);
  if (!brief) return null;
  // The summary is what the job is screened and prepared as. A placeholder
  // describes nothing, so it is asked for rather than screened as out of scope.
  const summary = params.summary?.trim() || brief.summary;
  if (isPlaceholderSummary(summary)) throw new BriefSummaryRequiredError();

  const unknown = new Set(params.operatorUnknown ?? brief.operatorUnknown ?? []);
  const supplied = { ...brief.operatorAnswers, ...params.operatorAnswers };
  const previousRequest = db
    ? (await db.collection("inboundRequests").doc(params.requestId).get()).data() : null;
  if (params.familyTaskFacts) {
    const retained = brief.familyTaskAuthoring;
    const currentSource = retained ? await (await import("./websitePreparationStatus"))
      .loadCurrentFamilyTaskAuthoring(params.requestId, retained.status.capture_id) : null;
    if (!currentSource || currentSource.projection_digest !== retained?.status.projection_digest)
      throw new Error("family_task_facts_source_changed");
  }
  const answers: Record<string, string> = { ...gateAnswersOnFile(previousRequest ?? {}) };
  for (const fieldId of unknown) delete answers[fieldId];

  // Our proposed answers, except the ones we only assumed. An assumption is a
  // question wearing an answer's clothes, and confirming it back to ourselves
  // would establish nothing while looking like it established everything.
  for (const answer of brief.proposed) {
    if (!CONFIRMABLE_BASES.includes(answer.basis)) continue;
    // A clip supports observations, not shift variability, the full item
    // distribution, required throughput or the site's business decisions.
    if (answer.basis === "observation") continue;
    if (unknown.has(answer.fieldId) || answers[answer.fieldId]) continue;
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
    summary,
    confirmedAtIso: nowIso(),
    confirmedBy: params.confirmedBy,
    operatorAnswers: answers,
    operatorUnknown: [...unknown],
    successCriteria: params.successCriteria ?? brief.successCriteria ?? null,
    pilotIntent: params.pilotIntent ?? brief.pilotIntent ?? null,
    // Whatever they did not answer stays outstanding, in the same order.
    unresolved: brief.unresolved.filter((fieldId) => !answers[fieldId]),
  };

  // The kind of job, screened against what the simulation can score. Separate
  // from the gate verdict: a qualified site can still have a job we cannot
  // score, and that job is not opened to robot teams (`teamJobAccess`).
  const scope = taskScopeRecord(screenTaskScope({
    summary: confirmed.summary,
    successDefinition: confirmed.successCriteria?.successDefinition ?? null,
  }), nowIso());

  confirmed.taskFamily = scope.kind ?? "general_task";

  // Repeating the same factual confirmation must not change its source context
  // through a fresh timestamp alone. An actual edit or new fact keeps its new
  // confirmation time and the ordinary exact-context/funding reconciliation.
  if (familyTaskFactsEnabled() && !params.familyTaskFacts && brief.familyTaskFacts && brief.confirmedAtIso
    && humanDecisionDigest({ ...brief, confirmedAtIso: confirmed.confirmedAtIso, confirmedBy: confirmed.confirmedBy })
      === humanDecisionDigest(confirmed)) confirmed.confirmedAtIso = brief.confirmedAtIso;

  // Confirmation attests to answers, not to footage we have never received.
  const evidence = { hasAny: true, hasVisual: false, explainsTask: true,
    coversScene: false, missingCoverage: undefined as string[] | undefined };

  if (db) {
    await db.runTransaction(async tx => {
      const briefRef = db!.collection(TASK_BRIEFS_COLLECTION).doc(params.requestId);
      const current = await tx.get(briefRef);
      const requestRef = db!.collection("inboundRequests").doc(params.requestId);
      const requestSnapshot = await tx.get(requestRef);
      const requestedScope = { summary, answers, unknown: [...unknown].sort(), success: confirmed.successCriteria ?? null, pilotIntent: confirmed.pilotIntent ?? null };
      const priorScope = { summary: brief.summary, answers: brief.operatorAnswers ?? {}, unknown: [...(brief.operatorUnknown ?? [])].sort(), success: brief.successCriteria ?? null, pilotIntent: brief.pilotIntent ?? null };
      if (requestSnapshot.data()?.job_marketplace?.agreement && params.familyTaskFacts)
        throw new BriefPilotScopeLockedError("A pilot agreement is recorded. Agree scope changes with Blueprint and the delivery partner before changing this brief.");
      if (requestSnapshot.data()?.job_marketplace?.agreement && humanDecisionDigest(requestedScope) !== humanDecisionDigest(priorScope)) {
        throw new BriefPilotScopeLockedError("A pilot agreement is recorded. Agree scope changes with Blueprint and the delivery partner before changing this brief.");
      }
      if (requestSnapshot.data()?.job_marketplace?.agreement) {
        confirmed.confirmedAtIso = brief.confirmedAtIso;
        confirmed.confirmedBy = brief.confirmedBy;
      }
      const coverage = requestSnapshot.data()?.capture_coverage;
      evidence.hasVisual = Boolean(coverage);
      evidence.coversScene = coverage?.covers_scene ?? false;
      evidence.missingCoverage = coverage?.missing_coverage;
      if (humanDecisionDigest(current.data()) !== humanDecisionDigest(brief)) throw new Error("brief_changed_before_confirmation");
      if (previousRequest && humanDecisionDigest(gateAnswersOnFile(requestSnapshot.data() ?? {})) !== humanDecisionDigest(gateAnswersOnFile(previousRequest)))
        throw new Error("brief_answers_changed_before_confirmation");
      let factVersion: { ref: FirebaseFirestore.DocumentReference; value: NonNullable<SiteTaskBriefRecord["familyTaskFacts"]> } | null = null;
      if (params.familyTaskFacts) {
        const source = brief.familyTaskAuthoring;
        if (!source || requestSnapshot.data()?.active_capture_id
          && requestSnapshot.data()!.active_capture_id !== source.status.capture_id)
          throw new Error("family_task_facts_source_changed");
        const session = (await tx.get(db!.collection("captureUploadSessions").doc(source.status.capture_id))).data();
        const items = (await tx.get(db!.collection("siteTaskItemInventories").doc(params.requestId))).data() as TaskItemInventoryRecord | undefined;
        const rights = projectWebsiteCaptureRights(requestSnapshot.data());
        if (!session || !rights.derived_scene_generation_allowed || session.capture_access?.future_processing_allowed === false
          || session.completed_capture_lifecycle || ["revoked", "revocation_in_progress", "cancelled"].includes(session.status)
          || familyTaskCaptureFingerprint(session) !== source.sourceFingerprint)
          throw new Error("family_task_facts_source_changed");
        const evidence = { inventory: items, captureId: source.status.capture_id,
          ...(requestSnapshot.data()?.website_scene_sponsorship?.purpose === "scene_preparation"
            ? { purpose: "scene_preparation" as const } : {}) };
        const previousContext = projectWebsiteTaskContext(brief, rights, evidence);
        if (previousContext.context_digest !== source.status.task_context_digest)
          throw new Error("family_task_facts_source_changed");
        const context = familyTaskContextBasis(projectWebsiteTaskContext({ ...confirmed, familyTaskFacts: null }, rights, evidence));
        confirmed.familyTaskFacts = confirmFamilyTaskAnswer(brief, params.familyTaskFacts, context, params.confirmedBy,
          familyTaskContextBasis(previousContext));
        confirmed.familyTaskDeferred = params.familyTaskFacts.answer === null
          ? { authoringDigest: params.familyTaskFacts.authoringDigest,
            ...("requirementId" in params.familyTaskFacts ? {requirementId: params.familyTaskFacts.requirementId}
              : {operationId: params.familyTaskFacts.operationId, field: params.familyTaskFacts.field}),
            bindingDigest: familyTaskQuestionBinding(source) } : null;
        if (confirmed.familyTaskFacts) {
          const ref = briefRef.collection("familyTaskFacts").doc(confirmed.familyTaskFacts.confirmation_digest.slice(7));
          const priorVersion = (await tx.get(ref)).data();
          if (priorVersion && humanDecisionDigest(priorVersion) !== humanDecisionDigest(confirmed.familyTaskFacts))
            throw new Error("family_task_facts_version_conflict");
          if (!priorVersion) factVersion = { ref, value: confirmed.familyTaskFacts };
        }
      }
      const materialChange = humanDecisionDigest({ summary: brief.summary, taskFamily: brief.taskFamily ?? null, answers: gateAnswersOnFile(previousRequest ?? {}),
        unknown: [...(brief.operatorUnknown ?? [])].sort(), success: brief.successCriteria ?? null,
        familyFacts: brief.familyTaskFacts?.confirmation_digest ?? null }) !== humanDecisionDigest({ summary: confirmed.summary, taskFamily: confirmed.taskFamily ?? null, answers,
        unknown: [...unknown].sort(), success: confirmed.successCriteria ?? null, familyFacts: confirmed.familyTaskFacts?.confirmation_digest ?? null });
      const nextRecord = { ...requestSnapshot.data(), siteTaskGates: answers };
      const refresh = requestSnapshot.data()?.site_advisory
        ? await (await import("./siteAssessmentQueue")).prepareBriefContextSiteAssessment(
          tx, params.requestId, nextRecord, confirmed) : null;
      tx.set(briefRef, confirmed, { merge: true });
      tx.set(requestRef,
        {
          ...(requestSnapshot.data()?.capture_coverage_request ? { capture_coverage_pending: true } : {}),
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
          site_task_scope: scope,
          ...(materialChange && requestSnapshot.data()?.public_task_listing
            && ["cycleTarget", "pilotConditions", "targeting"].some(field => Boolean(requestSnapshot.data()!.public_task_listing.details?.[field])) ? {
            public_task_listing: { ...requestSnapshot.data()!.public_task_listing, enabled: false, reviewRequired: true },
          } : {}),
          ...(materialChange && requestSnapshot.data()?.pilot_recommendation ? {
            pilot_recommendation: { ...requestSnapshot.data()!.pilot_recommendation, reviewRequired: true },
          } : {}),
          ...(params.successCriteria || params.pilotIntent ? {
            workspace_task: {
              ...(params.successCriteria ? { terms: {
                successDefinition: params.successCriteria.successDefinition ?? "",
                successRate: params.successCriteria.successRate,
                cycleTimeSeconds: params.successCriteria.cycleTimeSeconds,
              } } : {}),
              ...(params.pilotIntent ? { pilotIntent: params.pilotIntent } : {}),
            },
          } : {}),
        },
        { merge: true },
      );
      refresh?.();
      if (factVersion) tx.set(factVersion.ref, factVersion.value);
    });
  }

  const readiness = assessReadiness({
    answers,
    captureMode: brief.captureMode,
    briefDrafted: true,
    briefConfirmed: true,
    evidence,
    reconstructed: false,
  });

  logger.info(
    {
      requestId: params.requestId,
      disposition: verdict.disposition,
      answered: Object.keys(answers).length,
      unknown: [...unknown],
      stage: readiness.stage,
      taskScope: scope.supported ? scope.kind : `not_supported:${scope.reason}`,
    },
    "Site task brief confirmed by the operator",
  );

  return {
    brief: confirmed,
    answers,
    sources,
    disposition: verdict.disposition,
    readiness,
    scope,
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
  clarificationId?: string;
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

  const clarification = params.clarificationId
    ? await (await import("./siteTaskClarifications")).loadSiteClarificationContext(params.requestId) : null;
  await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    const brief = params.clarificationId ? (await tx.get(db!.collection(TASK_BRIEFS_COLLECTION).doc(params.requestId))).data() : null;
    if (humanDecisionDigest(current) !== humanDecisionDigest(record)) throw new CallOutcomeError("The submission changed. Reload before recording the outcome.");
    if (params.clarificationId) {
      const { clarificationRevision, assertClarificationPacketCurrent } = await import("./siteTaskClarifications");
      if (current?.site_task_clarification?.id !== params.clarificationId
        || current.site_task_clarification.state !== "review_required"
        || current.site_task_clarification.revision !== clarificationRevision(brief, current, clarification?.advisoryBasis)) {
        throw new CallOutcomeError("The written clarification no longer matches this brief.");
      }
      await assertClarificationPacketCurrent(tx, current, clarification?.advisoryBasis, brief ?? null);
    }
    tx.set(ref,
    {
      ...(params.clarificationId ? { site_task_clarification: { state: "reviewed", resolved_by: params.resolvedBy,
        resolved_at: nowIso(), disposition }, } : {}),
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
          channel: params.clarificationId ? "written_clarification" : "call",
          clarification_id: params.clarificationId || null,
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
  });

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
        ? "once the site is saved to your account (claim it from your job page)"
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
