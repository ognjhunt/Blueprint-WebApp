import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { InboundRequest } from "../types/inbound-request";
import { createHash, randomBytes } from "node:crypto";
import { listTaskBrowseCards, projectTaskBrowseCard, readTaskCardDetail } from "../utils/taskBrowse";
import { Response, Router } from "express";
import { companyViewerForRequest, libraryAccessForRequest } from "../utils/robotTeamLibraryAccess";
import { loadCompanyJobAccess } from "../utils/teamJobAccess";
import { loadCompanyJobPage } from "../utils/companyJobPage";
import { JOB_THUMBNAIL_VERSION } from "../utils/jobThumbnail";
import { jobThumbnailViewUrl, verifyJobThumbnailTicket } from "../utils/jobThumbnailTicket";
import { companyMediaRefusal } from "../utils/companyJobPage";
import { siteWalkthroughIdentity } from "../utils/siteWalkthrough";
import { companyMaySeeJobs, TERMS_ACCEPTANCE_REQUIRED } from "../utils/companyTerms";
import { TERMS_PROMPT } from "../../client/src/lib/companyResponses";

import { z } from "zod";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { csrfProtection } from "../middleware/csrf";
import { accessRecordId, getAccessRecordForEmail } from "../utils/robotTeamEarlyAccess";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { CHARGE_MODELS, ESTIMATE_RULE, SIMILAR_JOBS, VISIT_NOTE_LIMIT, isApplicationEstimate, isEstimateAmount }
  from "../../client/src/lib/companyResponses";
import { COMPANY_QUESTION_LIMIT, COMPANY_RESPONSE_STATEMENT_VERSION, COMPANY_RESPONSE_STATES, COMPANY_START_WINDOWS, INTRODUCIBLE_RESPONSE_STATES, TESTED_RESPONSE_STATES, companyResponseNeedsNote, type CompanyResponseState } from "../../client/src/lib/companyResponses";
import { firstAnswerTimestamp, prepareCompanyAnswerInTransaction } from "../utils/jobCompanies";
import { captureUploadUrlFor } from "../utils/captureUploadToken";
import { recordReplyWindow } from "../utils/siteReplyReminders";
import { questionOnReply } from "../utils/jobClarifications";
import { recordCompanyJobView } from "../utils/companyJobViews";
const router = Router();

/**
 * An approved deployment company that has not accepted the current Terms and Privacy Policy: 403 with its own code and
 * the prompt, and nothing of any job (not even a count).
 */
function termsRequired(res: Response, access: { status: string; signedIn: boolean; emailVerified: boolean; staff: boolean }) {
  return res.status(403).json({ code: TERMS_ACCEPTANCE_REQUIRED, error: TERMS_PROMPT,
    access: { status: access.status, signedIn: access.signedIn, emailVerified: access.emailVerified,
      allowed: false, staff: access.staff, termsRequired: true } });
}
const interestSchema = z.object({ state: z.enum(COMPANY_RESPONSE_STATES),
  inputs: z.string().trim().max(2000),
  details: z.object({
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
    }).optional(),
  // The line the company saw under the form (E5); stored on the answer.
  statementVersion: z.literal(COMPANY_RESPONSE_STATEMENT_VERSION) }).strict();
/** A response the form cannot send as it is: unknown fields, or a page that is out of date. */
export const RESPONSE_UNREADABLE = "Your response could not be read. Reload the page and send it again.";
/**
 * Why a response was refused, naming the field that failed (stress test, 2026-11-24: every refusal used to be about the
 * note, even when the estimate or the visit note was the cause). The first failing field is named.
 */
