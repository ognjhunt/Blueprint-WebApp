import { createHash } from "node:crypto";

import { Router, type Request, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import {
  parseVerifiedTaskDiscovery,
  pipelineTaskDiscoveryPublicationSchema,
  stableJson,
} from "../utils/taskCandidateContract";

const router = Router();
const rateLimiter = createPipelineSyncRateLimiter();

function requirePipelineSignature(req: Request, res: Response, next: () => void) {
  const result = verifyPipelineSyncRequest(req);
  if (!result.ok) {
    return res.status(result.status).json({ error: result.message, code: result.code });
  }
  next();
}

function discoveryRecordId(sessionId: string, digest: string) {
  return `task-discovery-${createHash("sha256")
    .update(`${sessionId}\u0000${digest}`)
    .digest("hex")
    .slice(0, 32)}`;
}

router.post(
  "/capture-task-discoveries",
  rateLimiter,
  requirePipelineSignature,
  async (req, res) => {
    if (!db) {
      return res.status(503).json({ error: "Capture task store is unavailable" });
    }
    const parsed = pipelineTaskDiscoveryPublicationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Pipeline task-discovery publication is invalid",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    const publication = parsed.data;
    const verified = parseVerifiedTaskDiscovery(publication.pipeline_task_discovery);
    if (!verified.ok) {
      return res.status(400).json({
        error: "Pipeline task-discovery publication failed integrity validation",
        blockers: verified.blockers,
      });
    }
    if (
      publication.discovery_digest !== verified.discovery.discovery_digest ||
      publication.intake_id !== verified.discovery.source_capture.intake_id
    ) {
      return res.status(409).json({ error: "Pipeline task-discovery binding is stale" });
    }

    const sessionRef = db.collection("captureUploadSessions").doc(
      publication.capture_session_id,
    );
    const discoveryRef = db.collection("captureTaskDiscoveries").doc(
      discoveryRecordId(publication.capture_session_id, publication.discovery_digest),
    );
    type Outcome =
      | { kind: "published" }
      | { kind: "replayed" }
      | { kind: "not_found" }
      | { kind: "intake_mismatch" }
      | { kind: "capture_digest_mismatch" }
      | { kind: "pending_command_conflict" }
      | { kind: "immutable_conflict" };
    let outcome: Outcome;
    try {
      outcome = await db.runTransaction<Outcome>(async (transaction) => {
        const sessionSnapshot = await transaction.get(sessionRef);
        const discoverySnapshot = await transaction.get(discoveryRef);
        if (!sessionSnapshot.exists) return { kind: "not_found" };
        const session = sessionSnapshot.data() as Record<string, any>;
        if (session.request?.intake_id !== publication.intake_id) {
          return { kind: "intake_mismatch" };
        }
        const addressing = session.content_addressing as
          | { status?: unknown; sha256?: unknown }
          | undefined;
        if (
          addressing?.status === "verified" &&
          addressing.sha256 !== verified.discovery.source_capture.capture_digest
        ) {
          return { kind: "capture_digest_mismatch" };
        }
        const currentDiscovery = session.pipeline_task_discovery as
          | Record<string, unknown>
          | undefined;
        if (
          session.latest_task_decision_command?.pipeline_approval_status ===
            "pending_pipeline_validation" &&
          currentDiscovery?.discovery_digest !== publication.discovery_digest
        ) {
          return { kind: "pending_command_conflict" };
        }
        const record = {
          schema_version: "capture_task_discovery_record.v1",
          capture_session_id: publication.capture_session_id,
          intake_id: publication.intake_id,
          discovery_digest: publication.discovery_digest,
          pipeline_task_discovery: verified.discovery,
          proof_boundary: publication.proof_boundary,
        };
        if (discoverySnapshot.exists) {
          const existing = discoverySnapshot.data() as Record<string, unknown>;
          if (stableJson(existing) !== stableJson(record)) {
            return { kind: "immutable_conflict" };
          }
        } else {
          transaction.create(discoveryRef, record);
        }
        transaction.set(
          sessionRef,
          {
            pipeline_task_discovery: verified.discovery,
            pipeline_task_discovery_digest: publication.discovery_digest,
            task_discovery_projection_updated_at_iso: new Date().toISOString(),
          },
          { merge: true },
        );
        return { kind: discoverySnapshot.exists ? "replayed" : "published" };
      });
    } catch {
      return res.status(503).json({ error: "Capture task store is unavailable" });
    }
    if (outcome.kind === "not_found") {
      return res.status(404).json({ error: "Capture upload not found" });
    }
    if (outcome.kind === "intake_mismatch") {
      return res.status(409).json({ error: "Capture intake binding does not match" });
    }
    if (outcome.kind === "capture_digest_mismatch") {
      return res.status(409).json({ error: "Capture digest binding does not match" });
    }
    if (outcome.kind === "pending_command_conflict") {
      return res.status(409).json({
        error: "A task decision is pending for the current discovery",
      });
    }
    if (outcome.kind === "immutable_conflict") {
      return res.status(409).json({ error: "Immutable task discovery conflicts" });
    }
    res.set("Cache-Control", "no-store");
    return res.status(outcome.kind === "replayed" ? 200 : 201).json({
      schema_version: "capture_task_discovery_publication_receipt.v1",
      status: "published",
      already_exists: outcome.kind === "replayed",
      capture_session_id: publication.capture_session_id,
      intake_id: publication.intake_id,
      discovery_digest: publication.discovery_digest,
      proof_boundary: publication.proof_boundary,
    });
  },
);

export default router;
