/**
 * `POST /api/internal/pipeline/test-jobs`: an engineering session starts a whole internal test job (owner, 2026-11-15).
 *
 * The signed Pipeline call is the only door: the same signature check every internal Pipeline route uses
 * (`verifyPipelineSyncRequest`). Not open intake, so not the start form's caps, trap field or App Check.
 *
 * What it does, through the start form's own code:
 * 1. Finds the test footage: exactly one of `internal-test-footage/<footage_id>/walkthrough.mp4` or `.mov` in the
 *    existing bucket. The id is a plain slug, so the object can be nowhere else.
 * 2. Creates the job with the start form's own handler (`submitInboundRequest`), passing what a test job is instead
 *    of what a person sent: the `internal_test` marker, the `internal_test.v1` recording grant, the description as the
 *    job's sentence with its brief confirmed, and the current Privacy version recorded as Blueprint's own. No person,
 *    no address: nothing about a test job is sent to anyone (`internalTestJob.ts`).
 * 3. Copies the footage on the server into the capture's canonical path and finishes it exactly as a composed
 *    upload is finished (`landInternalTestFootage`): manifest, privacy screen, completion marker, delivery record.
 *    The frame extraction and the Pipeline hand-off then run as for a site's upload.
 *
 * The same `idempotency_key` returns the same job and creates nothing twice; the copy is itself idempotent.
 * The response names the job and its capture. A person opens a test job through the admin console.
 */
import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";

import { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { siteWalkthroughIdentity } from "../utils/siteWalkthrough";
import { PRIVACY_VERSION } from "../../client/src/lib/legalAcceptance";
import { TASK_CONFIRMATION_VERSION } from "../../client/src/lib/taskConfirmationStatement";
import { getBrief, isPlaceholderSummary } from "../utils/siteTaskBrief";
import { INTERNAL_TEST_BASIS, INTERNAL_TEST_INTAKE_LOCAL, INTERNAL_TEST_RECORDING_STATEMENT_VERSION,
  isInternalTestJob, type InternalTestIntake, type InternalTestMarker } from "../utils/internalTestJob";
import { submitInboundRequest } from "./inbound-request";
import { recordInternalTestSimulationRequest } from "../utils/simulationRequest";
import { landInternalTestFootage } from "./self-capture-uploads";
import { uploadCapLimitsBytes } from "../utils/betaAbuseCaps";
import { isAcceptedVideoHeader, VIDEO_NOT_RECOGNIZED, VIDEO_SIGNATURE_BYTES } from "../utils/videoMagicBytes";

const router = Router();
const rateLimiter = createPipelineSyncRateLimiter();

/** The same refusal as every other internal Pipeline route. */
function requirePipelineSignature(req: Request, res: Response, next: () => void) {
  const result = verifyPipelineSyncRequest(req);
  if (!result.ok) return res.status(result.status).json({ error: result.message, code: result.code });
  next();
}

/** Where test footage is kept: `internal-test-footage/<footage_id>/walkthrough.(mp4|mov)` in the existing bucket. */
const INTERNAL_TEST_FOOTAGE_PREFIX = "internal-test-footage";

/** The start form's own limit on the job's sentence (`SiteCaptureStart.tsx`, `workspace.ts`: 2000). */
const DESCRIPTION_MAX = 2000;

export const internalTestJobSchema = z.object({
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
  label: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/),
  footage_id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  description: z.string().trim().min(1).max(DESCRIPTION_MAX)
    .refine(text => !isPlaceholderSummary(text), "description_is_a_placeholder"),
  /**
   * When the test job's simulation is asked for (owner, 2026-11-28; `simulationRequest.ts`). Absent or `"now"`: the job
   * asks for its own when it is made (an `internal_test` request, pushed like a company's), so the full path still runs.
   * `"on_request"`: it waits, and Blueprint's internal test company can press "Ask for a simulation" on its page.
   */
  simulation: z.enum(["now", "on_request"]).optional(),
}).strict();

/** Who the marker says asked: the only identity this route can prove is the signature it verified. */
export const INTERNAL_TEST_CREATED_BY = "pipeline_sync_signature";

/** One job per key, and an id no form would pick by chance. */
export function internalTestJobId(idempotencyKey: string): string {
  return `itest-${createHash("sha256").update(`blueprint-internal-test-job\u0000${idempotencyKey}`).digest("hex").slice(0, 40)}`;
}

function storageBucketName() {
  return process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";
}

type Footage = { objectName: string; extension: "mp4" | "mov"; generation: string; size: number };

/** The one video under the footage's own prefix, or why there is none or it may not be used, before any job exists. */
async function findTestFootage(footageId: string): Promise<Footage | "missing" | "ambiguous" | "too_large" | "not_video"> {
  const bucket = storageAdmin!.bucket(storageBucketName());
  const found: Footage[] = [];
  for (const extension of ["mp4", "mov"] as const) {
    const objectName = `${INTERNAL_TEST_FOOTAGE_PREFIX}/${footageId}/walkthrough.${extension}`;
    try {
      const [metadata] = await bucket.file(objectName).getMetadata();
      if (metadata?.name === objectName && metadata.generation !== undefined)
        found.push({ objectName, extension, generation: String(metadata.generation), size: Number(metadata.size) });
    } catch (error) {
      if ((error as { code?: unknown })?.code !== 404) throw error;
    }
  }
  if (found.length !== 1) return found.length === 0 ? "missing" : "ambiguous";
  // No larger than one job may upload (the existing per-job cap), and a video by its header, as the upload routes check.
  if (!(found[0].size <= uploadCapLimitsBytes().perJob)) return "too_large";
  const [head] = await bucket.file(found[0].objectName, { generation: found[0].generation })
    .download({ start: 0, end: VIDEO_SIGNATURE_BYTES - 1 });
  return isAcceptedVideoHeader(head.subarray(0, VIDEO_SIGNATURE_BYTES)) ? found[0] : "not_video";
}