export function interestRefusal(issues: ReadonlyArray<{ code: string; path: ReadonlyArray<PropertyKey> }>): string {
  const issue = issues[0];
  if (!issue || issue.code === "unrecognized_keys") return RESPONSE_UNREADABLE;
  const [field, detail] = issue.path;
  if (field === "state") return "Choose a response.";
  if (field === "inputs") return "Keep your note to 2,000 characters or fewer.";
  if (field === "statementVersion") return "The wording on this page has changed. Reload the page, read it, then send your response again.";
  if (field !== "details") return RESPONSE_UNREADABLE;
  switch (detail) {
    case "question": return `Write your question for the site in 4 to ${COMPANY_QUESTION_LIMIT} characters.`;
    case "verified": return `Keep what you checked to ${COMPANY_QUESTION_LIMIT} characters or fewer.`;
    case "startWindow": return "Choose the earliest start from the list.";
    case "chargeModel": return "Choose how you charge from the list.";
    case "estimate": return ESTIMATE_RULE;
    case "similarJobs": return "Choose how many similar jobs you have done from the list.";
    case "visitMustConfirm": return `Keep what a visit must confirm to ${VISIT_NOTE_LIMIT} characters or fewer.`;
    // The rule on the details as a whole: an estimate is in a unit, so it needs a way of charging that has one.
    case undefined: return "An estimate needs a way of charging. Choose how you charge, other than Not decided yet, or leave the estimate empty.";
    default: return RESPONSE_UNREADABLE;
  }
}
/**
 * The field a refusal names, for the form to mark, focus and scroll to (stress test round 2, 2026-11-24): the note
 * ("inputs") or one of the details ("estimate", "visitMustConfirm", "question", …); none for the rest.
 */
export function interestRefusalField(issues: ReadonlyArray<{ code: string; path: ReadonlyArray<PropertyKey> }>): string | null {
  const issue = issues[0];
  if (!issue || issue.code === "unrecognized_keys") return null;
  const [field, detail] = issue.path;
  if (field === "inputs") return "inputs";
  return field === "details" && typeof detail === "string" ? detail : null;
}
router.post("/tasks/:taskId/interest", csrfProtection, verifyFirebaseToken, async (req, res) => {
  const input = interestSchema.safeParse(req.body), user = res.locals.firebaseUser;
  if (!input.success) {
    const field = interestRefusalField(input.error.issues);
    return res.status(400).json({ error: interestRefusal(input.error.issues), ...(field ? { field } : {}) });
  }
  if (companyResponseNeedsNote(input.data.state) && input.data.inputs.length < 4) {
    return res.status(400).json({ error: "Add a few words about what you need or what you tested.", field: "inputs" });
  }
  if (!user?.email || user.email_verified !== true) return res.status(403).json({ error: "Use your approved company's verified account." });
  if (!db) return res.status(503).json({ error: "Your response could not be saved just now. Try again." });
  try {
    const access = await getAccessRecordForEmail(user.email);
    if (access?.status !== "approved" || access.partnerRole === "technology")
      return res.status(403).json({ error: "Only an approved deployment company can answer." });
    // The current Terms and Privacy Policy first (`companyTerms.ts`).
    if (!companyMaySeeJobs(access as never))
      return res.status(403).json({ error: TERMS_PROMPT, code: TERMS_ACCEPTANCE_REQUIRED });
    const taskId = String(req.params.taskId), ref = db.collection("inboundRequests").doc(taskId);
    const before = await loadCompanyJobAccess(taskId);
    if (!before.record || !before.access.listed) return res.status(409).json({ error: "This job is no longer shared, so it can't take responses." });
    const source = before.record;
    // The two tested answers need the job's simulation package (E9).
    if (TESTED_RESPONSE_STATES.includes(input.data.state)) {
      const { siteWalkthroughIdentity } = await import("../utils/siteWalkthrough");
      const { captureId } = siteWalkthroughIdentity(taskId, source);
      const { storedCompanySimulation } = await import("../utils/websiteCompanySimulation");
      if (!storedCompanySimulation((await db.collection("captureUploadSessions").doc(captureId).get()).data(), captureId))
        return res.status(409).json({ error: "This job has no simulation to test yet." });
    }
    const row = { state: input.data.state, inputs: input.data.inputs, statementVersion: input.data.statementVersion,
      ...(input.data.details && input.data.state !== "declined" ? { details: applicationDetailsFor(input.data.state, input.data.details) } : {}),
      email: user.email.toLowerCase(), company: access.company, submittedBy: user.uid,
      recordedBy: "company" as const, updatedAtIso: new Date().toISOString() };
    const companyId = accessRecordId(user.email);
    // The company's alias on this job (package C1), assigned with its first answer: the site is told "Company A",
    // never the name. The site's email is written in the same transaction as the answer.
    const captureUrl = captureUploadUrlFor(taskId, "owner");
    await db.runTransaction(async tx => {
      const { record: current, access: now } = await loadCompanyJobAccess(taskId, undefined, tx);
      const company = await tx.get(db!.collection("robotTeamAccess").doc(companyId));
      if (!current || humanDecisionDigest(current.public_task_listing) !== humanDecisionDigest(source.public_task_listing)
        || !now.listed || !companyMaySeeJobs(company.data())) throw new Error("job_changed");
      const interestRef = ref.collection("robotTeamInterest").doc(companyId);
      const prior = (await tx.get(interestRef)).data();
      const priorQuestion = questionOnReply(prior), question = questionOnReply(row);
      const sameQuestion = question && priorQuestion?.text === question.text;
      const next = { ...row, firstAnsweredAtIso: firstAnswerTimestamp(prior, row.updatedAtIso),
        ...(question ? { questionId: sameQuestion ? priorQuestion.id : randomBytes(32).toString("hex") } : {}),
        // When this question was first asked, so the company's page can say how quickly the site answers.
        ...(question && !sameQuestion ? { questionAskedAtIso: row.updatedAtIso }
          : sameQuestion && typeof prior?.questionAskedAtIso === "string" ? { questionAskedAtIso: prior.questionAskedAtIso } : {}),
        ...(sameQuestion && prior?.siteClarification ? { siteClarification: prior.siteClarification } : {}) };
      if (prior && humanDecisionDigest({ ...prior, firstAnsweredAtIso: next.firstAnsweredAtIso, updatedAtIso: null })
        === humanDecisionDigest({ ...next, updatedAtIso: null })) return;
      const prepared = await prepareCompanyAnswerInTransaction(tx, ref, taskId, current, companyId, input.data.state, captureUrl);
      prepared.write();
      tx.set(interestRef, next);
      // A new question opens its reply window (`siteReplyReminders.ts`): a date for the site, and one reminder at it.
      if (question && !sameQuestion && typeof next.questionId === "string")
        recordReplyWindow(tx, { jobId: taskId, companyId, questionId: next.questionId, askedAtIso: row.updatedAtIso });
    });
    // The site reads the answer's words only once names and contact details are out of them (`companyWordsForSite`):
    // their model pass starts now, without waiting.
    void import("../utils/jobCompanies").then(({ screenCompanyWordsInBackground }) =>
      screenCompanyWordsInBackground(taskId, companyId, row, access as unknown as Record<string, unknown>, row)).catch(() => undefined);
    return res.json({ ok: true, state: input.data.state, nextAction: answerNextStep(input.data.state) });
  } catch { return res.status(409).json({ error: "The job changed or the answer could not be saved. Reopen the job before trying again." }); }
});

