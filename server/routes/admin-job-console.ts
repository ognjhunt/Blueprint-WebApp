/**
 * The admin job page: one row per site job, and one job's page (`client/src/pages/AdminJobConsole.tsx`). The list and
 * the detail return what the page shows and no more (`server/utils/jobConsoleData.ts`); neither works out a status of
 * its own. Behind a verified sign-in with the admin or ops role, at the mount (`server/routes.ts`) and here.
 *
 * The page's staff tools write through the routes below, each with its own checks. The site-measurement export keeps
 * an immutable copy of exactly what it exported, so the evidence handed to the Pipeline stays recoverable; it is
 * refused once recording consent is withdrawn. Deployment companies (package C1) records, by hand, a send and what a
 * company answered by email, and holds the job back from every company when needed (`server/utils/jobCompanies.ts`).
 * Robot fit is read and ranked here for the reviewed-job form on `/admin/robot-team-access`.
 * The job brief's lessons, per kind of job, are listed for staff at `/brief-lessons`.
 * The simulation package download serves staff the same bytes a company's download serves, for any job that has a
 * package, internal test jobs included.
 * "View the simulation of the site" mints the same kind of 15-minute viewer ticket the site's own job page mints, under
 * its own domain, for any job with a stored scene preview, internal test jobs included (`websiteScenePreview.ts`).
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { requireAdminRole } from "../middleware/requireAdminRole";
import { logger } from "../logger";
import { getJobConsoleDetail, jobScenePreview, jobSimulationPackage, listJobConsoleRows, loadSiteJobRecord, PAGE_LIMIT_MAX } from "../utils/jobConsoleData";
import { billableEventsCsv, loadJobTotals } from "../utils/ownerTotals";
import { websiteScenePreviewAdminViewerUrl } from "../utils/websiteScenePreview";
import { fetchCompanySimulation, forwardableRange } from "../utils/websiteCompanySimulation";
import { sendThrough } from "./company-media";
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
  JobCompaniesError, loadAdminJobCompanies, setOperatorListingHold,
  type OperatorActor,
} from "../utils/jobCompanies";

const router = Router();
router.use(requireAdminRole);

const requestId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const listQuery = z.object({
  limit: z.coerce.number().int().positive().max(PAGE_LIMIT_MAX).default(PAGE_LIMIT_MAX),
  cursor: requestId.optional(),
}).strict();

router.get("/", async (req: Request, res: Response) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid job list query." });
  }
  try {
    const page = await listJobConsoleRows({ limit: parsed.data.limit, cursor: parsed.data.cursor ?? null });
    res.set("Cache-Control", "no-store");
    return res.json({ jobs: page.rows, nextCursor: page.nextCursor });
  } catch (error) {
    logger.error({ err: error }, "Job console list failed");
    return res.status(503).json({ error: "The job console is unavailable. Try again." });
  }
});

/** The owner's one line of totals (`server/utils/ownerTotals.ts`). Registered before `/:requestId`. */
router.get("/totals", async (_req: Request, res: Response) => {
  try {
    const totals = await loadJobTotals();
    res.set("Cache-Control", "no-store");
    return res.json(totals);
  } catch (error) {
    logger.error({ err: error }, "Job console totals failed");
    return res.status(503).json({ error: "The totals are unavailable. Try again." });
  }
});

/**
 * The job brief's lessons for each kind of job (`server/utils/jobBriefLessons.ts`): what companies asked with "Need more
 * details" and why they said "Not a fit", as checked lessons with how many companies gave each (once per company per job)
 * and when. No job, no company and no company's own words. Registered before `/:requestId`.
 */
router.get("/brief-lessons", async (_req: Request, res: Response) => {
  try {
    const { loadAllJobBriefLessons } = await import("../utils/jobBriefLessons");
    res.set("Cache-Control", "no-store");
    return res.json({ kinds: await loadAllJobBriefLessons() });
  } catch (error) {
    logger.error({ err: error }, "Job brief lessons failed");
    return res.status(503).json({ error: "The lessons are unavailable. Try again." });
  }
});

