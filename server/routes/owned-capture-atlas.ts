/** Owner operations over retained accepted uploads; no provider/site impersonation. */
import { Router, type Response } from "express";
import { z } from "zod";
import { requireOwnedCaptureAtlasSource } from "../utils/ownedCaptureAtlasContext";
import { loadOwnedCaptureAtlasConfiguration } from "../utils/ownedCaptureAtlasPreparation";
import { ownedCaptureAtlasPreparationPlanSchema } from "../utils/reconstructionForwarding";
import { executeOwnedAtlas, retryOwnedAtlas, inspectOwnedAtlas, ownedAtlasBundleRequest } from "../utils/ownedCaptureAtlasExecution";
import { streamVerifiedPipelineArtifact } from "../utils/taskEvaluationResultArtifactProxy";

const executeCommand = z.object({ schema_version: z.literal("capture_owned_atlas_execute_command.v1"),
  idempotency_key: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{7,191}$/) }).strict();
const retryCommand = executeCommand.extend({ schema_version: z.literal("capture_owned_atlas_retry_command.v1") });

export function ownedCaptureAtlasExecutionRouter(dependencies: {
  authenticatedUser: (res: Response) => { uid?: string | null };
  readOwnedSession: (sessionId: string, ownerUid: string) => Promise<{ status: number; record?: Record<string, any> | null }>;
}) {
  const router = Router({ mergeParams: true });

  const source = async (sessionId: string, planId: string, ownerUid: string) => {
    const owned = await dependencies.readOwnedSession(sessionId, ownerUid);
    if (!owned.record) return { status: owned.status };
    const record = owned.record, control = record.pipeline_owned_atlas_preparation;
    if (control?.schema_version !== "capture_owned_atlas_preparation_control.v1") return { status: 404 };
    const plan = ownedCaptureAtlasPreparationPlanSchema.parse(control.plans?.[planId]);
    if (plan.plan_id !== planId) throw new Error("owned_capture_atlas_plan_binding_invalid");
    requireOwnedCaptureAtlasSource({ session: record, ownerUid, context: plan.source_context });
    return { status: 200, plan };
  };
  const failure = (res: Response, error: unknown) => {
    const code = error instanceof Error && /^(owned_capture_atlas_|website_atlas_|capture_revoked_or_expired$|provider_terms_not_configured_or_changed$)/.test(error.message)
      ? error.message.split(":", 1)[0] : "owned_capture_atlas_operation_unavailable";
    return res.status(code === "capture_revoked_or_expired" ? 410 : 409)
      .json({ error: "Owned Atlas preparation is unavailable", code });
  };

  for (const operation of ["execute", "retry"] as const) {
  router.post<{ sessionId: string; planId: string }>(`/:planId/${operation}`, async (req, res) => {
    const user = dependencies.authenticatedUser(res);
    if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
    const parsed = (operation === "execute" ? executeCommand : retryCommand).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Owned Atlas execution command is invalid" });
    try {
      const owned = await source(req.params.sessionId, req.params.planId, user.uid);
      if (!owned.plan) return res.status(owned.status).json({ error: "Capture reconstruction not found" });
      const plan = owned.plan;
      // Inspection is noncreating. Only the separate explicit owner authority
      // command can have established this source's original finite allowance.
      await loadOwnedCaptureAtlasConfiguration(req.params.sessionId, { plan_id: plan.plan_id,
        task_context_digest: plan.source_context.context_digest, source_video_digest: plan.source_video_digest });
      const execution = await (operation === "execute" ? executeOwnedAtlas : retryOwnedAtlas)(plan, user.uid, parsed.data.idempotency_key);
      res.set("Cache-Control", "private, no-store");
      return res.json({ schema_version: "capture_owned_atlas_execution_receipt.v1", execution });
    } catch (error) { return failure(res, error); }
  });
  }

  router.get<{ sessionId: string; planId: string }>("/:planId", async (req, res) => {
    const user = dependencies.authenticatedUser(res);
    if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
    try {
      const owned = await source(req.params.sessionId, req.params.planId, user.uid);
      if (!owned.plan) return res.status(owned.status).json({ error: "Capture reconstruction not found" });
      const execution = await inspectOwnedAtlas(owned.plan, user.uid);
      res.set("Cache-Control", "private, no-store");
      return res.json({ schema_version: "capture_owned_atlas_execution_inspection.v1", execution,
        download_available: execution.state === "ready" && execution.bundle !== null });
    } catch (error) { return failure(res, error); }
  });

  router.get<{ sessionId: string; planId: string }>("/:planId/bundle", async (req, res) => {
    const user = dependencies.authenticatedUser(res);
    if (!user.uid) return res.status(401).json({ error: "Missing authenticated user" });
    try {
      const owned = await source(req.params.sessionId, req.params.planId, user.uid);
      if (!owned.plan) return res.status(owned.status).json({ error: "Capture reconstruction not found" });
      const execution = await inspectOwnedAtlas(owned.plan, user.uid), bundle = execution.bundle;
      if (execution.state !== "ready" || !bundle) return res.status(409).json({ error: "Reconstruction bundle is not ready" });
      const origin = ownedAtlasBundleRequest(owned.plan.plan_id, user.uid, bundle.digest);
      if (!origin) return res.status(503).json({ error: "Reconstruction delivery is not configured" });
      await streamVerifiedPipelineArtifact({ endpoint: origin.url, headers: origin.headers, req, res,
        originRequest: { method: "POST", body: origin.body },
        expected: { sha256: bundle.digest, size_bytes: bundle.size_bytes }, forwardRange: false,
        label: "Reconstruction bundle", forcedHeaders: { "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${owned.plan.plan_id}.zip"` } });
    } catch (error) { if (!res.headersSent) return failure(res, error); res.destroy(); }
  });
  return router;
}
