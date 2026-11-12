/**
 * The founder's job console: one row per site job, with its loop stage and
 * the next action. Read-only. Every write it links to goes through an
 * existing endpoint with its own checks (the recommendation form, the lead
 * page). Three writes live here. The site-measurement export keeps an
 * immutable copy of exactly what it exported, so the evidence handed to the
 * Pipeline stays recoverable. Robot fit keeps a team ranking (a model call
 * staff ask for). The export and the ranking are refused once recording
 * consent is withdrawn.
 * Deployment companies (package C1) records, by hand, which approved companies
 * Blueprint sent the job to and what each answered, and holds the job back from
 * every company when needed (`server/utils/jobCompanies.ts`). The product sends
 * nothing to a company.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAdminRole } from "../middleware/requireAdminRole";
import { logger } from "../logger";
import { JOB_STAGES } from "../utils/jobConsoleStage";
import { getJobConsoleDetail, listJobConsoleRows, PAGE_LIMIT_MAX } from "../utils/jobConsoleData";
import {
  SourceMeasurementExportError,
  buildSourceMeasurementDocument,
  getMeasurements,
  getRetainedExport,
  listRetainedExports,
  presentMeasurementsForAdmin,
  retainSourceMeasurementExport,
} from "../utils/siteTaskMeasurements";
import { RobotFitError, getAdminRobotFit, rankTeamsForJob } from "../utils/siteRobotFit";
import { loadWebsiteCaptureRights } from "../utils/websiteTaskContext";
import {
  JobCompaniesError, loadAdminJobCompanies, recordCompanyResponseByOperator, recordCompanySend, setOperatorListingHold, voidCompanySend,
  type OperatorActor,
} from "../utils/jobCompanies";

const router = Router();
router.use(requireAdminRole);

const requestId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const listQuery = z.object({
  limit: z.coerce.number().int().positive().max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_MAX),
  cursor: requestId.optional(),
  stage: z.enum(JOB_STAGES).optional(),
  q: z.string().trim().max(120).optional(),
});

router.get("/", async (req: Request, res: Response) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid job console query.", stages: JOB_STAGES });
  }
  try {
    const page = await listJobConsoleRows({ limit: parsed.data.limit, cursor: parsed.data.cursor ?? null,
      stage: parsed.data.stage ?? null, q: parsed.data.q ?? null });
    res.set("Cache-Control", "no-store");
    return res.json({ jobs: page.rows, nextCursor: page.nextCursor, scanned: page.scanned, stages: JOB_STAGES });
  } catch (error) {
    logger.error({ err: error }, "Job console list failed");
    return res.status(503).json({ error: "The job console is unavailable. Try again." });
  }
});

router.get("/:requestId", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  if (!parsed.success) return res.status(400).json({ error: "Invalid job id." });
  try {
    const detail = await getJobConsoleDetail(parsed.data);
    if (!detail) return res.status(404).json({ error: "Site job not found." });
    res.set("Cache-Control", "no-store");
    return res.json(detail);
  } catch (error) {
    logger.error({ err: error, requestId: parsed.data }, "Job console detail failed");
    return res.status(503).json({ error: "The job detail is unavailable. Try again." });
  }
});

/**
 * The site's recorded readings, with SI values, provenance and what they cannot
 * fill; whether recording consent was withdrawn; and the exports retained so far.
 */
router.get("/:requestId/site-measurements", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  if (!parsed.success) return res.status(400).json({ error: "Invalid job id." });
  try {
    const [record, rights, exports] = await Promise.all([
      getMeasurements(parsed.data),
      loadWebsiteCaptureRights(parsed.data),
      listRetainedExports(parsed.data),
    ]);
    res.set("Cache-Control", "no-store");
    return res.json({ measurements: presentMeasurementsForAdmin(record), consentRevoked: rights.consent_revoked, exports });
  } catch (error) {
    logger.error({ err: error, requestId: parsed.data }, "Site measurements read failed");
    return res.status(503).json({ error: "The site measurements are unavailable. Try again." });
  }
});

const sourceDocumentBody = z.object({
  binding: z.record(z.string(), z.unknown()),
  producerId: z.string().max(192),
  calibrationSampleIds: z.array(z.string().max(64)).max(24).optional(),
}).strict();

/**
 * The source measurement document for one qualification request: exact bytes,
 * their sha256 and size, and per-check coverage, for the operator to retain as
 * the request's `measurement` artifact. The same bytes and the inputs that made
 * them are kept, immutably, under the job; refused once consent is withdrawn.
 */
