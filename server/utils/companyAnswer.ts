/**
 * A deployment company's answer on a job (package E, E5): the one path that records it. Two doors call it:
 * - the answer route `POST /api/site-worlds/tasks/:taskId/interest`, for a signed-in approved deployment company;
 * - the signed internal route `POST /api/internal/pipeline/test-company/answer` (`internal-test-company.ts`), for
 *   Blueprint's internal test company on an internal test job (owner, 2026-11-25), so an engineering session can answer
 *   for it again and again.
 *
 * Both re-check, inside one transaction, the whole sharing rule (`loadCompanyJobAccess`, with `internalTestCompany` for
 * the test company, which closes every real job to it) and the company, then write the answer, the company's alias on
 * the job and the site's email about it (`prepareCompanyAnswerInTransaction`), all or nothing.
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { CHARGE_MODELS, COMPANY_QUESTION_LIMIT, COMPANY_START_WINDOWS, ESTIMATE_RULE, INTRODUCIBLE_RESPONSE_STATES, SIMILAR_JOBS,
  TESTED_RESPONSE_STATES, VISIT_NOTE_LIMIT, isApplicationEstimate, isEstimateAmount, type CompanyResponseState }
  from "../../client/src/lib/companyResponses";
import { humanDecisionDigest } from "./human-reply-admission";
import { loadCompanyJobAccess } from "./teamJobAccess";
import { companyMaySeeJobs } from "./companyTerms";
import { isInternalTestCompanyRow } from "./internalTestCompany";
import { firstAnswerTimestamp, firstApplicationTimestamp, prepareCompanyAnswerInTransaction } from "./jobCompanies";
import { captureUploadUrlFor } from "./captureUploadToken";
import { recordReplyWindow } from "./siteReplyReminders";
import { questionOnReply } from "./jobClarifications";

/** An answer's details, as the job page's form sends them. */
export const companyAnswerDetailsSchema = z.object({
  verified: z.string().trim().min(1).max(COMPANY_QUESTION_LIMIT).optional(),
  question: z.string().trim().min(4).max(COMPANY_QUESTION_LIMIT).optional(),
  startWindow: z.enum(COMPANY_START_WINDOWS).optional(),
  // An application at a glance (owner, 2026-11-23): how the company charges, an optional estimate before a site visit
  // in US dollars and cents (never a quote), how many similar jobs it has done, and what a visit must confirm.
  chargeModel: z.enum(CHARGE_MODELS).optional(),
  estimate: z.object({ lowUsd: z.number().refine(value => isEstimateAmount(value)), highUsd: z.number().refine(value => isEstimateAmount(value)) })
    .strict().refine(value => value.lowUsd <= value.highUsd).optional(),
  similarJobs: z.enum(SIMILAR_JOBS).optional(),
  visitMustConfirm: z.string().trim().min(1).max(VISIT_NOTE_LIMIT).optional(),
}).strict().refine(value => !value.estimate || (value.chargeModel !== undefined && value.chargeModel !== "undecided"))
  // Each way of charging has its own ceiling (stress test round 2, 2026-11-24: "$41,555,501.99 an hour").
  .superRefine((value, context) => {
    if (value.estimate && value.chargeModel && value.chargeModel !== "undecided"
      && !isApplicationEstimate(value.estimate, value.chargeModel))
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["estimate"], message: ESTIMATE_RULE });
  });

export const ANSWER_JOB_NOT_SHARED = "This job is no longer shared, so it can't take responses.";
export const ANSWER_NO_SIMULATION = "This job has no simulation to test yet.";

/** The application's own fields are kept only with an application (Apply or Tested it: can do); the rest as given. */
export function applicationDetailsFor(state: CompanyResponseState, details: Record<string, unknown>): Record<string, unknown> {
  if (INTRODUCIBLE_RESPONSE_STATES.includes(state)) return details;
  const { chargeModel: _charge, estimate: _estimate, similarJobs: _similar, visitMustConfirm: _visit, ...rest } = details;
  return rest;
}

export interface CompanyAnswerInput {
  taskId: string;
  /** The company's `robotTeamAccess` id. */
  companyId: string;
  /** The company's access record as the caller read it: its name goes on the answer, its identity out of its words. */
  company: Record<string, any>;
  /** The company's address, as the answer records it. */
  email: string;
  /** Who pressed: the signed-in account's uid, or `blueprint_internal_test` for the internal route. */
  submittedBy: string;
  state: CompanyResponseState;
  inputs: string;
  statementVersion: string;
  details?: Record<string, unknown>;
  /** The caller checked that this is Blueprint's internal test company (`isInternalTestCompanyRow`). */
  internalTestCompany: boolean;
}

export type CompanyAnswerOutcome = { ok: true } | { ok: false; error: string };

