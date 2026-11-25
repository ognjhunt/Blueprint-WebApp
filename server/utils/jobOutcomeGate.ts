/**
 * When an outcome question is owed (PACKAGE_E E8), as pure rules plus the dispatch check the outbox
 * runs before it sends one. Kept apart from `jobOutcomes.ts` so `captureOutbox.ts` can import the
 * check without an import cycle.
 *
 * A question is owed 14, 45 and 90 days after the introduction (the dates `AGENTS.md` states), once per side per date;
 * none to a side once it answered "Not going ahead" (or, while it was offered, "Installed") itself (the other side's
 * answer never ends its questions), and none after the site withdrew ("Stop using my video"). A site closing its job, or
 * the job leaving the companies' list, does not end them: the introduction was already made.
 *
 * An internal test job (owner, 2026-11-25) takes questions only about its introduction to Blueprint's internal test
 * company (`introductionTakesOutcomeQuestions`); both sides of that introduction are the internal test inbox, and the
 * outbox delivers a test job's question to that inbox only (`internalTestRowMayBeDelivered`). An answer is never a
 * billable event and changes none.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { FINAL_OUTCOME_STATES, isNotGoingAheadReason, isOutcomeState, type NotGoingAheadReason, type OutcomeState }
  from "../../client/src/lib/jobOutcomeStates";
import { isApprovedDeploymentCompanyRecord } from "./companyTerms";
import { isInternalTestPair } from "./internalTestCompany";
import { isInternalTestJob } from "./internalTestJob";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import type { OutcomeSide } from "./jobOutcomeToken";

export const JOB_OUTCOME_QUESTION_KIND = "job_outcome_question" as const;
export const OUTCOME_QUESTION_DAYS = [14, 45, 90] as const;
export type OutcomeQuestionDay = (typeof OUTCOME_QUESTION_DAYS)[number];
export const INTRODUCTIONS_SUBCOLLECTION = "introductions";

const DAY_MS = 24 * 60 * 60 * 1000;

/** One recorded answer. `reason` only on "Not going ahead", and only when the side chose one (`NOT_GOING_AHEAD_REASONS`). */
export interface OutcomeRecord { by: OutcomeSide; state: OutcomeState; atIso: string; reason?: NotGoingAheadReason }

/** The fields of an introduction (E6) this module reads. */
export interface IntroductionLike {
  requestedAtIso?: unknown;
  siteShared?: unknown;
  companyShared?: unknown;
  outcomes?: unknown;
  /** Set when the introduction was cancelled at dispatch (G3): neither side is asked anything about it. */
  cancelledAtIso?: unknown;
}

/** The recorded answers that are well formed, in the order they were recorded. */
export function outcomesOf(introduction: IntroductionLike | null | undefined): OutcomeRecord[] {
  const list = Array.isArray(introduction?.outcomes) ? introduction!.outcomes as unknown[] : [];
  return list.filter((item): item is OutcomeRecord => Boolean(item) && typeof item === "object"
    && ((item as OutcomeRecord).by === "site" || (item as OutcomeRecord).by === "company")
    && isOutcomeState((item as OutcomeRecord).state) && typeof (item as OutcomeRecord).atIso === "string")
    // Only these fields: the stored link digest (one record per link) is never read back out.
    .map(item => ({ by: item.by, state: item.state, atIso: item.atIso,
      ...(item.state === "not_going_ahead" && isNotGoingAheadReason(item.reason) ? { reason: item.reason } : {}) }));
}

/**
 * Nothing more is asked of this side: it said "Not going ahead" (or "Installed", while offered) itself, or the
 * introduction was cancelled. Each side's questions end on its own answer, never on the other side's (stress test round 2, 2026-11-24:
 * a company's "Not going ahead" on day 14 threw away the site's "Installed" and its day-45 and day-90 questions).
 */
export function outcomeQuestionsEnded(introduction: IntroductionLike | null | undefined, side: OutcomeSide): boolean {
  if (typeof introduction?.cancelledAtIso === "string") return true;
  return outcomesOf(introduction).some(record => record.by === side && FINAL_OUTCOME_STATES.has(record.state));
}

/**
 * The question owed to this side now: the latest of 14, 45 and 90 days that has passed since the introduction, or
 * null. A date missed by the sweep is not asked late once a later one is due, so a side never gets two
 * questions at once.
 */
export function dueOutcomeQuestionDay(introduction: IntroductionLike | null | undefined, nowMs: number,
  side: OutcomeSide): OutcomeQuestionDay | null {
  if (outcomeQuestionsEnded(introduction, side)) return null;
  const startMs = typeof introduction?.requestedAtIso === "string" ? Date.parse(introduction.requestedAtIso) : NaN;
  if (!Number.isFinite(startMs)) return null;
  let due: OutcomeQuestionDay | null = null;
  for (const day of OUTCOME_QUESTION_DAYS) if (nowMs >= startMs + day * DAY_MS) due = day;
  return due;
}