/** The application's own fields are kept only with an application (Apply or Tested it: can do); the rest as given. */
function applicationDetailsFor(state: CompanyResponseState, details: Record<string, unknown>): Record<string, unknown> {
  if (INTRODUCIBLE_RESPONSE_STATES.includes(state)) return details;
  const { chargeModel: _charge, estimate: _estimate, similarJobs: _similar, visitMustConfirm: _visit, ...rest } = details;
  return rest;
}

/** After an answer, one sentence saying what happens next. */
function answerNextStep(state: CompanyResponseState): string {
  if (INTRODUCIBLE_RESPONSE_STATES.includes(state))
    return "Saved. If the site accepts your application, we email you each other's contact details.";
  if (state === "needs_something") return "Saved. If the site answers your question, its answer shows on this page.";
  return "Saved. The site sees this answer with your company's name, and you can change it on this page.";
}

// The company's page for one job (E3): signed-in, approved accounts only, whatever the early-access switch says.
router.get("/jobs/:taskId", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.set("Vary", "Authorization");
  try {
    const { access, viewer } = await companyViewerForRequest(req);
    if (access.termsRequired) return termsRequired(res, access);
    if (!access.allowed || !viewer) return res.status(404).json({ error: "This job is not available.", access });
    // A public live job's reference (`publicLiveJobRef`) opens its job for an approved company, and only for one.
    const asked = String(req.params.taskId);
    const { PUBLIC_LIVE_JOB_REF, resolvePublicLiveJobRef } = await import("../utils/taskBrowse");
    const taskId = PUBLIC_LIVE_JOB_REF.test(asked) ? await resolvePublicLiveJobRef(asked) : asked;
    const page = taskId ? await loadCompanyJobPage(taskId, { companyId: viewer.companyId }) : null;
    if (!page) return res.status(404).json({ error: "This job is not available.", access });
    if (!viewer.staff) await recordCompanyJobView(page.id, viewer.companyId);
    return res.json({ item: page, access });
  } catch { return res.status(503).json({ error: "This job could not be loaded." }); }
});


