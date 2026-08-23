import { Router, type Request, type Response } from "express";
import { z } from "zod";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import {
  createPipelineSyncRateLimiter,
  validatePipelineArtifactUris,
  verifyPipelineSyncRequest,
} from "../utils/pipelineSyncSecurity";

const router = Router();
const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const artifact = z.object({
  artifact_id: z.string().trim().min(1).max(240),
  digest: sha256,
  uri: z.string().trim().min(1).max(1600),
}).strict();
const terminalStatus = z.object({
  schema_version: z.literal("capture_reconstruction_status.v1"),
  capture_id: z.string().trim().min(1).max(200),
  capture_digest: sha256,
  state: z.enum(["published", "abstained", "failed"]),
  arm: z.string().trim().min(1).max(120).nullable(),
  artifacts: z.array(artifact).max(100),
  blockers: z.array(z.string().trim().min(1).max(300)).max(100),
  campaign_digest: sha256.nullable(),
  completed_at: z.string().datetime(),
  appearance_fidelity_qualified: z.literal(false),
  metric_accuracy_qualified: z.literal(false),
  collision_suitability_qualified: z.literal(false),
  physical_task_success_proven: z.literal(false),
  status_digest: sha256,
}).strict();

router.post(
  "/creator-captures/:captureId/reconstruction",
  createPipelineSyncRateLimiter(),
  (req: Request, res: Response, next) => {
    const verified = verifyPipelineSyncRequest(req);
    if (!verified.ok) {
      return res.status(verified.status).json({ error: verified.message, code: verified.code });
    }
    next();
  },
  async (req, res) => {
    if (!db) return res.status(503).json({ error: "Capture store is unavailable" });
    const parsed = terminalStatus.safeParse(req.body);
    if (!parsed.success || parsed.data.capture_id !== req.params.captureId) {
      return res.status(400).json({
        error: "Reconstruction status is invalid",
        code: "capture_reconstruction_status_invalid",
      });
    }
    const status = parsed.data;
    if (
      canonicalArtifactDigest(
        status as unknown as Record<string, unknown>,
        "status_digest",
      ) !== status.status_digest
    ) {
      return res.status(400).json({
        error: "Reconstruction status digest does not match",
        code: "capture_reconstruction_status_digest_mismatch",
      });
    }
    if (
      (status.state === "published" && status.artifacts.length === 0)
      || (status.state !== "published" && status.blockers.length === 0)
    ) {
      return res.status(400).json({
        error: "Reconstruction terminal evidence is incomplete",
        code: "capture_reconstruction_terminal_evidence_incomplete",
      });
    }
    const uriViolations = validatePipelineArtifactUris(
      status as unknown as Record<string, unknown>,
    );
    if (uriViolations.length) {
      return res.status(400).json({
        error: "Reconstruction artifact URI is not admitted",
        code: "capture_reconstruction_artifact_uri_invalid",
      });
    }

    const captureRef = db.collection("creatorCaptures").doc(status.capture_id);
    type Outcome = "written" | "replayed" | "not_found" | "capture_digest_mismatch" | "terminal_conflict";
    let outcome: Outcome;
    try {
      outcome = await db.runTransaction<Outcome>(async (transaction) => {
        const snapshot = await transaction.get(captureRef);
        if (!snapshot.exists) return "not_found";
        const record = (snapshot.data() || {}) as Record<string, any>;
        const identity = record.immutable_upload_identity as Record<string, unknown> | undefined;
        if (identity?.raw_bundle_digest !== status.capture_digest) {
          return "capture_digest_mismatch";
        }
        const existing = record.reconstruction as Record<string, unknown> | undefined;
        if (existing?.status_digest === status.status_digest) return "replayed";
        if (existing?.state && ["published", "abstained", "failed"].includes(String(existing.state))) {
          return "terminal_conflict";
        }
        transaction.set(captureRef, {
          reconstruction: status,
          immutable_upload_identity: {
            ...identity,
            verification_status: "pipeline_storage_bytes_verified",
            verified_capture_digest: status.capture_digest,
          },
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return "written";
      });
    } catch {
      return res.status(503).json({ error: "Capture store is unavailable" });
    }
    if (outcome === "not_found") return res.status(404).json({ error: "Capture not found" });
    if (outcome === "capture_digest_mismatch") {
      return res.status(409).json({
        error: "Capture digest does not match accepted upload identity",
        code: "capture_reconstruction_capture_digest_mismatch",
      });
    }
    if (outcome === "terminal_conflict") {
      return res.status(409).json({
        error: "Terminal reconstruction cannot be replaced",
        code: "capture_reconstruction_terminal_conflict",
      });
    }
    res.set("Cache-Control", "no-store");
    return res.status(outcome === "replayed" ? 200 : 201).json({
      schema_version: "capture_reconstruction_status_sync_receipt.v1",
      capture_id: status.capture_id,
      capture_digest: status.capture_digest,
      status_digest: status.status_digest,
      written: outcome === "written",
      already_synced: outcome === "replayed",
    });
  },
);

export default router;
