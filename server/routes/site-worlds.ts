import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { InboundRequest } from "../types/inbound-request";
import { createHash } from "node:crypto";
import { listTaskBrowseCards, projectTaskBrowseCard, readTaskCardDetail } from "../utils/taskBrowse";
import { Response, Router } from "express";
import { companyViewerForRequest, libraryAccessForRequest } from "../utils/robotTeamLibraryAccess";
import { loadCompanyJobAccess } from "../utils/teamJobAccess";
import { loadCompanyJobPage } from "../utils/companyJobPage";
import { companyMaySeeJobs, TERMS_ACCEPTANCE_REQUIRED } from "../utils/companyTerms";
import { TERMS_PROMPT } from "../../client/src/lib/companyResponses";

import { z } from "zod";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { csrfProtection } from "../middleware/csrf";
import { accessRecordId, getAccessRecordForEmail } from "../utils/robotTeamEarlyAccess";
import { humanDecisionDigest } from "../utils/human-reply-admission";
import { COMPANY_RESPONSE_STATEMENT_VERSION, COMPANY_RESPONSE_STATES, TESTED_RESPONSE_STATES } from "../../client/src/lib/companyResponses";
import { prepareCompanyAnswerInTransaction } from "../utils/jobCompanies";
import { captureUploadUrlFor } from "../utils/captureUploadToken";
const router = Router();

/**
 * An approved deployment company that has not accepted the current Terms and Privacy Policy: 403 with its own code and
 * the prompt, and nothing of any job (not even a count).
 */
function termsRequired(res: Response, access: { gated: boolean; status: string; signedIn: boolean; emailVerified: boolean; staff: boolean }) {
  return res.status(403).json({ code: TERMS_ACCEPTANCE_REQUIRED, error: TERMS_PROMPT,
    access: { gated: access.gated, status: access.status, signedIn: access.signedIn, emailVerified: access.emailVerified,
      allowed: false, staff: access.staff, termsRequired: true } });
}
const interestSchema = z.object({ state: z.enum(COMPANY_RESPONSE_STATES),
  inputs: z.string().trim().min(4).max(2000),
  // The line the company saw under the form (E5); stored on the answer.
  statementVersion: z.literal(COMPANY_RESPONSE_STATEMENT_VERSION) }).strict();
router.post("/tasks/:taskId/interest", csrfProtection, verifyFirebaseToken, async (req, res) => {
  const input = interestSchema.safeParse(req.body), user = res.locals.firebaseUser;
  if (!input.success) return res.status(400).json({ error: "Choose an answer and add a few words about it." });
  if (!user?.email || user.email_verified !== true) return res.status(403).json({ error: "Use your approved company's verified account." });
  if (!db) return res.status(503).json({ error: "Job unavailable" });
  try {
    const access = await getAccessRecordForEmail(user.email);
    if (access?.status !== "approved" || access.partnerRole === "technology")
      return res.status(403).json({ error: "Only an approved deployment company can answer." });
    // The current Terms and Privacy Policy first (`companyTerms.ts`).
    if (!companyMaySeeJobs(access as never))
      return res.status(403).json({ error: TERMS_PROMPT, code: TERMS_ACCEPTANCE_REQUIRED });
    const taskId = String(req.params.taskId), ref = db.collection("inboundRequests").doc(taskId);
    const before = await loadCompanyJobAccess(taskId);
    if (!before.record || !before.access.listed) return res.status(409).json({ error: "This job is not open to answers." });
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
      if (prior && humanDecisionDigest({ ...prior, updatedAtIso: null }) === humanDecisionDigest({ ...row, updatedAtIso: null })) return;
      const prepared = await prepareCompanyAnswerInTransaction(tx, ref, taskId, current, companyId, input.data.state, captureUrl);
      prepared.write();
      tx.set(interestRef, row);
    });
    return res.json({ ok: true, state: input.data.state,
      nextAction: "Saved. The site is told this answer under an alias. Answering commits nobody." });
  } catch { return res.status(409).json({ error: "The job changed or the answer could not be saved. Reopen the job before trying again." }); }
});

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
    return res.json({ item: page, access });
  } catch { return res.status(503).json({ error: "This job could not be loaded." }); }
});


router.get("/tasks/:taskId/thumbnail", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Content-Type-Options", "nosniff");
  if (!db) return res.status(503).end();
  try {
    const id = String(req.params.taskId);
    // The same check as the card: a signed-in approved viewer, and the whole sharing rule. An approved deployment company
    // without the current Terms gets the same 403 as every other surface, before any job is read (G5).
    const viewerAccess = await libraryAccessForRequest(req);
    if (viewerAccess.termsRequired) return termsRequired(res, viewerAccess);
    if (!viewerAccess.allowed) return res.status(404).end();
    const { record, access } = await loadCompanyJobAccess(id);
    if (!record || !projectTaskBrowseCard(id, record as InboundRequest, access)?.thumbnailUrl) return res.status(404).end();
    const image = (await db.collection("taskThumbnails").doc(id).get()).data();
    if (!image || image.consentVersion !== "public-task-thumbnail-v1"
      || image.digest !== record.public_task_listing.thumbnailDigest) return res.status(404).end();
    const bytes = Buffer.from(image.pngBase64, "base64");
    if (createHash("sha256").update(bytes).digest("hex") !== image.digest) return res.status(404).end();
    return res.type("png").send(bytes);
  } catch { return res.status(503).end(); }
});

// Site task cards are for robot teams in early access. Anyone else gets no
// items and the access state, which the page turns into the application.
router.get("/tasks", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Vary", "Authorization");
  try {
    const access = await libraryAccessForRequest(req);
    if (access.termsRequired) return termsRequired(res, access);
    if (!access.allowed) return res.json({ items: [], access });
    return res.json({ items: await listTaskBrowseCards({ withAnswerHeadlines: true }), access });
  } catch { return res.status(503).json({ error: "The job library could not be loaded." }); }
});

// One card, for the same viewers as the library. A job that does not exist and
// one that is not listed are refused alike.
router.get("/tasks/:taskId", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Vary", "Authorization");
  try {
    const access = await libraryAccessForRequest(req);
    if (access.termsRequired) return termsRequired(res, access);
    if (!access.allowed) return res.status(404).json({ error: "This job is not in the job library." });
    const item = await readTaskCardDetail(String(req.params.taskId));
    if (!item) return res.status(404).json({ error: "This job is not in the job library." });
    return res.json({ item });
  } catch { return res.status(503).json({ error: "This job could not be loaded." }); }
});

export default router;
