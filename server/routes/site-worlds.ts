import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { InboundRequest } from "../types/inbound-request";
import { createHash } from "node:crypto";
import { listTaskBrowseCards, projectTaskBrowseCard, readTaskCardDetail } from "../utils/taskBrowse";
import { Request, Response, Router } from "express";
import { companyViewerForRequest, libraryAccessForRequest, type CompanyViewer } from "../utils/robotTeamLibraryAccess";
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
import { ESTIMATE_RULE, VISIT_NOTE_LIMIT } from "../../client/src/lib/companyResponses";
import { COMPANY_QUESTION_LIMIT, COMPANY_RESPONSE_FORM_STATEMENT_VERSIONS, COMPANY_RESPONSE_STATES, FIT_RESPONSE_STATES, INTRODUCIBLE_RESPONSE_STATES, companyResponseNeedsNote, type CompanyResponseState } from "../../client/src/lib/companyResponses";
import { companyAnswerDetailsSchema, recordCompanyAnswer } from "../utils/companyAnswer";
import { hasInternalTestCompanyMarker, isInternalTestCompanyRow, loadIsInternalTestCompany } from "../utils/internalTestCompany";
import { recordCompanyJobView } from "../utils/companyJobViews";
import { companyJobSummaryPdf } from "../utils/companyJobSummary";
import { companyJobUrl } from "../utils/jobCompanies";
import { jobSummaryFileName } from "../../client/src/lib/companyJobPage";
import type { CompanyJobPage } from "../../client/src/types/taskBrowse";
import { PILOT_CONFIRM_FAILED, PILOT_OFFER_STATEMENT, PILOT_OFFER_STATEMENT_VERSION } from "../../client/src/lib/pilotOffers";
import { askForSimulation } from "../utils/simulationRequest";
import { SIMULATION_ASK_FAILED } from "../../client/src/lib/simulationRequest";
import { confirmPilotRequest, pilotOfferInputSchema, pilotOfferRefusal, readPilotOffer, savePilotOffer } from "../utils/pilotOffers";
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
// Only an answer the form offers (owner, 2026-11-25): a tested answer can no longer be given, though a stored one still
// reads (stress test, 2026-11-27: a "Tested it: can do" sent to this route was accepted and shown to the site).
const interestSchema = z.object({ state: z.enum(COMPANY_RESPONSE_STATES).refine(state => FIT_RESPONSE_STATES.includes(state)),
  inputs: z.string().trim().max(2000),
  details: companyAnswerDetailsSchema.optional(),
  // The line the company saw under the form (E5); stored on the answer.
  statementVersion: z.enum(COMPANY_RESPONSE_FORM_STATEMENT_VERSIONS) }).strict();
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
    const companyId = accessRecordId(user.email);
    // Blueprint's internal test company answers internal test jobs only, and no Terms are asked of it: it is Blueprint's
    // own (`internalTestCompany.ts`). `recordCompanyAnswer` closes every real job to it.
    const internalTestCompany = isInternalTestCompanyRow(companyId, access);
    if (!internalTestCompany && (access?.status !== "approved" || access.partnerRole === "technology" || hasInternalTestCompanyMarker(access)))
      return res.status(403).json({ error: "Only an approved deployment company can answer." });
    // The current Terms and Privacy Policy first (`companyTerms.ts`).
    if (!internalTestCompany && !companyMaySeeJobs(access as never))
      return res.status(403).json({ error: TERMS_PROMPT, code: TERMS_ACCEPTANCE_REQUIRED });
    const taskId = String(req.params.taskId);
    const result = await recordCompanyAnswer({ taskId, companyId, company: access as unknown as Record<string, any>,
      email: user.email, submittedBy: user.uid, state: input.data.state, inputs: input.data.inputs,
      statementVersion: input.data.statementVersion, details: input.data.details, internalTestCompany });
    if (!result.ok) return res.status(409).json({ error: result.error });
    return res.json({ ok: true, state: input.data.state, nextAction: answerNextStep(input.data.state) });
  } catch { return res.status(409).json({ error: "The job changed or the answer could not be saved. Reopen the job before trying again." }); }
});

/**
 * "Ask for a simulation" (owner, 2026-11-28; `simulationRequest.ts`): on a job whose simulation is built only when a
 * company asks, the first press asks for it for every company. The same account checks and refusals as the answer route
 * above; Blueprint's internal test company may press it on an internal test job, as it may answer one. Idempotent.
 */
