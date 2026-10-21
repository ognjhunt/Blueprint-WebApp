/**
 * The founder's job console: one row per site job, with its loop stage and
 * the next action. Read-only. Every write it links to goes through an
 * existing endpoint with its own checks (free-evaluation admission, the
 * recommendation form, the lead page). Robot asset preflight also retains
 * the caller's own configuration receipt without granting execution. The
 * site-measurement export keeps an immutable copy of exactly what it exported,
 * so the evidence handed to the Pipeline stays recoverable. Robot fit keeps a
 * team ranking (a model call staff ask for) and whether the site may see its
 * robot-form read. The export and the ranking are refused once recording
 * consent is withdrawn, and nothing new is shared with the site after that.
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
import { RobotFitError, getAdminRobotFit, rankTeamsForJob, setRobotFitSharing } from "../utils/siteRobotFit";
import { getReadinessPreview } from "../utils/siteReadiness";
import { loadWebsiteCaptureRights } from "../utils/websiteTaskContext";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptFieldValue } from "../utils/field-encryption";
import { robotEmbodimentSchema } from "../../client/src/types/robotEmbodiment";
import { robotSetupIntegrationBlocker, TEAM_POLICY_BLOCKER_MESSAGES } from "../utils/policyIntegration";
import { preflightRobotConfiguration } from "../utils/robotConfigurationPreflight";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";

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

/** Validate the caller's actual saved robot assets; no site observations or policy tokens are sent. */
router.post("/:requestId/robot-configuration/preflight", async (req, res) => {
  const parsed = requestId.safeParse(req.params.requestId);
  const body = z.object({ setupId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/) }).strict().safeParse(req.body);
  if (!parsed.success || !body.success) return res.status(400).json({ error: "Choose a saved robot configuration." });
  const caller = res.locals.firebaseUser;
  if (caller?.email_verified !== true) return res.status(403).json({ error: "Verify your email before validating a robot configuration." });
  if (!db) return res.status(503).json({ error: "Robot configuration storage is unavailable." });
  try {
    if (!await getJobConsoleDetail(parsed.data)) return res.status(404).json({ error: "Site job not found." });
    const ref = db.collection("users").doc(caller.uid).collection("robotSetups").doc(body.data.setupId);
    const saved = await ref.get();
    if (!saved.exists || !saved.data()?.payload) return res.status(404).json({ error: "Save a robot configuration on your account first." });
    const savedPayload = saved.data()!.payload;
    const setup = JSON.parse(await decryptFieldValue(savedPayload));
    const manifest = robotEmbodimentSchema.safeParse(setup.robotEmbodiment);
    const blocker = robotSetupIntegrationBlocker(setup);
    if (!manifest.success || blocker) return res.status(409).json({ error: blocker ? TEAM_POLICY_BLOCKER_MESSAGES[blocker] : "Attach the complete robot manifest first." });
    const embodimentId = setup.robotDescription?.source === "support_option" ? setup.robotDescription.embodimentId : manifest.data.embodiment_id;
    const preflight = await preflightRobotConfiguration(embodimentId, manifest.data);
    await db.runTransaction(async transaction => {
      const current = await transaction.get(ref);
      if (current.data()?.payload !== savedPayload) throw new Error("The saved robot changed during validation. Validate its current configuration again.");
      transaction.update(ref, { native_preflight: preflight, native_preflight_manifest_digest: crossRuntimeDigest(manifest.data) });
    });
    res.set("Cache-Control", "private, no-store");
    return res.json({ setupId: body.data.setupId, preflight });
  } catch (error) {
    logger.warn({ errorName: error instanceof Error ? error.name : "UnknownError", requestId: parsed.data }, "Robot configuration preflight unavailable");
    return res.status(409).json({ error: error instanceof Error && error.name === "Error" ? error.message : "Robot configuration validation could not be confirmed. The setup remains saved." });
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
 * site's own data, computed now), the last team ranking (flagged stale when the
 * job or the research notes changed since), sharing, and the exact site preview.
 */
router.get("/:requestId/robot-fit", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  if (!parsed.success) return res.status(400).json({ error: "Invalid job id." });
  try {
    const [fit, readiness] = await Promise.all([getAdminRobotFit(parsed.data), getReadinessPreview(parsed.data)]);
    if (!fit) return res.status(404).json({ error: "Site job not found." });
    res.set("Cache-Control", "no-store");
    // The readiness report as the site would see it once shared, and what the job takes today.
    return res.json({ ...fit, readiness });
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

const sharingBody = z.object({ shared: z.boolean() }).strict();

/** Show or hide the robot-form read on the owner's job page. It never names a team. */
router.post("/:requestId/robot-fit/sharing", async (req: Request, res: Response) => {
  const parsed = requestId.safeParse(req.params.requestId);
  const body = sharingBody.safeParse(req.body);
  if (!parsed.success || !body.success) return res.status(400).json({ error: "Send whether the site may see robot fit." });
  try {
    const actor = res.locals.firebaseUser?.uid ?? null;
    const sharing = await setRobotFitSharing(parsed.data, body.data.shared, { actor });
    logger.info({ requestId: parsed.data, actor, shared: sharing.shared }, "Robot fit sharing changed");
    res.set("Cache-Control", "no-store");
    return res.json({ sharing });
  } catch (error) {
    if (error instanceof RobotFitError) return robotFitErrorResponse(res, error);
    logger.error({ err: error, requestId: parsed.data }, "Robot fit sharing change failed");
    return res.status(503).json({ error: "Sharing could not be changed. Try again." });
  }
});

export default router;
