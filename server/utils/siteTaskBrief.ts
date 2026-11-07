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
import { TASK_CONFIRMATION_VERSION } from "../../client/src/lib/taskConfirmationStatement";
import { gateAnswersOnFile } from "./gateAnswersOnFile";
import { screenTaskScope, taskScopeRecord, type SiteTaskScope } from "./siteTaskScope";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "./websiteTaskContext";
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

/** What the site says counts as a successful cycle. */
export type SiteTaskSuccessCriteria = {
  successDefinition: string | null; successRate: number | null; cycleTimeSeconds: number | null; unknown: boolean;
};

export interface SiteTaskBriefRecord {
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
  successCriteria?: SiteTaskSuccessCriteria | null;
  pilotIntent?: SitePilotIntent | null;
  /**
   * The consent the site gave when it submitted this task: the statement it
   * ticked and when (owner decision 2026-11-07, "Confirm at upload"). Present
   * only on briefs confirmed at submission; it stays as the record of that act
   * after a later edit or confirmation. Older briefs never carry it.
   */
  submissionConsent?: { statementVersion: string; recordedAtIso: string };
  /** The last change to the task made without a confirmation in the same act. */
  lastTaskEdit?: { atIso: string; by: string; clearedConfirmedAtIso: string | null };
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

/**
 * The brief a site confirms by submitting it (owner decision 2026-11-07,
 * "Confirm at upload").
 *
 * Consent means the customer agreed to this exact task, and it is captured once:
 * the description they typed, the success criteria they gave (if any) and the
 * one box they ticked. Their words are the summary, the submission time is the
 * confirmation time, and the submitter is the identity the intake route binds to
 * the job. Nothing here is inferred, and nothing confirms without the box.
 *
 * Returns null when there is no consent to record: the box was not ticked (or
 * not on the current statement), there is no description to consent to, or
 * there is no submitter. That submission keeps the draft-then-confirm flow, so
 * its brief still needs the site's own click.
 */
export function briefConfirmedAtSubmission(params: {
  requestId: string;
  /** The task in the site's own words. */
  summary: string;
  captureMode?: string | null;
  /** The box, exactly as the client reported it. */
  consent: unknown;
  /** Gate answers the site stated on the form. */
  statedAnswers: Record<string, string>;
  successCriteria: SiteTaskSuccessCriteria | null;
  /** The submitter, as the intake route identifies it. Never a made-up value. */
  confirmedBy: string;
  submittedAtIso: string;
}): SiteTaskBriefRecord | null {
  const consent = params.consent as { granted?: unknown; statementVersion?: unknown } | null | undefined;
  if (!consent || typeof consent !== "object" || consent.granted !== true
    || consent.statementVersion !== TASK_CONFIRMATION_VERSION) return null;
  const summary = params.summary.trim();
  if (isPlaceholderSummary(summary) || !params.confirmedBy.trim()
    || !Number.isFinite(Date.parse(params.submittedAtIso))) return null;
  const answers = Object.fromEntries(Object.entries(params.statedAnswers)
    .filter(([fieldId, value]) => Boolean(value) && gateFields.some((field) => field.id === fieldId)));
  const draft = draftBrief({
    requestId: params.requestId,
    summary,
    captureMode: params.captureMode,
    proposed: Object.entries(answers).map(([fieldId, value]) => ({
      fieldId, value, basis: "description" as const, reading: "From what you told us at intake.",
    })),
  });
  return {
    ...draft,
    taskFamily: screenTaskScope({ summary, successDefinition: params.successCriteria?.successDefinition }).kind ?? "general_task",
    draftedAtIso: params.submittedAtIso,
    confirmedAtIso: params.submittedAtIso,
    confirmedBy: params.confirmedBy,
    operatorAnswers: answers,
    operatorUnknown: [],
    successCriteria: params.successCriteria,
    unresolved: draft.unresolved.filter((fieldId) => !answers[fieldId]),
    submissionConsent: { statementVersion: TASK_CONFIRMATION_VERSION, recordedAtIso: params.submittedAtIso },
  };
}

/**
 * What a confirmed brief writes onto its job, from one place.
 *
 * Both confirmations call this: the site's click on the review (`confirmBrief`)
 * and the site's submission itself (owner decision 2026-11-07, "Confirm at
 * upload"), so the two cannot drift. It writes the gate answers as the site's
 * own, screens them with the same deterministic scorer, records the task scope
 * and mirrors the confirmation and any success terms onto the job.
 *
 * Under the 2026-11-07 rule (a brief that carries `submissionConsent`), a gate
 * the site left unanswered or said it does not know is a disclosed unknown,
 * recorded as `disclosed_unknown_field_ids` and carried with the job, never a
 * stop: only privacy, rights and money stop a job. A stated answer that blocks
 * (`not_now`) or needs settling (`needs_conversation`) still does. An older
 * brief is screened exactly as before and records no disclosed unknowns.
 */
export function projectConfirmationOntoJob(params: {
  /** The brief as confirmed. */
  brief: Pick<SiteTaskBriefRecord, "summary" | "captureMode" | "successCriteria" | "submissionConsent">;
  /** Every gate answer on file, now the site's own. */
  answers: Record<string, string>;
  /** The value stored as `site_task_brief_confirmed_at`. */
  confirmedAt: unknown;
  atIso: string;
  /** Terms the site supplied in this act, mirrored where the workspace reads them. */
  workspace?: { successCriteria?: SiteTaskSuccessCriteria | null; pilotIntent?: SitePilotIntent | null };
}) {
  const verdict = triageGateAnswers(params.answers, undefined, params.brief.captureMode);
  const disclose = Boolean(params.brief.submissionConsent);
  const disclosedUnknown = disclose ? [...verdict.unanswered] : [];
  const disposition: "qualified" | "needs_conversation" | "not_now" = verdict.blockers.length ? "not_now"
    : verdict.openQuestions.length || (verdict.incomplete && !disclose) ? "needs_conversation" : "qualified";
  const sources: Record<string, "operator_stated"> = Object.fromEntries(
    Object.keys(params.answers).map((fieldId) => [fieldId, "operator_stated" as const]));
  // The kind of job, screened against what the simulation can score. A display
  // and demand hint, separate from the gate verdict.
  const scope = taskScopeRecord(screenTaskScope({
    summary: params.brief.summary,
    successDefinition: params.brief.successCriteria?.successDefinition ?? null,
  }), params.atIso);
  const success = params.workspace?.successCriteria ?? null;
  const pilotIntent = params.workspace?.pilotIntent ?? null;
  const jobFields: Record<string, unknown> = {
    siteTaskGates: params.answers,
    site_task_gate_sources: sources,
    site_task_triage: {
      disposition,
      blocking_field_ids: verdict.blockers.map((blocker) => blocker.fieldId),
      blockers: verdict.blockers.map((blocker) => `${blocker.answer} — ${blocker.detail}`),
      open_questions: verdict.openQuestions.map((question) => `${question.answer} — ${question.detail}`),
      open_question_field_ids: verdict.openQuestions.map((question) => question.fieldId),
      unanswered_field_ids: verdict.unanswered,
      incomplete: verdict.incomplete,
      evaluated_at: params.atIso,
      ...(disclose ? { disclosed_unknown_field_ids: disclosedUnknown } : {}),
    },
    site_task_brief_confirmed_at: params.confirmedAt,
    site_task_scope: scope,
    ...(success || pilotIntent ? {
      workspace_task: {
        ...(success ? { terms: {
          successDefinition: success.successDefinition ?? "",
          successRate: success.successRate,
          cycleTimeSeconds: success.cycleTimeSeconds,
        } } : {}),
        ...(pilotIntent ? { pilotIntent } : {}),
      },
    } : {}),
  };
  return { disposition, verdict, disclosedUnknown, sources, scope, jobFields };
}

/** Whether the brief's current confirmation is the one the site gave on submitting it. */
export function confirmedAtSubmission(brief: Pick<SiteTaskBriefRecord, "confirmedAtIso" | "submissionConsent">): boolean {
  return Boolean(brief.confirmedAtIso && brief.submissionConsent?.recordedAtIso === brief.confirmedAtIso);
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
/**
 * Name the job of a brief that still describes none.
 *
 * Owner decision 2026-10-29: a site that only uploads a video gets its job drafted
 * from the footage, and writes one line only when the footage shows no task. This
 * fills the placeholder alone; a named job or a confirmed brief is corrected through
 * the confirmation flow, never here.
 */
export async function nameUnnamedTask(params: { requestId: string; summary: string }): Promise<SiteTaskBriefRecord | null> {
  const summary = params.summary.trim().slice(0, 300);
  if (isPlaceholderSummary(summary)) return null;
  const brief = await getBrief(params.requestId);
  if (!brief || brief.confirmedAtIso || !isPlaceholderSummary(brief.summary)) return null;
  const named = await mergeBriefProposals({ requestId: params.requestId, proposals: [], observedSummary: summary });
  return named?.summary === summary ? named : null;
}

/**
 * Whether folding later evidence into this brief would move the task a live
 * scene grant was issued for.
 *
 * A grant is bound to the task context it was issued for. When that context
 * moves, the grant no longer verifies and the intake worker ends the job's
 * Pipeline intent. capture-447ae4f4 (2026-11-02): a description reading that
 * ran three days late closed one open site question on a paid job's
 * unconfirmed brief, and the intent was revoked 30 s later. A model's reading
 * is not the site's word and is no reason to stop a job, so it waits for the
 * site's own review instead, as it does on a confirmed brief. A grant that
 * follows the brief (issued before the site named its job) still follows it.
 */
async function movesGrantedTask(transaction: FirebaseFirestore.Transaction, requestId: string,
  record: Record<string, any>, grant: Record<string, any>, brief: SiteTaskBriefRecord, next: SiteTaskBriefRecord) {
  const inventorySnapshot = await transaction.get(db!.collection("siteTaskItemInventories").doc(requestId));
  const inventory = inventorySnapshot.exists ? inventorySnapshot.data() as TaskItemInventoryRecord : null;
  const rights = projectWebsiteCaptureRights(record);
  const purpose = grant.purpose === "scene_preparation" ? "scene_preparation" as const : undefined;
  const sealed = purpose ? grant.task_context_digest : undefined;
  const context = (value: SiteTaskBriefRecord) => projectWebsiteTaskContext(value, rights, { inventory, purpose,
    preparationGrantContextDigest: sealed }).context_digest;
  if (context(brief) === context(next)) return false;
  // preparationGrantTask imports this module; load it when it is needed.
  const { preparationGrantFollowsBrief } = await import("./preparationGrantTask");
  return !preparationGrantFollowsBrief(grant, { brief: next, record, inventory });
}

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
  let heldForGrant = false;
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
    const grant = requestSnapshot.data()?.website_scene_sponsorship;
    if (grant && await movesGrantedTask(transaction, params.requestId, requestSnapshot.data()!, grant, brief, next)) {
      if (sourceNote) transaction.set(sourceNote.ref, { ...sourceNote.value, state: "grant_review_required" });
      heldForGrant = true;
      return null;
    }
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
  if (heldForGrant) logger.info({ requestId: params.requestId,
    held: incoming.map((answer) => `${answer.fieldId}:${answer.basis}`) },
  "Later evidence held: the brief is bound to a live scene grant");
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

/**
 * Change the task itself (its summary or success criteria) without a
 * confirmation in the same act.
 *
 * Owner decision 2026-11-07: consent is to this exact task, so a change to it,
 * by the site or by an operator, clears the confirmation until the site
 * confirms again (`confirmBrief`, its one click). A change that leaves the task
 * as it was keeps the confirmation. This never confirms anything. Inferences
 * (gate readings, footage observations, task kind) do not come through here:
 * they are disclosed proposals and never un-confirm a brief.
 *
 * Returns null when there is no brief.
 */
export async function reviseBriefTask(params: {
  requestId: string;
  summary?: string;
  successCriteria?: SiteTaskSuccessCriteria;
  /** Who made the change. Recorded, never treated as a confirmation. */
  revisedBy: string;
}): Promise<{ brief: SiteTaskBriefRecord; reconfirmationRequired: boolean } | null> {
  if (!db) return null;
  const store = db;
  const briefRef = store.collection(TASK_BRIEFS_COLLECTION).doc(params.requestId);
  const requestRef = store.collection("inboundRequests").doc(params.requestId);
  return store.runTransaction(async (transaction) => {
    const [snapshot, requestSnapshot] = await Promise.all([transaction.get(briefRef), transaction.get(requestRef)]);
    if (!snapshot.exists) return null;
    const brief = snapshot.data() as SiteTaskBriefRecord;
    const summary = params.summary?.trim() ? params.summary.trim().slice(0, 2000) : brief.summary;
    const successCriteria = params.successCriteria ?? brief.successCriteria ?? null;
    const task = (value: { summary: string; successCriteria?: SiteTaskSuccessCriteria | null }) =>
      humanDecisionDigest({ summary: value.summary, success: value.successCriteria ?? null });
    if (task({ summary, successCriteria }) === task(brief)) return { brief, reconfirmationRequired: false };
    const atIso = nowIso();
    const next: SiteTaskBriefRecord = {
      ...brief,
      summary,
      successCriteria,
      taskFamily: screenTaskScope({ summary, successDefinition: successCriteria?.successDefinition }).kind ?? "general_task",
      confirmedAtIso: null,
      confirmedBy: null,
      lastTaskEdit: { atIso, by: params.revisedBy, clearedConfirmedAtIso: brief.confirmedAtIso ?? null },
    };
    transaction.set(briefRef, next);
    if (requestSnapshot.exists && requestSnapshot.data()?.site_task_brief_confirmed_at) {
      transaction.set(requestRef, { site_task_brief_confirmed_at: admin.firestore.FieldValue.delete() }, { merge: true });
    }
    logger.info({ requestId: params.requestId, revisedBy: params.revisedBy, wasConfirmed: Boolean(brief.confirmedAtIso) },
      "Site task changed; it needs the site's confirmation again");
    return { brief: next, reconfirmationRequired: Boolean(brief.confirmedAtIso) };
  });
}

export interface ConfirmationResult {
  brief: SiteTaskBriefRecord;
  /** No new attestation or work was created for this already-confirmed scope. */
  reusedConfirmation?: boolean;
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

  // Everything on file is now something the operator stated, either by
  // accepting our reading of their own evidence or by correcting it. The same
  // projection records a confirmation given at submission (2026-11-07).
  const projection = projectConfirmationOntoJob({
    brief: confirmed,
    answers,
    confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
    atIso: nowIso(),
    workspace: { successCriteria: params.successCriteria, pilotIntent: params.pilotIntent },
  });
  const { sources, scope } = projection;

  confirmed.taskFamily = scope.kind ?? "general_task";

  const requestedScope = { summary, answers, unknown: [...unknown].sort(), success: confirmed.successCriteria ?? null, pilotIntent: confirmed.pilotIntent ?? null };
  const priorScope = { summary: brief.summary, answers: brief.operatorAnswers ?? {}, unknown: [...(brief.operatorUnknown ?? [])].sort(), success: brief.successCriteria ?? null, pilotIntent: brief.pilotIntent ?? null };
  const sameScope = humanDecisionDigest(requestedScope) === humanDecisionDigest(priorScope);
  const reuseConfirmation = Boolean(brief.confirmedAtIso) && sameScope;
  if (reuseConfirmation) {
    // An unchanged click is not new task evidence. Keep its original
    // attestation and legacy projection, including unknown-field ordering.
    confirmed.confirmedAtIso = brief.confirmedAtIso;
    confirmed.confirmedBy = brief.confirmedBy;
    confirmed.operatorUnknown = brief.operatorUnknown;
    confirmed.unresolved = brief.unresolved;
    if (brief.taskFamily === undefined) delete confirmed.taskFamily;
    else confirmed.taskFamily = brief.taskFamily;
  }

  // Confirmation attests to answers, not to footage we have never received.
  const evidence = { hasAny: true, hasVisual: false, explainsTask: true,
    coversScene: false, missingCoverage: undefined as string[] | undefined };

  if (db) {
    await db.runTransaction(async tx => {
      const briefRef = db!.collection(TASK_BRIEFS_COLLECTION).doc(params.requestId);
      const current = await tx.get(briefRef);
      const requestRef = db!.collection("inboundRequests").doc(params.requestId);
      const requestSnapshot = await tx.get(requestRef);
      if (requestSnapshot.data()?.job_marketplace?.agreement && !sameScope) {
        throw new BriefPilotScopeLockedError("A pilot agreement is recorded. Agree scope changes with Blueprint and the deployment company before changing this brief.");
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
      // Fresh transaction reads still fence concurrent edits. A no-op leaves
      // timestamps, pending coverage, allowances and advisory jobs alone.
      if (reuseConfirmation) {
        if (requestSnapshot.exists && !requestSnapshot.data()?.site_task_brief_confirmed_at) {
          tx.set(requestRef, { site_task_brief_confirmed_at: brief.confirmedAtIso }, { merge: true });
        }
        return;
      }
      const materialChange = humanDecisionDigest({ summary: brief.summary, taskFamily: brief.taskFamily ?? null, answers: gateAnswersOnFile(previousRequest ?? {}),
        unknown: [...(brief.operatorUnknown ?? [])].sort(), success: brief.successCriteria ?? null }) !== humanDecisionDigest({ summary: confirmed.summary, taskFamily: confirmed.taskFamily ?? null, answers,
        unknown: [...unknown].sort(), success: confirmed.successCriteria ?? null });
      const nextRecord = { ...requestSnapshot.data(), siteTaskGates: answers };
      const refresh = requestSnapshot.data()?.site_advisory
        ? await (await import("./siteAssessmentQueue")).prepareBriefContextSiteAssessment(
          tx, params.requestId, nextRecord, confirmed) : null;
      tx.set(briefRef, confirmed, { merge: true });
      tx.set(requestRef,
        {
          ...(requestSnapshot.data()?.capture_coverage_request ? { capture_coverage_pending: true } : {}),
          ...projection.jobFields,
          ...(materialChange && requestSnapshot.data()?.public_task_listing
            && ["cycleTarget", "pilotConditions", "targeting"].some(field => Boolean(requestSnapshot.data()!.public_task_listing.details?.[field])) ? {
            public_task_listing: { ...requestSnapshot.data()!.public_task_listing, enabled: false, reviewRequired: true },
          } : {}),
          ...(materialChange && requestSnapshot.data()?.pilot_recommendation ? {
            pilot_recommendation: { ...requestSnapshot.data()!.pilot_recommendation, reviewRequired: true },
          } : {}),
        },
        { merge: true },
      );
      refresh?.();
    });
  }

  const readiness = assessReadiness({
    answers,
    captureMode: brief.captureMode,
    briefDrafted: true,
    briefConfirmed: true,
    evidence,
    reconstructed: false,
    disclosedUnknown: projection.disclosedUnknown,
  });

  logger.info(
    {
      requestId: params.requestId,
      disposition: projection.disposition,
      answered: Object.keys(answers).length,
      unknown: [...unknown],
      stage: readiness.stage,
      taskScope: scope.supported ? scope.kind : `not_supported:${scope.reason}`,
    },
    "Site task brief confirmed by the operator",
  );

  return {
    brief: confirmed,
    reusedConfirmation: reuseConfirmation,
    answers,
    sources,
    disposition: projection.disposition,
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
  // A job confirmed at submission (2026-11-07) carries its open gates as disclosed unknowns.
  const disclose = Array.isArray(record.site_task_triage?.disclosed_unknown_field_ids);
  const disposition = verdict.blockers.length
    ? "not_now"
    : openQuestions.length || (verdict.unanswered.length && !disclose)
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
        ...(disclose ? { disclosed_unknown_field_ids: verdict.unanswered } : {}),
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

  // Share an actual held outcome. Clearing an internal screen continues
  // Blueprint's work without another account invitation or progress email.
  if (disposition === "not_now") {
    const { enqueueTaskLifecycleNotification } = await import("./taskLifecycleNotifications");
    await enqueueTaskLifecycleNotification({
      requestId: params.requestId,
      milestone: "screening_not_now",
      eventId: String(Date.now()),
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
    // A job confirmed at submission (2026-11-07) carries its open gates as disclosed unknowns.
    const disclose = Array.isArray(record.site_task_triage?.disclosed_unknown_field_ids);
    const disposition = verdict.blockers.length
      ? "not_now"
      : openQuestions.length || (verdict.unanswered.length && !disclose)
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
          ...(disclose ? { disclosed_unknown_field_ids: verdict.unanswered } : {}),
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
