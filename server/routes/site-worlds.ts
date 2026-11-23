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
import { COMPANY_QUESTION_LIMIT, COMPANY_RESPONSE_STATEMENT_VERSION, COMPANY_RESPONSE_STATES, COMPANY_START_WINDOWS, INTRODUCIBLE_RESPONSE_STATES, TESTED_RESPONSE_STATES, companyResponseNeedsNote, type CompanyResponseState } from "../../client/src/lib/companyResponses";
import { firstAnswerTimestamp, prepareCompanyAnswerInTransaction } from "../utils/jobCompanies";
import { captureUploadUrlFor } from "../utils/captureUploadToken";
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
  }).strict().optional(),
  // The line the company saw under the form (E5); stored on the answer.
  statementVersion: z.literal(COMPANY_RESPONSE_STATEMENT_VERSION) }).strict();
router.post("/tasks/:taskId/interest", csrfProtection, verifyFirebaseToken, async (req, res) => {
  const input = interestSchema.safeParse(req.body), user = res.locals.firebaseUser;
  if (!input.success) return res.status(400).json({ error: "Choose a response and keep your note under 2,000 characters." });
  if (companyResponseNeedsNote(input.data.state) && input.data.inputs.length < 4) {
    return res.status(400).json({ error: "Add a few words about what you need or what you tested." });
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
      ...(input.data.details && input.data.state !== "declined" ? { details: input.data.details } : {}),
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
        ...(sameQuestion && prior?.siteClarification ? { siteClarification: prior.siteClarification } : {}) };
      if (prior && humanDecisionDigest({ ...prior, firstAnsweredAtIso: next.firstAnsweredAtIso, updatedAtIso: null })
        === humanDecisionDigest({ ...next, updatedAtIso: null })) return;
      const prepared = await prepareCompanyAnswerInTransaction(tx, ref, taskId, current, companyId, input.data.state, captureUrl);
      prepared.write();
      tx.set(interestRef, next);
    });
    return res.json({ ok: true, state: input.data.state, nextAction: answerNextStep(input.data.state) });
  } catch { return res.status(409).json({ error: "The job changed or the answer could not be saved. Reopen the job before trying again." }); }
});

/** After an answer, one sentence saying what happens next. */
function answerNextStep(state: CompanyResponseState): string {
  if (INTRODUCIBLE_RESPONSE_STATES.includes(state))
    return "Saved. If the site asks to meet you, we email you both each other's name and contact details.";
  if (state === "needs_something") return "Saved. If the site answers your question, its answer shows on this page.";
  return "Saved. The site sees this answer without your company's name, and you can change it on this page.";
}

// The company's page for one job (E3): signed-in, approved accounts only, whatever the early-access switch says.
router.get("/jobs/:taskId", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.set("Vary", "Authorization");
  try {
    const { access, viewer } = await companyViewerForRequest(req);
    if (access.termsRequired) return termsRequired(res, access);
    if (!access.allowed || !viewer) return res.status(404).json({ error: "This job is not available.", access });
    const page = await loadCompanyJobPage(String(req.params.taskId), { companyId: viewer.companyId });
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