/** Whether the stored job is the one this call asks for: the same footage, label and description. */
async function sameAsk(requestId: string, record: Record<string, any> | undefined,
  input: { footage_id: string; label: string; description: string }): Promise<boolean> {
  return record?.internal_test?.footage_id === input.footage_id && record.internal_test.label === input.label
    && (await getBrief(requestId))?.summary === input.description;
}

/** Collects what the start form's handler answers, so this route can answer in its own shape. */
function capturedResponse(locals: Record<string, unknown>) {
  const out: { status: number; body: Record<string, any> | undefined } = { status: 500, body: undefined };
  const res = {
    locals,
    status(code: number) { out.status = code; return res; },
    json(body: Record<string, any>) { out.body = body; return res; },
    set() { return res; },
  };
  return { res: res as unknown as Response, out };
}

router.post("/test-jobs", rateLimiter, requirePipelineSignature, async (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  const parsed = internalTestJobSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ code: "internal_test_job_invalid",
      issues: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) });
  }
  if (!db || !storageAdmin) return res.status(503).json({ code: "internal_test_job_store_unavailable" });
  const input = parsed.data;
  const requestId = internalTestJobId(input.idempotency_key);
  const identity = siteWalkthroughIdentity(requestId);
  try {
    const footage = await findTestFootage(input.footage_id);
    if (footage === "missing") return res.status(404).json({ code: "internal_test_footage_not_found", footage_id: input.footage_id });
    if (footage === "ambiguous") return res.status(409).json({ code: "internal_test_footage_ambiguous", footage_id: input.footage_id });
    if (footage === "too_large") return res.status(413).json({ code: "video_too_large_for_job", footage_id: input.footage_id });
    if (footage === "not_video") return res.status(415).json({ code: VIDEO_NOT_RECOGNIZED.code, footage_id: input.footage_id });

    const existing = (await db.collection("inboundRequests").doc(requestId).get()).data();
    let created = false;
    if (existing) {
      // The same key is the same job. Anything else under this id is not ours to touch.
      if (!isInternalTestJob(existing)) return res.status(409).json({ code: "internal_test_job_id_taken" });
      if (!await sameAsk(requestId, existing, input)) return res.status(409).json({ code: "internal_test_idempotency_key_reused" });
    } else {
      const nowIso = new Date().toISOString();
      const marker: InternalTestMarker = { label: input.label, footage_id: input.footage_id, created_by: INTERNAL_TEST_CREATED_BY,
        created_at_iso: nowIso };
      const intake: InternalTestIntake = {
        consentAttestation: { granted: true, statement_version: INTERNAL_TEST_RECORDING_STATEMENT_VERSION, recorded_at_iso: nowIso,
          basis: INTERNAL_TEST_BASIS },
        // Written once, here, into the job's one create: the marker, and the Privacy version in force now (the marker
        // says it is Blueprint's own test, not a person's acceptance). The second writer of `privacy_version_at_submission`.
        recordFields: { internal_test: marker, privacy_version_at_submission: PRIVACY_VERSION },
      };
      // The start form's body, with what a test job is: its sentence (confirmed by the session that sent it), filmed
      // by itself, no person's name, address, acceptance or contact, and no share statement.
      req.body = {
        requestId,
        retryToken: createHash("sha256").update(`blueprint-internal-test-retry\u0000${input.idempotency_key}`).digest("hex"),
        buyerType: "site_operator",
        accountSignup: false,
        company: "Blueprint internal test",
        requestedLanes: [],
        taskStatement: input.description,
        taskDescription: input.description,
        taskConfirmation: { granted: true, statementVersion: TASK_CONFIRMATION_VERSION },
        siteTaskGates: {},
        siteTaskSpec: {},
        captureMode: "self_capture",
        captureRegion: "us",
        hasExistingFootage: true,
        descriptionOnly: false,
        context: { sourcePageUrl: "" },
      };
      const { res: captured, out } = capturedResponse({ [INTERNAL_TEST_INTAKE_LOCAL]: intake });
      await submitInboundRequest(req, captured);
      if (out.status !== 201 && out.status !== 200) {
        logger.warn({ requestId, status: out.status }, "An internal test job was not created");
        return res.status(out.status >= 400 && out.status < 600 ? out.status : 500)
          .json({ code: "internal_test_job_not_created", detail: out.body?.message ?? null });
      }
      created = out.status === 201;
      // A concurrent call with the same key created the job first: it is this job only if it is the same ask.
      if (!created && !await sameAsk(requestId, (await db.collection("inboundRequests").doc(requestId).get()).data(), input))
        return res.status(409).json({ code: "internal_test_idempotency_key_reused" });
    }

    // Before the footage lands, so the request is on record before the hand-off reads the job. Idempotent: a repeated
    // call with the same key asks nothing twice, and a job made before this change (without the field) asks nothing.
    if (input.simulation !== "on_request") await recordInternalTestSimulationRequest(requestId);
    const landing = await landInternalTestFootage(identity, footage);
    return res.status(created ? 201 : 200).json({
      ok: true, created,
      job_id: requestId,
      capture_id: identity.captureId,
      footage: { state: landing.body.state ?? null, code: landing.body.code ?? null, status: landing.status },
    });
  } catch (error) {
    logger.error({ requestId, error: error instanceof Error ? error.message : String(error) }, "Internal test job failed");
    return res.status(503).json({ code: "internal_test_job_unavailable", job_id: requestId });
  }
});

export default router;
