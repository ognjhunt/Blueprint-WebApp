/**
 * The founder's job console: one row per site job, with its loop stage and
 * the next action. Read-only. Every write it links to goes through an
 * existing endpoint with its own checks (free-evaluation admission, the
 * recommendation form, the lead page). The site-measurement export is the one
 * write here: it keeps an immutable copy of exactly what it exported, so the
 * evidence handed to the Pipeline stays recoverable, and it is refused once
 * recording consent is withdrawn.
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
import { loadWebsiteCaptureRights } from "../utils/websiteTaskContext";

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

export default router;