const simulationRequestSchema = z.object({}).strict();
router.post("/jobs/:taskId/simulation-request", csrfProtection, verifyFirebaseToken, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const user = res.locals.firebaseUser;
  if (!simulationRequestSchema.safeParse(req.body ?? {}).success) return res.status(400).json({ error: RESPONSE_UNREADABLE });
  if (!user?.email || user.email_verified !== true) return res.status(403).json({ error: "Use your approved company's verified account." });
  if (!db) return res.status(503).json({ error: SIMULATION_ASK_FAILED });
  try {
    const access = await getAccessRecordForEmail(user.email);
    const companyId = accessRecordId(user.email);
    const internalTestCompany = isInternalTestCompanyRow(companyId, access);
    if (!internalTestCompany && (access?.status !== "approved" || access.partnerRole === "technology" || hasInternalTestCompanyMarker(access)))
      return res.status(403).json({ error: "Only an approved deployment company can ask for a simulation." });
    if (!internalTestCompany && !companyMaySeeJobs(access as never))
      return res.status(403).json({ error: TERMS_PROMPT, code: TERMS_ACCEPTANCE_REQUIRED });
    const result = await askForSimulation({ taskId: String(req.params.taskId), companyId, internalTestCompany });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.json({ ok: true, already: result.already, askedAtIso: result.askedAtIso, message: result.message });
  } catch { return res.status(503).json({ error: SIMULATION_ASK_FAILED }); }
});

/**
 * The signed-in account as an approved deployment company under the current Terms, refused exactly as the answer route
 * refuses (`/tasks/:taskId/interest`). Blueprint's internal test company has no pilot offer. Null once the refusal is sent.
 */
async function pilotOfferCompany(res: Response): Promise<{ companyId: string; access: Record<string, any>; email: string; uid: string } | null> {
  const user = res.locals.firebaseUser;
  if (!user?.email || user.email_verified !== true) { res.status(403).json({ error: "Use your approved company's verified account." }); return null; }
  if (!db) { res.status(503).json({ error: "Your pilot offer could not be read just now. Try again." }); return null; }
  const access = await getAccessRecordForEmail(user.email);
  const companyId = accessRecordId(user.email);
  if (access?.status !== "approved" || access.partnerRole === "technology" || hasInternalTestCompanyMarker(access)
    || isInternalTestCompanyRow(companyId, access)) {
    res.status(403).json({ error: "Only an approved deployment company can publish a pilot offer." }); return null;
  }
  if (!companyMaySeeJobs(access as never)) { res.status(403).json({ error: TERMS_PROMPT, code: TERMS_ACCEPTANCE_REQUIRED }); return null; }
  return { companyId, access: access as unknown as Record<string, any>, email: user.email, uid: user.uid };
}

/** The company's own pilot offer (owner, 2026-11-28), with the statement its form shows. */
router.get("/pilot-offer", csrfProtection, verifyFirebaseToken, async (_req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.set("Vary", "Authorization");
  try {
    const company = await pilotOfferCompany(res);
    if (!company) return;
    return res.json({ offer: await readPilotOffer(company.companyId),
      statement: { version: PILOT_OFFER_STATEMENT_VERSION, text: PILOT_OFFER_STATEMENT } });
  } catch { return res.status(503).json({ error: "Your pilot offer could not be read just now. Try again." }); }
});

/** Publish, edit or pause the company's one pilot offer. */
router.put("/pilot-offer", csrfProtection, verifyFirebaseToken, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const input = pilotOfferInputSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: pilotOfferRefusal(input.error.issues) });
  try {
    const company = await pilotOfferCompany(res);
    if (!company) return;
    const result = await savePilotOffer({ companyId: company.companyId, uid: company.uid, offer: input.data });
    if (!result.ok) return res.status(403).json({ error: "Only an approved deployment company can publish a pilot offer." });
    return res.json({ ok: true, offer: result.offer });
  } catch { return res.status(503).json({ error: "Your pilot offer could not be saved just now. Try again." }); }
});

/**
 * "Confirm" on a job whose site asked for the company's pilot: an Apply under the company's response line (the page shows
 * it beside the button and sends its version), then the introduction for the site's press (`confirmPilotRequest`).
 * Need more details and Not a fit go through `/tasks/:taskId/interest`, unchanged.
 */
const pilotConfirmSchema = z.object({ decision: z.literal("confirm"),
  statementVersion: z.enum(COMPANY_RESPONSE_FORM_STATEMENT_VERSIONS) }).strict();