router.post("/:requestId/site-measurements/source-document", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  const body = sourceDocumentBody.safeParse(req.body);
  if (!parsed.success || !body.success) {
    return res.status(400).json({ error: "Send the request binding, the producer identity and any calibration readings." });
  }
  try {
    // Like every capture-derived operation on the site's links, processing stops at withdrawal.
    const rights = await loadWebsiteCaptureRights(parsed.data);
    if (rights.consent_revoked) {
      return res.status(409).json({ code: "capture_processing_not_authorized",
        error: "Recording consent was withdrawn for this job, so its measurements cannot be exported for qualification." });
    }
    const record = await getMeasurements(parsed.data);
    if (!record) return res.status(404).json({ error: "This job has no recorded measurements." });
    const calibrationSampleIds = body.data.calibrationSampleIds ?? [];
    const exported = buildSourceMeasurementDocument(record, {
      binding: body.data.binding,
      producerId: body.data.producerId,
      calibrationSampleIds,
    });
    const actor = res.locals.firebaseUser?.uid ?? null;
    const retained = await retainSourceMeasurementExport(record, exported,
      { producerId: body.data.producerId, calibrationSampleIds }, { uid: actor });
    logger.info({ requestId: parsed.data, producerId: body.data.producerId, sha256: exported.sha256,
      sampleCount: exported.sampleCount, revision: record.revision, actor, retainedPath: retained.path,
      alreadyRetained: retained.alreadyRetained }, "Site measurement source document exported");
    res.set("Cache-Control", "no-store");
    return res.json({ ...exported, retained });
  } catch (error) {
    if (error instanceof SourceMeasurementExportError) {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    logger.error({ err: error, requestId: parsed.data }, "Site measurement export failed");
    return res.status(503).json({ error: "The source document could not be built. Try again." });
  }
});

const digestHex = z.string().regex(/^[0-9a-f]{64}$/);

/** The recovery route: a retained export's exact bytes and inputs, by its sha256 hex. */
router.get("/:requestId/site-measurements/exports/:digest", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  const digest = digestHex.safeParse(req.params.digest);
  if (!parsed.success || !digest.success) return res.status(400).json({ error: "Invalid job id or export digest." });
  try {
    const retained = await getRetainedExport(parsed.data, digest.data);
    if (!retained) return res.status(404).json({ error: "No export with that digest is retained for this job." });
    res.set("Cache-Control", "no-store");
    return res.json(retained);
  } catch (error) {
    logger.error({ err: error, requestId: parsed.data }, "Retained site measurement export read failed");
    return res.status(503).json({ error: "The retained export is unavailable. Try again." });
  }
});

function robotFitErrorResponse(res: Response, error: RobotFitError) {
  return res.status(error.code === "job_not_found" ? 404 : 409).json({ code: error.code, error: error.message });
}

/**
 * Robot fit: the job's needs and every robot form's rating (rules over the
 * site's own data, computed now) and the last team ranking (flagged stale when
 * the job or the research notes changed since).
 */
router.get("/:requestId/robot-fit", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  if (!parsed.success) return res.status(400).json({ error: "Invalid job id." });
  try {
    const fit = await getAdminRobotFit(parsed.data);
    if (!fit) return res.status(404).json({ error: "Site job not found." });
    res.set("Cache-Control", "no-store");
    return res.json(fit);
  } catch (error) {
    logger.error({ err: error, requestId: parsed.data }, "Robot fit read failed");
    return res.status(503).json({ error: "Robot fit is unavailable. Try again." });
  }
});

/** Rank researched teams for this job: one model call over every research note, each reason quote-checked. */
router.post("/:requestId/robot-fit/ranking", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  if (!parsed.success) return res.status(400).json({ error: "Invalid job id." });
  try {
    const actor = res.locals.firebaseUser?.uid ?? null;
    // A failed model run is a recorded attempt, not an HTTP error: the last good ranking stays.
    const { ranking, attempt } = await rankTeamsForJob(parsed.data, { actor });
    logger.info({ requestId: parsed.data, actor, state: attempt.state, error: attempt.error, teams: ranking?.teams.length ?? 0,
      candidates: ranking?.candidateCount ?? null, droppedReasons: ranking?.droppedReasons ?? 0, droppedTeams: ranking?.droppedTeams ?? 0 },
    "Robot fit ranking run recorded");
    res.set("Cache-Control", "no-store");
    return res.json({ ranking, attempt });
  } catch (error) {
    if (error instanceof RobotFitError) return robotFitErrorResponse(res, error);
    logger.error({ err: error, requestId: parsed.data }, "Robot fit ranking failed");
    return res.status(503).json({ error: "The team ranking could not be run. Try again." });
  }
});

/* ------------------------------------------------------- deployment companies */

function jobCompaniesErrorResponse(res: Response, error: JobCompaniesError) {
  const status = error.code === "job_not_found" || error.code === "send_not_found" ? 404
    : error.code === "store_unavailable" ? 503 : 409;
  return res.status(status).json({ code: error.code, error: error.message });
}

function operatorOf(res: Response): OperatorActor {
  const user = res.locals.firebaseUser as { uid?: string; email?: string } | undefined;
  return { uid: typeof user?.uid === "string" ? user.uid : null, email: typeof user?.email === "string" ? user.email : null };
}