router.get("/tasks/:taskId/thumbnail", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  if (!db) return res.status(503).end();
  try {
    const id = String(req.params.taskId);
    // An image or a video poster sends no sign-in token: its address carries the company's ticket instead
    // (`jobThumbnailViewUrl`), and the company and the job are checked again on every read.
    const viewer = typeof req.query.viewer === "string" ? req.query.viewer : null;
    if (viewer) {
      if (!verifyJobThumbnailTicket(id, viewer, req.query.expires, req.query.signature)) return res.status(404).end();
      const { record } = await loadCompanyJobAccess(id);
      if (!record || await companyMediaRefusal(id, siteWalkthroughIdentity(id, record as Record<string, any>).captureId, viewer, record))
        return res.status(404).end();
      return await sendJobThumbnail(res, id, record as InboundRequest, "private, max-age=600");
    }
    // The same check as the card: a signed-in approved viewer, and the whole sharing rule. An approved deployment company
    // without the current Terms gets the same 403 as every other surface, before any job is read (G5).
    const viewerAccess = await libraryAccessForRequest(req);
    if (viewerAccess.termsRequired) return termsRequired(res, viewerAccess);
    if (!viewerAccess.allowed) return res.status(404).end();
    const { record, access } = await loadCompanyJobAccess(id);
    if (!record || !projectTaskBrowseCard(id, record as InboundRequest, access)?.thumbnailUrl) return res.status(404).end();
    return await sendJobThumbnail(res, id, record as InboundRequest, "no-store");
  } catch { return res.status(503).end(); }
});

/** The stored thumbnail the listing names (`jobThumbnail.ts`, or an image stored under the older listing), checked. */
async function sendJobThumbnail(res: Response, id: string, record: InboundRequest, cache: string) {
  const image = (await db!.collection("taskThumbnails").doc(id).get()).data();
  const listed = (record as unknown as Record<string, any>).public_task_listing?.thumbnailDigest;
  if (!image || (image.consentVersion !== JOB_THUMBNAIL_VERSION && image.consentVersion !== "public-task-thumbnail-v1")
    || !listed || image.digest !== listed) return res.status(404).end();
  const bytes = Buffer.from(image.pngBase64, "base64");
  if (createHash("sha256").update(bytes).digest("hex") !== image.digest) return res.status(404).end();
  res.set("Cache-Control", cache);
  return res.type("png").send(bytes);
}

/** A card's thumbnail as this company's browser can load it: the ticketed address (`jobThumbnailViewUrl`). */
function withViewerThumbnail<T extends { id: string; thumbnailUrl?: string | null }>(item: T, companyId: string | null): T {
  if (!item.thumbnailUrl) return item;
  return { ...item, thumbnailUrl: (companyId ? jobThumbnailViewUrl(item.id, companyId) : null) ?? item.thumbnailUrl };
}

// Site task cards are for robot teams in early access. Anyone else gets no
// items and the access state, which the page turns into the application.
router.get("/tasks", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Vary", "Authorization");
  try {
    const { access, viewer } = await companyViewerForRequest(req);
    if (access.termsRequired) return termsRequired(res, access);
    if (!access.allowed) return res.json({ items: [], access });
    const items = await listTaskBrowseCards({ withAnswerHeadlines: true });
    return res.json({ items: items.map(item => withViewerThumbnail(item, viewer?.companyId ?? null)), access });
  } catch { return res.status(503).json({ error: "The job library could not be loaded." }); }
});

// One card, for the same viewers as the library. A job that does not exist and
// one that is not listed are refused alike.
router.get("/tasks/:taskId", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Vary", "Authorization");
  try {
    const { access, viewer } = await companyViewerForRequest(req);
    if (access.termsRequired) return termsRequired(res, access);
    if (!access.allowed) return res.status(404).json({ error: "This job is not in the job library." });
    const item = await readTaskCardDetail(String(req.params.taskId));
    if (!item) return res.status(404).json({ error: "This job is not in the job library." });
    return res.json({ item: withViewerThumbnail(item, viewer?.companyId ?? null) });
  } catch { return res.status(503).json({ error: "This job could not be loaded." }); }
});

export default router;