router.post("/jobs/:taskId/pilot-request", csrfProtection, verifyFirebaseToken, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const input = pilotConfirmSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: input.error.issues[0]?.path[0] === "statementVersion"
    ? "The wording on this page has changed. Reload the page, read it, then confirm again." : RESPONSE_UNREADABLE });
  const user = res.locals.firebaseUser;
  if (!user?.email || user.email_verified !== true) return res.status(403).json({ error: "Use your approved company's verified account." });
  if (!db) return res.status(503).json({ error: PILOT_CONFIRM_FAILED });
  try {
    const access = await getAccessRecordForEmail(user.email);
    const companyId = accessRecordId(user.email);
    if (access?.status !== "approved" || access.partnerRole === "technology" || hasInternalTestCompanyMarker(access)
      || isInternalTestCompanyRow(companyId, access))
      return res.status(403).json({ error: "Only an approved deployment company can answer." });
    if (!companyMaySeeJobs(access as never)) return res.status(403).json({ error: TERMS_PROMPT, code: TERMS_ACCEPTANCE_REQUIRED });
    const result = await confirmPilotRequest({ taskId: String(req.params.taskId), companyId, company: access as unknown as Record<string, any>,
      email: user.email, uid: user.uid, statementVersion: input.data.statementVersion });
    if (!result.ok && result.reason === "no_request")
      return res.status(409).json({ error: "The site has not asked for your pilot on this job. Use the form to apply." });
    if (!result.ok) return res.status(409).json({ error: result.error ?? PILOT_CONFIRM_FAILED });
    return res.json({ ok: true, introduced: result.introduced, ...(result.refusal ? { refusal: result.refusal } : {}) });
  } catch { return res.status(409).json({ error: "The job changed or your confirmation could not be saved. Reopen the job before trying again." }); }
});

/** After an answer, one sentence saying what happens next. */
function answerNextStep(state: CompanyResponseState): string {
  if (INTRODUCIBLE_RESPONSE_STATES.includes(state))
    return "Saved. If the site accepts your application, we email you each other's contact details.";
  if (state === "needs_something") return "Saved. If the site answers your question, its answer shows on this page.";
  return "Saved. The site sees this answer with your company's name, and you can change it on this page.";
}

/**
 * The company's page for one job as this request's viewer may read it, under every check the page has: a signed-in
 * approved deployment company under the current Terms (or Blueprint's internal test company, on an internal test job
 * only), and the whole sharing rule, so a withdrawn site closes it (`loadCompanyJobPage`). Null once the refusal is sent.
 */
async function companyJobPageForRequest(req: Request, res: Response): Promise<{ page: CompanyJobPage; viewer: CompanyViewer;
  access: Awaited<ReturnType<typeof companyViewerForRequest>>["access"] } | null> {
  const { access, viewer } = await companyViewerForRequest(req);
  if (access.termsRequired) { termsRequired(res, access); return null; }
  // Blueprint's internal test company is shown no library, and opens an internal test job's page only: the page itself
  // reads the company and closes every real job to it (`loadCompanyJobPage`).
  const internalTestCompany = Boolean(viewer) && !access.allowed && await loadIsInternalTestCompany(db, viewer!.companyId);
  if ((!access.allowed && !internalTestCompany) || !viewer) { res.status(404).json({ error: "This job is not available.", access }); return null; }
  // A public live job's reference (`publicLiveJobRef`) opens its job for an approved company, and only for one.
  const asked = String(req.params.taskId);
  const { PUBLIC_LIVE_JOB_REF, resolvePublicLiveJobRef } = await import("../utils/taskBrowse");
  const taskId = PUBLIC_LIVE_JOB_REF.test(asked) ? await resolvePublicLiveJobRef(asked) : asked;
  const page = taskId ? await loadCompanyJobPage(taskId, { companyId: viewer.companyId }) : null;
  if (!page) { res.status(404).json({ error: "This job is not available.", access }); return null; }
  return { page, viewer, access };
}

// The company's page for one job (E3): signed-in, approved accounts only, whatever the early-access switch says.
router.get("/jobs/:taskId", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.set("Vary", "Authorization");
  try {
    const found = await companyJobPageForRequest(req, res);
    if (!found) return;
    if (!found.viewer.staff) await recordCompanyJobView(found.page.id, found.viewer.companyId);
    return res.json({ item: found.page, access: found.access });
  } catch { return res.status(503).json({ error: "This job could not be loaded." }); }
});

/**
 * "Download the job summary (PDF)" (owner, 2026-11-25): the page's words as a PDF a company can forward inside its own
 * team (`companyJobSummary.ts`), built from the very payload the page gets, under the same checks, so it holds nothing
 * the page does not show. Saved as `job-summary-<short job ref>.pdf`, a name that names nothing of the site.
 */
router.get("/jobs/:taskId/summary.pdf", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.set("Vary", "Authorization");
  res.set("X-Content-Type-Options", "nosniff");
  try {
    const found = await companyJobPageForRequest(req, res);
    if (!found) return;
    const pdf = companyJobSummaryPdf(found.page, companyJobUrl(found.page.id));
    res.status(200).set({ "Content-Type": "application/pdf", "Content-Length": String(pdf.length),
      "Content-Disposition": `attachment; filename="${jobSummaryFileName(found.page.id)}"` });
    return res.end(pdf);
  } catch { return res.status(503).json({ error: "The job summary could not be made just now. Try again." }); }
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
    // No first look on a company's list (owner, 2026-11-25: companies know robots better than a paper check does).
    const items = await listTaskBrowseCards();
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