/** The panel: sharing in words, the hold, the library address, approved companies, sends and answers (admin only). */
router.get("/:requestId/companies", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  if (!parsed.success) return res.status(400).json({ error: "Invalid job id." });
  try {
    const panel = await loadAdminJobCompanies(parsed.data);
    if (!panel) return res.status(404).json({ error: "Site job not found." });
    res.set("Cache-Control", "no-store");
    return res.json(panel);
  } catch (error) {
    if (error instanceof JobCompaniesError) return jobCompaniesErrorResponse(res, error);
    logger.error({ err: error, requestId: parsed.data }, "Job companies read failed");
    return res.status(503).json({ error: "Deployment companies are unavailable. Try again." });
  }
});

const companyId = z.string().regex(/^[a-f0-9]{64}$/);
const sendBody = z.object({ companyId }).strict();

/** Record that the operator sent this job's library address to an approved deployment company, from their own mailbox. */
router.post("/:requestId/companies/sends", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  const body = sendBody.safeParse(req.body);
  if (!parsed.success || !body.success) return res.status(400).json({ error: "Choose an approved deployment company." });
  try {
    const actor = operatorOf(res);
    const send = await recordCompanySend(parsed.data, body.data.companyId, actor);
    logger.info({ requestId: parsed.data, actor: actor.uid, sendId: send.sendId, alias: send.alias }, "Company send recorded");
    res.set("Cache-Control", "no-store");
    return res.json({ send });
  } catch (error) {
    if (error instanceof JobCompaniesError) return jobCompaniesErrorResponse(res, error);
    logger.error({ err: error, requestId: parsed.data }, "Company send failed");
    return res.status(503).json({ error: "The send could not be recorded. Try again." });
  }
});

const sendId = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);

/** Void a mistaken send: it stays on record and the site no longer sees it. */
router.post("/:requestId/companies/sends/:sendId/void", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  const send = sendId.safeParse(req.params.sendId);
  if (!parsed.success || !send.success || (req.body && Object.keys(req.body).length)) return res.status(400).json({ error: "Invalid send." });
  try {
    const actor = operatorOf(res);
    const voided = await voidCompanySend(parsed.data, send.data, actor);
    logger.info({ requestId: parsed.data, actor: actor.uid, sendId: send.data }, "Company send voided");
    res.set("Cache-Control", "no-store");
    return res.json({ voided });
  } catch (error) {
    if (error instanceof JobCompaniesError) return jobCompaniesErrorResponse(res, error);
    logger.error({ err: error, requestId: parsed.data }, "Company send void failed");
    return res.status(503).json({ error: "The send could not be voided. Try again." });
  }
});

const responseBody = z.object({
  companyId,
  // A tested answer is the company's own, on the job's page (E9); an operator records only the three others.
  state: z.enum(["interested", "declined", "needs_something"]),
  inputs: z.string().trim().max(2000).default(""),
}).strict();

/** Record an answer a company gave by email, about a job Blueprint sent it: their words for Blueprint only. */
router.post("/:requestId/companies/responses", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  const body = responseBody.safeParse(req.body);
  if (!parsed.success || !body.success) return res.status(400).json({ error: "Choose the company and its answer." });
  try {
    const actor = operatorOf(res);
    const recorded = await recordCompanyResponseByOperator(parsed.data, { companyId: body.data.companyId, state: body.data.state,
      inputs: body.data.inputs }, actor);
    logger.info({ requestId: parsed.data, actor: actor.uid, alias: recorded.alias, state: body.data.state }, "Company response recorded by operator");
    res.set("Cache-Control", "no-store");
    return res.json({ response: recorded });
  } catch (error) {
    if (error instanceof JobCompaniesError) return jobCompaniesErrorResponse(res, error);
    logger.error({ err: error, requestId: parsed.data }, "Company response record failed");
    return res.status(503).json({ error: "The answer could not be recorded. Try again." });
  }
});

const holdBody = z.object({ held: z.boolean(), reason: z.string().trim().max(500).optional() }).strict();

/** "Stop showing this job to companies" / "Show again": Blueprint's own hold, read by `teamJobAccess`. */
router.post("/:requestId/companies/hold", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  const body = holdBody.safeParse(req.body);
  if (!parsed.success || !body.success) return res.status(400).json({ error: "Send whether to stop showing this job to companies." });
  try {
    const actor = operatorOf(res);
    const hold = await setOperatorListingHold(parsed.data, body.data.held, body.data.reason || null, actor);
    logger.info({ requestId: parsed.data, actor: actor.uid, held: hold.held }, "Operator listing hold changed");
    res.set("Cache-Control", "no-store");
    return res.json({ hold });
  } catch (error) {
    if (error instanceof JobCompaniesError) return jobCompaniesErrorResponse(res, error);
    logger.error({ err: error, requestId: parsed.data }, "Operator listing hold change failed");
    return res.status(503).json({ error: "The hold could not be changed. Try again." });
  }
});

export default router;