/** Every billable event as CSV: ids, times and status; no site identity, no price. */
router.get("/billable-events.csv", async (_req: Request, res: Response) => {
  try {
    const csv = await billableEventsCsv();
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Content-Disposition", 'attachment; filename="billable-events.csv"');
    return res.type("text/csv; charset=utf-8").send(csv);
  } catch (error) {
    logger.error({ err: error }, "Billable events export failed");
    return res.status(503).json({ error: "The billable events are unavailable. Try again." });
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
 * "Download the simulation package": the zip a company's download serves (`company-media.ts`), read through the same
 * signed Pipeline read and proxied straight through, ranges included, with the company download's own headers (its name
 * is the package's version, `companySimulationFileName`; the console saves it with the job's id before the version). Not
 * the company rule: an internal test job's package is served here too. A job with no package, or whose site has
 * withdrawn, answers as the company route does.
 */
router.get("/:requestId/simulation.zip", async (req: Request, res: Response) => {
  res.set("Cache-Control", "private, no-store");
  res.set("X-Content-Type-Options", "nosniff");
  const parsed = requestId.safeParse(req.params.requestId);
  if (!parsed.success) return res.status(400).json({ error: "Invalid job id." });
  const jobId = parsed.data;
  const unavailable = () => res.status(404).json({ error: "The simulation is not available.", code: "company_simulation_unavailable" });
  try {
    const record = await loadSiteJobRecord(jobId);
    if (!record) return res.status(404).json({ error: "Site job not found." });
    const reference = await jobSimulationPackage(jobId, record);
    if (!reference) return unavailable();
    const askedAtMs = Date.now();
    const read = await fetchCompanySimulation(jobId, reference, forwardableRange(req.get("range")));
    if (!read.ok) {
      if (read.status === 416) {
        if (read.contentRange) res.set("Content-Range", read.contentRange);
        return res.status(416).end();
      }
      if (read.issuerRefused) logger.error({ jobId, captureId: reference.capture_id }, "The Pipeline refused the website's signed read of a simulation package for the job console");
      if (read.status === 404) return unavailable();
      return res.status(503).json({ error: "The simulation is not available right now. Try again in a few minutes." });
    }
    logger.info({ jobId, actor: res.locals.firebaseUser?.uid ?? null, status: read.status }, "Simulation package downloaded from the job console");
    res.status(read.status).set(read.headers);
    sendThrough(read.body, res, { jobId, kind: "simulation", askedAtMs });
  } catch (error) {
    logger.warn({ err: error, jobId }, "Job console simulation package unavailable");
    if (!res.headersSent) return res.status(503).json({ error: "The simulation is not available right now. Try again in a few minutes." });
    res.destroy();
  }
});

/**
 * "View the simulation of the site": answers `{ url }`, the vendored viewer with a 15-minute ticket for this job and its
 * current capture, under the admin ticket's own domain; the admin's uid is logged here, at the mint, not carried. The console fetches it with the admin's sign-in (an address alone cannot carry it)
 * and opens the viewer; the viewer's own route serves the bytes and re-reads the site's rights on every request. A job
 * with no stored preview, whose site's grant no longer stands, or whose site has withdrawn gets no ticket. The ticket
 * is never logged.
 */
router.get("/:requestId/scene-preview-view", async (req: Request, res: Response) => {
  res.set("Cache-Control", "private, no-store");
  const parsed = requestId.safeParse(req.params.requestId);
  if (!parsed.success) return res.status(400).json({ error: "Invalid job id." });
  const jobId = parsed.data;
  const actor: string | null = res.locals.firebaseUser?.uid ?? null;
  try {
    const record = await loadSiteJobRecord(jobId);
    if (!record) return res.status(404).json({ error: "Site job not found." });
    const found = await jobScenePreview(jobId, record);
    if (!found) {
      logger.info({ jobId, actor, status: 404 }, "Simulation of the site not viewable from the job console");
      return res.status(404).json({ error: "The simulation of the site is not available.", code: "scene_preview_unavailable" });
    }
    const url = websiteScenePreviewAdminViewerUrl(jobId, found.captureId);
    if (!url) {
      logger.warn({ jobId, captureId: found.captureId, actor, status: 503 }, "Could not mint the job console's view of the simulation of the site");
      return res.status(503).json({ error: "The simulation of the site is not available right now. Try again in a few minutes." });
    }
    logger.info({ jobId, captureId: found.captureId, actor, status: 200 }, "Simulation of the site opened from the job console");
    return res.json({ url });
  } catch (error) {
    logger.warn({ err: error, jobId, actor }, "Job console view of the simulation of the site unavailable");
    return res.status(503).json({ error: "The simulation of the site is not available right now. Try again in a few minutes." });
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
  const status = error.code === "job_not_found" ? 404
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

// Stopping needs a reason (the only staff stop for a privacy or rights problem); showing again needs none.
const holdBody = z.discriminatedUnion("held", [
  z.object({ held: z.literal(true), reason: z.string().trim().min(1).max(500) }).strict(),
  z.object({ held: z.literal(false), reason: z.string().trim().max(500).optional() }).strict(),
]);

/** "Stop showing this job to companies" / "Show again": Blueprint's own hold, read by `teamJobAccess`. */
router.post("/:requestId/companies/hold", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  const body = holdBody.safeParse(req.body);
  if (!parsed.success || !body.success) return res.status(400).json({ error: "Say why this job should stop being shown to companies." });
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
