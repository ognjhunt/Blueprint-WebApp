/** Pipeline callback only wakes canonical ledger readback; it carries no status truth. */
import express, { type Request, type RequestHandler } from "express";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { strictBoundedProofJson } from "../utils/strictBoundedProofJson";
import { syncWebsitePreparationStatus, websitePreparationSelectorSchema, type WebsitePreparationDeps } from "../utils/websitePreparationStatus";
import { readTaskTargetChoiceForPipeline, type TaskTargetChoiceDeps } from "../utils/websiteTaskTargetChoice";

type AdmittedRequest = Request & {rawBody?: string; websitePreparationBodyAdmitted?: boolean};
const callbackPath = /^\/api\/internal\/pipeline\/creator-captures\/[A-Za-z0-9][A-Za-z0-9._-]{0,131}\/(?:preparation-status|task-target-choice)\/?$/;
const rawParser = express.raw({type: "application/json", limit: 4096, inflate: false});
/** Mount beside captureOwnerRawBody before global JSON; auth/router remain after global controls. */
export const websitePreparationRawBody: RequestHandler = (req, res, next) => {
  if (req.method !== "POST" || !callbackPath.test(req.path)) return next();
  if (!req.is("application/json") || req.header("content-encoding") && req.header("content-encoding") !== "identity")
    return void res.status(415).json({code: "website_preparation_selector_invalid"});
  rawParser(req, res, error => {
    if (error || !Buffer.isBuffer(req.body) || req.body.length < 2) {
      res.status((error as {status?: number} | undefined)?.status === 413 ? 413 : 400)
        .json({code: "website_preparation_selector_invalid"}); return;
    }
    try { (req as AdmittedRequest).rawBody = new TextDecoder("utf-8", {fatal: true}).decode(req.body); }
    catch { res.status(400).json({code: "website_preparation_selector_invalid"}); return; }
    (req as AdmittedRequest).websitePreparationBodyAdmitted = true;
    next();
  });
};

export function createWebsitePreparationRouter(deps?: WebsitePreparationDeps, choiceDeps?: TaskTargetChoiceDeps) {
  const router = express.Router();
  // The Pipeline asks whether the site answered the question its parked job waits on.
  router.post("/creator-captures/:captureId/task-target-choice", createPipelineSyncRateLimiter(), async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const request = req as AdmittedRequest;
    if (!request.websitePreparationBodyAdmitted || !request.rawBody || Buffer.byteLength(request.rawBody) > 4096)
      return res.status(400).json({code: "website_task_target_choice_read_invalid"});
    if (!req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature"))
      return res.status(401).json({code: "missing_pipeline_sync_signature"});
    const auth = verifyPipelineSyncRequest(request);
    if (!auth.ok) return res.status(auth.status).json({code: auth.code});
    let raw: unknown;
    try { raw = strictBoundedProofJson(Buffer.from(request.rawBody), 4096); }
    catch { return res.status(400).json({code: "website_task_target_choice_read_invalid"}); }
    try {
      const answer = await readTaskTargetChoiceForPipeline(req.params.captureId, raw, choiceDeps);
      return answer ? res.status(200).json(answer) : res.status(404).json({code: "website_task_target_choice_pending"});
    } catch (error) {
      return (error as Error)?.name === "ZodError" || (error as Error)?.message === "task_target_choice_read_invalid"
        ? res.status(400).json({code: "website_task_target_choice_read_invalid"})
        : res.status(503).json({code: "website_task_target_choice_unavailable"});
    }
  });
  // Reuse production's captureRawBody parser, or own exact bytes when mounted without the global parser.
  router.post("/creator-captures/:captureId/preparation-status", createPipelineSyncRateLimiter(),
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const request = req as AdmittedRequest;
      if (!request.websitePreparationBodyAdmitted || !request.rawBody || Buffer.byteLength(request.rawBody) > 4096) {
        return res.status(400).json({code: "website_preparation_selector_invalid"});
      }
      if (!req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature")) {
        return res.status(401).json({code: "missing_pipeline_sync_signature"});
      }
      const auth = verifyPipelineSyncRequest(request);
      if (!auth.ok) return res.status(auth.status).json({code: auth.code});
      let selector;
      try {
        selector = websitePreparationSelectorSchema.parse(strictBoundedProofJson(Buffer.from(request.rawBody), 4096));
        if (selector.capture_id !== req.params.captureId) throw new Error("capture mismatch");
      } catch { return res.status(400).json({code: "website_preparation_selector_invalid"}); }
      try {
        const status = await syncWebsitePreparationStatus(selector, deps);
        // Sanitized reply omits all private source record/ownership/provider details. It names
        // the receipt version read, so a Pipeline that predates v2 still sees exactly v1.
        return res.status(200).json({schema_version: status.schema_version.replace("website_preparation_status.", "website_preparation_status_acceptance."),
          accepted: true, ...selector, status_digest: status.status_digest, state: status.state, native_execution_complete: false,
          correlation_id: `bp-prep-${status.status_digest.slice(7, 23)}`});
      } catch { return res.status(503).json({code: "website_preparation_status_unavailable"}); }
    });
  return router;
}
export default createWebsitePreparationRouter();