/**
 * The job still takes questions: it exists, is not an internal test job, and the site has not withdrawn (a privacy stop). Whether companies
 * can still see the job does not matter here: closing it, a hold or an authority end leaves the questions owed. An
 * internal test job's introduction to the internal test company is decided by `introductionTakesOutcomeQuestions`.
 */
export async function jobTakesOutcomeQuestions(_requestId: string, record: Record<string, unknown> | null | undefined,
  _tx?: FirebaseFirestore.Transaction): Promise<boolean> {
  if (!record || isInternalTestJob(record)) return false;
  return !projectWebsiteCaptureRights(record).consent_revoked && !record.capture_withdrawal;
}

/**
 * The introduction to this company takes questions: on a real job, whenever the job does (`jobTakesOutcomeQuestions`);
 * on an internal test job, only when the company is Blueprint's internal test company (the pair, `isInternalTestPair`)
 * and the job is not withdrawn. `company` is the company's access record.
 */
export function introductionTakesOutcomeQuestions(record: Record<string, unknown> | null | undefined, companyId: string,
  company: Record<string, unknown> | null | undefined): boolean {
  if (!record || projectWebsiteCaptureRights(record).consent_revoked || record.capture_withdrawal) return false;
  return !isInternalTestJob(record) || isInternalTestPair(companyId, company, record);
}

/** The outbox document id of one question: fixed by job, company, side and date, so it is queued once. */
export function outcomeQuestionKey(requestId: string, companyId: string, side: OutcomeSide, day: OutcomeQuestionDay): string {
  return `job-outcome-question:${requestId}:${companyId}:${side}:d${day}`;
}

/** The company and side a stored key names, given the job it was queued for. */
export function parseOutcomeQuestionKey(requestId: string, key: string): { companyId: string; side: OutcomeSide; day: OutcomeQuestionDay } | null {
  const prefix = `job-outcome-question:${requestId}:`;
  if (!key.startsWith(prefix)) return null;
  const match = /^(.+):(site|company):d(14|45|90)$/.exec(key.slice(prefix.length));
  if (!match || match[1].includes("/")) return null;
  return { companyId: match[1], side: match[2] as OutcomeSide, day: Number(match[3]) as OutcomeQuestionDay };
}

/**
 * The outbox's check before it sends a row: true for every other kind; for an outcome question, true
 * only while the introduction exists, the side it goes to has given no final answer and the site has not withdrawn. On
 * an internal test job, only for its introduction to the internal test company (both sides).
 */
export async function outcomeQuestionIsCurrent(entry: { kind: string; requestId: string; idempotencyKey?: string },
  tx?: FirebaseFirestore.Transaction): Promise<boolean> {
  if (entry.kind !== JOB_OUTCOME_QUESTION_KIND) return true;
  const parsed = entry.idempotencyKey ? parseOutcomeQuestionKey(entry.requestId, entry.idempotencyKey) : null;
  if (!parsed) return false;
  if (!db) throw new Error("job_outcome_store_unavailable");
  const jobRef = db.collection("inboundRequests").doc(entry.requestId);
  const introRef = jobRef.collection(INTRODUCTIONS_SUBCOLLECTION).doc(parsed.companyId);
  const [job, intro] = tx ? [await tx.get(jobRef), await tx.get(introRef)] : [await jobRef.get(), await introRef.get()];
  if (!job.exists || !intro.exists) return false;
  const record = job.data() as Record<string, unknown>;
  const testJob = isInternalTestJob(record);
  if (parsed.side === "company" || testJob) {
    // A company is asked only while it is still an approved deployment company. A stale Terms acceptance does not
    // stop the question: it is about an introduction already made (planner, 19:50Z, G4). The site's questions are
    // unaffected by the company's state, but on a test job either side is asked only about the internal test company.
    const companyRef = db.collection("robotTeamAccess").doc(parsed.companyId);
    const company = tx ? await tx.get(companyRef) : await companyRef.get();
    const companyRecord = company.exists ? company.data() as Record<string, unknown> : null;
    if (testJob) return introductionTakesOutcomeQuestions(record, parsed.companyId, companyRecord)
      && !outcomeQuestionsEnded(intro.data() as IntroductionLike, parsed.side);
    if (!isApprovedDeploymentCompanyRecord(companyRecord)) return false;
  }
  if (!await jobTakesOutcomeQuestions(entry.requestId, record, tx)) return false;
  return !outcomeQuestionsEnded(intro.data() as IntroductionLike, parsed.side);
}
