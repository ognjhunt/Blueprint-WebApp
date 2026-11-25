/**
 * The internal test company's signed doors (owner, 2026-11-25; `server/utils/internalTestCompany.ts`), so an engineering
 * session can test the company side end to end on Blueprint's own internal test jobs, again and again:
 *
 * - `POST /api/internal/pipeline/test-company` `{}`: ensures the ONE test company record, from the server setting
 *   `BLUEPRINT_INTERNAL_TEST_COMPANY_EMAIL` (503 while it is unset): approved, a deployment company, "Blueprint internal
 *   test company", source invite, and the marker. A record of a real company at that address is never taken over (409).
 * - `POST /api/internal/pipeline/test-company/send` `{ job_id }`: sends an internal test job to the test company, as the
 *   automatic send does for one company (its send row and its new-job email to the internal test inbox).
 * - `POST /api/internal/pipeline/test-company/answer` `{ job_id, state, inputs?, details? }`: records the test company's
 *   answer on an internal test job through the answer route's own path (`recordCompanyAnswer`), submitted by
 *   `blueprint_internal_test`, under the current response line.
 * - `POST /api/internal/pipeline/test-jobs/:jobId/site-link` `{}`: the site's owner link of an internal test job (and only
 *   of one), so the session can act as the site (its applicants, Accept) through the site's own token routes.
 *
 * The same signature check as every internal Pipeline route (`verifyPipelineSyncRequest`) is the only door. None of these
 * reaches a real job: each refuses a job that is not an internal test job, and the test company's every read closes real
 * jobs to it (`teamJobAccess`, `internal_test_company`).
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { COMPANY_RESPONSE_STATEMENT_VERSION, COMPANY_RESPONSE_STATES, companyResponseNeedsNote }
  from "../../client/src/lib/companyResponses";
import { companyAnswerDetailsSchema, recordCompanyAnswer } from "../utils/companyAnswer";
import { captureUploadUrlFor } from "../utils/captureUploadToken";
import { isInternalTestJob } from "../utils/internalTestJob";
import { INTERNAL_TEST_ANSWER_SUBMITTER, INTERNAL_TEST_COMPANY_CREATED_BY, INTERNAL_TEST_COMPANY_NAME, hasInternalTestCompanyMarker,
  internalTestCompanyEmail, internalTestCompanyId, loadInternalTestCompany, type InternalTestCompanyMarker }
  from "../utils/internalTestCompany";
import { ROBOT_TEAM_ACCESS_COLLECTION } from "../utils/robotTeamEarlyAccess";

const router = Router();
const rateLimiter = createPipelineSyncRateLimiter();

/** The same refusal as every other internal Pipeline route. */
function requirePipelineSignature(req: Request, res: Response, next: () => void) {
  const result = verifyPipelineSyncRequest(req);
  if (!result.ok) return res.status(result.status).json({ error: result.message, code: result.code });
  next();
}

/** A job id as the store keys it: no path separator. */
const JOB_ID = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/);
const empty = z.object({}).strict();

/** The setting and the store, or the answer that says which is missing. */
function unavailable(res: Response): Response | null {
  if (!internalTestCompanyEmail()) return res.status(503).json({ code: "internal_test_company_not_configured" });
  if (!db) return res.status(503).json({ code: "internal_test_company_store_unavailable" });
  return null;
}

const DECISION_NOTE = "Blueprint's own internal test company: it sees Blueprint's internal test jobs only (owner, 2026-11-25).";

router.post("/test-company", rateLimiter, requirePipelineSignature, async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  if (!empty.safeParse(req.body ?? {}).success) return res.status(400).json({ code: "internal_test_company_invalid" });
  const refused = unavailable(res);
  if (refused) return refused;
  const email = internalTestCompanyEmail()!, companyId = internalTestCompanyId()!;
  const store = db!;
  try {
    const result = await store.runTransaction(async tx => {
      const ref = store.collection(ROBOT_TEAM_ACCESS_COLLECTION).doc(companyId);
      const prior = (await tx.get(ref)).data() as Record<string, any> | undefined;
      // A real company's record at this address is never made the test company.
      if (prior && !hasInternalTestCompanyMarker(prior)) return { taken: true as const };
      const nowIso = new Date().toISOString();
      const priorMarker = prior?.internal_test_company;
      const marker: InternalTestCompanyMarker = priorMarker && typeof priorMarker === "object" && typeof priorMarker.created_at_iso === "string"
        && typeof priorMarker.created_by === "string" ? { created_at_iso: priorMarker.created_at_iso, created_by: priorMarker.created_by }
        : { created_at_iso: nowIso, created_by: INTERNAL_TEST_COMPANY_CREATED_BY };
      // An approval that stands keeps its decision time, so a sign-in link already emailed to the inbox still works.
      const stands = prior?.status === "approved" && typeof prior.decidedAtIso === "string" && typeof prior.decidedBy === "string";
      tx.set(ref, { ...(prior ?? {}), name: INTERNAL_TEST_COMPANY_NAME, email, company: INTERNAL_TEST_COMPANY_NAME, website: null,
        partnerRole: "deployment", source: "invite", status: "approved", newJobAlertsOptIn: prior?.newJobAlertsOptIn ?? true,
        appliedAtIso: typeof prior?.appliedAtIso === "string" ? prior.appliedAtIso : nowIso, updatedAtIso: nowIso,
        decidedAtIso: stands ? prior!.decidedAtIso : nowIso, decidedBy: stands ? prior!.decidedBy : INTERNAL_TEST_COMPANY_CREATED_BY,
        decisionNote: DECISION_NOTE, internal_test_company: marker });
      return { created: !prior };
    });
    if ("taken" in result) return res.status(409).json({ code: "internal_test_company_email_taken" });
    return res.status(result.created ? 201 : 200).json({ ok: true, created: result.created, company_id: companyId,
      company: INTERNAL_TEST_COMPANY_NAME });
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, "The internal test company could not be ensured");
    return res.status(503).json({ code: "internal_test_company_unavailable" });
  }
});

