/**
 * When an outcome question is owed (PACKAGE_E E8), as pure rules plus the dispatch check the outbox
 * runs before it sends one. Kept apart from `jobOutcomes.ts` so `captureOutbox.ts` can import the
 * check without an import cycle.
 *
 * A question is owed 14, 45 and 90 days after the introduction, once per side per date; none once
 * either side answered "Installed" or "Not going ahead", none after the site withdrew, and none while
 * the job is not visible to companies (the whole E2 rule, `loadCompanyJobAccess`).
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { FINAL_OUTCOME_STATES, isOutcomeState, type OutcomeState } from "../../client/src/lib/jobOutcomeStates";
import { loadCompanyJobAccess } from "./teamJobAccess";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import type { OutcomeSide } from "./jobOutcomeToken";

export const JOB_OUTCOME_QUESTION_KIND = "job_outcome_question" as const;
export const OUTCOME_QUESTION_DAYS = [14, 45, 90] as const;
export type OutcomeQuestionDay = (typeof OUTCOME_QUESTION_DAYS)[number];
export const INTRODUCTIONS_SUBCOLLECTION = "introductions";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface OutcomeRecord { by: OutcomeSide; state: OutcomeState; atIso: string }

/** The fields of an introduction (E6) this module reads. */
export interface IntroductionLike {
  requestedAtIso?: unknown;
  siteShared?: unknown;
  companyShared?: unknown;
  outcomes?: unknown;
}

/** The recorded answers that are well formed, in the order they were recorded. */
export function outcomesOf(introduction: IntroductionLike | null | undefined): OutcomeRecord[] {
  const list = Array.isArray(introduction?.outcomes) ? introduction!.outcomes as unknown[] : [];
  return list.filter((item): item is OutcomeRecord => Boolean(item) && typeof item === "object"
    && ((item as OutcomeRecord).by === "site" || (item as OutcomeRecord).by === "company")
    && isOutcomeState((item as OutcomeRecord).state) && typeof (item as OutcomeRecord).atIso === "string");
}

/** Either side said "Installed" or "Not going ahead": nothing more is asked. */
export function outcomeQuestionsEnded(introduction: IntroductionLike | null | undefined): boolean {
  return outcomesOf(introduction).some(record => FINAL_OUTCOME_STATES.has(record.state));
}

/**
 * The question owed now: the latest of 14, 45 and 90 days that has passed since the introduction, or
 * null. A date missed by the sweep is not asked late once a later one is due, so a side never gets two
 * questions at once.
 */
export function dueOutcomeQuestionDay(introduction: IntroductionLike | null | undefined, nowMs: number): OutcomeQuestionDay | null {
  if (outcomeQuestionsEnded(introduction)) return null;
  const startMs = typeof introduction?.requestedAtIso === "string" ? Date.parse(introduction.requestedAtIso) : NaN;
  if (!Number.isFinite(startMs)) return null;
  let due: OutcomeQuestionDay | null = null;
  for (const day of OUTCOME_QUESTION_DAYS) if (nowMs >= startMs + day * DAY_MS) due = day;
  return due;
}

/**
 * The job still takes questions: the site has not withdrawn, and companies can see it under the whole
 * E2 rule (sentence, privacy screen, holds, authority end, the site closing the job). Inside a
 * transaction pass `tx` so every read participates.
 */
export async function jobTakesOutcomeQuestions(requestId: string, record: Record<string, unknown> | null | undefined,
  tx?: FirebaseFirestore.Transaction): Promise<boolean> {
  if (!record) return false;
  if (projectWebsiteCaptureRights(record).consent_revoked) return false;
  return (await loadCompanyJobAccess(requestId, record as Record<string, any>, tx)).access.listed;
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
 * only while the introduction exists, no final answer is on it, the site has not withdrawn and the
 * job is visible.
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
  if (!await jobTakesOutcomeQuestions(entry.requestId, job.data() as Record<string, unknown>, tx)) return false;
  return !outcomeQuestionsEnded(intro.data() as IntroductionLike);
}