/**
 * Record the answer. `ok: false` with the sentence to show when the job is not shared (for this company) or a tested
 * answer has no simulation to test; throws when the job or the company changed under the transaction.
 */
export async function recordCompanyAnswer(input: CompanyAnswerInput): Promise<CompanyAnswerOutcome> {
  if (!db) throw new Error("company_answer_store_unavailable");
  const store = db;
  const { taskId, companyId } = input;
  const options = input.internalTestCompany ? { internalTestCompany: true } : undefined;
  const ref = store.collection("inboundRequests").doc(taskId);
  const before = await loadCompanyJobAccess(taskId, undefined, undefined, options);
  if (!before.record || !before.access.listed) return { ok: false, error: ANSWER_JOB_NOT_SHARED };
  const source = before.record;
  // The two tested answers need the job's simulation package (E9).
  if (TESTED_RESPONSE_STATES.includes(input.state)) {
    const { siteWalkthroughIdentity } = await import("./siteWalkthrough");
    const { captureId } = siteWalkthroughIdentity(taskId, source);
    const { storedCompanySimulation } = await import("./websiteCompanySimulation");
    if (!storedCompanySimulation((await store.collection("captureUploadSessions").doc(captureId).get()).data(), captureId))
      return { ok: false, error: ANSWER_NO_SIMULATION };
  }
  const row = { state: input.state, inputs: input.inputs, statementVersion: input.statementVersion,
    ...(input.details && input.state !== "declined" ? { details: applicationDetailsFor(input.state, input.details) } : {}),
    email: input.email.toLowerCase(), company: input.company.company, submittedBy: input.submittedBy,
    recordedBy: "company" as const, updatedAtIso: new Date().toISOString() };
  // The company's alias on this job (package C1), assigned with its first answer: the site is told "Company A",
  // never the name. The site's email is written in the same transaction as the answer.
  const captureUrl = captureUploadUrlFor(taskId, "owner");
  await store.runTransaction(async tx => {
    const { record: current, access: now } = await loadCompanyJobAccess(taskId, undefined, tx, options);
    const company = (await tx.get(store.collection("robotTeamAccess").doc(companyId))).data();
    const mayAnswer = input.internalTestCompany ? isInternalTestCompanyRow(companyId, company) : companyMaySeeJobs(company);
    if (!current || humanDecisionDigest(current.public_task_listing) !== humanDecisionDigest(source.public_task_listing)
      || !now.listed || !mayAnswer) throw new Error("job_changed");
    const interestRef = ref.collection("robotTeamInterest").doc(companyId);
    const prior = (await tx.get(interestRef)).data();
    const priorQuestion = questionOnReply(prior), question = questionOnReply(row);
    const sameQuestion = question && priorQuestion?.text === question.text;
    const firstAppliedAtIso = firstApplicationTimestamp(prior, input.state, row.updatedAtIso);
    const next = { ...row, firstAnsweredAtIso: firstAnswerTimestamp(prior, row.updatedAtIso),
      ...(firstAppliedAtIso ? { firstAppliedAtIso } : {}),
      ...(question ? { questionId: sameQuestion ? priorQuestion.id : randomBytes(32).toString("hex") } : {}),
      // When this question was first asked, so the company's page can say how quickly the site answers.
      ...(question && !sameQuestion ? { questionAskedAtIso: row.updatedAtIso }
        : sameQuestion && typeof prior?.questionAskedAtIso === "string" ? { questionAskedAtIso: prior.questionAskedAtIso } : {}),
      ...(sameQuestion && prior?.siteClarification ? { siteClarification: prior.siteClarification } : {}) };
    if (prior && humanDecisionDigest({ ...prior, firstAnsweredAtIso: next.firstAnsweredAtIso, firstAppliedAtIso: next.firstAppliedAtIso,
      updatedAtIso: null })
      === humanDecisionDigest({ ...next, updatedAtIso: null })) return;
    const prepared = await prepareCompanyAnswerInTransaction(tx, ref, taskId, current, companyId, input.state, captureUrl);
    prepared.write();
    tx.set(interestRef, next);
    // A new question opens its reply window (`siteReplyReminders.ts`): a date for the site, and one reminder at it.
    if (question && !sameQuestion && typeof next.questionId === "string")
      recordReplyWindow(tx, { jobId: taskId, companyId, questionId: next.questionId, askedAtIso: row.updatedAtIso });
  });
  // The site reads the answer's words only once names and contact details are out of them (`companyWordsForSite`):
  // their model pass starts now, without waiting.
  void import("./jobCompanies").then(({ screenCompanyWordsInBackground }) =>
    screenCompanyWordsInBackground(taskId, companyId, row, input.company, row)).catch(() => undefined);
  return { ok: true };
}