const sendSchema = z.object({ job_id: JOB_ID }).strict();

router.post("/test-company/send", rateLimiter, requirePipelineSignature, async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: "internal_test_company_send_invalid" });
  const refused = unavailable(res);
  if (refused) return refused;
  const jobId = parsed.data.job_id;
  try {
    const { sendJobToInternalTestCompany } = await import("../utils/jobAutoSend");
    const result = await sendJobToInternalTestCompany(jobId);
    if (result.sent) return res.json({ ok: true, job_id: jobId, sent: true, emailed: result.emailed, sent_at_iso: result.sentAtIso });
    switch (result.reason) {
      case "already_sent": return res.json({ ok: true, job_id: jobId, sent: false, reason: "already_sent" });
      case "no_test_company": return res.status(409).json({ code: "internal_test_company_missing" });
      case "not_found": return res.status(404).json({ code: "internal_test_job_not_found", job_id: jobId });
      case "not_a_test_job": return res.status(409).json({ code: "not_an_internal_test_job", job_id: jobId });
      case "not_listed": return res.status(409).json({ code: "internal_test_job_not_listed", job_id: jobId, reason: result.closedReason ?? null });
      default: return res.status(503).json({ code: "internal_test_company_store_unavailable" });
    }
  } catch (error) {
    logger.error({ jobId, error: error instanceof Error ? error.message : String(error) }, "An internal test job was not sent to the test company");
    return res.status(503).json({ code: "internal_test_company_send_unavailable", job_id: jobId });
  }
});

const answerSchema = z.object({ job_id: JOB_ID, state: z.enum(COMPANY_RESPONSE_STATES), inputs: z.string().trim().max(2000).default(""),
  details: companyAnswerDetailsSchema.optional() }).strict();

router.post("/test-company/answer", rateLimiter, requirePipelineSignature, async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "internal_test_company_answer_invalid",
      issues: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) });
  }
  const input = parsed.data;
  // The answer route's own rule: these answers need a few words.
  if (companyResponseNeedsNote(input.state) && input.inputs.length < 4)
    return res.status(400).json({ code: "internal_test_company_answer_needs_note" });
  const refused = unavailable(res);
  if (refused) return refused;
  const store = db!;
  try {
    const company = await loadInternalTestCompany(store);
    if (!company) return res.status(409).json({ code: "internal_test_company_missing" });
    const job = (await store.collection("inboundRequests").doc(input.job_id).get()).data();
    if (!job) return res.status(404).json({ code: "internal_test_job_not_found", job_id: input.job_id });
    // Never a real job: the test company answers internal test jobs only.
    if (!isInternalTestJob(job)) return res.status(409).json({ code: "not_an_internal_test_job", job_id: input.job_id });
    const result = await recordCompanyAnswer({ taskId: input.job_id, companyId: company.id, company: company.record,
      email: String(company.record.email), submittedBy: INTERNAL_TEST_ANSWER_SUBMITTER, state: input.state, inputs: input.inputs,
      statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION, details: input.details, internalTestCompany: true });
    if (!result.ok) return res.status(409).json({ code: "internal_test_company_answer_refused", error: result.error, job_id: input.job_id });
    return res.json({ ok: true, job_id: input.job_id, state: input.state });
  } catch (error) {
    logger.warn({ jobId: input.job_id, error: error instanceof Error ? error.message : String(error) },
      "The internal test company's answer was not saved");
    return res.status(409).json({ code: "internal_test_company_answer_not_saved", job_id: input.job_id });
  }
});

router.post("/test-jobs/:jobId/site-link", rateLimiter, requirePipelineSignature, async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const jobId = JOB_ID.safeParse(req.params.jobId);
  if (!jobId.success || !empty.safeParse(req.body ?? {}).success) return res.status(400).json({ code: "internal_test_site_link_invalid" });
  if (!db) return res.status(503).json({ code: "internal_test_job_store_unavailable" });
  try {
    const job = (await db.collection("inboundRequests").doc(jobId.data).get()).data();
    // An internal test job's link only: any other job is answered as one that does not exist.
    if (!job || !isInternalTestJob(job)) return res.status(404).json({ code: "internal_test_job_not_found", job_id: jobId.data });
    const siteUrl = captureUploadUrlFor(jobId.data, "owner");
    return res.json({ ok: true, job_id: jobId.data, site_url: siteUrl, site_token: siteUrl.split("/capture-upload/")[1] ?? null });
  } catch (error) {
    logger.error({ jobId: jobId.data, error: error instanceof Error ? error.message : String(error) }, "An internal test job's site link failed");
    return res.status(503).json({ code: "internal_test_job_unavailable", job_id: jobId.data });
  }
});

export default router;
